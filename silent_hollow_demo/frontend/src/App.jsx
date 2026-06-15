import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, Search, RefreshCw, Play, 
  MapPin, Clock, Eye, AlertCircle, Compass, HelpCircle,
  FileText, Shield, Sparkles, MessageCircle, BarChart3, Database,
  Award, AlertTriangle, Users, Network, Share2
} from 'lucide-react';

import ThreeViewport from './components/ThreeViewport';
import SocialGraphView from './components/SocialGraphView';
import './App.css';

// Import local generated assets
import mayorAldenPortrait from './assets/mayor_alden_portrait.png';
import guardKatherinePortrait from './assets/guard_katherine_portrait.png';
import merchantMarcusPortrait from './assets/merchant_marcus_portrait.png';
import defaultVillagerPortrait from './assets/default_villager_portrait.png';
import evidenceBloodyLetter from './assets/evidence_bloody_letter.png';

const API_BASE = "http://localhost:8000/api";

const PORTRAITS = {
  "Alden": mayorAldenPortrait,
  "Katherine": guardKatherinePortrait,
  "Marcus": merchantMarcusPortrait,
  "Dennis": defaultVillagerPortrait,
  "Clara": defaultVillagerPortrait,
  "Elena": defaultVillagerPortrait,
  "Silas": defaultVillagerPortrait,
  "Gerald": defaultVillagerPortrait
};

const QUICK_REPLIES = [
  "Where were you last night?",
  "Did you hear anything suspicious?",
  "Who do you trust in this village?",
  "Do you have any secrets?"
];

