import random
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger("cognicore.rumors")

class Rumor(BaseModel):
    """
    Data model for a rumor traveling through the social grid.
    """
    id: str
    origin_agent_id: str
    about_agent_id: str
    content: str
    fidelity: float = 1.0  # 1.0 is original accuracy, degrades with mutation
    timestamp: float
    spread_count: int = 0
    raw_fact: Dict[str, Any] = Field(default_factory=dict) # The actual underlying true data

    def mutate(self, speaker_honesty: float, speaker_suspicion: float) -> 'Rumor':
        """
        Mutates rumor text based on the speaker's personality and emotional states.
        """
        # If speaker is highly honest and not suspicious, rumor stays pristine
        if speaker_honesty > 0.8 and speaker_suspicion < 0.3:
            return self.model_copy()

        new_content = self.content
        new_fidelity = self.fidelity

        # Text mutations (rule-based transformations)
        mutations = [
            (r"\bwas seen\b", "was seen acting suspiciously"),
            (r"\bat late night\b", "sneaking around at midnight"),
            (r"\bargued with\b", "threatened to kill"),
            (r"\bhas a weapon\b", "has a blood-stained weapon"),
            (r"\blied about\b", "is covering up"),
            (r"\btalking to\b", "conspiring in secret with")
        ]

        mutated = False
        # If dishonesty or suspicion is high, apply text modifications
        if speaker_honesty < 0.4 or speaker_suspicion > 0.6:
            import re
            for pattern, replacement in mutations:
                if re.search(pattern, new_content, re.IGNORECASE):
                    new_content = re.sub(pattern, replacement, new_content, flags=re.IGNORECASE)
                    mutated = True
                    break
            
            # If no regex matched, append a suspicious suffix
            if not mutated and random.random() < 0.5:
                suffixes = [
                    " and they seemed very guilty.",
                    " and I'm sure they are hiding something.",
                    " - it looked like a cover-up!",
                    " under very strange circumstances."
                ]
                new_content += random.choice(suffixes)
                mutated = True
            
            # Degrade fidelity if mutated
            if mutated:
                new_fidelity = max(0.1, self.fidelity - random.uniform(0.1, 0.3))

        return Rumor(
            id=self.id,
            origin_agent_id=self.origin_agent_id,
            about_agent_id=self.about_agent_id,
            content=new_content,
            fidelity=new_fidelity,
            timestamp=self.timestamp,
            spread_count=self.spread_count + 1,
            raw_fact=self.raw_fact
        )


class RumorTracker:
    """
    Tracks and filters rumors learned by an individual NPC.
    """
    def __init__(self, agent_id: str):
        self.agent_id = agent_id
        # rumor_id -> Rumor
        self.known_rumors: Dict[str, Rumor] = {}

    def hear_rumor(self, rumor: Rumor, source_agent_id: str, source_trust: float) -> bool:
        """
        Receives a rumor from a source.
        Decides if it is believed based on trust in the source and rumor fidelity.
        Returns: True if accepted, False otherwise.
        """
        # Credibility threshold logic
        # If trust is negative (trust < -0.3), reject rumor outright
        if source_trust < -0.3 and random.random() < 0.8:
            logger.debug(f"{self.agent_id} rejected rumor from {source_agent_id} due to low trust.")
            return False

        # If rumor is already known, keep the one with higher fidelity or accept update if trust is high
        if rumor.id in self.known_rumors:
            existing = self.known_rumors[rumor.id]
            if rumor.fidelity > existing.fidelity or source_trust > 0.5:
                self.known_rumors[rumor.id] = rumor
                return True
            return False

        # Accept rumor with probability scaled by trust
        # If trust is high (0.5+), accept 95%. If neutral (0.0), accept 70%. If distrusted, accept less.
        accept_chance = 0.7 + (source_trust * 0.25)
        accept_chance = max(0.1, min(0.99, accept_chance))

        if random.random() <= accept_chance:
            self.known_rumors[rumor.id] = rumor
            logger.debug(f"{self.agent_id} accepted rumor: '{rumor.content}' from {source_agent_id}")
            return True
        
        return False

    def get_rumors_to_share(self) -> List[Rumor]:
        return list(self.known_rumors.values())
