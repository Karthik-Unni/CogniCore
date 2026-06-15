import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("cognicore.relationships")

class RelationshipManager:
    """
    Manages an agent's subjective relationships with other agents in the simulation.
    Stores metrics: trust, respect, fear, friendship, rivalry, loyalty (normalized -1.0 to 1.0).
    """
    def __init__(self, agent_id: str, default_baselines: Optional[Dict[str, Dict[str, float]]] = None):
        self.agent_id = agent_id
        # subjective map: target_agent_id -> {metric_name -> value}
        self.relations: Dict[str, Dict[str, float]] = {}
        self.baselines = default_baselines or {}
        
    def _get_or_create_relation(self, target_id: str) -> Dict[str, float]:
        if target_id not in self.relations:
            # Load from baseline if exists, otherwise initialize to default neutral states (0.0)
            baseline = self.baselines.get(target_id, {})
            self.relations[target_id] = {
                "trust": baseline.get("trust", 0.0),
                "respect": baseline.get("respect", 0.0),
                "fear": baseline.get("fear", 0.0),
                "friendship": baseline.get("friendship", 0.0),
                "rivalry": baseline.get("rivalry", 0.0),
                "loyalty": baseline.get("loyalty", 0.0)
            }
        return self.relations[target_id]

    def get_relationship(self, target_id: str) -> Dict[str, float]:
        """Get the relationship metrics for a target agent."""
        return dict(self._get_or_create_relation(target_id))

    def update_metric(self, target_id: str, metric: str, amount: float):
        """
        Adjust a specific relationship metric, clamped between -1.0 and 1.0.
        """
        relation = self._get_or_create_relation(target_id)
        if metric in relation:
            old_val = relation[metric]
            relation[metric] = max(-1.0, min(1.0, old_val + amount))
            logger.debug(f"Relationship for {self.agent_id} -> {target_id} [{metric}] updated: {old_val:.2f} -> {relation[metric]:.2f}")
        else:
            logger.warning(f"Invalid relationship metric updated: {metric}")

    def update_batch(self, target_id: str, updates: Dict[str, float]):
        for metric, amount in updates.items():
            self.update_metric(target_id, metric, amount)

    def process_social_event(self, target_id: str, event_type: str, severity: float = 1.0):
        """
        Update relationships based on standard social events.
        """
        updates = {}
        if event_type == "insult":
            updates = {
                "friendship": -0.15 * severity,
                "respect": -0.05 * severity,
                "rivalry": 0.10 * severity
            }
        elif event_type == "compliment":
            updates = {
                "friendship": 0.10 * severity,
                "respect": 0.05 * severity
            }
        elif event_type == "bribe":
            updates = {
                "trust": -0.10 * severity,  # Suspect their morals
                "friendship": 0.05 * severity,
                "loyalty": 0.15 * severity
            }
        elif event_type == "shared_secret":
            updates = {
                "trust": 0.20 * severity,
                "friendship": 0.15 * severity,
                "loyalty": 0.10 * severity
            }
        elif event_type == "betrayal":
            updates = {
                "trust": -0.50 * severity,
                "friendship": -0.40 * severity,
                "loyalty": -0.50 * severity,
                "rivalry": 0.30 * severity
            }
        elif event_type == "threaten":
            updates = {
                "fear": 0.25 * severity,
                "friendship": -0.25 * severity,
                "trust": -0.15 * severity,
                "respect": -0.10 * severity
            }
        elif event_type == "cooperated":
            updates = {
                "trust": 0.10 * severity,
                "friendship": 0.10 * severity,
                "respect": 0.05 * severity
            }
        
        self.update_batch(target_id, updates)

    def get_all_relationships(self) -> Dict[str, Dict[str, float]]:
        # Populate relationships for all known baselines even if not interacted with yet
        for target in self.baselines:
            self._get_or_create_relation(target)
        return {k: dict(v) for k, v in self.relations.items()}
