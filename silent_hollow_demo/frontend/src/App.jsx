import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, Search, RefreshCw, Play, 
  MapPin, Clock, Eye, AlertCircle, Compass, HelpCircle,
  FileText, Shield, Sparkles, MessageCircle, BarChart3, Database,
  Award, AlertTriangle, Users, Network, Share2, X, Clipboard, ArrowRight
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

const NPC_LOCATIONS = {
  "Alden": "Town Hall",
  "Katherine": "Town Hall",
  "Marcus": "Merchant Store",
  "Dennis": "Blacksmith",
  "Clara": "Doctor Clinic",
  "Elena": "Tavern",
  "Silas": "Farms",
  "Gerald": "Forest Edge"
};

export default function App() {
  // Global States
  const [worldState, setWorldState] = useState(null);
  const [agents, setAgents] = useState({});
  const [socialGraph, setSocialGraph] = useState(null);
  const [selectedAgentId, setSelectedAgentId] = useState("Marcus");
  
  // Interactive HUD States
  const [nearNPCId, setNearNPCId] = useState(null);
  const [showInteractionModal, setShowInteractionModal] = useState(false);
  const [showNotebook, setShowNotebook] = useState(false);
  const [notebookTab, setNotebookTab] = useState("evidence"); // "evidence", "suspects", "social", "logs"
  
  // Interaction States
  const [chatLogs, setChatLogs] = useState({}); // agent_id -> list of messages
  const [chatInput, setChatInput] = useState("");
  const [cluesFound, setCluesFound] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [gameResult, setGameResult] = useState(null);

  // Messenger Game States
  const [score, setScore] = useState(0);
  const [activeDeliveryNPC, setActiveDeliveryNPC] = useState("Elena");
  const [deliveredNPCHistory, setDeliveredNPCHistory] = useState([]);

  // 1. Initial Load & Sync
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  // Manage keyboard focus for WASD movement
  useEffect(() => {
    window.focus();
  }, []);

  useEffect(() => {
    if (!showInteractionModal && !showNotebook && !gameResult) {
      window.focus();
    }
  }, [showInteractionModal, showNotebook, gameResult]);

  useEffect(() => {
    const handleDocumentClick = (e) => {
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        window.focus();
      }
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  // Keyboard shortcut listener: E to interact
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
        return;
      }
      if ((e.key === 'e' || e.key === 'E') && nearNPCId && !showInteractionModal && !showNotebook && !gameResult) {
        setSelectedAgentId(nearNPCId);
        setShowInteractionModal(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [nearNPCId, showInteractionModal, showNotebook, gameResult]);

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
    setShowInteractionModal(false);
    setShowNotebook(false);
    setScore(0);
    try {
      const res = await fetch(`${API_BASE}/reset`, { method: "POST" });
      await res.json();
      await fetchData();
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  const handleDeliveryComplete = async (npcId) => {
    setScore(prev => prev + 100);
    setDeliveredNPCHistory(prev => [...prev, npcId]);
    
    const npcLocation = NPC_LOCATIONS[npcId] || "Marketplace";
    try {
      const searchRes = await fetch(`${API_BASE}/player/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: npcLocation })
      });
      const searchData = await searchRes.json();
      
      let alertMsg = `📦 DELIVERED! Package successfully delivered to ${agents[npcId]?.name || npcId}'s mailbox!\n+100 Points!`;
      
      if (searchData.clues_found && searchData.clues_found.length > 0) {
        alertMsg += `\n\n🔎 CLUE UNLOCKED: You inspected the area and found: "${searchData.clues_found[0].name}"!\n${searchData.clues_found[0].description}`;
      } else {
        alertMsg += `\n\n(No new physical evidence was discovered at this location, but the character trusts you more!)`;
      }
      
      alert(alertMsg);
      fetchData(); // Sync updated clues and relationship graphs
      
      // Pick next target
      const npcIds = Object.keys(NPC_LOCATIONS);
      const filtered = npcIds.filter(id => id !== npcId);
      const nextNPC = filtered[Math.floor(Math.random() * filtered.length)];
      setActiveDeliveryNPC(nextNPC);
      
    } catch (e) {
      console.error("Error completing delivery:", e);
    }
  };

  // 3. Dialogue Interrogation
  const sendChatMessage = async (msgText) => {
    const activeTarget = showInteractionModal ? selectedAgentId : nearNPCId;
    if (!activeTarget) return;

    const newLogs = [...(chatLogs[activeTarget] || []), { sender: "player", text: msgText }];
    setChatLogs(prev => ({ ...prev, [activeTarget]: newLogs }));

    try {
      const res = await fetch(`${API_BASE}/player/talk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: activeTarget, message: msgText })
      });
      const data = await res.json();
      
      setChatLogs(prev => ({
        ...prev,
        [activeTarget]: [...(prev[activeTarget] || []), { sender: "npc", text: data.response }]
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
  const handleSearchLocation = async (targetId) => {
    const inspectTarget = targetId || selectedAgentId;
    const activeNPC = agents[inspectTarget];
    if (!activeNPC || !worldState) return;
    
    const loc = worldState.agent_positions[inspectTarget] || "Marketplace";
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
          [inspectTarget]: [
            ...(prev[inspectTarget] || []), 
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
  const handleAccuse = async (targetId) => {
    const accuseTarget = targetId || selectedAgentId;
    const activeNPC = agents[accuseTarget];
    if (!activeNPC) return;
    
    if (!window.confirm(`Are you absolutely ready to accuse ${activeNPC.name} of murder? This will close the case.`)) return;

    try {
      const res = await fetch(`${API_BASE}/player/accuse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: accuseTarget })
      });
      const data = await res.json();
      setGameResult(data);
      setShowInteractionModal(false);
    } catch (e) {
      console.error(e);
    }
  };

  // Helper variables
  const activeNPC = agents[selectedAgentId];
  const activeNPCLogs = chatLogs[selectedAgentId] || [];
  
  // Calculate trust percentage relative to Player
  const getNPCTrustPct = (npcId) => {
    const agentData = agents[npcId];
    if (!agentData || !agentData.relationships || !agentData.relationships.Player) return 50;
    const rawVal = agentData.relationships.Player.trust; // -1.0 to 1.0
    return Math.round((rawVal + 1.0) * 50);
  };

  // Determine NPC Mood / State for HUD
  const getNPCMood = (npcId) => {
    const targetNPC = agents[npcId] || activeNPC;
    if (!targetNPC) return "Normal";
    const em = targetNPC.emotions;
    if (em.anger > 0.4) return "Aggressive";
    if (em.fear > 0.4) return "Defensive";
    if (em.suspicion > 0.4) return "Suspicious";
    return "Neutral";
  };

  const getNPCMoodColor = (npcId) => {
    const mood = getNPCMood(npcId);
    if (mood === "Aggressive") return "#ef4444";
    if (mood === "Defensive") return "#f59e0b";
    if (mood === "Suspicious") return "#a855f7";
    return "#10b981";
  };

  const currentLoc = worldState?.agent_positions[selectedAgentId] || "Town Square";
  const currentTick = worldState?.tick || 0;

  return (
    <div className="app-container" style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      
      {/* 3D Background Viewport */}
      <div className="background-3d-viewport" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
        <ThreeViewport 
          agentPositions={worldState?.agent_positions} 
          selectedAgentId={selectedAgentId}
          onSelectAgent={(id) => {
            setSelectedAgentId(id);
            setShowInteractionModal(true);
          }}
          activeDeliveryNPC={activeDeliveryNPC}
          onDeliverySuccess={handleDeliveryComplete}
          onNearNPC={setNearNPCId}
        />
      </div>

      {/* Floating HUD Layer */}
      <div className="floating-hud-layer" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10, pointerEvents: 'none' }}>
        
        {/* Floating Header Panel */}
        <header className="hud-header" style={{ pointerEvents: 'auto' }}>
          <div className="brand-section">
            <h1 className="brand-title">SILENT HOLLOW</h1>
            <span className="brand-subtitle">COGNICORE SIMULATOR</span>
          </div>
          
          <div className="system-telemetry">
            <div className="telemetry-pill">
              <Clock size={13} color="var(--accent-gold)" />
              <span>Time: Tick {currentTick}</span>
            </div>
            <div className="telemetry-pill">
              <div className="telemetry-beacon" style={{ background: worldState?.murder_discovered ? '#ef4444' : '#10b981', boxShadow: `0 0 8px ${worldState?.murder_discovered ? '#ef4444' : '#10b981'}` }} />
              <span>State: {worldState?.murder_discovered ? 'CRIME SCENE ACTIVE' : 'PEACEFUL schedules'}</span>
            </div>
          </div>

          <div className="header-controls" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button className="btn-hud-control" onClick={handleReset}>
              <RefreshCw size={12} /> Reset Case
            </button>
            <button className="btn-hud-control btn-notebook" onClick={() => setShowNotebook(true)}>
              <Clipboard size={12} /> Case Notebook
              {cluesFound.length > 0 && <span className="clue-badge">{cluesFound.length}</span>}
            </button>
            <button className="btn-hud-heartbeat" onClick={handleStep} disabled={isLoading}>
              <Play size={12} fill="white" /> Advance Time
            </button>
          </div>
        </header>

        {/* Floating Courier Game HUD (Top Left) */}
        <div className="courier-hud-glass" style={{ pointerEvents: 'auto' }}>
          <div className="courier-score-box">
            <span className="label">SCORE</span>
            <span className="score">{score}</span>
          </div>
          <div className="courier-divider" />
          <div className="courier-target">
            <span className="label">CURRENT TARGET</span>
            <span className="name">{agents[activeDeliveryNPC]?.name || activeDeliveryNPC}</span>
            <span className="info">Deliver letter to the <strong style={{ color: '#00f2fe' }}>{NPC_LOCATIONS[activeDeliveryNPC]} Mailbox</strong>!</span>
          </div>
        </div>

        {/* Floating Evidence Progress HUD (Top Right) */}
        <div className="evidence-hud-glass" style={{ pointerEvents: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.5)', letterSpacing: '1px' }}>
            <span>EVIDENCE FILE</span>
            <span>{cluesFound.length}/7 FOUND</span>
          </div>
          <div className="metric-bar-track" style={{ height: '4px', marginTop: '6px', background: 'rgba(255,255,255,0.06)' }}>
            <div className="metric-bar-fill" style={{ width: `${(cluesFound.length / 7) * 100}%`, background: 'var(--accent-gold)', boxShadow: '0 0 8px var(--accent-gold)' }} />
          </div>
        </div>

        {/* Proximity HUD Prompt (Bottom Center) */}
        {nearNPCId && !showInteractionModal && !showNotebook && (
          <div className="proximity-hud-prompt" style={{ pointerEvents: 'auto' }}>
            <div className="avatar-frame">
              <img src={PORTRAITS[nearNPCId] || defaultVillagerPortrait} alt={nearNPCId} />
            </div>
            <div className="info-area">
              <span className="proximity-tag">NEARBY VILLAGER</span>
              <span className="npc-title">{agents[nearNPCId]?.name || nearNPCId} ({NPC_LOCATIONS[nearNPCId]})</span>
              <span className="prompt-help">Press <span className="key-cap">E</span> or click Interact to Interrogate</span>
            </div>
            <div className="actions-area">
              <button 
                className="btn-proximity-action btn-interrogate"
                onClick={() => {
                  setSelectedAgentId(nearNPCId);
                  setShowInteractionModal(true);
                }}
              >
                💬 Interact
              </button>
              <button 
                className="btn-proximity-action btn-inspect"
                onClick={() => handleSearchLocation(nearNPCId)}
              >
                🔎 Inspect Location
              </button>
            </div>
          </div>
        )}

        {/* Keyboard Controls Guide (Bottom Right) */}
        <div className="keyboard-guide-hud" style={{ pointerEvents: 'auto' }}>
          <div className="guide-title">CONTROLS</div>
          <div className="keys-grid">
            <div className="key-row"><span className="key-badge">W</span><span className="key-badge">A</span><span className="key-badge">S</span><span className="key-badge">D</span> <span className="label">Run</span></div>
            <div className="key-row"><span className="key-badge" style={{ width: '60px', textAlign: 'center' }}>SPACE</span> <span className="label">Jump</span></div>
            <div className="key-row"><span className="key-badge">E</span> <span className="label">Interact</span></div>
          </div>
        </div>

      </div>

      {/* Interrogation Dialog Modal */}
      {showInteractionModal && activeNPC && (
        <div className="glass-modal-backdrop" style={{ zIndex: 100 }}>
          <div className="glass-modal-container interrogation-modal">
            
            <div className="modal-header">
              <div className="header-brand">
                <MessageCircle size={14} color="var(--accent-gold)" />
                <span>INTERROGATION CASE RECORD</span>
              </div>
              <button className="btn-close-modal" onClick={() => setShowInteractionModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="interrogation-content">
              
              {/* Left Panel: Suspect Profile */}
              <div className="suspect-profile-pane">
                <div className="avatar-ring">
                  <img src={PORTRAITS[selectedAgentId] || defaultVillagerPortrait} alt={activeNPC.name} />
                </div>
                <h3 className="suspect-name">{activeNPC.name}</h3>
                <span className="suspect-role">{activeNPC.metadata?.role || "Villager"}</span>
                
                <div className="divider-line" />

                <div className="status-meters">
                  <div className="meter-group">
                    <div className="meter-label">
                      <span>Trust Relationship</span>
                      <span>{getNPCTrustPct(selectedAgentId)}%</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${getNPCTrustPct(selectedAgentId)}%`, background: 'var(--accent-gold)' }} />
                    </div>
                  </div>

                  <div className="meter-group">
                    <div className="meter-label">
                      <span>Mood / Alert State</span>
                      <span style={{ color: getNPCMoodColor(selectedAgentId) }}>{getNPCMood(selectedAgentId)}</span>
                    </div>
                  </div>

                  <div className="emotions-mini-grid">
                    <div className="emotion-stat">
                      <span className="val">{Math.round(activeNPC.emotions.anger * 100)}%</span>
                      <span className="lbl">Anger</span>
                    </div>
                    <div className="emotion-stat">
                      <span className="val">{Math.round(activeNPC.emotions.fear * 100)}%</span>
                      <span className="lbl">Fear</span>
                    </div>
                    <div className="emotion-stat">
                      <span className="val">{Math.round(activeNPC.emotions.suspicion * 100)}%</span>
                      <span className="lbl">Suspicion</span>
                    </div>
                  </div>
                </div>

                <div className="action-buttons-stack" style={{ marginTop: 'auto' }}>
                  <button className="btn-action-inspect" onClick={() => handleSearchLocation(selectedAgentId)}>
                    🔎 Inspect {NPC_LOCATIONS[selectedAgentId] || 'Cottage'}
                  </button>
                  <button className="btn-action-accuse" onClick={() => handleAccuse(selectedAgentId)}>
                    🚨 Accuse of Murder
                  </button>
                </div>
              </div>

              {/* Right Panel: Interrogation Chat Console */}
              <div className="dialogue-chat-pane">
                <div className="chat-messages-container">
                  <div className="speech-bubble npc-bubble">
                    <strong>{activeNPC.name}:</strong> I'm shocked by Arthur's murder, detective. What do you wish to ask me?
                  </div>
                  {activeNPCLogs.map((msg, idx) => (
                    <div key={idx} className={`speech-bubble ${msg.sender}-bubble`}>
                      {msg.sender === 'player' ? (
                        <><strong>You:</strong> {msg.text}</>
                      ) : msg.sender === 'system' ? (
                        <span className="system-text">{msg.text}</span>
                      ) : (
                        <><strong>{activeNPC.name}:</strong> {msg.text}</>
                      )}
                    </div>
                  ))}
                </div>

                {/* Quick replies */}
                <div className="quick-replies-hud">
                  {QUICK_REPLIES.map((reply, idx) => (
                    <button 
                      key={idx} 
                      className="btn-quick-reply"
                      onClick={() => sendChatMessage(reply)}
                    >
                      👉 "{reply}"
                    </button>
                  ))}
                </div>

                {/* Custom chat form */}
                <form onSubmit={handleSendChat} className="chat-input-row">
                  <input 
                    type="text" 
                    placeholder={`Ask custom question to ${activeNPC.name}...`}
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    className="chat-text-input"
                  />
                  <button type="submit" className="btn-chat-send">ASK</button>
                </form>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Case Notebook Drawer Overlay */}
      {showNotebook && (
        <div className="glass-modal-backdrop" style={{ zIndex: 100 }}>
          <div className="glass-modal-container notebook-modal">
            
            <div className="modal-header">
              <div className="header-brand">
                <Clipboard size={14} color="var(--accent-gold)" />
                <span>INVESTIGATOR'S CASE NOTEBOOK</span>
              </div>
              <button className="btn-close-modal" onClick={() => setShowNotebook(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="notebook-tabs-row">
              <button className={`tab-button ${notebookTab === 'evidence' ? 'active' : ''}`} onClick={() => setNotebookTab('evidence')}>
                📁 Evidence Board ({cluesFound.length})
              </button>
              <button className={`tab-button ${notebookTab === 'suspects' ? 'active' : ''}`} onClick={() => setNotebookTab('suspects')}>
                👥 Suspect Dossier
              </button>
              <button className={`tab-button ${notebookTab === 'social' ? 'active' : ''}`} onClick={() => setNotebookTab('social')}>
                🕸️ Relationship Map
              </button>
              <button className={`tab-button ${notebookTab === 'logs' ? 'active' : ''}`} onClick={() => setNotebookTab('logs')}>
                📜 Chronicle Feed
              </button>
            </div>

            <div className="notebook-body-content">
              
              {/* Evidence Board Tab */}
              {notebookTab === 'evidence' && (
                <div className="evidence-tab-pane">
                  <div className="evidence-corkboard">
                    {[0, 1, 2, 3, 4, 5, 6].map((idx) => {
                      const clue = cluesFound[idx];
                      return (
                        <div key={idx} className={`corkboard-slot ${clue ? 'active' : ''}`}>
                          {clue ? (
                            <>
                              <img src={evidenceBloodyLetter} alt={clue.name} style={{ filter: idx === 1 ? 'hue-rotate(90deg)' : idx === 2 ? 'hue-rotate(220deg)' : 'none' }} />
                              <div className="clue-tag">{clue.name}</div>
                              <div className="clue-tooltip">
                                <strong style={{ color: 'var(--accent-gold)' }}>{clue.name}</strong>
                                <span className="loc">Found at: {clue.location}</span>
                                <p className="desc">{clue.description}</p>
                              </div>
                            </>
                          ) : (
                            <span className="slot-placeholder">?</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="corkboard-instruction">
                    🔎 Deliver packages to cottages to gain trust and inspect houses for clues. Collect all 7 items to solve the mystery.
                  </div>
                </div>
              )}

              {/* Suspect Dossier Tab */}
              {notebookTab === 'suspects' && (
                <div className="suspects-tab-pane">
                  <div className="suspects-dossier-grid">
                    {Object.entries(agents).map(([id, data]) => {
                      const trust = getNPCTrustPct(id);
                      const currentPos = worldState?.agent_positions[id] || "Marketplace";
                      return (
                        <div key={id} className="suspect-dossier-card">
                          <div className="card-top">
                            <div className="avatar-frame">
                              <img src={PORTRAITS[id] || defaultVillagerPortrait} alt={data.name} />
                            </div>
                            <div className="meta">
                              <h4>{data.name}</h4>
                              <span className="role">{data.metadata?.role || "Villager"}</span>
                            </div>
                          </div>
                          
                          <div className="card-middle">
                            <div className="stat-row"><span>Location:</span> <strong style={{ color: 'white' }}>{currentPos}</strong></div>
                            <div className="stat-row"><span>Mood:</span> <strong style={{ color: getNPCMoodColor(id) }}>{getNPCMood(id)}</strong></div>
                            <div className="stat-row"><span>Trust level:</span> <strong style={{ color: 'var(--accent-gold)' }}>{trust}%</strong></div>
                          </div>

                          <div className="card-secrets">
                            <span className="secrets-header">🔓 Unlocked Secrets & Rumors</span>
                            <div className="secrets-list">
                              {data.known_rumors && Object.values(data.known_rumors).length > 0 ? (
                                Object.values(data.known_rumors).map((rumor, rIdx) => (
                                  <div key={rIdx} className="secret-bullet">📰 "{rumor.content}"</div>
                                ))
                              ) : (
                                <div className="no-secrets">No secrets shared yet. Interrogate with higher trust.</div>
                              )}
                            </div>
                          </div>

                          <button className="btn-dossier-interrogate" onClick={() => {
                            setSelectedAgentId(id);
                            setShowNotebook(false);
                            setShowInteractionModal(true);
                          }}>
                            💬 Interrogate {data.name}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Relationship Map Tab */}
              {notebookTab === 'social' && socialGraph && (
                <div className="social-tab-pane" style={{ height: '100%' }}>
                  <SocialGraphView graphData={socialGraph} />
                </div>
              )}

              {/* Chronicle Feed Tab */}
              {notebookTab === 'logs' && worldState && (
                <div className="logs-tab-pane">
                  <div className="logs-feed-container">
                    {worldState.event_log && worldState.event_log.length > 0 ? (
                      worldState.event_log.map((log, idx) => {
                        let icon = <Info size={12} color="#94a3b8" />;
                        if (log.type.includes("CLUE")) icon = <Search size={12} color="var(--accent-gold)" />;
                        if (log.type.includes("ACCUSATION")) icon = <ShieldAlert size={12} color="#ef4444" />;
                        if (log.type.includes("MURDER")) icon = <AlertTriangle size={12} color="#ef4444" />;
                        if (log.type.includes("TALK")) icon = <MessageCircle size={12} color="#3b82f6" />;

                        return (
                          <div key={idx} className="feed-log-item">
                            <div className="icon-wrap">{icon}</div>
                            <div className="log-text">
                              <span className="desc">{log.description}</span>
                              <span className="time">Simulation Step {log.tick !== undefined ? log.tick : currentTick}</span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="no-logs">No simulation events recorded yet.</div>
                    )}
                  </div>
                </div>
              )}

            </div>

          </div>
        </div>
      )}

      {/* Case Result Screen Overlay Modal */}
      {gameResult && (
        <div className="glass-modal-backdrop" style={{ zIndex: 101 }}>
          <div className="glass-modal-container game-result-modal" style={{ maxWidth: '560px', textAlign: 'center' }}>
            
            {gameResult.success ? (
              <div className="result-success-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
                <Award size={64} color="var(--accent-gold)" className="pulse-animation" />
                <h2 className="result-title" style={{ color: 'var(--accent-gold)' }}>CASE SOLVED!</h2>
                <p className="result-desc">{gameResult.message}</p>
                
                <div className="evidence-summary-card">
                  <div className="row"><strong>KILLER:</strong> <span style={{ color: '#ef4444' }}>{gameResult.killer_name}</span></div>
                  <div className="row"><strong>MOTIVE:</strong> <span>{gameResult.motive}</span></div>
                  <div className="row"><strong>MURDER WEAPON:</strong> <span>{gameResult.clue.name} ({gameResult.clue.description})</span></div>
                </div>
              </div>
            ) : (
              <div className="result-fail-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
                <AlertTriangle size={64} color="#ef4444" />
                <h2 className="result-title" style={{ color: '#ef4444' }}>CASE FAILED!</h2>
                <p className="result-desc">{gameResult.message}</p>
                <p style={{ color: '#8c9bb4', fontSize: '12px' }}>The actual culprit slipped away in the shadows. The village of Silent Hollow remains under a shroud of suspicion...</p>
              </div>
            )}

            <button className="btn-result-restart" onClick={handleReset}>
              Restart Simulation Case
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
