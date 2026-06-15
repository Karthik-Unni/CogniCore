import logging
from typing import Dict, Any

logger = logging.getLogger("cognicore.emotions")

class EmotionEngine:
    """
    Manages a character's emotional state, transitions, and decay over time.
    Tracks: anger, fear, suspicion, happiness, trust, guilt, confidence.
    """
    def __init__(self, baselines: Optional[Dict[str, float]] = None, decay_rates: Optional[Dict[str, float]] = None):
        # Default baselines are 0.0 (neutral), except for trust/confidence which defaults to 0.5 (midpoint)
        self.baselines = baselines or {
            "anger": 0.0,
            "fear": 0.0,
            "suspicion": 0.1,
            "happiness": 0.3,
            "trust": 0.5,
            "guilt": 0.0,
            "confidence": 0.5
        }
        
        # Current emotional values start at baselines
        self.current_emotions = dict(self.baselines)
        
        # Default decay rates per tick (emotions move towards baselines by this rate)
        self.decay_rates = decay_rates or {
            "anger": 0.10,       # Decays quickly
            "fear": 0.08,        # Decays quickly
            "suspicion": 0.02,   # Suspicion lingers
            "happiness": 0.05,   # Happy moods decay moderately
            "trust": 0.01,       # Trust changes very slowly
            "guilt": 0.005,      # Guilt decays extremely slowly
            "confidence": 0.02   # Confidence decays slowly
        }

    def update_emotion(self, emotion: str, amount: float):
        """
        Modify an emotional state by a specific amount, clamping between 0.0 and 1.0.
        """
        if emotion in self.current_emotions:
            old_val = self.current_emotions[emotion]
            self.current_emotions[emotion] = max(0.0, min(1.0, old_val + amount))
            logger.debug(f"Emotion {emotion} updated: {old_val:.2f} -> {self.current_emotions[emotion]:.2f}")
        else:
            logger.warning(f"Attempted to update non-existent emotion: {emotion}")

    def update_batch(self, updates: Dict[str, float]):
        for emotion, amount in updates.items():
            self.update_emotion(emotion, amount)

    def tick(self, ticks: float = 1.0):
        """
        Decays emotional states towards their baseline values over ticks.
        """
        for emotion, current in self.current_emotions.items():
            baseline = self.baselines.get(emotion, 0.0)
            decay = self.decay_rates.get(emotion, 0.05) * ticks
            
            if current > baseline:
                self.current_emotions[emotion] = max(baseline, current - decay)
            elif current < baseline:
                self.current_emotions[emotion] = min(baseline, current + decay)

    def process_event(self, event_type: str, severity: float = 1.0):
        """
        Standard emotional updates triggered by common event categories.
        """
        updates = {}
        if event_type == "accused":
            # Being accused spikes anger, fear, and suspicion, and drops happiness
            updates = {
                "anger": 0.25 * severity,
                "fear": 0.20 * severity,
                "suspicion": 0.15 * severity,
                "happiness": -0.20 * severity
            }
        elif event_type == "threatened":
            updates = {
                "fear": 0.30 * severity,
                "anger": 0.15 * severity,
                "suspicion": 0.20 * severity,
                "confidence": -0.10 * severity
            }
        elif event_type == "gift_received":
            updates = {
                "happiness": 0.20 * severity,
                "trust": 0.15 * severity,
                "suspicion": -0.10 * severity
            }
        elif event_type == "caught_lying":
            updates = {
                "guilt": 0.30 * severity,
                "fear": 0.20 * severity,
                "confidence": -0.15 * severity
            }
        elif event_type == "secret_shared":
            # Sharing a secret increases trust and happiness (bonding)
            updates = {
                "trust": 0.20 * severity,
                "happiness": 0.10 * severity,
                "suspicion": -0.05 * severity
            }
        elif event_type == "evidence_found":
            updates = {
                "suspicion": 0.25 * severity,
                "fear": 0.10 * severity
            }
        
        self.update_batch(updates)

    def get_state(self) -> Dict[str, float]:
        return dict(self.current_emotions)
