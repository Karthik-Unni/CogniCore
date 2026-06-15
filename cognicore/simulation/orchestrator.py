import logging
import random
from typing import Dict, Any, List, Optional
from cognicore.world.environment import World
from cognicore.agents.agent import Character
from cognicore.secrets.secret_system import SecretSystem
from cognicore.rumors.rumor_system import Rumor

logger = logging.getLogger("cognicore.simulation")

class SimulationOrchestrator:
    """
    Orchestrates the multi-agent execution loop, event broadcasting,
    action resolution, and social interaction mechanics.
    """
    def __init__(self, world: World):
        self.world = world
        self.agents: Dict[str, Character] = {}
        self.tick = 0

    def register_character(self, character: Character):
        self.agents[character.id] = character
        self.world.place_agent(character.id, "Marketplace")  # Default start location

    def step(self):
        """
        Executes one clock cycle of the character simulation.
        """
        logger.info(f"--- Sim Tick {self.tick} Start ---")
        
        # 1. Local Observations: Broadcast recent events to NPCs sharing locations
        self._broadcast_local_observations()

        # 2. Get Agent Action Requests
        actions = {}
        for agent_id, agent in self.agents.items():
            world_state = self.world.get_world_state(agent_id)
            world_state["current_time"] = self.tick
            action = agent.act(world_state)
            actions[agent_id] = action

        # 3. Resolve Actions
        for agent_id, action in actions.items():
            self._resolve_action(agent_id, action)

        # 4. Decay Emotions and consolidate short-term memories (Reflect)
        for agent in self.agents.values():
            agent.reflect(self.tick)
            agent.emotions.tick(ticks=1.0)

        # Increment simulation clock
        self.tick += 1
        logger.info(f"--- Sim Tick finished. Now at tick {self.tick} ---")

    def _broadcast_local_observations(self):
        """
        Let agents at the same location observe each other's physical presence
        and log entries from the prior tick.
        """
        for location in self.world.locations:
            nearby_agents = self.world.get_agents_at(location)
            if len(nearby_agents) <= 1:
                continue

            # Broadcast arrival and general actions
            for observer_id in nearby_agents:
                observer = self.agents[observer_id]
                for observed_id in nearby_agents:
                    if observer_id == observed_id:
                        continue
                    
                    observed = self.agents[observed_id]
                    last_act = observed.last_action
                    
                    # Notify observer about what the other NPC did in their vicinity
                    if last_act.get("type") == "MOVE" and last_act.get("target") == location:
                        observer.observe(
                            description=f"I saw {observed.name} arrive at the {location}.",
                            related_entities=[observed_id, location],
                            timestamp=self.tick
                        )
                    elif last_act.get("type") == "TALK" and last_act.get("target") == observer_id:
                        # Direct conversations are handled explicitly, but we note it in ST memory
                        pass
                    elif last_act.get("type") == "SEARCH":
                        observer.observe(
                            description=f"I noticed {observed.name} searching around the {location}.",
                            related_entities=[observed_id, location],
                            timestamp=self.tick
                        )

    def _resolve_action(self, agent_id: str, action: Dict[str, Any]):
        agent = self.agents[agent_id]
        act_type = action.get("type", "IDLE").upper()
        target = action.get("target", "")
        metadata = action.get("metadata", {})

        if act_type == "MOVE":
            success = self.world.move_agent(agent_id, target)
            if success:
                agent.observe(
                    description=f"I arrived at the {target}.",
                    related_entities=[target],
                    timestamp=self.tick
                )

        elif act_type == "TALK":
            # Check if target is a valid agent and in the same location
            if target in self.agents:
                speaker = agent
                listener = self.agents[target]
                
                speaker_loc = self.world.agent_placements.get(speaker.id)
                listener_loc = self.world.agent_placements.get(listener.id)
                
                if speaker_loc == listener_loc:
                    self._resolve_conversation(speaker, listener)
                else:
                    logger.warning(f"{speaker.id} tried to talk to {target} but they are in different places ({speaker_loc} vs {listener_loc})")
            else:
                logger.warning(f"Talk target {target} not registered in simulation.")

        elif act_type == "SEARCH":
            loc = self.world.agent_placements.get(agent_id, "Marketplace")
            clues = self.world.get_clues_at(loc)
            found_any = False
            
            # Simple discovery calculation based on character suspicion/intelligence
            for clue in clues:
                if agent_id not in clue["found_by"]:
                    # Roll success based on clue secrecy. 
                    # If suspecting/fearful, they search harder
                    suspicion = agent.emotions.get_state().get("suspicion", 0.1)
                    search_roll = random.random() + (suspicion * 0.3)
                    
                    if search_roll > clue["secrecy"]:
                        clue["found_by"].append(agent_id)
                        agent.observe(
                            description=f"I searched the {loc} and found a clue: {clue['name']}. ({clue['description']})",
                            related_entities=[loc, clue["owner"]],
                            timestamp=self.tick
                        )
                        found_any = True
                        
                        # Add clue finding event to world log
                        self.world.log_event({
                            "type": "CLUE_FOUND",
                            "agent_id": agent_id,
                            "location": loc,
                            "clue_name": clue["name"],
                            "description": f"{agent.name} found '{clue['name']}' at the {loc}."
                        })
                        break
            
            if not found_any:
                agent.observe(
                    description=f"I searched the {loc} but found nothing of interest.",
                    related_entities=[loc],
                    timestamp=self.tick
                )

        elif act_type == "ACCUSE":
            if target in self.agents:
                accuser = agent
                accused = self.agents[target]
                
                is_killer = accused.metadata.get("is_killer", False)
                self.world.log_event({
                    "type": "ACCUSATION",
                    "agent_id": agent_id,
                    "target": target,
                    "success": is_killer,
                    "description": f"{accuser.name} publicly ACCUSED {accused.name} of the murder!"
                })
                
                if is_killer:
                    logger.info(f"SUCCESS! {accused.name} confessed to the crime under pressure!")
                    accused.observe(
                        description=f"I was accused by {accuser.name} and was forced to confess to the murder.",
                        related_entities=[accuser.id],
                        timestamp=self.tick
                    )
                    accused.emotions.update_batch({"fear": 0.5, "guilt": 0.5})
                else:
                    logger.info(f"FALSE ACCUSATION! {accused.name} is innocent. Social friction ensues.")
                    # Innocents get angry, and trust in the accuser decays
                    accused.emotions.update_emotion("anger", 0.4)
                    accused.relationships.update_metric(accuser.id, "trust", -0.4)
                    accused.relationships.update_metric(accuser.id, "friendship", -0.3)
                    
                    accuser.relationships.update_metric(accused.id, "trust", -0.2)
                    accuser.observe(
                        description=f"I accused {accused.name} but they maintained their innocence. I might have made a mistake.",
                        related_entities=[target],
                        timestamp=self.tick
                    )

        elif act_type == "IDLE":
            agent.observe(
                description="I spent some time waiting and observing the surroundings.",
                timestamp=self.tick
            )

    def _resolve_conversation(self, speaker: Character, listener: Character):
        """
        Executes a dialogue tick between two characters, sharing rumors and checking secrets.
        """
        logger.info(f"Conversation: {speaker.name} -> {listener.name}")
        
        # 1. Share Rumors (Gossip)
        speaker_rumors = speaker.rumors.get_rumors_to_share()
        shared_rumor = None
        
        if speaker_rumors:
            # Pick a rumor to share (prefer the most recent or important)
            chosen_raw = random.choice(speaker_rumors)
            
            # Mutate rumor based on speaker traits
            honesty = speaker.personality.get("honesty", 0.5)
            suspicion = speaker.emotions.get_state().get("suspicion", 0.1)
            mutated = chosen_raw.mutate(speaker_honesty=honesty, speaker_suspicion=suspicion)
            
            # Speaker tells B
            trust_level = listener.relationships.get_relationship(speaker.id).get("trust", 0.0)
            accepted = listener.rumors.hear_rumor(mutated, speaker.id, trust_level)
            
            if accepted:
                shared_rumor = mutated
                listener.observe(
                    description=f"{speaker.name} told me a rumor: '{mutated.content}'",
                    related_entities=[speaker.id, mutated.about_agent_id],
                    timestamp=self.tick
                )
                
                # Tiny trust bump for sharing news
                listener.relationships.update_metric(speaker.id, "trust", 0.02)
                listener.relationships.update_metric(speaker.id, "friendship", 0.02)

        # 2. Check Secret Sharing
        # A) Speaker sharing their own secrets with B
        speaker_secrets = speaker.memory.get_secrets()
        shared_secret = None
        for secret in speaker_secrets:
            # Check if secret subject is the speaker themselves
            exposed_to = secret.metadata.get("exposed_to", [])
            if listener.id in exposed_to:
                continue

            trust = speaker.relationships.get_relationship(listener.id).get("trust", 0.0)
            friendship = speaker.relationships.get_relationship(listener.id).get("friendship", 0.0)
            emotions = speaker.emotions.get_state()

            if SecretSystem.should_reveal_own_secret(secret, listener.id, trust, friendship, emotions):
                # Reveal secret!
                exposed_to.append(listener.id)
                secret.metadata["exposed_to"] = exposed_to
                
                # B learns the secret
                listener.memory.add_memory(
                    content=f"{speaker.name} confided a secret in me: {secret.content}",
                    memory_type=secret.memory_type, # Keep as secret type in B's memory
                    importance=secret.importance,
                    timestamp=self.tick,
                    related_entities=[speaker.id],
                    metadata={"subject": speaker.id, "original_secret_id": secret.id}
                )
                
                # B's relationship to A increases due to vulnerability
                listener.relationships.process_social_event(speaker.id, "shared_secret", severity=1.0)
                speaker.relationships.update_metric(listener.id, "trust", 0.1)  # A trusts B more too
                
                shared_secret = secret.content
                break

        # B) Speaker exposing SOMEONE ELSE's secret to B
        # Let's say Speaker knows a secret about Agent C, and evaluates if they should expose it to B
        if not shared_secret:  # Only expose one major thing per chat
            all_memories = speaker.memory.query_memories("confided a secret", k=50)
            other_secrets = [m for m in all_memories if m.metadata.get("subject") and m.metadata.get("subject") != speaker.id]
            
            for secret in other_secrets:
                subject_id = secret.metadata["subject"]
                if subject_id == listener.id:
                    continue  # Don't expose their own secret back to them

                # Check if listener already knows this secret
                original_secret_id = secret.metadata.get("original_secret_id")
                # Evaluate should expose
                rel_with_subject = speaker.relationships.get_relationship(subject_id)
                rel_with_listener = speaker.relationships.get_relationship(listener.id)
                
                if SecretSystem.should_expose_others_secret(secret, subject_id, listener.id, rel_with_subject, rel_with_listener):
                    # Expose!
                    listener.observe(
                        description=f"{speaker.name} whispered a secret about {self.agents[subject_id].name}: {secret.content}",
                        related_entities=[speaker.id, subject_id],
                        timestamp=self.tick
                    )
                    
                    # Social friction
                    # Listener's trust in Subject drops
                    listener.relationships.update_metric(subject_id, "trust", -0.25)
                    listener.relationships.update_metric(subject_id, "friendship", -0.15)
                    
                    # Log event
                    self.world.log_event({
                        "type": "SECRET_EXPOSED",
                        "speaker": speaker.id,
                        "listener": listener.id,
                        "subject": subject_id,
                        "description": f"{speaker.name} exposed {self.agents[subject_id].name}'s secret to {listener.name}!"
                    })
                    break

        # Log conversation event
        desc = f"{speaker.name} spoke with {listener.name}."
        if shared_rumor:
            desc += f" Shared rumor: '{shared_rumor.content}'."
        if shared_secret:
            desc += " Shared a deep personal secret."
            
        self.world.log_event({
            "type": "TALK",
            "speaker": speaker.id,
            "listener": listener.id,
            "description": desc
        })
        
        # Let speaker observe that they had a chat
        speaker.observe(
            description=f"I had a conversation with {listener.name}.",
            related_entities=[listener.id],
            timestamp=self.tick
        )
