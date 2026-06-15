import logging
from typing import Dict, Any, List, Optional
from cognicore.memory.memory_types import Memory

logger = logging.getLogger("cognicore.secrets")

class SecretSystem:
    """
    Evaluates social mechanics around secrets:
    - Decides when an NPC reveals their own secret.
    - Decides when an NPC weaponizes or trades someone else's secret.
    """
    @staticmethod
    def should_reveal_own_secret(secret: Memory, target_agent_id: str, 
                                  target_trust: float, target_friendship: float, 
                                  agent_emotions: Dict[str, float]) -> bool:
        """
        NPC decides if they trust another villager enough to share their own secret.
        """
        secrecy_level = secret.metadata.get("secrecy_level", 0.5)
        
        # If the secret has already been shared with this target, no need to re-evaluate
        exposed_to = secret.metadata.get("exposed_to", [])
        if target_agent_id in exposed_to:
            return False

        # Threshold increases with secrecy level
        # A secret with secrecy_level 0.8 requires trust > 0.7
        required_trust = secrecy_level * 0.9
        
        # High fear or suspicion of the target raises the trust threshold
        fear_factor = agent_emotions.get("fear", 0.0)
        suspicion_factor = agent_emotions.get("suspicion", 0.0)
        
        required_trust += (fear_factor * 0.2) + (suspicion_factor * 0.1)
        
        # friendship reduces the required trust slightly
        required_trust -= (target_friendship * 0.15)
        
        required_trust = max(0.2, min(0.95, required_trust))

        decision = target_trust >= required_trust
        if decision:
            logger.info(f"Secret shared: Agent shared secret '{secret.content}' with {target_agent_id} (Trust: {target_trust:.2f} >= Required: {required_trust:.2f})")
        return decision

    @staticmethod
    def should_expose_others_secret(secret: Memory, about_agent_id: str, 
                                    target_agent_id: str, relationship_with_subject: Dict[str, float],
                                    relationship_with_target: Dict[str, float]) -> bool:
        """
        NPC decides if they will gossip/expose NPC B's secret to NPC C.
        NPC A will expose B's secret if:
        1. They dislike/distrust B (subject of secret).
        2. They like/trust C (the target listener).
        """
        subject_friendship = relationship_with_subject.get("friendship", 0.0)
        subject_loyalty = relationship_with_subject.get("loyalty", 0.0)
        
        target_trust = relationship_with_target.get("trust", 0.0)
        target_friendship = relationship_with_target.get("friendship", 0.0)

        # Exposing score increases if we hate the subject and trust the listener
        expose_drive = (target_trust * 0.4) + (target_friendship * 0.3)
        expose_drive -= (subject_friendship * 0.5) + (subject_loyalty * 0.4)

        # High secrecy level makes it harder to share unless drive is very high
        secrecy_level = secret.metadata.get("secrecy_level", 0.5)
        threshold = secrecy_level * 0.5

        return expose_drive > threshold