export default function App() {
  // Global States
  const [worldState, setWorldState] = useState(null);
  const [agents, setAgents] = useState({});
  const [socialGraph, setSocialGraph] = useState(null);
  const [selectedAgentId, setSelectedAgentId] = useState("Marcus");
  const [activeSubView, setActiveSubView] = useState("dashboard"); // "dashboard", "clues", "interrogate", "social"
  
  // Interaction States
  const [chatLogs, setChatLogs] = useState({}); // agent_id -> list of messages
  const [chatInput, setChatInput] = useState("");
  const [cluesFound, setCluesFound] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [gameResult, setGameResult] = useState(null);

  // 1. Initial Load & Sync
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const stateRes = await fetch(`${API_BASE}/state`);
      const stateData = await stateRes.json();
      setWorldState(stateData);

      const agentsRes = await fetch(`${API_BASE}/agents`);
      const agentsData = await agentsRes.json();
      setAgents(agentsData);

      const graphRes = await fetch(`${API_BASE}/social-graph`);
      const graphData = await graphRes.json();
      setSocialGraph(graphData);
      
      if (stateData && stateData.clues) {
        const found = [];
        Object.entries(stateData.clues).forEach(([loc, list]) => {
          list.forEach(c => {
            if (c.found_by.includes("player")) {
              found.push({ ...c, location: loc });
            }
          });
        });
        setCluesFound(found);
      }
    } catch (e) {
      console.error("Error syncing simulation backend:", e);
    }
  };

  // 2. Control Operations
  const handleStep = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/step`, { method: "POST" });
      await res.json();
      await fetchData();
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  const handleReset = async () => {
    if (!window.confirm("Are you sure you want to restart the murder mystery? All evidence and conversations will be reset.")) return;
    setIsLoading(true);
    setChatLogs({});
    setGameResult(null);
    try {
      const res = await fetch(`${API_BASE}/reset`, { method: "POST" });
      await res.json();
      await fetchData();
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  // 3. Dialogue Interrogation
  const sendChatMessage = async (msgText) => {
    const newLogs = [...(chatLogs[selectedAgentId] || []), { sender: "player", text: msgText }];
    setChatLogs(prev => ({ ...prev, [selectedAgentId]: newLogs }));

    try {
      const res = await fetch(`${API_BASE}/player/talk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: selectedAgentId, message: msgText })
      });
      const data = await res.json();
      
      setChatLogs(prev => ({
        ...prev,
        [selectedAgentId]: [...(prev[selectedAgentId] || []), { sender: "npc", text: data.response }]
      }));
      
      fetchData(); // Sync updated emotions/relationships
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput);
    setChatInput("");
  };

  // 4. Clue Search
  const handleSearchLocation = async () => {
    const activeNPC = agents[selectedAgentId];
    if (!activeNPC || !worldState) return;
    
    const loc = worldState.agent_positions[selectedAgentId] || "Marketplace";
    try {
      const res = await fetch(`${API_BASE}/player/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: loc })
      });
      const data = await res.json();
      
      if (data.clues_found && data.clues_found.length > 0) {
        alert(`Clue found at the ${loc}: "${data.clues_found[0].name}"!\n${data.clues_found[0].description}`);
        
        // Log to chat
        setChatLogs(prev => ({
          ...prev,
          [selectedAgentId]: [
            ...(prev[selectedAgentId] || []), 
            { sender: "system", text: `🔎 EVIDENCE RECORDED: Found ${data.clues_found[0].name} at the ${loc}.` }
          ]
        }));
      } else {
        alert(`You searched the ${loc} thoroughly but found no physical clues.`);
      }
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // 5. Accusation
  const handleAccuse = async () => {
    const activeNPC = agents[selectedAgentId];
    if (!activeNPC) return;
    
    if (!window.confirm(`Are you absolutely ready to accuse ${activeNPC.name} of murder? This will close the case.`)) return;

    try {
      const res = await fetch(`${API_BASE}/player/accuse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: selectedAgentId })
      });
      const data = await res.json();
      setGameResult(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Helper variables
  const activeNPC = agents[selectedAgentId];
  const activeNPCLogs = chatLogs[selectedAgentId] || [];
  
  // Calculate trust percentage relative to Player (default to neutral 50% if not set)
  const getNPCTrustPct = (npcId) => {
    const agentData = agents[npcId];
    if (!agentData || !agentData.relationships || !agentData.relationships.Player) return 50;
    const rawVal = agentData.relationships.Player.trust; // -1.0 to 1.0
    return Math.round((rawVal + 1.0) * 50);
  };

  const currentLoc = worldState?.agent_positions[selectedAgentId] || "Town Square";
  const currentTick = worldState?.tick || 0;
  
  // Determine NPC Mood / State for HUD
  const getNPCMood = () => {
    if (!activeNPC) return "Normal";
    const em = activeNPC.emotions;
    if (em.anger > 0.4) return "Aggressive";
    if (em.fear > 0.4) return "Defensive";
    if (em.suspicion > 0.4) return "Suspicious";
    return "Neutral";
  };

  // Determine current active event overlay text
  const getActiveEventText = () => {
    if (!worldState) return { title: "Initializing", desc: "Setting up simulation..." };
    if (!worldState.murder_discovered) {
      return { 
        title: "Peaceful Village", 
        desc: "Simulating normal village schedules. Tick forward to discover Arthur's body." 
      };
    }
    return {
      title: "Investigation In Progress",
      desc: "Interrogate suspects, gather physical clues, and deduce the killer."
    };
  };

  const activeEvent = getActiveEventText();

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* Game Over Screen Modal */}
      {gameResult && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(4, 6, 15, 0.95)', zIndex: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="platform-panel" style={{ padding: '40px', maxWidth: '600px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px', borderColor: 'var(--border-gold)' }}>
            {gameResult.success ? (
              <>
                <Award size={64} color="var(--accent-gold)" style={{ alignSelf: 'center' }} />
                <h2 style={{ fontSize: '28px', color: 'var(--accent-gold)', margin: 0, fontFamily: 'var(--font-serif)' }}>Case Solved!</h2>
                <p style={{ fontSize: '15px', color: '#f1f3f9' }}>{gameResult.message}</p>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '4px', border: '1px solid var(--border-gold)', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                  <p><strong>Killer:</strong> {gameResult.killer_name}</p>
                  <p><strong>Motive:</strong> {gameResult.motive}</p>
                  <p><strong>Murder Weapon:</strong> {gameResult.clue.name} ({gameResult.clue.description})</p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle size={64} color="#ef4444" style={{ alignSelf: 'center' }} />
                <h2 style={{ fontSize: '28px', color: '#ef4444', margin: 0, fontFamily: 'var(--font-serif)' }}>Case Failed!</h2>
                <p style={{ fontSize: '15px', color: '#f1f3f9' }}>{gameResult.message}</p>
                <p style={{ fontSize: '13px', color: '#8c9bb4' }}>The real killer escaped. The village of Silent Hollow remains locked in fear.</p>
              </>
            )}
            <button className="btn-outline-gold" onClick={handleReset} style={{ alignSelf: 'center', marginTop: '10px', width: 'auto' }}>
              Restart Simulation
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="platform-header">
        <div className="brand-section">
          <h1 className="brand-title">COGNICORE</h1>
          <span className="brand-subtitle">DETECTIVE SIMULATION</span>
        </div>
        
        <div className="system-telemetry">
          <div className="telemetry-pill">
            <MapPin size={13} color="var(--accent-gold)" />
            <span>Location: {currentLoc}</span>
          </div>
          <div className="telemetry-pill">
            <Clock size={13} color="var(--accent-gold)" />
            <span>Time: Tick {currentTick}</span>
          </div>
          <div className="telemetry-pill">
            <div className="telemetry-beacon" style={{ background: worldState?.murder_discovered ? '#ef4444' : '#10b981', boxShadow: `0 0 8px ${worldState?.murder_discovered ? '#ef4444' : '#10b981'}` }} />
            <span>State: {worldState?.murder_discovered ? 'INVESTIGATION' : 'STANDBY'}</span>
          </div>
        </div>

        <div className="header-controls" style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-pause" onClick={handleReset}>
            Reset
          </button>
          <button className="btn-next-heartbeat" onClick={handleStep} disabled={isLoading}>
            <Play size={12} fill="white" /> Next Heartbeat
          </button>
        </div>
      </header>

      {/* Main Layout Grid */}
      <div className="platform-layout">
        
        {/* Left Sidebar: Character grid */}
        <aside className="sidebar-intelligence">
          <div className="sidebar-heading">
            <span>CHARACTERS</span>
            <Users size={12} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
            {Object.entries(agents).map(([id, data]) => {
              const isSelected = id === selectedAgentId;
              const loc = worldState?.agent_positions[id] || "Marketplace";
              const trust = getNPCTrustPct(id);
              
              // Colors based on trust levels
              let beaconColor = '#10b981'; // Green
              if (trust < 30) beaconColor = '#ef4444'; // Red
              else if (trust < 60) beaconColor = '#f59e0b'; // Yellow/Orange

              return (
                <div 
                  key={id} 
                  className={`character-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedAgentId(id)}
                >
                  <div className="character-avatar">
                    <img src={PORTRAITS[id] || defaultVillagerPortrait} alt={data.name} />
                  </div>
                  <div className="character-info">
                    <div className="character-name-row">
                      <span className="character-name">{data.name}</span>
                      <div className="card-status-dot" style={{ background: beaconColor }} />
                    </div>
                    <div className="character-loc">{loc}</div>
                    <div className="character-trust">Trust: {trust}%</div>
                  </div>
                  {id === "Katherine" && <Shield size={12} color="var(--accent-emerald)" style={{ marginLeft: '4px' }} />}
                </div>
              );
            })}
          </div>

          <button className="btn-outline-gold" onClick={() => setActiveSubView("social")}>
            View Relationship Map
          </button>
        </aside>

        {/* Center column - Simulation Area */}
        <main className="center-column center-simulation">
          
          {/* 3D Viewport */}
          <div className="three-simulation-viewport">
            <ThreeViewport 
              agentPositions={worldState?.agent_positions} 
              selectedAgentId={selectedAgentId}
              onSelectAgent={setSelectedAgentId}
              eventLog={worldState?.event_log}
            />

            {/* Top-Left Floating Controls */}
            <div className="floating-hud-coords">
              <div className="hud-icon-btn"><Search size={14} /></div>
              <div className="hud-icon-btn"><MapPin size={14} /></div>
              <div className="hud-icon-btn"><FileText size={14} /></div>
              <div className="hud-icon-btn" onClick={() => setActiveSubView("social")}><Network size={14} /></div>
            </div>

            {/* Active Event bottom left overlay */}
            <div className="active-event-overlay">
              <div className="active-event-header">ACTIVE EVENT</div>
              <div className="active-event-title">{activeEvent.title}</div>
              <div className="active-event-desc">{activeEvent.desc}</div>
              
              <div style={{ marginTop: '8px', fontSize: '9px', color: '#8c9bb4', display: 'flex', justifyBetween: 'center' }}>
                <span>Evidence Index:</span>
                <span style={{ color: 'var(--accent-gold)', marginLeft: '4px' }}>{cluesFound.length}/7</span>
              </div>
              <div className="metric-bar-track" style={{ height: '3px', marginTop: '4px' }}>
                <div className="metric-bar-fill" style={{ width: `${(cluesFound.length / 7) * 100}%`, background: 'var(--accent-gold)' }} />
              </div>
            </div>

            {/* Floating Navigation Menu */}
            <div className="viewport-bottom-nav">
              <button className={`nav-pill ${activeSubView === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveSubView('dashboard')}>
                <Compass size={13} /> Dashboard
              </button>
              <button className={`nav-pill ${activeSubView === 'clues' ? 'active' : ''}`} onClick={() => setActiveSubView('clues')}>
                <FileText size={13} /> Clues & reasoning
              </button>
              <button className={`nav-pill ${activeSubView === 'interrogate' ? 'active' : ''}`} onClick={() => setActiveSubView('interrogate')}>
                <MessageCircle size={13} /> Interrogate Logs
              </button>
              <button className={`nav-pill ${activeSubView === 'social' ? 'active' : ''}`} onClick={() => setActiveSubView('social')}>
                <Share2 size={13} /> Social Graph
              </button>
            </div>
          </div>
        </main>

        {/* Right Sidebar: Investigation Hub */}
        <aside className="sidebar-investigation">
          
          {/* Current Objective scroll card */}
          <div className="objective-parchment">
            <div className="objective-meta">
              <div className="objective-label">CURRENT OBJECTIVE</div>
              <div className="objective-title">Uncover the Truth</div>
              <div className="objective-desc">Interrogate villagers, collect evidence and deduce who murdered Arthur the Scribe.</div>
            </div>
            <div className="objective-icon-img">
              <img src={evidenceBloodyLetter} alt="sword scroll icon" style={{ filter: 'sepia(1) brightness(0.6)' }} />
            </div>
          </div>

          {/* Interrogation log box */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div className="section-label">INTERROGATION</div>
            <div className="interrogation-console">
              
              <div className="interrogation-target-row">
                <div className="interrogation-target-avatar">
                  <img src={PORTRAITS[selectedAgentId] || defaultVillagerPortrait} alt={activeNPC?.name} />
                </div>
                <div className="interrogation-target-meta">
                  <div className="interrogation-target-name">{activeNPC?.name}</div>
                  <div className="interrogation-target-relation">
                    Mood: <span style={{ color: getNPCMood() === 'Defensive' ? 'var(--accent-amber)' : 'var(--accent-gold)' }}>{getNPCMood()}</span>
                  </div>
                </div>
              </div>

              <div className="dialogue-logs">
                <div className="dialogue-bubble npc">
                  I was shocked when I heard about Arthur. Ask me what I know, detective.
                </div>
                {activeNPCLogs.map((msg, idx) => (
                  <div key={idx} className={`dialogue-bubble ${msg.sender}`}>
                    {msg.text}
                  </div>
                ))}
              </div>

              {/* Quick Replies presets mapping */}
              <div className="quick-replies-list">
                {QUICK_REPLIES.map((reply, idx) => (
                  <button 
                    key={idx} 
                    type="button"
                    className="quick-reply-option"
                    onClick={() => sendChatMessage(reply)}
                  >
                    👉 "{reply}"
                  </button>
                ))}
              </div>
            </div>
            
            <form onSubmit={handleSendChat} style={{ display: 'flex', border: '1px solid var(--border-dim)', borderRadius: '4px', overflow: 'hidden' }}>
              <input 
                type="text" 
                placeholder="Ask custom question..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                style={{ flex: 1, padding: '8px', background: 'rgba(0,0,0,0.3)', color: 'white', border: 'none', fontSize: '11px', outline: 'none' }}
              />
              <button type="submit" style={{ padding: '0 12px', background: 'var(--accent-gold)', color: '#03050c', border: 'none', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}>ASK</button>
            </form>
          </div>

          {/* Evidence board slots */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>EVIDENCE BOARD</span>
              <span>{cluesFound.length}/7 COLLECTED</span>
            </div>
            
            <div className="evidence-corkboard-grid">
              {/* Slot 1: Bloody Letter */}
              <div className={`evidence-corkboard-slot ${cluesFound.some(c => c.name.toLowerCase().includes("letter")) ? 'active' : ''}`}>
                {cluesFound.some(c => c.name.toLowerCase().includes("letter")) ? (
                  <>
                    <img src={evidenceBloodyLetter} alt="Bloody Letter" />
                    <div className="evidence-slot-title">Letter</div>
                  </>
                ) : (
                  <span className="evidence-slot-empty">?</span>
                )}
              </div>

              {/* Slot 2: Broken Necklace */}
              <div className={`evidence-corkboard-slot ${cluesFound.some(c => c.name.toLowerCase().includes("necklace") || c.name.toLowerCase().includes("ring")) ? 'active' : ''}`}>
                {cluesFound.some(c => c.name.toLowerCase().includes("necklace") || c.name.toLowerCase().includes("ring")) ? (
                  <>
                    <img src={evidenceBloodyLetter} alt="Ring clue" style={{ filter: 'hue-rotate(90deg)' }} />
                    <div className="evidence-slot-title">Ring</div>
                  </>
                ) : (
                  <span className="evidence-slot-empty">?</span>
                )}
              </div>

              {/* Slot 3: Tool / Hammer */}
              <div className={`evidence-corkboard-slot ${cluesFound.some(c => c.name.toLowerCase().includes("hammer") || c.name.toLowerCase().includes("dagger") || c.name.toLowerCase().includes("arrow") || c.name.toLowerCase().includes("hook") || c.name.toLowerCase().includes("vial")) ? 'active' : ''}`}>
                {cluesFound.some(c => c.name.toLowerCase().includes("hammer") || c.name.toLowerCase().includes("dagger") || c.name.toLowerCase().includes("arrow") || c.name.toLowerCase().includes("hook") || c.name.toLowerCase().includes("vial")) ? (
                  <>
                    <img src={evidenceBloodyLetter} alt="Weapon clue" style={{ filter: 'hue-rotate(220deg)' }} />
                    <div className="evidence-slot-title">Weapon</div>
                  </>
                ) : (
                  <span className="evidence-slot-empty">?</span>
                )}
              </div>

              {/* Slot 4: Placeholder */}
              <div className="evidence-corkboard-slot">
                <span className="evidence-slot-empty">?</span>
              </div>
            </div>
          </div>

          {/* Actions panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
            <button className="btn-outline-gold" onClick={handleSearchLocation} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Search size={12} /> Inspect location for clues
            </button>
            <button className="btn-accuse-crimson" onClick={handleAccuse}>
              <ShieldAlert size={14} /> Accuse Suspect
            </button>
          </div>

        </aside>

      </div>

      {/* Floating observatory tabs drawer overlay if Clues / Social subviews are active */}
      {activeSubView !== "dashboard" && (
        <div style={{
          position: 'fixed', bottom: '60px', left: '296px', right: '396px',
          height: '240px', background: 'rgba(9, 12, 21, 0.95)', border: '1px solid var(--border-gold)',
          borderRadius: '8px', boxShadow: '0 -10px 40px rgba(0,0,0,0.8)',
          zIndex: 80, display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}>
          <div className="observatory-header">
            <div style={{ paddingLeft: '16px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--accent-gold)' }}>
              OBSERVATORY DEEP MATRIX: {activeSubView.toUpperCase()} ANALYSIS
            </div>
            <button 
              onClick={() => setActiveSubView("dashboard")}
              style={{ background: 'transparent', border: 'none', color: '#8c9bb4', cursor: 'pointer', padding: '10px 16px', fontSize: '11px' }}
            >
              CLOSE
            </button>
          </div>
          
          <div className="observatory-content" style={{ flex: 1, overflowY: 'auto' }}>
            {activeSubView === "clues" && activeNPC && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', fontSize: '12px' }}>
                <div>
                  <div className="inspector-section-title">ACTIVE AI GOALS</div>
                  {activeNPC.goals.map((g, idx) => (
                    <div key={idx} style={{ marginBottom: '6px', padding: '6px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                      <strong>{g.id}: </strong>
                      <span style={{ fontSize: '11px', color: '#8c9bb4' }}>{g.description}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="inspector-section-title">LLM PLANNING REASONING LOGS</div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-dim)', fontFamily: 'var(--font-mono)', fontSize: '11px', lineHeight: '1.4' }}>
                    {activeNPC.last_reasoning}
                  </div>
                </div>
              </div>
            )}

            {activeSubView === "interrogate" && activeNPC && (
              <div className="memory-timeline">
                <div className="inspector-section-title">NPC Memory Log & Rumor Bank</div>
                {activeNPC.secrets.map((sec, idx) => (
                  <div key={`sec-${idx}`} className="memory-item secret">
                    <div className="memory-meta">
                      <span>🤫 SECRET DETAIL</span>
                      <span>TICK {sec.timestamp}</span>
                    </div>
                    <div>{sec.content}</div>
                  </div>
                ))}
                {activeNPC.known_rumors.map((rum, idx) => (
                  <div key={`rum-${idx}`} className="memory-item">
                    <div className="memory-meta">
                      <span>📰 KNOWN GOSSIP (Fidelity: {rum.fidelity.toFixed(2)})</span>
                      <span>TICK {rum.timestamp}</span>
                    </div>
                    <div>{rum.content}</div>
                  </div>
                ))}
              </div>
            )}

            {activeSubView === "social" && socialGraph && (
              <SocialGraphView graphData={socialGraph} />
            )}
          </div>
        </div>
      )}

    </div>
  );
}
