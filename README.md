# CogniCore: Open-Source Character Intelligence Engine & Silent Hollow Simulation

CogniCore is a production-grade, reusable Character Intelligence Framework and SDK designed to empower virtual agents and non-player characters (NPCs) with persistent memory, numerical emotional engines, subjective social matrices, goals, autonomous planning, and rumor-propagation mechanics. 

Instead of writing rigid, hardcoded branching dialogue trees, CogniCore models the cognitive dynamics of characters systemically. Behavior and stories emerge naturally from the systemic interactions of personality traits, emotional responses, and memories.

This repository features both the reusable **CogniCore SDK** (Python library) and the **Silent Hollow Demo**, a stunning 3D isometric simulation and developer observability dashboard built with FastAPI, React, Three.js, and CSS.

---

## 🌟 Core Philosophy: Predictable Rules, Unpredictable Stories

In complex multi-agent setups, predictability and emergent autonomy must balance:
* **Predictable Rules**: Emotions decay systematically over time, memory retrieval follows deterministic vector-similarity math, and rumor mutations correspond directly to character honesty vectors.
* **Unpredictable Stories**: Every execution cycle yields a unique social outcome. Characters form alliances, hide evidence, trade secrets, lie to players, and spread gossip autonomously depending on the environment state.

---

## 🚀 Key Features

* 🧠 **Multi-Tiered Memory & RAG**: Short-term sliding-window interactions and long-term memory summary consolidation. Powered by a built-in SQLite-based vector store (supporting both cosine-similarity TF-IDF embeddings and standard API embeddings).
* 🎭 **Decaying Emotion Engine**: Numerical tracking across 7 core dimensions (`anger`, `fear`, `suspicion`, `happiness`, `trust`, `guilt`, `confidence`) adjusting dynamically per tick based on environmental events.
* 🕸️ **Subjective Social Matrix**: Directed relationship trackers adjusting trust, respect, fear, friendship, and rivalry between specific agents.
* 🎯 **Goal-Driven Planner**: Dynamic priority selection with LLM-assisted or rule-based/utility-based deterministic planners.
* 🤫 **Secret & Rumor Propagation**: Mutating gossip chains during retelling, trust-based secrets sharing, and threshold-based exposure.
* 🎮 **Silent Hollow 3D Showcase**: A fully playable detective simulation showcasing characters walking in real time inside a stylized Three.js viewport alongside a glassmorphic intelligence dashboard.

---

## 📂 Project Structure

```text
cognicore/               # Reusable Character Intelligence SDK (Core Python Library)
├── agents/             # Autonomous agent loops and heartbeats
├── emotions/           # Emotion state transition matrices & decay engines
├── goals/              # Dynamic goal weight structures
├── llm/                # LLM adapters (Gemini, OpenAI, Claude, Ollama, LoomGPT, Mock)
├── memory/             # Short-term, long-term, social, and secret memory managers
├── personality/        # Character personality vector traits
├── planning/           # Utility-based and LLM-driven planners
├── rag/                # SQLite-based vector storage and cosine-similarity searches
├── relationships/      # Directed relationship weights and matrices
├── rumors/             # Rumor propagation and mutation logic
├── secrets/            # Secret management and exposure thresholds
└── simulation/         # Multi-agent orchestrators

silent_hollow_demo/      # Showcase Simulation Application
├── backend/            # FastAPI orchestration server & game state endpoints
└── frontend/           # Vite + React + Three.js dashboard & social graph visualizer
```

---

## 🛠️ Using CogniCore as a Framework

CogniCore is designed to be easily imported into any backend or game loop. Below are the two primary enterprise use cases showing how to leverage the SDK.

### Use Case 1: Dynamic Game NPCs with Emergent Behavior

In RPGs or simulation games, you can instantiate characters with distinct personalities and let them react autonomously to players and environment events.

```python
from cognicore import Character, World
from cognicore.memory.memory_types import MemoryType

# 1. Initialize character with personality traits
marcus = Character(
    agent_id="Marcus",
    name="Merchant Marcus",
    personality={
        "honesty": 0.3,
        "greed": 0.85,
        "aggression": 0.4
    }
)

# 2. Add memories to their local SQLite vector store
marcus.memory.add_memory(
    content="I saw Guard Katherine hiding a bloodstained key near the forge at midnight.",
    memory_type=MemoryType.LONG_TERM,
    importance=8.0,
    tags=["Katherine", "forge", "evidence"]
)

# 3. Simulate an event (e.g. being questioned or accused)
# This triggers immediate emotional shifts and planning updates
marcus.emotions.process_event(event_type="accused", severity=0.8)

# 4. Tick the agent's cognitive heartbeat
marcus.step()

# 5. Inspect the resulting emotional state
emotions = marcus.emotions.get_state()
print(f"Marcus Anger: {emotions['anger']:.2f}, Suspicion: {emotions['suspicion']:.2f}")
```

### Use Case 2: Social Modeling & Information/Gossip Propagation

You can model complex social environments to research how information, secrets, and rumors mutate as they spread across a network.

