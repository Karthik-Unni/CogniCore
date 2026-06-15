from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

class Goal(BaseModel):
    """
    Represents an active or passive character goal.
    """
    id: str
    description: str
    base_priority: float = 0.5  # 0.0 to 1.0 baseline
    current_priority: float = 0.5
    conditions: Dict[str, Any] = Field(default_factory=dict)  # State criteria that affect priority
    is_completed: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)

    def evaluate_priority(self, world_state: Dict[str, Any], agent_state: Dict[str, Any]) -> float:
        """
        Dynamically adjust priority based on current world and agent state variables.
        """
        multiplier = 1.0
        
        # 1. Self Preservation spikes based on fear and suspicion
        if self.id == "self_preservation":
            fear = agent_state.get("emotions", {}).get("fear", 0.0)
            suspicion = agent_state.get("emotions", {}).get("suspicion", 0.0)
            multiplier += (fear * 2.0) + (suspicion * 1.5)
            
        # 2. Expose Murderer spikes for Guard Katherine or when town fear is high
        elif self.id == "solve_murder":
            murder_discovered = world_state.get("murder_discovered", False)
            if murder_discovered:
                multiplier += 1.5
                # Guard Katherine gets extra drive to solve the murder
                if agent_state.get("role") == "Guard":
                    multiplier += 2.0
            else:
                multiplier = 0.1 # Very low priority before discovery

        # 3. Hide Crime spikes for the killer based on suspicion/fear
        elif self.id == "hide_crime":
            is_killer = agent_state.get("is_killer", False)
            if is_killer:
                suspicion = agent_state.get("emotions", {}).get("suspicion", 0.0)
                multiplier += 2.5 + (suspicion * 3.0)
            else:
                multiplier = 0.0 # Non-killers do not have this goal

        # 4. Maximize Profit spikes for merchant if greed is high
        elif self.id == "maximize_profit":
            greed = agent_state.get("personality", {}).get("greed", 0.5)
            multiplier += (greed * 1.5)

        # Apply multiplier to baseline priority
        self.current_priority = min(5.0, self.base_priority * multiplier)
        return self.current_priority
