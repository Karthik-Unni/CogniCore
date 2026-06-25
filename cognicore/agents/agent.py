import logging
from typing import Dict, Any, List, Optional, Tuple
from cognicore.llm.client import LLMClient
from cognicore.rag.vector_store import SQLiteVectorStore
from cognicore.memory.manager import MemoryManager
from cognicore.memory.memory_types import MemoryType
from cognicore.emotions.engine import EmotionEngine
from cognicore.relationships.manager import RelationshipManager
from cognicore.goals.goal_types import Goal
from cognicore.planning.planner import Planner
from cognicore.rumors.rumor_system import RumorTracker, Rumor

logger = logging.getLogger("cognicore.agents")

class Character:
    """
    Main Character Intelligence class. Represents an autonomous NPC agent.
    """
    def __init__(self, agent_id: str, name: str, personality: Dict[str, float],
                 goals: List[Goal], vector_store: SQLiteVectorStore, 
                 llm_client: Optional[LLMClient] = None,
                 relationship_baselines: Optional[Dict[str, Dict[str, float]]] = None,
                 metadata: Optional[Dict[str, Any]] = None):
        self.id = agent_id
        self.name = name
        self.personality = personality  # e.g., {"greed": 0.9, "honesty": 0.2, "aggression": 0.5}
        self.goals = goals
        self.vector_store = vector_store
        self.llm_client = llm_client
        self.metadata = metadata or {}
        
        # Initialize sub-systems
        # Derive custom emotional baselines and decay rates from personality
        custom_baselines = {
            "anger": round(0.15 * personality.get("aggression", 0.5), 3),
            "fear": round(0.15 * (1.0 - personality.get("aggression", 0.5)), 3),
            "suspicion": round(0.1 + 0.3 * (1.0 - personality.get("honesty", 0.5)), 3),
            "happiness": round(0.5 - 0.2 * personality.get("greed", 0.5), 3),
            "trust": round(0.6 - 0.3 * (1.0 - personality.get("honesty", 0.5)), 3),
            "guilt": 0.25 if self.metadata.get("is_killer", False) else 0.0,
            "confidence": round(0.3 + 0.4 * personality.get("aggression", 0.5), 3)
        }
        
        custom_decay_rates = {
            "anger": round(0.08 + 0.04 * (1.0 - personality.get("aggression", 0.5)), 3),
            "fear": round(0.06 + 0.04 * personality.get("aggression", 0.5), 3),
            "suspicion": round(0.015 + 0.01 * personality.get("honesty", 0.5), 3),
            "happiness": round(0.04 + 0.02 * personality.get("greed", 0.5), 3),
            "trust": round(0.008 + 0.004 * (1.0 - personality.get("honesty", 0.5)), 3),
            "guilt": 0.002 if self.metadata.get("is_killer", False) else 0.005,
            "confidence": round(0.015 + 0.01 * (1.0 - personality.get("aggression", 0.5)), 3)
        }
        self.emotions = EmotionEngine(baselines=custom_baselines, decay_rates=custom_decay_rates)
        self.relationships = RelationshipManager(agent_id, relationship_baselines)
        self.memory = MemoryManager(agent_id, vector_store)
        self.rumors = RumorTracker(agent_id)
        self.planner = Planner(llm_client)

        # Execution tracking (for observability)
        self.last_reasoning = "Just initialized."
        self.last_plan: List[str] = []
        self.last_action: Dict[str, Any] = {"type": "IDLE", "target": "", "metadata": {}}

    def get_agent_state(self) -> Dict[str, Any]:
        """
        Returns a snapshot of the agent's complete current state.
        """
        return {
            "id": self.id,
            "name": self.name,
            "role": self.metadata.get("role", "Villager"),
            "is_killer": self.metadata.get("is_killer", False),
            "personality": self.personality,
            "emotions": self.emotions.get_state(),
            "relationships": self.relationships.get_all_relationships(),
            "goals": [{"id": g.id, "description": g.description, "priority": g.current_priority} for g in self.goals],
            "known_rumors": [r.model_dump() for r in self.rumors.get_rumors_to_share()],
            "secrets": [s.model_dump() for s in self.memory.get_secrets()],
            "last_reasoning": self.last_reasoning,
            "last_plan": self.last_plan,
            "last_action": self.last_action
        }

    def observe(self, description: str, emotional_weight: float = 1.0, 
                related_entities: Optional[List[str]] = None, timestamp: float = 0.0):
        """
        Observe an event in the world. Records memory and updates emotional state.
        """
        related = related_entities or []
        
        # Determine emotional impact of the observation
        # For simplicity, we calculate a standard valence update or look for trigger terms
        emotions_update = {
            "anger": 0.0, "fear": 0.0, "suspicion": 0.0, 
            "happiness": 0.0, "trust": 0.0, "guilt": 0.0, "confidence": 0.0
        }
        
        desc_lower = description.lower()
        if "murder" in desc_lower or "dead" in desc_lower or "body" in desc_lower:
            emotions_update["fear"] = 0.4 * emotional_weight
            emotions_update["suspicion"] = 0.3 * emotional_weight
            emotions_update["happiness"] = -0.2 * emotional_weight
        elif "stole" in desc_lower or "stolen" in desc_lower or "theft" in desc_lower:
            emotions_update["suspicion"] = 0.2 * emotional_weight
            emotions_update["anger"] = 0.15 * emotional_weight
        elif "threat" in desc_lower or "argue" in desc_lower:
            emotions_update["fear"] = 0.15 * emotional_weight
            emotions_update["suspicion"] = 0.15 * emotional_weight

        # Add short-term memory
        self.memory.add_memory(
            content=description,
            memory_type=MemoryType.SHORT_TERM,
            importance=int(3 * emotional_weight),
            emotional_impact=emotions_update,
            timestamp=timestamp,
            related_entities=related
        )
        
        # Apply emotional changes
        self.emotions.update_batch(emotions_update)

    def act(self, world_state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluate goals, query relevant memories, and plan the next action.
        """
        # 1. Update goal priorities based on current world and agent state
        agent_snap = self.get_agent_state()
        for goal in self.goals:
            goal.evaluate_priority(world_state, agent_snap)

        # 2. Retrieve relevant memories based on active goal
        top_goal = sorted(self.goals, key=lambda g: g.current_priority, reverse=True)[0]
        memories = self.memory.query_memories(top_goal.description, k=4)

        # 3. Create plan
        reasoning, plan_steps, action = self.planner.plan(
            agent_id=self.id,
            agent_state=agent_snap,
            active_goals=self.goals,
            relevant_memories=memories,
            world_state=world_state
        )

        # Save plans
        self.last_reasoning = reasoning
        self.last_plan = plan_steps
        self.last_action = action

        return action

    def reflect(self, timestamp: float):
        """
        Consolidates short-term memories periodically.
        """
        # Check if cache is full or run based on tick rate
        if len(self.memory.get_short_term_memories()) >= 5:
            logger.info(f"Agent {self.id} is reflecting on past events.")
            self.memory.consolidate_memories(self.llm_client, timestamp)
            # Decays emotions slightly on reflection
            self.emotions.tick(ticks=1.0)
