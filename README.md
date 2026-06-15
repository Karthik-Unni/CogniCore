# CogniCore: Developer Framework Integration Guide

CogniCore is an open-source, reusable Character Intelligence Framework designed as a modular SDK. It enables developers to integrate persistent cognitive capabilities—including vector-based memory (RAG), dynamic emotional systems, directed social relationships, and autonomous planning—into virtual agents, simulations, and non-player characters (NPCs).

Think of CogniCore as **"Unity Physics, but for Character Decision-Making."** Instead of hardcoding branching dialogue trees or writing deterministic state machines, developers define *who* a character is (their traits, core motivations, and secrets), initialize the cognitive loop, and let systemic, believable behaviors emerge naturally.

---

## 🛠️ Module Architecture Overview

The framework is highly decoupled, allowing you to use the entire orchestrator or import specific submodules individually:

```text
cognicore/
├── agents/             # Core Agent controller that binds all modules
├── llm/                # Unified LLM provider client (Gemini, OpenAI, Claude, Ollama, LoomGPT)
├── rag/                # SQLite-based local vector store (zero-dependency cosine similarity)
├── memory/             # Tiered memory managers (Short-Term, Long-Term, Secrets)
├── emotions/           # Decaying 7-dimensional emotion model
├── relationships/      # Directed social graph matrices (Trust, Respect, Fear, Friendship)
├── goals/              # Priority-based goal definitions
├── planning/           # Action planner (Utility-based or LLM-driven)
└── rumors/             # Rumor mutation & propagation engines
```

---

## 🚀 Step-by-Step Framework Integration Guide

Follow this guide to integrate CogniCore into your Python application, game loop, or simulation engine.

### Step 1: Initialize the Character and Personality Trait Vector

A character is defined by a unique ID and a set of static personality weight parameters (`honesty`, `greed`, `aggression`, etc.) that guide planning and dialogue mutation.

```python
from cognicore.agents.agent import Agent

# Create an autonomous agent
agent = Agent(
    agent_id="Marcus",
    name="Merchant Marcus",
    personality={
        "honesty": 0.25,     # Low honesty: likely to lie or mutate rumors
        "greed": 0.85,       # High greed: values money, trades secrets for profit
        "aggression": 0.40,  # Moderate aggression
    }
)
```

---

### Step 2: Configure the LLM Engine (Cloud or Private LoomGPT)

The planning and interrogation modules leverage a unified `LLMClient`. For cloud setups, pass standard API credentials. For complete privacy, route calls to a local **LoomGPT** instance.

```python
from cognicore.llm.client import LLMClient

# 1. Cloud-Based Configuration
cloud_config = {
    "provider": "gemini",
    "model": "gemini-1.5-flash",
    "api_key": "YOUR_GEMINI_API_KEY"
}

# 2. Enterprise Privacy-First Configuration (LoomGPT Drop-In)
private_config = {
    "provider": "loomgpt",
    "model": "loomgpt-local",
    "api_url": "http://localhost:8080/v1",  # Local/VPC private endpoint
    "api_key": "loomgpt-private-token"       # Custom security token
}

# Instantiate and bind the client
llm_client = LLMClient(config=private_config)
agent.bind_llm_client(llm_client)
```

---

### Step 3: Manage Memory and RAG Queries

The memory submodule manages a rolling window of short-term interactions and indexes long-term memories inside a local SQLite-based vector store (RAG).

```python
from cognicore.memory.memory_types import MemoryType

# 1. Add short-term sensory observation
agent.memory.add_memory(
    content="I saw Guard Katherine walking suspiciously near the Blacksmith at midnight.",
    memory_type=MemoryType.SHORT_TERM,
    importance=8.0,
    tags=["Katherine", "forge", "midnight"]
)

# 2. Query RAG to retrieve relevant history based on current context
relevant_memories = agent.memory.query_memories(
    query_text="Is Katherine suspect?",
    k=2
)

for mem in relevant_memories:
    print(f"Retrieved: {mem['content']} (Cosine Similarity: {mem['score']:.2f})")
```

---

### Step 4: Update the Emotional State & Decay Ticks

Agents possess a 7-dimensional emotion engine. Emotions shift dynamically in response to external events (e.g. being accused, receiving gifts) and decay back toward baseline values on clock ticks.

```python
# 1. Simulate an event that triggers immediate emotional spikes
# accusing a character raises anger and suspicion, while lowering trust
agent.emotions.process_event(
    event_type="accused",
    severity=0.75
)

# 2. Inspect the updated emotion values
state = agent.emotions.get_state()
print(f"Anger: {state['anger']:.2f}, Suspicion: {state['suspicion']:.2f}")

# 3. Step the simulation clock to apply natural decay over time
agent.emotions.decay_tick()
```

