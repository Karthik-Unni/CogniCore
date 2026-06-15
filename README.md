# CogniCore: Open-Source Character Intelligence Framework

CogniCore is a production-grade Character Intelligence Framework designed as a reusable SDK. It enables persistent AI characters with memory, emotions, relationships, goals, planning capabilities, social reasoning, and autonomous behavior.

Think of CogniCore as **"Unity Physics, but for Character Intelligence."** Instead of hardcoding dialogue trees or scripting every action, developers define *who* a character is (their personality, motivations, and secrets), and let their behavior emerge naturally through systemic interactions.

---

## 🌟 Core Philosophy: Predictable Rules, Unpredictable Stories

Emergent systems are fascinating because of the interplay between rules and autonomy:
*   **Predictable Rules**: Emotions decay smoothly, rumors mutate logically based on honesty traits, memories are retrieved via vector similarity, and plans are built to satisfy active goals.
*   **Unpredictable Stories**: You don't know who will turn on whom, who will spread which rumors, which secrets will be exposed, or how a mystery will resolve. Every simulation run produces a different, believable social narrative.

---

## 🚀 Key Features

*   🧠 **Multi-Tiered Memory**: Short-term, long-term, social, and secret memories with SQLite-based vector indexing (RAG) for zero-dependency local runs.
*   🎭 **Emotion Engine**: Real-time numerical tracking of 7 core dimensions (`anger`, `fear`, `suspicion`, `happiness`, `trust`, `guilt`, `confidence`) with tick-based decay.
*   🕸️ **Relationship Social Graph**: Directed graph mapping trust, respect, fear, friendship, rivalry, and loyalty between all agents.
*   🎯 **Goal & Planning Engine**: Dynamic priority selection with LLM-assisted or rule-based/utility-based deterministic planners.
*   🤫 **Secret & Rumor Propagation**: Mutation of rumor details during retelling, trust verification, and secret trading/exposure mechanics.
*   🎮 **Silent Hollow 3D Showcase**: A fully playable murder mystery simulation featuring a Three.js isometric village and a real-time developer observability dashboard.

---

## 📂 SDK Folder Structure

```text
cognicore/               # Reusable Character Intelligence SDK
├── agents/             # Autonomous agent runtime loops
├── emotions/           # Emotion state transition & decay models
├── goals/              # Dynamic goal-weight structures
├── llm/                # LLM adapters (Gemini, OpenAI, Ollama, Mock)
├── memory/             # Short-term, long-term, social, and secret memory
├── personality/        # Character personality vector traits
├── planning/           # Utility-based and LLM planners
├── rag/                # SQLite-based RAG and vector database interface
├── relationships/      # Directed relationship weights and matrices
├── rumors/             # Rumor propagation and mutation logic
├── secrets/            # Secret management and exposure thresholds
├── social_graph/       # Visual graph generation and trackers
├── world/              # Environment and clock simulation managers
└── simulation/         # Multi-agent orchestrators

silent_hollow_demo/      # Showcase Simulation Application
├── backend/            # FastAPI orchestration server
└── frontend/           # Vite + React + Three.js dashboard
```

---

## ⚙️ Development Setup

Refer to the [Implementation Plan](docs/implementation_plan.md) for architectural details and execution options.
- The framework can run **locally and for free** out-of-the-box using standard rule-based planning and SQLite embeddings, requiring no LLM API keys.
- You can plug in Gemini, OpenAI, Claude, or local Ollama instances through simple environment configurations.



<img width="1912" height="1078" alt="image" src="https://github.com/user-attachments/assets/2239f684-6f28-49cc-b32f-172a419d7d9c" />
<img width="958" height="539" alt="image" src="https://github.com/user-attachments/assets/8c3d4f00-d9f4-4c94-a685-835cdd832dcf" />
