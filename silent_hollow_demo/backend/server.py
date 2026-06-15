import os
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List, Optional

from silent_hollow_demo.backend.scenario import setup_simulation
from cognicore import Character
from cognicore.social_graph import SocialGraph
from cognicore.rumors.rumor_system import Rumor

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("silent_hollow.server")

app = FastAPI(title="Silent Hollow: NPC Engine Demonstration Server")

# Configure CORS so our frontend can connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global simulation states
SIM_DB_PATH = "silent_hollow_memories.db"
SIM_LLM_PROVIDER = os.environ.get("COGNICORE_PROVIDER", "mock")

orchestrator = None
world = None
scenario_info = None

@app.on_event("startup")
def startup_event():
    global orchestrator, world, scenario_info
    logger.info(f"Initializing simulation with provider: {SIM_LLM_PROVIDER}")
    orchestrator, world, scenario_info = setup_simulation(db_path=SIM_DB_PATH, llm_provider=SIM_LLM_PROVIDER)
    logger.info("Simulation initialized. Killer selected: " + scenario_info["killer_id"])

@app.post("/api/reset")
def reset_simulation():
    global orchestrator, world, scenario_info
    logger.info("Resetting simulation...")
    orchestrator, world, scenario_info = setup_simulation(db_path=SIM_DB_PATH, llm_provider=SIM_LLM_PROVIDER)
    return {
        "status": "reset",
        "victim": scenario_info["victim_id"],
        "killer_id_debug": scenario_info["killer_id"]  # Exposed for dashboard debugging
    }

@app.get("/api/state")
def get_state():
    if not world:
        raise HTTPException(status_code=500, detail="Simulation not initialized")
    
    # Expose positions and overall metrics
    return {
        "tick": orchestrator.tick,
        "murder_discovered": world.murder_discovered,
        "victim": world.victim_id,
        "agent_positions": world.agent_placements,
        "locations": world.locations,
        "event_log": world.event_log[::-1],  # Reverse log for newest first
        "clues": {
            loc: [{"name": c["name"], "secrecy": c["secrecy"], "found_by": c["found_by"]} for c in cls]
            for loc, cls in world.clues.items()
        }
    }

@app.get("/api/agents")
def get_agents():
    if not orchestrator:
        raise HTTPException(status_code=500, detail="Simulation not initialized")
    return {
        agent_id: agent.get_agent_state()
        for agent_id, agent in orchestrator.agents.items()
    }

@app.get("/api/agents/{agent_id}")
def get_agent(agent_id: str):
    if not orchestrator or agent_id not in orchestrator.agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    agent = orchestrator.agents[agent_id]
    return agent.get_agent_state()

@app.get("/api/social-graph")
def get_social_graph():
    if not orchestrator:
        raise HTTPException(status_code=500, detail="Simulation not initialized")
    graph = SocialGraph(list(orchestrator.agents.values()))
    return graph.export_graph_json()

@app.post("/api/step")
def step_simulation():
    global orchestrator, world
    if not orchestrator:
        raise HTTPException(status_code=500, detail="Simulation not initialized")
    
    # Tick simulation forward
    orchestrator.step()
    
    # Custom murder discovery check:
    # If the murder is not yet discovered, check if any NPC is at the Town Hall (crime scene)
    if not world.murder_discovered:
        npcs_at_town_hall = world.get_agents_at("Town Hall")
        if npcs_at_town_hall:
            discoverer_id = npcs_at_town_hall[0]
            discoverer = orchestrator.agents[discoverer_id]
            world.murder_discovered = True
            
            world.log_event({
                "type": "MURDER_DISCOVERED",
                "agent_id": discoverer_id,
                "description": f"{discoverer.name} discovered Arthur's body at the Town Hall!"
            })
            
            # Broadcast observation to all NPCs
            for agent in orchestrator.agents.values():
                agent.observe(
                    description=f"Arthur's body has been discovered at the Town Hall! The killer is in our midst.",
                    emotional_weight=1.5,
                    related_entities=["Arthur", "Town Hall"],
                    timestamp=orchestrator.tick
                )
                
            # Seed the murder rumor in the discoverer
            m_rumor = Rumor(
                id="rumor_murder",
                origin_agent_id=discoverer_id,
                about_agent_id="Arthur",
                content=f"Arthur was murdered at the Town Hall! I saw the corpse with my own eyes.",
                timestamp=orchestrator.tick,
                raw_fact={"victim": "Arthur", "location": "Town Hall"}
            )
            discoverer.rumors.known_rumors["rumor_murder"] = m_rumor

    return {
        "tick": orchestrator.tick,
        "murder_discovered": world.murder_discovered,
        "event_log": world.event_log[-3:]  # Latest events
    }


class TalkRequest(BaseModel):
    agent_id: str
    message: str

