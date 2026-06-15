<div align="center">

# 🧠 CogniCore

### The Character Intelligence Framework

**Unity Physics, but for believable AI characters.**

[![Python Version](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![PyPI version](https://img.shields.io/badge/pypi-v0.1.0-orange.svg)](https://pypi.org/project/cognicore/)
[![Build Status](https://github.com/Karthik-Unni/CogniCore/actions/workflows/ci.yml/badge.svg)](https://github.com/Karthik-Unni/CogniCore/actions)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![GitHub Stars](https://img.shields.io/github/stars/Karthik-Unni/CogniCore?style=social)](https://github.com/Karthik-Unni/CogniCore/stargazers)

[Quickstart](#-quickstart) · [Use Cases](#-use-cases) · [Silent Hollow Demo](#-silent-hollow--full-showcase-demo) · [LLM Integrations](#-bring-your-own-llm) · [Architecture](#-architecture)

</div>

---

## What is CogniCore?

Most "AI NPC" tools are dialogue engines — you send a prompt, get a reply, and the character forgets everything the moment the session ends.

**CogniCore is different.** It's infrastructure for character *minds* — a reusable system for memory, emotion, relationships, goals, and social dynamics that sits underneath whatever game, app, or chat interface you're already building.

> Think of it the way you'd think of a physics engine. You don't hand-script how a ball bounces — you give it mass, gravity, and friction, and let the engine work out the rest. CogniCore does the same for character *behavior*: you define **who** a character is, and their actions, relationships, and reactions **emerge** from the simulation.

### Core Philosophy: Predictable Rules, Unpredictable Stories

- **Predictable rules** — emotions decay on a tick-based clock, memories are retrieved by vector similarity, rumors mutate based on each agent's honesty trait, relationships shift based on defined weights.
- **Unpredictable stories** — because those rules interact, every run produces a different social narrative. You don't script who betrays whom — the simulation finds out.

---

## ✨ Features

| System | What it does |
|---|---|
| 🧠 **Multi-Tiered Memory** | Short-term, long-term, social, and secret memory stores with SQLite-based vector search (RAG) — runs fully offline |
| 🎭 **Emotion Engine** | 7 tracked dimensions (anger, fear, suspicion, happiness, trust, guilt, confidence) with tick-based decay |
| 🕸️ **Relationship Graph** | Directed graph of trust, respect, fear, friendship, rivalry, and loyalty between every pair of agents |
| 🎯 **Goal & Planning Engine** | Rule-based utility planners or LLM-assisted planners — your choice |
| 🤫 **Rumors & Secrets** | Information mutates as it spreads; secrets can be traded, leaked, or weaponized |
| 🔌 **Pluggable LLMs** | OpenAI, Gemini, Claude, Ollama, LoomGPT, your own local model — or zero API keys at all |
| 🎮 **Showcase Demo** | "Silent Hollow" — a full 3D murder-mystery sim built entirely on CogniCore |

---

## 📦 Installation

```bash
pip install cognicore-sdk==0.1.0
```

CogniCore runs **completely free and offline** out of the box — no API key required. The default mode uses rule-based planning and local SQLite embeddings.

Want richer dialogue and planning from a hosted or local LLM? Install the extra for your provider:

```bash
pip install cognicore-sdk[openai]      # OpenAI / GPT models
pip install cognicore-sdk[gemini]      # Google Gemini
pip install cognicore-sdk[anthropic]   # Claude
pip install cognicore-sdk[ollama]      # Local models via Ollama
pip install cognicore-sdk[all]         # everything
```

---

## 🚀 Quickstart

```python
from cognicore import Agent, World, Simulation
from cognicore.llm import MockLLM  # zero-dependency, no API key needed

# Define a world
world = World(name="Greenfield Village")

# Define two characters
maya = Agent.from_config("characters/maya.yaml", llm=MockLLM())
tom  = Agent.from_config("characters/tom.yaml", llm=MockLLM())

# Run the simulation
sim = Simulation(world=world, agents=[maya, tom])
sim.run(ticks=50)

# Inspect what happened
print(maya.emotions.summary())
print(maya.relationships.to(tom))
print(maya.memory.recall("Tom"))
```

Characters are defined in plain YAML — no subclassing required:

```yaml
# characters/maya.yaml
name: Maya
personality:
  honesty: 0.3
  curiosity: 0.8
  extraversion: 0.6
goals:
  - type: uncover_secret
    target: Tom
    priority: 0.9
relationships:
  Tom: { trust: 0.4, rivalry: 0.5 }
```

---

## 🎮 Use Cases

### 1. A companion character that remembers and reacts

Build a chat companion that doesn't reset every session — and whose mood actually shifts based on how you treat it.

```python
from cognicore import Agent
from cognicore.llm import OpenAIAdapter

companion = Agent.from_config("characters/jin.yaml", llm=OpenAIAdapter(model="gpt-4.1"))

companion.perceive("You forgot my birthday again.")
print(companion.emotions.summary())
# {'trust': -0.2, 'guilt': 0.0, 'happiness': -0.4, ...}

reply = companion.respond("You forgot my birthday again.")
print(reply)
```

Every interaction updates `companion`'s emotion state and memory — and it persists across sessions via the local SQLite store.

### 2. A small social sim where rumors spread

Drop a handful of NPCs into a `World`, seed a rumor, and watch it mutate as it passes between agents with different honesty traits.

```python
from cognicore import World, Simulation, Agent
from cognicore.llm import MockLLM

villagers = [
    Agent.from_config(f"characters/villager_{i}.yaml", llm=MockLLM())
    for i in range(5)
]

world = World(name="Hollow Creek")
world.seed_rumor(
    source=villagers[0],
    content="The blacksmith stole from the church donations.",
)

sim = Simulation(world=world, agents=villagers)
sim.run(ticks=30)

for v in villagers:
    print(v.name, "believes:", v.memory.recall_rumor("blacksmith"))
```

By tick 30, the rumor each villager believes may look nothing like the original — exactly the "unpredictable story from predictable rules" CogniCore is built around.

---

## 🏘️ Silent Hollow — Full Showcase Demo

`silent_hollow_demo/` is a complete murder-mystery simulation built entirely on CogniCore — a fully playable, isometric Three.js village where every NPC has memory, emotions, secrets, and relationships, plus a real-time dashboard for watching the simulation think.

```bash
# Backend (FastAPI)
cd silent_hollow_demo/backend
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend (Vite + React + Three.js)
cd silent_hollow_demo/frontend
npm install
npm run dev
```

Then open `http://localhost:5173` and watch the village live — characters investigating, gossiping, forming alliances, and occasionally turning on each other.

---

## 🔌 Bring Your Own LLM

Every CogniCore agent takes an `llm` adapter. Built-in adapters:

| Adapter | Use case |
|---|---|
| `MockLLM` | Zero dependencies, fully deterministic, great for testing |
| `OllamaAdapter` | Local open models (Llama, Mistral, etc.) |
| `LoomGPTAdapter` | Local private models (standard self-hosted / private gateway endpoints) |
| `OpenAIAdapter` | GPT-4.1 / GPT-5 family |
| `GeminiAdapter` | Google Gemini models |
| `ClaudeAdapter` | Anthropic Claude models |

### Writing your own adapter

Any LLM — including a model you trained yourself — can power CogniCore. Just implement `BaseLLMAdapter`:

```python
import requests
from cognicore.llm import BaseLLMAdapter

class LoomGPTAdapter(BaseLLMAdapter):
    """Adapter for a local LOOM-GPT model server."""

    def __init__(self, endpoint="http://localhost:8008/generate"):
        self.endpoint = endpoint

    def generate(self, prompt: str, **kwargs) -> str:
        response = requests.post(self.endpoint, json={"prompt": prompt, **kwargs})
        return response.json()["text"]
```

```python
agent = Agent.from_config("characters/maya.yaml", llm=LoomGPTAdapter())
```

This gives you a fully local stack: CogniCore handles character logic, memory, emotions, and social dynamics, while a small custom-trained model from [LOOM-GPT](https://github.com/Karthik-Unni) handles the actual text generation — zero cloud dependencies, zero API cost.

#### What is LOOM-GPT?
LOOM-GPT is a local transformer laboratory (available on PyPI via `pip install loom-gpt==0.1.0`) designed to train small domain-specific transformers from scratch, run local inference, and weave specialist model outputs together. Integrating it with CogniCore provides complete offline privacy for custom character models.

---

## 🧩 Architecture

```
cognicore/               # The reusable SDK
├── agents/             # Autonomous agent runtime loops
├── emotions/           # Emotion state transitions & decay
├── goals/              # Goal weighting & selection
├── llm/                # LLM adapters (OpenAI, Gemini, Claude, Ollama, Mock, LoomGPT, custom)
├── memory/             # Short-term, long-term, social & secret memory
├── personality/        # Character trait vectors
├── planning/           # Rule-based & LLM-based planners
├── rag/                # SQLite vector store
├── relationships/      # Relationship graph
├── rumors/             # Rumor propagation & mutation
├── secrets/            # Secret management & exposure
├── social_graph/       # Graph visualization & tracking
├── world/              # Environment & clock
└── simulation/         # Multi-agent orchestration

silent_hollow_demo/      # Full showcase app
├── backend/            # FastAPI server
└── frontend/           # Vite + React + Three.js dashboard
```

---

## 🤝 Contributing

Issues and PRs welcome. If you build a custom LLM adapter, planner, or world, consider opening a PR to add it to `examples/`.

---

## 📄 License

[MIT](LICENSE) — use it, fork it, ship it.
