<div align="center">

# 🧠 CogniCore

### A Character Intelligence Framework for Believable AI NPCs

**Memory, emotion, relationships, rumors, and secrets — for characters that evolve through interaction instead of running on scripts.**

[![Python Version](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![PyPI version](https://img.shields.io/badge/pypi-v0.1.0-orange.svg)](https://pypi.org/project/cognicore-sdk/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

## What is CogniCore?

Most "AI NPC" demos are a chat window wired to an LLM — send a prompt, get a reply, forget everything when the session ends.

**CogniCore is the layer underneath that.** It's a multi-agent character runtime: persistent memory backed by a local vector store, an emotion engine that decays over time instead of resetting, a relationship graph between every pair of characters, and a rumor/secret system where information mutates and spreads the way gossip actually does. You wire an LLM (or nothing at all — it runs fully offline) into it for the actual text generation; CogniCore handles everything around *why* a character says what it says.

### Core philosophy: predictable rules, unpredictable stories

- **Predictable rules** — emotions decay on a tick-based clock toward a baseline, memories are retrieved by similarity search, rumors mutate based on the speaker's honesty and suspicion, relationships shift by fixed weights per social event.
- **Unpredictable stories** — because those rules interact across many characters and many ticks, no two simulation runs play out the same way. Nobody scripts who turns on whom; the simulation works it out.

---

## 🎮 Real-World Use Cases

- **Living RPG NPCs**: Create merchants, guards, companions, and quest-givers that remember player actions, form relationships, spread rumors, and evolve naturally over time.
- **Detective & Mystery Games**: Design investigations where suspects maintain alibis, hide secrets, lie to protect allies, and react dynamically to evidence and accusations.
- **AI Companions**: Build persistent companions whose emotions, trust, loyalty, and behavior evolve through long-term interactions with users or players.
- **Social Simulation Research**: Study trust formation, deception, influence, rumor propagation, and emergent social behavior within autonomous agent communities.
- **Historical Simulations**: Create believable historical figures, political leaders, and citizens that pursue goals, form alliances, and respond dynamically to world events.
- **Training & Roleplay Systems**: Power negotiation training, leadership development, customer support simulations, interview practice, and conflict-resolution environments.
- **Virtual Societies**: Simulate evolving communities of autonomous digital citizens that develop friendships, rivalries, social groups, and collective behaviors.
- **Enterprise Agent Simulations**: Model information flow, policy compliance, insider threats, organizational behavior, and multi-agent workflows within secure environments.
- **Offline AI Worlds**: Run fully local, privacy-preserving AI simulations using Loom-GPT, Ollama, or other local models without relying on external APIs.

---

## 💻 Developer Integration Examples

### 1. A companion character that remembers and reacts
Every character interaction writes to persistent memory and nudges the emotion state. Because the vector store is a local SQLite file, the character's memory survives across process restarts.
```python
from cognicore import Character, SQLiteVectorStore, Goal

companion = Character(
    agent_id="jin", name="Jin",
    personality={"warmth": 0.7, "patience": 0.4},
    goals=[Goal(id="idle", description="Be a good friend")],
    vector_store=SQLiteVectorStore(db_path="jin.db"),
)

companion.observe("I threatened to leave if things don't change.", timestamp=0)
print(companion.emotions.get_state())
```

### 2. A small social sim where gossip spreads and mutates
Register a handful of `Character`s with a shared `SQLiteVectorStore`, seed one of them with a `Rumor`, and call `orchestrator._resolve_conversation(speaker, listener)` (or just run `orchestrator.step()` repeatedly with characters placed in the same `World` location) to watch the story warp as it passes between agents with different honesty levels.

### 3. Drive characters with an LLM instead of rules
Pass any `LLMClient` with a non-mock provider into `Character`, and the planner automatically switches from rule-based logic to LLM-assisted reasoning over personality, emotions, relationships, and retrieved memories.
```python
from cognicore import Character, SQLiteVectorStore, Goal
from cognicore.llm.client import LLMClient

llm = LLMClient({"provider": "openai", "api_key": "sk-...", "model": "gpt-4o-mini"})

wizard = Character(
    agent_id="gandry", name="Gandry",
    personality={"openness": 0.9},
    goals=[Goal(id="seek_knowledge", description="Uncover the ruins' secret")],
    vector_store=SQLiteVectorStore(db_path="gandry.db", llm_client=llm),
    llm_client=llm,
)
```

### 4. Dynamic Quest Giver NPCs (RPG / Adventure Games)
Create game questlines that adapt automatically to your social standing. Instead of static dialog switches, NPCs evaluate their relationship metrics and current emotions before deciding to trust you with a quest or run away from you.
```python
# A quest giver character
merchant = Character(
    agent_id="merchant_marcus", name="Marcus",
    personality={"greed": 0.9, "honesty": 0.4},
    goals=[Goal(id="protect_vault", description="Keep treasury safe")],
    vector_store=SQLiteVectorStore(db_path="world.db"),
)

# If trust is low, Marcus refuses to share the location of the stolen ledger
if merchant.relationships.get_trust("player") < 0.3:
    print("Marcus refuses to cooperate and acts defensive.")
```

### 5. Multi-Agent Group Dynamics (Behavioral Simulations)
Study group dynamics, corporate workspaces, or safety behaviors. Seed a population of agents, introduce a single "lie" or "theft" event, and track how the social graph evolves, who forms rivalries, and how secrets leak across the network.

---

## ✨ Features

| System | What it actually does |
|---|---|
| 🧠 **Multi-tiered memory** | Short-term (sliding window), long-term, episodic, social, and secret memory, all queryable by similarity search through a local SQLite store — no external vector DB required |
| 🔍 **Built-in RAG** | Pure-Python TF-IDF cosine similarity by default (zero dependencies). Automatically upgrades to real OpenAI/Gemini embeddings if you configure an API key |
| 🎭 **Emotion engine** | 7 tracked dimensions (`anger`, `fear`, `suspicion`, `happiness`, `trust`, `guilt`, `confidence`), each decaying toward a baseline at its own configurable rate |
| 🕸️ **Relationship graph** | Per-pair, directional metrics (`trust`, `respect`, `fear`, `friendship`, `rivalry`, `loyalty`), exportable as JSON for D3/Vis.js-style visualization |
| 🎯 **Goals & planning** | Pick between a zero-dependency rule-based planner or LLM-assisted planning that reasons over personality, memory, and world state |
| 🤫 **Rumors & secrets** | Rumors mutate via rule-based text transformation as they pass between characters with different honesty/suspicion levels; secrets are shared or exposed based on trust thresholds, not coin flips |
| 🔌 **Pluggable LLMs** | OpenAI, Gemini, Claude, Ollama, or a deterministic mock mode that needs no API key at all |
| 🎮 **Showcase demo** | *Silent Hollow* — a playable murder-mystery sim built on top of the SDK, with a FastAPI backend and a Three.js isometric frontend |

---

## 📦 Installation

```bash
pip install cognicore-sdk==0.1.1
```

> **Note:** the published `0.1.0` package is missing `pydantic` as a declared dependency, which it requires internally. Until a patched release is out, also run `pip install pydantic`, or install from source (see below) where this is already fixed.

To install from source instead:

```bash
git clone https://github.com/Karthik-Unni/CogniCore.git
cd CogniCore
pip install -r requirements.txt
pip install -e .
```

CogniCore runs **completely offline by default** — the default `LLMClient` provider is `"mock"`, which uses rule-based planning and TF-IDF similarity search with no API key and no network calls. To use a real LLM, set a provider when constructing your `LLMClient`:

```bash
pip install cognicore-sdk[openai]      # OpenAI models
pip install cognicore-sdk[gemini]      # Google Gemini
pip install cognicore-sdk[anthropic]   # Claude
# Ollama needs no extra — it talks to a local server over plain HTTP
```

---

## 🚀 Quickstart

This example is copied directly from a working run against the current codebase — every line of output below is real, not illustrative.

```python
from cognicore import Character, World, SimulationOrchestrator, Goal, SQLiteVectorStore

# A local, file-backed vector store — no external DB needed
vector_store = SQLiteVectorStore(db_path="my_world.db")

world = World()
orchestrator = SimulationOrchestrator(world)

maya = Character(
    agent_id="maya",
    name="Maya",
    personality={"honesty": 0.3, "curiosity": 0.8},
    goals=[Goal(id="idle", description="Go about daily business")],
    vector_store=vector_store,
)
orchestrator.register_character(maya)

# Characters react emotionally to events with trigger keywords
# (murder/dead/body, stole/theft, threat/argue) out of the box
maya.emotions.process_event("accused", severity=1.0)
print(maya.emotions.get_state())
# {'anger': 0.25, 'fear': 0.2, 'suspicion': 0.25, 'happiness': 0.1, 'trust': 0.5, 'guilt': 0.0, 'confidence': 0.5}

# Run a tick of the simulation — Maya evaluates goals, retrieves
# relevant memories, and decides her next action
orchestrator.step()
print(maya.last_action)
# {'type': 'MOVE', 'target': 'Tavern', 'metadata': {'reason': 'Look for customers'}}
```

Notes on what's actually happening here, since the API is intentionally low-magic:

- `Character` is the core agent class — there's no separate `Agent` wrapper or YAML config loader. Personality is currently a plain `Dict[str, float]` you define yourself (e.g. `{"honesty": 0.3, "greed": 0.7}`); the specific keys you use are then read by your own goal/planning logic.
- `emotions.process_event(...)` applies a predefined delta set for common events (`accused`, `threatened`, `gift_received`, `caught_lying`, `secret_shared`, `evidence_found`). `Character.observe(description)` is the free-text path, but it currently only updates emotions when the text contains specific trigger keywords (`murder`/`dead`/`body`, `stole`/`theft`, `threat`/`argue`) — it isn't doing general sentiment analysis on arbitrary text yet.
- `orchestrator.step()` runs one full tick: broadcasting local observations, letting every registered character plan and act, resolving those actions against the `World`, then decaying emotions and consolidating short-term memory into long-term summaries.

### Persistent memory + retrieval

```python
maya.memory.add_secret(
    "I stole gold from the church",
    secrecy_level=0.8, expose_penalty=0.6, timestamp=0, related_entities=[]
)

results = maya.memory.query_memories("gold", k=3)
print([m.content for m in results])
# ['I stole gold from the church']
```

This is backed by `SQLiteVectorStore`, which uses hand-rolled TF-IDF cosine similarity over your stored memories by default — no embedding API call required. If you attach an `LLMClient` configured for OpenAI or Gemini, it transparently switches to real embedding-based similarity instead.

### Rumors that mutate as they spread

```python
from cognicore import Rumor

rumor = Rumor(
    id="r1", origin_agent_id="elena", about_agent_id="alden",
    content="Alden was seen at late night near the vault.", timestamp=0.0,
)

# A dishonest, suspicious speaker distorts the story on retelling
mutated = rumor.mutate(speaker_honesty=0.1, speaker_suspicion=0.7)
print(mutated.content)
# 'Alden was seen acting suspiciously sneaking around at midnight near the vault.'
print(round(mutated.fidelity, 2))
# 0.84
```

Whether a listener *believes* a rumor depends on how much they trust the source — `RumorTracker.hear_rumor()` rejects rumors from low-trust speakers and accepts high-fidelity rumors from trusted ones at different probabilities, rather than a fixed coin flip.

---

## 🏘️ Silent Hollow — Showcase Demo

`silent_hollow_demo/` is a playable murder-mystery built on top of the SDK — 8 named characters with secrets, emotions, and relationships, a FastAPI backend running the simulation loop, and a Three.js isometric frontend for watching it unfold.

```bash
# Backend
cd silent_hollow_demo/backend
pip install fastapi uvicorn
uvicorn server:app --reload

# Frontend
cd silent_hollow_demo/frontend
npm install
npm run dev
```

Open the frontend dev server URL and watch the village — characters investigating, gossiping, forming alliances, and occasionally giving themselves away.

**Worth knowing:** the demo's locations (Tavern, Blacksmith, Town Hall...) and goal types (`solve_murder`, `hide_crime`, `self_preservation`) are currently hardcoded directly into the SDK's core `World` and `Goal` classes, not cleanly separated into demo-only config. If you're building your *own* world rather than running Silent Hollow, you'll currently need to either work around or fork these classes — see [Known Limitations](#-known-limitations--roadmap).

---

## 🔌 LLM Providers

`LLMClient` is configured with a plain dict, not a separate adapter class per provider:

```python
from cognicore.llm.client import LLMClient

# No API key needed — deterministic rule-based responses
mock = LLMClient({"provider": "mock"})

# Real providers
openai_client = LLMClient({"provider": "openai", "api_key": "sk-...", "model": "gpt-4o-mini"})
gemini_client = LLMClient({"provider": "gemini", "api_key": "...", "model": "gemini-1.5-flash"})
claude_client = LLMClient({"provider": "claude", "api_key": "...", "model": "claude-3-5-sonnet-20240620"})
ollama_client = LLMClient({"provider": "ollama", "api_url": "http://localhost:11434", "model": "llama3"})
```

If an API call fails for any reason, `LLMClient.generate()` automatically falls back to mock output rather than raising — useful for keeping a long-running simulation alive through transient API errors, though it does mean failures can silently degrade output quality rather than surfacing loudly.

### Training your own local model

If you want characters that run on a custom-trained model instead of a hosted API, [**LOOM-GPT**](https://pypi.org/project/loom-gpt/) (`pip install loom-gpt`) is a companion project — a from-scratch, hackable PyTorch implementation for training small, domain-specific transformers locally and inspecting how they generate. It's aimed at understanding and experimenting with GPT-style models, not at replacing a hosted LLM's general capability — pair it with CogniCore by serving its output through a small local HTTP wrapper and pointing an `LLMClient` at it with `provider: "ollama"`-style config, or by writing a small custom branch in `LLMClient._init_provider()`.

---

## 🧩 Architecture

```
cognicore/               # The SDK
├── agents/             # Character class — the core agent runtime loop
├── emotions/           # EmotionEngine: tick-based decay, event-driven updates
├── goals/              # Goal class with dynamic priority evaluation
├── llm/                # LLMClient — single class, multi-provider via config dict
├── memory/             # MemoryManager + Memory/MemoryType models
├── planning/            # Planner — rule-based fallback or LLM-assisted
├── rag/                 # SQLiteVectorStore — TF-IDF or real embeddings
├── relationships/       # RelationshipManager — per-pair directional metrics
├── rumors/               # Rumor model + RumorTracker (mutation, belief)
├── secrets/              # SecretSystem — static methods for share/expose logic
├── social_graph/         # Exports relationship data as graph JSON
├── world/                # World — locations, agent placement, clue tracking
└── simulation/           # SimulationOrchestrator — the multi-agent tick loop

silent_hollow_demo/       # Showcase app (NOT required to use the SDK)
├── backend/             # FastAPI server wrapping SimulationOrchestrator
└── frontend/            # Vite + React + Three.js dashboard

tests/                   # 6 unit/integration tests, all passing as of this writing
```

---

## 🤝 Contributing

Issues and PRs welcome — especially around decoupling the demo-specific logic from the core SDK classes noted above, or adding new LLM provider adapters.

---
