import json
import logging
from typing import Dict, Any, List, Tuple, Optional
from cognicore.llm.client import LLMClient

logger = logging.getLogger("cognicore.planning")

class Planner:
    """
    Main planning system. Generates reasoning, list of future sub-tasks,
    and the next action using either LLM prompts or utility-based rules.
    """
    def __init__(self, llm_client: Optional[LLMClient] = None):
        self.llm_client = llm_client

    def plan(self, agent_id: str, agent_state: Dict[str, Any], active_goals: List[Any], 
             relevant_memories: List[Any], world_state: Dict[str, Any]) -> Tuple[str, List[str], Dict[str, Any]]:
        """
        Calculates the plan.
        Returns:
            reasoning (str): Explanation of decision-making.
            sub_tasks (List[str]): Sequence of steps.
            next_action (Dict[str, Any]): Next action dictionary.
        """
        # Pick top goal
        if not active_goals:
            # Default fallback goal
            top_goal = {"id": "idle", "description": "Linger around the village"}
        else:
            sorted_goals = sorted(active_goals, key=lambda g: g.current_priority, reverse=True)
            top_goal = {"id": sorted_goals[0].id, "description": sorted_goals[0].description}

        # If LLM client is available and not mock, run LLM-based planning
        if self.llm_client and self.llm_client.provider != "mock":
            return self._plan_with_llm(agent_id, agent_state, top_goal, relevant_memories, world_state)
        else:
            return self._plan_with_rules(agent_id, agent_state, top_goal, relevant_memories, world_state)

    def _plan_with_llm(self, agent_id: str, agent_state: Dict[str, Any], top_goal: Dict[str, Any],
                        relevant_memories: List[Any], world_state: Dict[str, Any]) -> Tuple[str, List[str], Dict[str, Any]]:
        
        system_instruction = f"""
You are the planning engine for {agent_id}, a character in the simulation "Silent Hollow".
You must decide the character's reasoning, plan, and immediate next action based on their personality, emotions, memories, and top goal.
Return your decision strictly in JSON format matching the schema:
{{
  "reasoning": "Detailed breakdown of what you are thinking and why, based on your state and goals",
  "plan": ["Sub-task 1", "Sub-task 2", ...],
  "action": {{
    "type": "MOVE" | "TALK" | "SEARCH" | "IDLE" | "ACCUSE",
    "target": "name of target location, character, or clue",
    "metadata": {{ "reason": "reason for action", "custom_key": "custom_val" }}
  }}
}}

Available actions and targets:
- MOVE: target must be one of the locations: Town Hall, Marketplace, Tavern, Blacksmith, Doctor Clinic, Farms, Forest Edge, Merchant Store
- TALK: target must be an NPC in the same location as you. Nearby NPCs: {world_state.get('nearby_npcs', [])}
- SEARCH: target must be a nearby object or the current location for clues.
- IDLE: no target.
- ACCUSE: target must be an NPC you believe is the killer. (Only do this if suspicion/evidence is high).
"""
        
        mem_str = "\n".join(f"- [{m.timestamp}] {m.content} (importance: {m.importance})" for m in relevant_memories)
        
        prompt = f"""
CHARACTER PROFILE:
Name: {agent_state.get('name')}
Role: {agent_state.get('role')}
Personality: {agent_state.get('personality')}
Emotions: {agent_state.get('emotions')}
Relationships: {agent_state.get('relationships')}
Secrets Known: {agent_state.get('secrets')}

WORLD CONTEXT:
Current Time: Tick {world_state.get('current_time')}
Current Location: {world_state.get('current_location')}
Nearby Villagers: {world_state.get('nearby_npcs')}
Murder Discovered: {world_state.get('murder_discovered')}

TOP GOAL:
{top_goal['id']} - {top_goal['description']}

RELEVANT MEMORIES RETRIEVED:
{mem_str}

Please plan your next step. Output ONLY valid JSON.
"""
        try:
            response = self.llm_client.generate(prompt, system_instruction, json_mode=True)
            data = json.loads(response)
            
            reasoning = data.get("reasoning", "Decided to proceed with plan.")
            sub_tasks = data.get("plan", ["Keep observing"])
            next_action = data.get("action", {"type": "IDLE", "target": "", "metadata": {}})
            
            return reasoning, sub_tasks, next_action
        except Exception as e:
            logger.error(f"Failed to generate LLM plan: {e}. Falling back to rule planner.")
            return self._plan_with_rules(agent_id, agent_state, top_goal, relevant_memories, world_state)

    def _plan_with_rules(self, agent_id: str, agent_state: Dict[str, Any], top_goal: Dict[str, Any],
                          relevant_memories: List[Any], world_state: Dict[str, Any]) -> Tuple[str, List[str], Dict[str, Any]]:
        """
        Utility-based planner fallback. Evaluates simple conditions to generate action chains.
        """
        role = agent_state.get("role", "Villager")
        loc = world_state.get("current_location", "Marketplace")
        nearby = world_state.get("nearby_npcs", [])
        goal_id = top_goal["id"]

        # Default actions
        reasoning = f"My primary focus is '{top_goal['description']}'. "
        sub_tasks = []
        next_action = {"type": "IDLE", "target": "", "metadata": {}}

        locations = [
            "Town Hall", "Marketplace", "Tavern", "Blacksmith", 
            "Doctor Clinic", "Farms", "Forest Edge", "Merchant Store"
        ]

        if goal_id == "hide_crime":
            reasoning += "I must behave normally and divert suspicion from myself."
            # If anyone is nearby, try to lie or speak to them to create an alibi
            if nearby:
                target = nearby[0]
                reasoning += f" I will talk to {target} to construct a fake alibi."
                sub_tasks = ["Establish alibi", "Move location to look normal"]
                next_action = {
                    "type": "TALK",
                    "target": target,
                    "metadata": {"topic": "alibi", "reason": "Divert suspicion"}
                }
            else:
                # Move to a new location to look active
                import random
                possible_locs = [l for l in locations if l != loc]
                target_loc = random.choice(possible_locs)
                reasoning += f" No one is around. I will move to the {target_loc} to blend in."
                sub_tasks = [f"Go to {target_loc}", "Talk to villagers"]
                next_action = {
                    "type": "MOVE",
                    "target": target_loc,
                    "metadata": {"reason": "Blend in and establish presence"}
                }

        elif goal_id == "solve_murder":
            reasoning += "I need to find out who killed Arthur. I should ask for alibis and gather rumors."
            if nearby:
                target = nearby[0]
                reasoning += f" I will interrogate {target} about their whereabouts."
                sub_tasks = [f"Interrogate {target}", "Verify alibi details", "Search the crime scene"]
                next_action = {
                    "type": "TALK",
                    "target": target,
                    "metadata": {"topic": "murder", "reason": "Query alibi and suspects"}
                }
            else:
                # Search current location for evidence
                import random
                # If we are at the clinic or forest, check for items, otherwise move to the tavern where people gather
                if loc == "Tavern":
                    reasoning += " No one is in the tavern. I will search the counter or tables for gossip files."
                    sub_tasks = ["Search tavern", "Move to town hall"]
                    next_action = {
                        "type": "SEARCH",
                        "target": "Tavern",
                        "metadata": {"reason": "Search tables for items"}
                    }
                else:
                    target_loc = "Tavern"
                    reasoning += f" It's quiet here. I'll head to the {target_loc} to find witnesses."
                    sub_tasks = [f"Go to {target_loc}", "Gossip with villagers"]
                    next_action = {
                        "type": "MOVE",
                        "target": target_loc,
                        "metadata": {"reason": "Go where villagers congregate"}
                    }

        elif goal_id == "self_preservation":
            reasoning += "Things are getting dangerous. I need to seek safety and protect myself."
            # If the guard is nearby, talk to her. Else move to home or clinic.
            if "Katherine" in nearby:
                reasoning += " Guard Katherine is here. I will ask her for protection."
                sub_tasks = ["Request guard escort", "Stay secure"]
                next_action = {
                    "type": "TALK",
                    "target": "Katherine",
                    "metadata": {"topic": "safety", "reason": "Expose fears to the guard"}
                }
            else:
                target_loc = "Doctor Clinic" if role == "Doctor" else "Town Hall"
                if loc != target_loc:
                    reasoning += f" I should head back to the safety of the {target_loc}."
                    sub_tasks = [f"Go to {target_loc}", "Lock door"]
                    next_action = {
                        "type": "MOVE",
                        "target": target_loc,
                        "metadata": {"reason": "Seek security in clinic/hall"}
                    }
                else:
                    reasoning += " I am in a safe location. I will observe."
                    sub_tasks = ["Linger", "Watch entrance"]
                    next_action = {
                        "type": "IDLE",
                        "target": "",
                        "metadata": {"reason": "Wait in safety"}
                    }

        else: # maximize_profit or default idle
            reasoning += "I will go about my daily schedule, buy goods, and trade gossip."
            # Go to shop, farms or tavern
            import random
            current_role_locations = {
                "Merchant": "Merchant Store",
                "Blacksmith": "Blacksmith",
                "Farmer": "Farms",
                "Doctor": "Doctor Clinic",
                "Innkeeper": "Tavern",
                "Hunter": "Forest Edge",
                "Guard": "Town Hall"
            }
            home_loc = current_role_locations.get(role, "Marketplace")
            
            if loc != home_loc and random.random() < 0.6:
                reasoning += f" I will return to my workspace at the {home_loc}."
                sub_tasks = [f"Go to {home_loc}", "Do daily work"]
                next_action = {
                    "type": "MOVE",
                    "target": home_loc,
                    "metadata": {"reason": "Return to workspace"}
                }
            elif nearby:
                target = nearby[0]
                reasoning += f" I will chat with {target} to keep up appearances and swap news."
                sub_tasks = [f"Chat with {target}", "Swap market news"]
                next_action = {
                    "type": "TALK",
                    "target": target,
                    "metadata": {"topic": "general", "reason": "Friendly gossip"}
                }
            else:
                # Walk to Marketplace
                possible_locs = ["Marketplace", "Tavern"]
                target_loc = random.choice(possible_locs)
                if loc != target_loc:
                    reasoning += f" I'll head to the {target_loc} to see if any customers are there."
                    sub_tasks = [f"Go to {target_loc}", "Find trade options"]
                    next_action = {
                        "type": "MOVE",
                        "target": target_loc,
                        "metadata": {"reason": "Look for customers"}
                    }
                else:
                    reasoning += " I am working."
                    next_action = {"type": "IDLE", "target": "", "metadata": {"reason": "Working at station"}}

        return reasoning, sub_tasks, next_action
