from enum import Enum
from uuid import uuid4
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field

class MemoryType(str, Enum):
    SHORT_TERM = "short_term"
    LONG_TERM = "long_term"
    EPISODIC = "episodic"
    SOCIAL = "social"
    SECRET = "secret"

class Memory(BaseModel):
    """
    Representation of a single character memory node.
    """
    id: str = Field(default_factory=lambda: str(uuid4()))
    agent_id: str
    memory_type: MemoryType
    content: str
    importance: int = 1  # 1 to 10 scale
    emotional_impact: Dict[str, float] = Field(default_factory=lambda: {
        "anger": 0.0, "fear": 0.0, "suspicion": 0.0, 
        "happiness": 0.0, "trust": 0.0, "guilt": 0.0, "confidence": 0.0
    })
    timestamp: float  # Simulation tick or system time
    related_entities: List[str] = Field(default_factory=list)  # NPC names, objects, locations
    confidence: float = 1.0  # 0.0 to 1.0
    metadata: Dict[str, Any] = Field(default_factory=dict)