---

### Step 5: Update the Subjective Relationship Matrix

NPC relationship vectors (Trust, Fear, Friendship) are subjective and directed. Character A's trust in Character B changes based on direct social transactions.

```python
# 1. Register a positive interaction (e.g., getting help)
agent.relationships.adjust_trust(
    target_agent_id="Elena",
    delta=0.15
)

agent.relationships.adjust_fear(
    target_agent_id="Katherine",
    delta=0.30  # Guard Katherine is acting aggressively, increasing fear
)

# 2. Query relationship weights to adjust dialogue tone
trust_score = agent.relationships.get_trust("Elena")
if trust_score > 0.5:
    print("Marcus: 'I trust you enough to tell you what I saw.'")
```

---

### Step 6: Define Custom Goals and Drive the Planner

CogniCore uses a utility-based scoring function to rank active goals. Ticking the planning engine prompts the character to execute actions satisfying their highest-priority goal.

```python
from cognicore.goals.goal_types import Goal

# 1. Define a custom goal
protect_self_goal = Goal(
    goal_id="hide_involvement",
    title="Protect My Involvement",
    base_priority=0.8,
    decay_rate=0.01
)
agent.goals.add_goal(protect_self_goal)

# 2. Step the planning loop
# The planner evaluates emotions, goals, and memories to determine the next action
plan = agent.planning.recalculate_plan(
    world_state={"murder_discovered": True}
)

print(f"Marcus's Plan: {plan.reasoning}")
# e.g., "Reasoning: Since my fear is high and the murder is discovered, I must build an alibi."
print(f"Immediate Action: {plan.next_action.type} -> {plan.next_action.target}")
```

---

### Step 7: Handle Rumors, Gossip, and Secrets Trading

Rumors mutate as they propagate from agent to agent depending on the speaker's personality. Secrets are guarded and only shared if trust exceeds defined thresholds.

```python
from cognicore.rumors.rumor_system import Rumor

# 1. Elena shares a rumor with Marcus
incoming_rumor = Rumor(
    id="scribe_murder_rumor",
    origin_agent_id="Dennis",
    about_agent_id="Katherine",
    content="Katherine was arguing with Arthur near the tavern.",
    timestamp=2.0
)

# Marcus decides whether to accept and believe the rumor based on his trust in Elena
believed = agent.rumors.hear_rumor(
    rumor=incoming_rumor,
    source_agent_id="Elena",
    source_trust=agent.relationships.get_trust("Elena")
)

# 2. Marcus propagates the rumor to a third agent
# Because Marcus has a low honesty vector (0.25), the rumor text will mutate!
if believed:
    mutated_rumor = agent.rumors.get_mutated_rumor("scribe_murder_rumor")
    print("Mutated Gossip:", mutated_rumor.content)
    # Output: "Katherine attacked Arthur near the tavern with a dagger."
```

---

## 🔒 Enterprise Privacy: Custom Simulations via LoomGPT

For enterprise applications, simulations must run in completely secure environments. You can run CogniCore 100% offline, locally, or inside a private cloud VPC without transmitting data to public third-party APIs by using **LoomGPT**.

LoomGPT serves as a local, private drop-in proxy. It intercepts traditional LLM payload requests and forwards them to open-source foundation models (such as Llama-3 or Mistral) running inside your secure infrastructure.

### Configuring CogniCore for LoomGPT

To route all agent decision-making and planning through LoomGPT, simply update the Unified LLM config environment variables:

```bash
# Set provider to LoomGPT
export COGNICORE_PROVIDER=loomgpt

# Point to your local LoomGPT gateway server
export COGNICORE_API_URL=http://localhost:8080/v1

# Use your private self-hosted model index
export COGNICORE_MODEL=loomgpt-local

# Provide your custom VPC security token
export COGNICORE_API_KEY=loomgpt-private-token-123
```

Now, when you instantiate `LLMClient(config=None)`, the SDK will automatically read these variables, log `"CogniCore running with LoomGPT private local model."`, and ensure complete local data privacy.

---

## 🧪 Testing the Framework

CogniCore features a comprehensive unit and integration test suite covering memory consolidation, rumor mutation, emotional decay dynamics, and secret sharing.

Run the tests locally:
```bash
python -m unittest tests/test_cognicore.py
```
*All tests run inside a temporary database wrapper to isolate test states.*