@app.post("/api/player/talk")
def player_talk(req: TalkRequest):
    if not orchestrator or req.agent_id not in orchestrator.agents:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    agent = orchestrator.agents[req.agent_id]
    msg = req.message
    msg_lower = msg.lower()
    
    # Track a subjective relationship value for the player
    # Initialize if not present
    player_relation = agent.relationships.get_relationship("Player")
    
    # If LLM provider is active and not mock, generate response using AI
    if orchestrator.agents[req.agent_id].llm_client and orchestrator.agents[req.agent_id].llm_client.provider != "mock":
        response_text = _generate_player_talk_llm(agent, msg, player_relation)
    else:
        # Fallback to rule/keyword based response generator
        response_text = _generate_player_talk_rules(agent, msg_lower, player_relation)

    # Process relationship changes based on statement tone
    # Aggressive accusations make them defensive (fear/anger rise, trust decays)
    rel_change = {"trust": 0.0, "friendship": 0.0, "fear": 0.0}
    if "kill" in msg_lower or "murderer" in msg_lower or "accuse" in msg_lower:
        agent.emotions.update_emotion("anger", 0.15)
        agent.emotions.update_emotion("fear", 0.10)
        agent.emotions.update_emotion("suspicion", 0.20)
        
        agent.relationships.update_metric("Player", "trust", -0.15)
        agent.relationships.update_metric("Player", "friendship", -0.10)
        rel_change = {"trust": -0.15, "friendship": -0.10, "fear": 0.10}
    else:
        # Normal conversation increases friendship slightly
        agent.relationships.update_metric("Player", "trust", 0.02)
        agent.relationships.update_metric("Player", "friendship", 0.02)
        rel_change = {"trust": 0.02, "friendship": 0.02, "fear": 0.0}

    # Log interaction
    world.log_event({
        "type": "PLAYER_TALK",
        "agent_id": req.agent_id,
        "player_message": msg,
        "response": response_text,
        "description": f"Player spoke with {agent.name}."
    })

    return {
        "response": response_text,
        "emotions": agent.emotions.get_state(),
        "relationship_with_player": agent.relationships.get_relationship("Player"),
        "rel_change": rel_change
    }

def _generate_player_talk_llm(agent: Character, message: str, player_relation: Dict[str, float]) -> str:
    """Uses the active LLM to generate dialogue based on NPC context."""
    system_instruction = f"""
You are {agent.name}, a {agent.metadata.get('role')} in the village of Silent Hollow.
The player is an investigator questioning you about the murder of Arthur.
Respond in character, adopting your role, personality, and emotions.
Keep your response concise (1-3 sentences) and realistic. Do not break character.

YOUR STATE:
Role: {agent.metadata.get('role')}
Personality: {agent.personality}
Emotions: {agent.emotions.get_state()}
Subjective trust in Player: {player_relation.get('trust', 0.0)}
Is Killer: {agent.metadata.get('is_killer', False)}
"""
    prompt = f"""
PLAYER INTERROGATION:
"{message}"

Recall memories / secrets:
{ [m.content for m in agent.memory.query_memories(message, k=3)] }

Respond in dialogue:
"""
    return agent.llm_client.generate(prompt, system_instruction)

def _generate_player_talk_rules(agent: Character, msg_lower: str, player_relation: Dict[str, float]) -> str:
    """Fallback keyword-based dialogues representing NPC personalities."""
    role = agent.metadata.get("role")
    is_killer = agent.metadata.get("is_killer", False)
    
    # Check for alibi query
    if "alibi" in msg_lower or "where were you" in msg_lower or "when it happened" in msg_lower or "location" in msg_lower:
        if is_killer:
            # Fake alibi
            fake_loc = "Tavern" if role != "Innkeeper" else "Doctor Clinic"
            return f"I was at the {fake_loc} tending to some personal matters. Speak to the others if you don't believe me."
        else:
            # Innocent alibi
            work_locs = {
                "Mayor": "Town Hall", "Guard": "Guardhouse", "Merchant": "Merchant Store",
                "Blacksmith": "Blacksmith forge", "Doctor": "Doctor Clinic", 
                "Innkeeper": "Tavern", "Farmer": "Farms", "Hunter": "Forest Cabin"
            }
            loc = work_locs.get(role, "Marketplace")
            return f"I was busy at the {loc} when Arthur was killed. I had no reason to go near the Town Hall last night."

    # Check for murder/victim query
    if "murder" in msg_lower or "arthur" in msg_lower or "dead" in msg_lower:
        if is_killer:
            return "It's a tragic loss for the village, truly. Arthur was a good man. I hope you find whoever did this."
        else:
            if role == "Guard":
                return "This is a heinous crime! I'm doing everything I can to track their movements, but rumors are spreading fast."
            elif role == "Doctor":
                return "I examined Arthur's body briefly. The cause of death looked like blunt force trauma, or perhaps poison. It was hard to tell."
            elif role == "Innkeeper":
                return "Everyone is talking about it. Some say they saw Dennis arguing with him, others claim Marcus has something to do with it."
            return "Arthur was always quiet. I can't imagine why anyone would want to harm him."

    # Check for suspicious entities / query about other suspect
    for suspect in ["alden", "katherine", "marcus", "dennis", "clara", "elena", "silas", "gerald"]:
        if suspect in msg_lower:
            # Retrieve relationship metric for suspect
            t_id = suspect.capitalize()
            # Handle Elena name exception
            if suspect == "elena":
                t_id = "Elena"
            
            rel = agent.relationships.get_relationship(t_id)
            trust = rel.get("trust", 0.0)
            friendship = rel.get("friendship", 0.0)
            
            if trust < -0.2:
                return f"I don't trust {t_id} at all. They've been acting very suspicious lately, if you ask me."
            elif friendship > 0.3:
                return f"{t_id} is a good friend of mine. I'm certain they have absolutely nothing to do with Arthur's death."
            else:
                return f"{t_id}? They keep to themselves mostly. I don't know them well enough to judge."

    # Check for secret query
    if "secret" in msg_lower or "hiding" in msg_lower or "tell me" in msg_lower:
        secrets = agent.memory.get_secrets()
        if secrets and player_relation.get("trust", 0.0) > 0.4:
            # If trust is high, share secret
            return f"Well... I shouldn't be saying this, but: {secrets[0].content}"
        return "I have nothing to hide from you, investigator. I've told you everything I know."

    # Default responses
    if is_killer:
        return "I have a lot of work to catch up on, detective. Unless you have specific questions, please leave me to it."
    else:
        if agent.emotions.get_state().get("fear", 0.0) > 0.4:
            return "Please, detective, find the killer soon. We are all terrified of who might be next."
        return "I hope your investigation yields results soon. The tension in the village is becoming unbearable."


