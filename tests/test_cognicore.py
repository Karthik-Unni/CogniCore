import os
import unittest
import tempfile
from typing import Dict, Any

from cognicore.emotions.engine import EmotionEngine
from cognicore.relationships.manager import RelationshipManager
from cognicore.rag.vector_store import SQLiteVectorStore
from cognicore.memory.manager import MemoryManager
from cognicore.memory.memory_types import MemoryType
from cognicore.rumors.rumor_system import Rumor, RumorTracker
from cognicore.secrets.secret_system import SecretSystem
from cognicore import Character, World, SimulationOrchestrator, Goal

class TestCogniCoreEngine(unittest.TestCase):
    
    def setUp(self):
        import random
        random.seed(42)
        # Create temp file for sqlite db
        self.db_fd, self.db_path = tempfile.mkstemp()
        self.vector_store = SQLiteVectorStore(db_path=self.db_path)

    def tearDown(self):
        # Close and remove temp database file
        os.close(self.db_fd)
        try:
            os.unlink(self.db_path)
        except OSError:
            pass

    def test_emotion_updates_and_decay(self):
        engine = EmotionEngine()
        # Initial anger baseline should be 0.0
        self.assertEqual(engine.get_state()["anger"], 0.0)

        # Accuse event should increase anger
        engine.process_event("accused", severity=1.0)
        self.assertGreater(engine.get_state()["anger"], 0.2)

        # A tick should decay anger back towards 0.0
        old_anger = engine.get_state()["anger"]
        engine.tick(ticks=1.0)
        self.assertLess(engine.get_state()["anger"], old_anger)

    def test_relationship_manager(self):
        manager = RelationshipManager(agent_id="Dennis")
        
        # Test default initialization
        rel = manager.get_relationship("Marcus")
        self.assertEqual(rel["trust"], 0.0)

        # Test updates
        manager.update_metric("Marcus", "trust", 0.3)
        self.assertEqual(manager.get_relationship("Marcus")["trust"], 0.3)

        # Clamped values
        manager.update_metric("Marcus", "trust", 2.0)
        self.assertEqual(manager.get_relationship("Marcus")["trust"], 1.0)

        # Reset trust to 0.4, then apply betrayal
        manager.update_metric("Marcus", "trust", -0.6) # 1.0 - 0.6 = 0.4
        manager.process_social_event("Marcus", "betrayal", severity=1.0)
        self.assertLess(manager.get_relationship("Marcus")["trust"], 0.0)

    def test_vector_store_rag(self):
        self.vector_store.add_memory(
            memory_id="mem_1",
            agent_id="Katherine",
            content="Mayor Alden was seen embezzling gold from the chest.",
            importance=8,
            emotional_impact={"suspicion": 0.5},
            timestamp=1.0,
            tags=["Alden", "gold"]
        )

        self.vector_store.add_memory(
            memory_id="mem_2",
            agent_id="Katherine",
            content="Dennis the blacksmith was working at his forge.",
            importance=2,
            emotional_impact={"suspicion": 0.0},
            timestamp=2.0,
            tags=["Dennis", "forge"]
        )

        # Query for embezzling should retrieve memory 1 as top match
        results = self.vector_store.query_memories(agent_id="Katherine", query_text="stole gold", k=1)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], "mem_1")

    def test_rumor_mutation_and_propagation(self):
        rumor = Rumor(
            id="rumor_1",
            origin_agent_id="Dennis",
            about_agent_id="Marcus",
            content="Marcus argued with Dennis at late night.",
            timestamp=1.0
        )

        # Low honesty, high suspicion speaker should mutate the rumor text
        mutated = rumor.mutate(speaker_honesty=0.2, speaker_suspicion=0.8)
        self.assertNotEqual(mutated.content, rumor.content)
        self.assertIn("threatened to kill", mutated.content.lower()) # check regex replacement
        self.assertLess(mutated.fidelity, 1.0)

        # Receiver should accept rumor if trust is neutral/high
        tracker = RumorTracker(agent_id="Elena")
        accepted = tracker.hear_rumor(mutated, source_agent_id="Dennis", source_trust=0.2)
        self.assertTrue(accepted)
        self.assertIn("rumor_1", tracker.known_rumors)

    def test_secret_sharing_logic(self):
        # A high secrecy memory
        secret = MemoryType.SECRET
        # Mocking memory class fields
        from cognicore.memory.memory_types import Memory
        sec_mem = Memory(
            agent_id="Alden",
            memory_type=secret,
            content="I embezzled town gold.",
            timestamp=1.0,
            metadata={"secrecy_level": 0.8, "exposed_to": []}
        )

        # Low trust receiver should be denied secret
        should_reveal = SecretSystem.should_reveal_own_secret(
            secret=sec_mem,
            target_agent_id="Katherine",
            target_trust=0.2,
            target_friendship=0.0,
            agent_emotions={"fear": 0.0, "suspicion": 0.2}
        )
        self.assertFalse(should_reveal)

        # High trust receiver should get the secret
        should_reveal_high = SecretSystem.should_reveal_own_secret(
            secret=sec_mem,
            target_agent_id="Elena",
            target_trust=0.9,
            target_friendship=0.4,
            agent_emotions={"fear": 0.0, "suspicion": 0.0}
        )
        self.assertTrue(should_reveal_high)

    def test_simulation_integration(self):
        """
        Runs a simplified integration test simulation with 2 agents.
        Tests that movement registers and talk exchanges spread rumors.
        """
        world = World()
        orchestrator = SimulationOrchestrator(world)

        # Character 1: Elena (has a rumor)
        goals_1 = [Goal(id="idle", description="Do chores")]
        elena = Character(
            agent_id="Elena", name="Elena", personality={"honesty": 0.9},
            goals=goals_1, vector_store=self.vector_store
        )
        
        # Character 2: Katherine (ignorant of rumor)
        goals_2 = [Goal(id="idle", description="Do chores")]
        katherine = Character(
            agent_id="Katherine", name="Katherine", personality={"honesty": 0.9},
            goals=goals_2, vector_store=self.vector_store
        )

        orchestrator.register_character(elena)
        orchestrator.register_character(katherine)

        # Seed rumor in Elena
        test_rumor = Rumor(
            id="rumor_gold", origin_agent_id="Elena", about_agent_id="Alden",
            content="Alden took some gold from the vault.", timestamp=0.0
        )
        elena.rumors.known_rumors["rumor_gold"] = test_rumor

        # Place them at the same location (Tavern)
        world.move_agent("Elena", "Tavern")
        world.move_agent("Katherine", "Tavern")

        # Manually trigger conversation exchange inside a mocked random environment
        from unittest.mock import patch
        with patch('random.random', return_value=0.0):
            orchestrator._resolve_conversation(speaker=elena, listener=katherine)

        # Assert katherine has received the rumor
        self.assertIn("rumor_gold", katherine.rumors.known_rumors)
        self.assertEqual(katherine.rumors.known_rumors["rumor_gold"].content, test_rumor.content)

if __name__ == "__main__":
    unittest.main()
