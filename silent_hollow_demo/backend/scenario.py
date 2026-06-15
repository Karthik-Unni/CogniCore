import random
import logging
from typing import Dict, Any, List, Tuple
from cognicore import Character, World, SimulationOrchestrator, SQLiteVectorStore, LLMClient, Goal, MemoryType

logger = logging.getLogger("silent_hollow.scenario")

SUSPECTS_CONFIG = [
    {
        "id": "Alden",
        "name": "Mayor Alden",
        "role": "Mayor",
        "start_location": "Town Hall",
        "personality": {"greed": 0.8, "honesty": 0.3, "aggression": 0.4},
        "description": "The town's ambitious mayor. Hides a history of embezzling village funds."
    },
    {
        "id": "Katherine",
        "name": "Guard Katherine",
        "role": "Guard",
        "start_location": "Town Hall",
        "personality": {"greed": 0.1, "honesty": 0.9, "aggression": 0.7},
        "description": "The stern guard captain dedicated to order and law."
    },
    {
        "id": "Marcus",
        "name": "Merchant Marcus",
        "role": "Merchant",
        "start_location": "Merchant Store",
        "personality": {"greed": 0.9, "honesty": 0.2, "aggression": 0.5},
        "description": "A wealthy merchant who secretly smuggles contraband through the forest."
    },
    {
        "id": "Dennis",
        "name": "Blacksmith Dennis",
        "role": "Blacksmith",
        "start_location": "Blacksmith",
        "personality": {"greed": 0.4, "honesty": 0.7, "aggression": 0.8},
        "description": "A hot-tempered blacksmith who owes Marcus a massive debt."
    },
    {
        "id": "Clara",
        "name": "Doctor Clara",
        "role": "Doctor",
        "start_location": "Doctor Clinic",
        "personality": {"greed": 0.2, "honesty": 0.8, "aggression": 0.3},
        "description": "A quiet doctor who once made a fatal medical error she keeps hidden."
    },
    {
        "id": "Elena",
        "name": "Elena the Innkeeper",
        "role": "Innkeeper",
        "start_location": "Tavern",
        "personality": {"greed": 0.5, "honesty": 0.5, "aggression": 0.4},
        "description": "The tavern owner who hears every piece of gossip in the village."
    },
    {
        "id": "Silas",
        "name": "Farmer Silas",
        "role": "Farmer",
        "start_location": "Farms",
        "personality": {"greed": 0.2, "honesty": 0.7, "aggression": 0.3},
        "description": "A struggling farmer whose crops are failing. Desperate for money."
    },
    {
        "id": "Gerald",
        "name": "Hunter Gerald",
        "role": "Hunter",
        "start_location": "Forest Edge",
        "personality": {"greed": 0.3, "honesty": 0.6, "aggression": 0.6},
        "description": "A reclusive woodsman who spends most of his time in the forest."
    }
]

CLUE_TEMPLATES = {
    "Alden": {
        "name": "Mayor's Signet Ring",
        "description": "A gold signet ring with the mayoral crest. Found covered in mud near the Blacksmith.",
        "location": "Blacksmith"
    },
    "Katherine": {
        "name": "Engraved Dagger",
        "description": "A guard-issue steel dagger. The hilt has Katherine's initials. Found at the Forest Edge.",
        "location": "Forest Edge"
    },
    "Marcus": {
        "name": "Smuggler's Ledger Page",
        "description": "A torn paper detail list of contraband shipments and Arthur's name circled. Found at the Tavern.",
        "location": "Tavern"
    },
    "Dennis": {
        "name": "Heavy Blacksmith Hammer",
        "description": "A heavy smithing hammer stained with dark dried blood. Found at the Farms.",
        "location": "Farms"
    },
    "Clara": {
        "name": "Labeled Poison Vial",
        "description": "A small glass vial that contained Hemlock, labeled from Clara's clinic. Found at the Forest Edge.",
        "location": "Forest Edge"
    },
    "Elena": {
        "name": "Tavern Room Key",
        "description": "A key to the tavern's private room, stained with a bloody fingerprint. Found at the Doctor Clinic.",
        "location": "Doctor Clinic"
    },
    "Silas": {
        "name": "Bloody Crop Hook",
        "description": "A rusty tool used for farming, showing traces of human blood. Found at the Merchant Store.",
        "location": "Merchant Store"
    },
    "Gerald": {
        "name": "Fletched Hunting Arrow",
        "description": "An arrow with distinctive owl-feather fletching, identical to Gerald's gear. Found in the Town Hall bushes.",
        "location": "Town Hall"
    }
}

MOTIVES = [
    "Arthur discovered my secret embezzlement and was planning to report it.",
    "Arthur had proof of my illegal smuggling operation and threatened to expose it to the guard.",
    "Arthur was blackmailing me over my past failures and demanded my entire savings.",
    "Arthur found out I forged the town land deeds to cover my debts."
]

