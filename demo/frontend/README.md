# The Last Supper at Ravenwood Inn (3D Browser Game Demo)

This is a single-page 3D browser mystery game that serves as a living demo of the **CogniCore Character Intelligence Framework**. All systems run purely client-side in the browser.

## 🎮 Game Concept
You are a traveling investigator who arrives at a small inn where the valuable royal **Ravenwood Amulet** has gone missing. You have exactly **5 days** (turns) to deduce which of the 5 suspects is the thief.

### Playable Suspects (NPC Guests)
1. **Maren** (Innkeeper) — High honesty, low suspicion. Knows everyone's business.
2. **Dorian** (Merchant) — High greed, low honesty.
3. **Sable** (Scholar) — High curiosity, high suspicion.
4. **Fen** (Soldier) — High loyalty, low openness. Protects someone.
5. **Vex** (Performer) — High charm, medium honesty.

---

## 🧠 CogniCore Systems Implemented (Client-Side JS)
- **EmotionEngine**: Dynamic tracking of Anger, Fear, Suspicion, Guilt, and Happiness. NPCs change colors in 3D (red for suspicious, blue for fearful) based on their state.
- **MemoryStore**: Recency and keyword-based retrieval of conversations and events.
- **RelationshipGraph**: Matrix of trust/suspicion scores between characters and toward the player.
- **RumorSystem**: At night, NPCs gossip based on trust relationships. Rumors mutate as they propagate.
- **SecretSystem**: NPC secrets are revealed only when the investigator gains enough trust.

---

## ⚡ How to Play
1. **Open the Game**: Since the game is client-side, you can run the development server or open the `index.html` file directly.
2. **Ask Questions**: Click on any suspect in the 3D room to approach and talk to them. Interrogating them costs **1 Action**.
3. **Search Rooms**: Go to the **Notebook** -> **Search Location** and search a room to find physical clues (costs **1 Action**).
4. **End the Day**: When you run out of actions, click the **End Day** button. Overnight, guests will gossip, and rumors will mutate based on their honesty.
5. **Accuse**: Click the **Accuse!** button, select the culprit, and pair your accusation with a piece of evidence.

---

## ⚙️ Settings (Claude Live Mode)
By default, the game uses a robust offline rule-based dialogue engine. To enable **Claude Live Mode**:
1. Click the **Settings (gear)** icon in the top right.
2. Enter your **Anthropic API Key**.
3. Use the recommended **CORS Proxy Prefix** (e.g. `https://corsproxy.io/?`) to bypass browser CORS policies.
4. Click **Save Options** to route dialogue queries to Claude-3.5-Sonnet in real-time.

---

## 🛠️ Running Locally
To launch the Vite development server:
```bash
npm install
npm run dev
```
To build the standalone HTML file:
```bash
npm run build
```
This generates the optimized `dist/index.html` file containing all code, CSS, and logic.
