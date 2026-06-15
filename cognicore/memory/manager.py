import logging
from typing import List, Dict, Any, Optional
from uuid import uuid4
from cognicore.memory.memory_types import Memory, MemoryType
from cognicore.rag.vector_store import SQLiteVectorStore

logger = logging.getLogger("cognicore.memory")

class MemoryManager:
    """
    Manages an agent's memory systems: Short-Term, Long-Term, Episodic, Social, and Secret.
    Interacts with SQLiteVectorStore for search and retrieval.
    """
    def __init__(self, agent_id: str, vector_store: SQLiteVectorStore, max_short_term: int = 10):
        self.agent_id = agent_id
        self.vector_store = vector_store
        self.max_short_term = max_short_term
        self.short_term_cache: List[Memory] = []
        self._load_short_term()

    def _load_short_term(self):
        """Pre-populate short term cache from database on startup."""
        try:
            # Query recent memories tagged as short_term
            memories = self.vector_store.query_memories(self.agent_id, "recent", k=self.max_short_term)
            self.short_term_cache = [
                Memory(
                    id=m["id"],
                    agent_id=m["agent_id"],
                    memory_type=MemoryType(m["metadata"].get("memory_type", MemoryType.SHORT_TERM.value)),
                    content=m["content"],
                    importance=m["importance"],
                    emotional_impact=m["emotional_impact"],
                    timestamp=m["timestamp"],
                    related_entities=m["tags"],
                    metadata=m["metadata"]
                )
                for m in memories if m["metadata"].get("memory_type") == MemoryType.SHORT_TERM.value
            ]
        except Exception as e:
            logger.warning(f"Could not load short-term memories: {e}")

    def add_memory(self, content: str, memory_type: MemoryType, importance: int = 1,
                   emotional_impact: Optional[Dict[str, float]] = None, timestamp: float = 0.0,
                   related_entities: Optional[List[str]] = None, metadata: Optional[Dict[str, Any]] = None) -> Memory:
        """
        Record a new memory. Saves to vector database and updates short-term cache if applicable.
        """
        # Ensure default emotional impact format
        emotions = emotional_impact or {
            "anger": 0.0, "fear": 0.0, "suspicion": 0.0, 
            "happiness": 0.0, "trust": 0.0, "guilt": 0.0, "confidence": 0.0
        }
        entities = related_entities or []
        meta = metadata or {}
        meta["memory_type"] = memory_type.value

        memory = Memory(
            agent_id=self.agent_id,
            memory_type=memory_type,
            content=content,
            importance=importance,
            emotional_impact=emotions,
            timestamp=timestamp,
            related_entities=entities,
            metadata=meta
        )

        # Save to database
        self.vector_store.add_memory(
            memory_id=memory.id,
            agent_id=self.agent_id,
            content=memory.content,
            importance=memory.importance,
            emotional_impact=memory.emotional_impact,
            timestamp=memory.timestamp,
            tags=memory.related_entities,
            metadata=memory.metadata
        )

        # Update short term sliding window
        if memory_type == MemoryType.SHORT_TERM:
            self.short_term_cache.append(memory)
            if len(self.short_term_cache) > self.max_short_term:
                self.short_term_cache.pop(0)

        return memory

    def query_memories(self, query: str, k: int = 5) -> List[Memory]:
        """
        Query vector DB for memories relevant to query text.
        """
        results = self.vector_store.query_memories(self.agent_id, query, k=k)
        memories = []
        for r in results:
            memories.append(Memory(
                id=r["id"],
                agent_id=r["agent_id"],
                memory_type=MemoryType(r["metadata"].get("memory_type", MemoryType.LONG_TERM.value)),
                content=r["content"],
                importance=r["importance"],
                emotional_impact=r["emotional_impact"],
                timestamp=r["timestamp"],
                related_entities=r["tags"],
                metadata=r["metadata"]
            ))
        return memories

    def get_short_term_memories(self) -> List[Memory]:
        return self.short_term_cache

    def add_secret(self, content: str, secrecy_level: float, expose_penalty: float, 
                   timestamp: float, related_entities: List[str]) -> Memory:
        """
        Add a secret memory.
        """
        metadata = {
            "secrecy_level": secrecy_level,  # 0.0 (expose freely) to 1.0 (never expose)
            "expose_penalty": expose_penalty, # Severity of negative relationship impact if exposed
            "exposed_to": []                  # List of agent_ids who know this secret
        }
        return self.add_memory(
            content=content,
            memory_type=MemoryType.SECRET,
            importance=8, # Secrets are usually important
            timestamp=timestamp,
            related_entities=related_entities,
            metadata=metadata
        )

    def get_secrets(self) -> List[Memory]:
        """Retrieve all secrets owned by this agent."""
        # Query database for memories with type = secret
        # For simplicity, we query a keyword and filter locally
        all_m = self.vector_store.query_memories(self.agent_id, "secret", k=100)
        secrets = []
        for m in all_m:
            if m["metadata"].get("memory_type") == MemoryType.SECRET.value:
                secrets.append(Memory(
                    id=m["id"],
                    agent_id=m["agent_id"],
                    memory_type=MemoryType.SECRET,
                    content=m["content"],
                    importance=m["importance"],
                    emotional_impact=m["emotional_impact"],
                    timestamp=m["timestamp"],
                    related_entities=m["tags"],
                    metadata=m["metadata"]
                ))
        return secrets

    def consolidate_memories(self, llm_client: Optional[Any] = None, timestamp: float = 0.0):
        """
        Consolidate short-term memories into a single long-term memory summary.
        Clears the short-term cache.
        """
        if not self.short_term_cache:
            return

        contents = [m.content for m in self.short_term_cache]
        summary_text = ""

        # Summarize memories
        if llm_client and llm_client.provider != "mock":
            prompt = f"Summarize the following recent experiences of {self.agent_id} into a single, cohesive long-term memory paragraph:\n"
            prompt += "\n".join(f"- {c}" for c in contents)
            summary_text = llm_client.generate(prompt, "You are a cognitive memory processor. Summarize facts accurately without flowery language.")
        else:
            # Simple rule-based consolidation
            entities_seen = set()
            for m in self.short_term_cache:
                entities_seen.update(m.related_entities)
            entities_str = ", ".join(entities_seen) if entities_seen else "various things"
            summary_text = f"Consolidated events involving {entities_str}. Summary: " + "; ".join(contents[:3]) + "..."

        # Calculate average emotional impact and max importance
        avg_emotions = {
            "anger": 0.0, "fear": 0.0, "suspicion": 0.0, 
            "happiness": 0.0, "trust": 0.0, "guilt": 0.0, "confidence": 0.0
        }
        max_importance = 1
        for m in self.short_term_cache:
            max_importance = max(max_importance, m.importance)
            for k in avg_emotions:
                avg_emotions[k] += m.emotional_impact.get(k, 0.0)
                
        num_m = len(self.short_term_cache)
        for k in avg_emotions:
            avg_emotions[k] /= num_m

        # Collect entities
        all_entities = list(set(ent for m in self.short_term_cache for ent in m.related_entities))

        # Add long term memory
        self.add_memory(
            content=summary_text,
            memory_type=MemoryType.LONG_TERM,
            importance=max_importance,
            emotional_impact=avg_emotions,
            timestamp=timestamp,
            related_entities=all_entities
        )

        # Clear cache
        self.short_term_cache = []