```python
from cognicore.rumors.rumor_system import Rumor, RumorTracker
from cognicore.simulation.orchestrator import SimulationOrchestrator

# Create a simulation world with 5 characters
orchestrator = SimulationOrchestrator(num_agents=5)

# Seed an initial rumor
initial_rumor = Rumor(
    id="murder_gossip",
    origin_agent_id="Dennis",
    about_agent_id="Marcus",
    content="Marcus was walking near the Town Hall around midnight.",
    timestamp=1.0
)

# Let Dennis tell Innkeeper Elena the rumor
# Low honesty and high suspicion traits in the speaker automatically mutate the rumor text
Elena_tracker = RumorTracker(agent_id="Elena")
 Elena_tracker.hear_rumor(
    rumor=initial_rumor, 
    source_agent_id="Dennis", 
    source_trust=0.6 # High trust increases the acceptance probability
)

# Elena shares the rumor with others...
shared_rumor = Elena_tracker.known_rumors["murder_gossip"].mutate(
    speaker_honesty=0.4, 
    speaker_suspicion=0.7
)
print("Mutated rumor text:", shared_rumor.content)
# Output might yield: "Marcus threatened Arthur at the Town Hall around midnight."
```

---

## 🔒 Privacy-First Design: Local Execution & LoomGPT Integration

When deploying agent simulations in enterprise environments, data privacy is critical. Sending player inputs, agent logs, or custom storylines to third-party public clouds (like OpenAI or Claude) can violate data protection policies.

CogniCore supports **LoomGPT**—a secure, enterprise-grade, local, and private drop-in replacement for public LLM endpoints. 

### How to use LoomGPT to Design Custom Stuff

To run completely private and custom simulations, configure the unified `LLMClient` to use LoomGPT:

1. **Deploy LoomGPT locally or on your private network** (typically runs on `http://localhost:8080/v1`).
2. **Initialize the CogniCore SDK with the `loomgpt` provider**:

```python
from cognicore.llm.client import LLMClient

# Configure the LLM client to use your private LoomGPT server
private_config = {
    "provider": "loomgpt",
    "model": "loomgpt-local",
    "api_url": "http://localhost:8080/v1",  # Local private gateway url
    "api_key": "loomgpt-private-key-123"
}

llm_client = LLMClient(config=private_config)

# Run a secure completion check
response = llm_client.generate(
    prompt="Design a custom merchant character background for a fantasy simulator.",
    system_instruction="You are a creative game director.",
    json_mode=True
)

print(response)
```

Alternatively, set your configurations using environment variables before launching your application:

```bash
export COGNICORE_PROVIDER=loomgpt
export COGNICORE_MODEL=loomgpt-local
export COGNICORE_API_URL=http://localhost:8080/v1
export COGNICORE_API_KEY=loomgpt-private-key-123
```

---

## ⚡ Quick Start: Running the Silent Hollow Demo

Follow these instructions to spin up the local FastAPI server and the Vite+React 3D frontend. By default, the demo runs in **Mock mode** (offline, rule-based), meaning you do not need any paid cloud API keys to run the simulation!

### Prerequisites

* Python 3.10+
* Node.js 18+

### Step 1: Start the Backend (FastAPI Server)

1. Navigate to the project root directory:
   ```bash
   pip install -r requirements.txt
   ```
2. Start the FastAPI development server:
   ```bash
   python -m uvicorn silent_hollow_demo.backend.server:app --port 8000
   ```
   *The server runs on `http://localhost:8000/`. It dynamically picks a murderer, weapon, clues, and seeds the SQLite memory graph.*

### Step 2: Start the Frontend (Vite + React)

1. Open a new terminal in the frontend directory:
   ```bash
   cd silent_hollow_demo/frontend
   npm install
   ```
2. Launch the Vite development server:
   ```bash
   npm run dev
   ```
3. Open your browser and navigate to:
   👉 **[http://localhost:5173/](http://localhost:5173/)**

---

## 🎮 How to Play & Observe the Simulation

1. **Observe the 3D Village**: Look at the Three.js viewport in the center. You will see characters (Mayor, Guard, Merchant, Blacksmith, etc.) walking between the locations (Tavern, Forge, Farms, Clinic).
2. **Tick the World**: Click **Next Heartbeat** in the top right to step time forward. Watch NPCs walk, meet each other, converse, and update their goals.
3. **Inspect Suspects**: Click any NPC card on the left Character Intelligence panel to view their real-time inner state:
   * **Emotions Tab**: Dynamic numerical values shifting per transaction.
   * **Social Graph Tab**: A live relationship web showing trust, respect, and fear weights.
   * **Memories Tab**: What they have witnessed (spatial movement logs).
4. **Interrogate Suspects**: Select an NPC card and use the **Interrogation Console** on the right side. Select quick reply prompts (e.g. *“Where were you last night?”* or *“What do you think of Marcus?”*) or ask about secrets.
5. **Search for Clues**: Select a location and inspect it. Found evidence (e.g. Dennis's hammer, Clara's vial, bloody letters) is pinned directly on your case board.
6. **Accuse the Suspect**: Compare alibis, track secrets, find the murderer, and click **Accuse Suspect** to solve the mystery.