class SearchRequest(BaseModel):
    location: str

@app.post("/api/player/search")
def player_search(req: SearchRequest):
    if not world:
        raise HTTPException(status_code=500, detail="Simulation not initialized")
    
    if req.location not in world.locations:
        raise HTTPException(status_code=400, detail="Invalid location")

    clues = world.get_clues_at(req.location)
    found_clues = []
    
    # Player searches the location. Reveal all clues hidden there.
    for clue in clues:
        if "player" not in clue["found_by"]:
            clue["found_by"].append("player")
            found_clues.append(clue)
            
            world.log_event({
                "type": "PLAYER_CLUE_FOUND",
                "location": req.location,
                "clue_name": clue["name"],
                "description": f"Detective found a clue: '{clue['name']}' at the {req.location}! ({clue['description']})"
            })

    return {
        "location": req.location,
        "clues_found": found_clues,
        "clues_remaining": len(clues) - len([c for c in clues if "player" in c["found_by"]])
    }


class AccuseRequest(BaseModel):
    agent_id: str

@app.post("/api/player/accuse")
def player_accuse(req: AccuseRequest):
    global orchestrator, scenario_info
    if not orchestrator or req.agent_id not in orchestrator.agents:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    accused = orchestrator.agents[req.agent_id]
    is_killer = accused.metadata.get("is_killer", False)
    
    world.log_event({
        "type": "PLAYER_ACCUSATION",
        "target": req.agent_id,
        "success": is_killer,
        "description": f"Detective publicly ACCUSED {accused.name} of the murder!"
    })

    if is_killer:
        return {
            "success": True,
            "message": f"Correct! {accused.name} was indeed the killer. Under pressure, they broke down and confessed.",
            "killer_name": accused.name,
            "motive": scenario_info["motive"],
            "clue": scenario_info["clue"]
        }
    else:
        # Increase anger and drop relationship metrics for the innocent person accused
        accused.emotions.update_emotion("anger", 0.5)
        accused.relationships.update_metric("Player", "trust", -0.6)
        accused.relationships.update_metric("Player", "friendship", -0.5)
        
        return {
            "success": False,
            "message": f"Incorrect. {accused.name} is innocent. Your false accusation has caused public outrage in the village!",
            "accused_name": accused.name
        }


class GossipRequest(BaseModel):
    agent_id: str
    rumor_content: str

@app.post("/api/player/gossip")
def player_gossip(req: GossipRequest):
    if not orchestrator or req.agent_id not in orchestrator.agents:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    agent = orchestrator.agents[req.agent_id]
    
    # Create rumor representing player gossip
    player_rumor = Rumor(
        id=f"player_rumor_{orchestrator.tick}",
        origin_agent_id="Player",
        about_agent_id="unknown",
        content=req.rumor_content,
        timestamp=orchestrator.tick
    )
    
    trust = agent.relationships.get_relationship("Player").get("trust", 0.0)
    accepted = agent.rumors.hear_rumor(player_rumor, "Player", trust)
    
    if accepted:
        agent.observe(
            description=f"Player told me a rumor: '{req.rumor_content}'",
            timestamp=orchestrator.tick
        )
        
    return {
        "accepted": accepted,
        "emotions": agent.emotions.get_state()
    }