def setup_simulation(db_path: str = "silent_hollow_memories.db", llm_provider: str = "mock") -> Tuple[SimulationOrchestrator, World, Dict[str, Any]]:
    """
    Initializes a new murder mystery simulation.
    Randomly assigns a killer, motive, hides evidence, and sets up relationships.
    """
    # 1. Initialize World
    world = World()
    world.victim_id = "Arthur"
    
    # 2. Select Killer
    killer_meta = random.choice([s for s in SUSPECTS_CONFIG if s["id"] != "Katherine"]) # Guard is not the killer by default to simplify investigation
    killer_id = killer_meta["id"]
    world.killer_id = killer_id
    motive = random.choice(MOTIVES)

    # 3. Setup LLM client
    llm_client = LLMClient(config={"provider": llm_provider})
    
    # Clean old vector DB
    vector_store = SQLiteVectorStore(db_path, llm_client)
    vector_store.clear()

    # 4. Hide Clue/Evidence
    clue_info = CLUE_TEMPLATES[killer_id]
    world.add_clue(
        location=clue_info["location"],
        clue_id=f"evidence_{killer_id}",
        name=clue_info["name"],
        description=clue_info["description"],
        associated_agent_id=killer_id,
        secrecy=0.6
    )

    # 5. Relationship baselines
    # All start with baseline trust=0.1, respect=0.1, except rivalries
    baselines: Dict[str, Dict[str, Dict[str, float]]] = {}
    for s in SUSPECTS_CONFIG:
        baselines[s["id"]] = {}
        for other in SUSPECTS_CONFIG:
            if s["id"] == other["id"]:
                continue
            
            # Default
            t, r, f, fr, ri, lo = 0.2, 0.2, 0.0, 0.1, 0.0, 0.0
            
            # Special social ties
            if s["id"] == "Dennis" and other["id"] == "Marcus":
                # Dennis owes Marcus money, fears him and rivals him
                t, r, f, fr, ri, lo = -0.2, 0.1, 0.4, -0.3, 0.5, 0.0
            elif s["id"] == "Marcus" and other["id"] == "Dennis":
                # Marcus treats Dennis as a debtor
                t, r, f, fr, ri, lo = 0.0, -0.1, 0.0, -0.1, 0.2, 0.0
            elif s["id"] == "Katherine" and other["id"] == "Alden":
                # Guard Katherine respects the mayor but distrusts him slightly
                t, r, f, fr, ri, lo = -0.1, 0.5, 0.0, 0.0, 0.0, 0.3
            elif s["id"] == "Silas" and other["id"] == "Marcus":
                # Silas hates the greedy merchant
                t, r, f, fr, ri, lo = -0.4, -0.3, 0.2, -0.5, 0.4, 0.0

            baselines[s["id"]][other["id"]] = {
                "trust": t, "respect": r, "fear": f, 
                "friendship": fr, "rivalry": ri, "loyalty": lo
            }

    # 6. Initialize Characters
    orchestrator = SimulationOrchestrator(world)
    characters: Dict[str, Character] = {}

    for s in SUSPECTS_CONFIG:
        agent_id = s["id"]
        is_killer = (agent_id == killer_id)

        # Build Goals
        goals = []
        if is_killer:
            # Killer goal to hide crime
            goals.append(Goal(id="hide_crime", description="Cover up your murder of Arthur and divert suspicion", base_priority=0.9))
            goals.append(Goal(id="self_preservation", description="Avoid getting arrested or exposed", base_priority=0.8))
        else:
            goals.append(Goal(id="self_preservation", description="Keep safe from the killer hiding in town", base_priority=0.5))
            
        if agent_id == "Katherine":
            # Guard captain wants to solve crime
            goals.append(Goal(id="solve_murder", description="Investigate the town and find Arthur's killer", base_priority=0.9))
        else:
            goals.append(Goal(id="solve_murder", description="Uncover who murdered Arthur to restore peace", base_priority=0.3))

        # Add professional goals
        if agent_id == "Marcus":
            goals.append(Goal(id="maximize_profit", description="Trade goods and accumulate wealth", base_priority=0.7))
        else:
            goals.append(Goal(id="idle", description="Linger around the village doing daily chores", base_priority=0.4))

        # Create character instance
        char = Character(
            agent_id=agent_id,
            name=s["name"],
            personality=s["personality"],
            goals=goals,
            vector_store=vector_store,
            llm_client=llm_client,
            relationship_baselines=baselines[agent_id],
            metadata={"role": s["role"], "is_killer": is_killer, "description": s["description"]}
        )

        # 7. Seed initial memories & secrets
        # Secret setup
        if is_killer:
            char.memory.add_secret(
                content=f"I killed Arthur the Clerk. I motive: {motive}. I hid the weapon ({clue_info['name']}) at the {clue_info['location']}.",
                secrecy_level=0.9,
                expose_penalty=0.8,
                timestamp=0.0,
                related_entities=[killer_id, "Arthur", clue_info["location"]]
            )
        else:
            # Innocent memories / gossip seeds
            if agent_id == "Elena":
                char.memory.add_memory(
                    content="I saw Marcus and Arthur arguing heatedly behind the tavern last Tuesday about some smuggled inventory.",
                    memory_type=MemoryType.LONG_TERM,
                    importance=5,
                    timestamp=0.0,
                    related_entities=["Marcus", "Arthur"]
                )
            elif agent_id == "Dennis":
                char.memory.add_memory(
                    content="I forged a custom weapon last week, but it went missing from my shop. I suspect someone stole it.",
                    memory_type=MemoryType.LONG_TERM,
                    importance=4,
                    timestamp=0.0,
                    related_entities=["Dennis"]
                )
            elif agent_id == "Clara":
                char.memory.add_memory(
                    content="Arthur was visiting my clinic recently, asking questions about lethal herbal doses.",
                    memory_type=MemoryType.LONG_TERM,
                    importance=4,
                    timestamp=0.0,
                    related_entities=["Arthur", "Clara"]
                )

        # Register to simulation and place character
        orchestrator.register_character(char)
        world.place_agent(agent_id, s["start_location"])
        characters[agent_id] = char

    # Log murder event
    world.log_event({
        "type": "MURDER",
        "victim": "Arthur",
        "location": "Town Hall",
        "description": "Arthur the Clerk was found dead at the Town Hall. He was murdered last night!"
    })

    # Return registered orchestrator, world and scenario info
    scenario_info = {
        "killer_id": killer_id,
        "victim_id": "Arthur",
        "clue": clue_info,
        "motive": motive
    }
    
    return orchestrator, world, scenario_info
