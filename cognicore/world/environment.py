import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("cognicore.world")

class World:
    """
    Manages spatial locations, agent placements, and clues within the simulation.
    """
    def __init__(self):
        self.locations = [
            "Town Hall", "Marketplace", "Tavern", "Blacksmith",
            "Doctor Clinic", "Farms", "Forest Edge", "Merchant Store"
        ]
        # agent_id -> location name
        self.agent_placements: Dict[str, str] = {}
        # location name -> List of clue dictionaries
        self.clues: Dict[str, List[Dict[str, Any]]] = {loc: [] for loc in self.locations}
        self.murder_discovered = False
        self.victim_id: Optional[str] = None
        self.killer_id: Optional[str] = None
        self.event_log: List[Dict[str, Any]] = []

    def place_agent(self, agent_id: str, location: str):
        if location in self.locations:
            self.agent_placements[agent_id] = location
            logger.debug(f"Placed agent {agent_id} at {location}")
        else:
            logger.warning(f"Attempted to place agent in invalid location: {location}")

    def move_agent(self, agent_id: str, target_location: str) -> bool:
        if target_location in self.locations:
            old_loc = self.agent_placements.get(agent_id, "Unknown")
            self.agent_placements[agent_id] = target_location
            logger.info(f"Agent {agent_id} moved: {old_loc} -> {target_location}")
            self.log_event({
                "type": "MOVE",
                "agent_id": agent_id,
                "from": old_loc,
                "to": target_location,
                "description": f"{agent_id} walked from the {old_loc} to the {target_location}."
            })
            return True
        return False

    def add_clue(self, location: str, clue_id: str, name: str, description: str, 
                 associated_agent_id: str, secrecy: float = 0.5):
        """
        Hide a physical clue at a location.
        """
        if location in self.locations:
            self.clues[location].append({
                "id": clue_id,
                "name": name,
                "description": description,
                "owner": associated_agent_id,
                "secrecy": secrecy,  # higher secrecy = harder to find
                "found_by": []
            })
            logger.info(f"Clue '{name}' hidden at {location}")
        else:
            logger.warning(f"Invalid location for clue placement: {location}")

    def get_clues_at(self, location: str) -> List[Dict[str, Any]]:
        return self.clues.get(location, [])

    def get_agents_at(self, location: str) -> List[str]:
        return [agent_id for agent_id, loc in self.agent_placements.items() if loc == location]

    def log_event(self, event: Dict[str, Any]):
        self.event_log.append(event)
        if len(self.event_log) > 100:
            self.event_log.pop(0)

    def get_world_state(self, agent_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Returns a global snapshot of the world, or subjective to a specific agent.
        """
        state = {
            "locations": self.locations,
            "agent_positions": self.agent_placements,
            "murder_discovered": self.murder_discovered,
            "victim": self.victim_id,
            "event_log": self.event_log
        }
        
        if agent_id:
            loc = self.agent_placements.get(agent_id, "Marketplace")
            state["current_location"] = loc
            # List other agents at the same location
            state["nearby_npcs"] = [other for other, other_loc in self.agent_placements.items() 
                                    if other_loc == loc and other != agent_id]
        
        return state
