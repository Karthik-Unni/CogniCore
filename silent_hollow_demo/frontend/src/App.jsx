import React, { useState, useEffect } from 'react';
import { 
  Users, MessageSquare, ShieldAlert, Search, RefreshCw, Play, 
  HelpCircle, Eye, AlertTriangle, Scroll, Key, Award, Heart
} from 'lucide-react';
import ThreeViewport from './components/ThreeViewport';
import SocialGraphView from './components/SocialGraphView';
import './App.css';

const API_BASE = "http://localhost:8000/api";

export default function App() {
  // Global States
  const [worldState, setWorldState] = useState(null);
  const [agents, setAgents] = useState({});
  const [socialGraph, setSocialGraph] = useState(null);
  const [selectedAgentId, setSelectedAgentId] = useState("Katherine");
  const [activeTab, setActiveTab] = useState("emotions");
  
  // Interaction States
  const [chatLogs, setChatLogs] = useState({}); // agent_id -> list of messages
  const [chatInput, setChatInput] = useState("");
  const [cluesFound, setCluesFound] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [gameResult, setGameResult] = useState(null); // { success: bool, message: str, ... }

  // 1. Initial Load & Periodic Sync
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000); // Poll every 4s to track NPC activities
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      // Fetch world state
      const stateRes = await fetch(`${API_BASE}/state`);
      const stateData = await stateRes.json();
      setWorldState(stateData);

      // Fetch agents
      const agentsRes = await fetch(`${API_BASE}/agents`);
      const agentsData = await agentsRes.json();
      setAgents(agentsData);

      // Fetch social graph
      const graphRes = await fetch(`${API_BASE}/social-graph`);
      const graphData = await graphRes.json();
      setSocialGraph(graphData);
      
      // Update local clues from worldState
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
      console.error("Error fetching simulation data:", e);
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
  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatInput("");

    // Append player message immediately
    const updatedLogs = { ...(chatLogs[selectedAgentId] || []) };
    const newLogs = [...(chatLogs[selectedAgentId] || []), { sender: "player", text: userMsg }];
    setChatLogs(prev => ({ ...prev, [selectedAgentId]: newLogs }));

    try {
      const res = await fetch(`${API_BASE}/player/talk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: selectedAgentId, message: userMsg })
      });
      const data = await res.json();
      
      // Append NPC response
      setChatLogs(prev => ({
        ...prev,
        [selectedAgentId]: [...(prev[selectedAgentId] || []), { sender: "npc", text: data.response }]
      }));
      
      fetchData(); // Sync updated emotions/relationships
    } catch (e) {
      console.error(e);
    }
  };

  // 4. Clue Search
  const handleSearchLocation = async () => {
    const activeNPC = agents[selectedAgentId];
    if (!activeNPC || !worldState) return;
    
    // Search the location where the currently selected agent is standing
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
            { sender: "system", text: `🔎 You searched the ${loc} and found: [${data.clues_found[0].name}] - ${data.clues_found[0].description}` }
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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* Game Over Screen Modal */}
      {gameResult && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 7, 18, 0.95)', zIndex: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="glass-panel" style={{ padding: '40px', maxWidth: '600px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {gameResult.success ? (
              <>
                <Award size={64} color="#10b981" style={{ alignSelf: 'center' }} />
                <h2 style={{ fontSize: '28px', color: '#10b981', margin: 0 }}>Case Solved!</h2>
                <p style={{ fontSize: '15px', color: '#f1f3f9' }}>{gameResult.message}</p>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-light)', textAlign: 'left' }}>
                  <p><strong>Killer:</strong> {gameResult.killer_name}</p>
                  <p><strong>Motive:</strong> {gameResult.motive}</p>
                  <p><strong>Murder Weapon:</strong> {gameResult.clue.name} ({gameResult.clue.description})</p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle size={64} color="#ff4a5a" style={{ alignSelf: 'center' }} />
                <h2 style={{ fontSize: '28px', color: '#ff4a5a', margin: 0 }}>Case Failed!</h2>
                <p style={{ fontSize: '15px', color: '#f1f3f9' }}>{gameResult.message}</p>
                <p style={{ fontSize: '13px', color: '#8c9bb4' }}>The real killer escaped. The village of Silent Hollow remains locked in fear.</p>
              </>
            )}
            <button className="btn-primary" onClick={handleReset} style={{ alignSelf: 'center', marginTop: '10px' }}>
              Restart Simulation
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="logo-section">
          <h1>CogniCore</h1>
          <span>Character Intelligence Engine</span>
        </div>
        
        <div className="header-status">
          <div>
            <strong>Status: </strong>
            {worldState?.murder_discovered ? (
              <span className="status-badge">🚨 Murder Discovered</span>
            ) : (
              <span className="status-badge safe">🟢 Peaceful Village</span>
            )}
          </div>
          <div>
            <strong>Clock: </strong>
            <span style={{ fontFamily: 'monospace', fontSize: '14px' }}>Tick {worldState?.tick || 0}</span>
          </div>
        </div>

        <div className="header-controls">
          <button className="btn-secondary" onClick={handleReset} disabled={isLoading}>
            <RefreshCw size={14} /> Reset
          </button>
          <button className="btn-primary" onClick={handleStep} disabled={isLoading}>
            <Play size={14} /> Step Heartbeat
          </button>
        </div>
      </header>

      {/* Main Sandbox Layout */}
      <div className="main-layout">
        
        {/* Sidebar NPCs */}
        <aside className="sidebar-npcs">
          <div className="sidebar-title">Suspects & Characters</div>
          {Object.entries(agents).map(([id, data]) => {
            const isSelected = id === selectedAgentId;
            const loc = worldState?.agent_positions[id] || "Marketplace";
            
            // Calculate dominant emotion bar weights
            const em = data.emotions;
            const maxEm = Math.max(em.anger, em.fear, em.suspicion);
            let barColor = 'var(--text-secondary)';
            if (maxEm > 0.3) {
              if (em.anger === maxEm) barColor = 'var(--color-anger)';
              else if (em.fear === maxEm) barColor = 'var(--color-fear)';
              else if (em.suspicion === maxEm) barColor = 'var(--color-suspicion)';
            }

            return (
              <div 
                key={id} 
                className={`npc-card glass-panel ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedAgentId(id)}
              >
                <div className="npc-avatar" style={{ borderBottom: `3px solid ${barColor}` }}>
                  {id.substring(0, 2).toUpperCase()}
                </div>
                <div className="npc-info">
                  <div className="npc-name-row">
                    <span className="npc-name">{data.name}</span>
                    {data.is_killer && <span style={{ fontSize: '8px', color: '#ff4a5a', border: '1px solid rgba(255,74,90,0.3)', padding: '2px 4px', borderRadius: '4px' }}>KILLER</span>}
                  </div>
                  <div className="npc-role">{data.role} • {loc}</div>
                  <div className="npc-loc-goal">Goal: {data.goals[0]?.description}</div>
                </div>
              </div>
            );
          })}
        </aside>

        {/* Center column */}
        <main className="center-column">
          
          {/* 3D Viewport */}
          <div className="three-container">
            <ThreeViewport 
              agentPositions={worldState?.agent_positions} 
              selectedAgentId={selectedAgentId}
              onSelectAgent={setSelectedAgentId}
            />
          </div>

          {/* Bottom Developer Inspector Tabs */}
          <section className="bottom-inspector">
            <div className="tab-header">
              <button className={`tab-btn ${activeTab === 'emotions' ? 'active' : ''}`} onClick={() => setActiveTab('emotions')}>
                🎭 Emotions
              </button>
              <button className={`tab-btn ${activeTab === 'reasoning' ? 'active' : ''}`} onClick={() => setActiveTab('reasoning')}>
                🧠 Planner & Reasoning
              </button>
              <button className={`tab-btn ${activeTab === 'memories' ? 'active' : ''}`} onClick={() => setActiveTab('memories')}>
                📜 Memory Log
              </button>
              <button className={`tab-btn ${activeTab === 'social' ? 'active' : ''}`} onClick={() => setActiveTab('social')}>
                🕸️ Social Graph
              </button>
            </div>

            <div className="tab-content">
              {activeTab === 'emotions' && activeNPC && (
                <div className="emotions-grid">
                  {Object.entries(activeNPC.emotions).map(([emotion, val]) => {
                    const colorVar = `var(--color-${emotion})`;
                    return (
                      <div key={emotion} className="emotion-meter">
                        <div className="emotion-label-row">
                          <span>{emotion}</span>
                          <span style={{ color: colorVar, fontFamily: 'monospace' }}>{val.toFixed(2)}</span>
                        </div>
                        <div className="meter-track">
                          <div className="meter-fill" style={{ width: `${val * 100}%`, background: colorVar }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === 'reasoning' && activeNPC && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <strong>Top Goal: </strong>
                    <span style={{ color: '#00c6ff' }}>{activeNPC.goals[0]?.description}</span>
                  </div>
                  <div>
                    <strong>Active Plan: </strong>
                    {activeNPC.last_plan && activeNPC.last_plan.length > 0 ? (
                      <ol style={{ margin: '6px 0', paddingLeft: '20px', fontSize: '13px' }}>
                        {activeNPC.last_plan.map((step, idx) => (
                          <li key={idx} style={{ color: '#8c9bb4' }}>{step}</li>
                        ))}
                      </ol>
                    ) : (
                      <span style={{ fontStyle: 'italic', fontSize: '13px' }}>No active plan. Idle.</span>
                    )}
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderLeft: '3px solid #00c6ff', borderRadius: '0 8px 8px 0' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Reasoning Trace</div>
                    <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{activeNPC.last_reasoning}</p>
                  </div>
                </div>
              )}

              {activeTab === 'memories' && activeNPC && (
                <div className="memory-timeline">
                  {/* Secrets */}
                  {activeNPC.secrets && activeNPC.secrets.map((sec, idx) => (
                    <div key={`sec-${idx}`} className="memory-item secret">
                      <div className="memory-meta">
                        <span>🤫 SECRET (Secrecy: {sec.metadata.secrecy_level})</span>
                        <span>Tick {sec.timestamp}</span>
                      </div>
                      <div>{sec.content}</div>
                    </div>
                  ))}

                  {/* General short term / long term */}
                  {activeNPC.known_rumors && activeNPC.known_rumors.map((rum, idx) => (
                    <div key={`rum-${idx}`} className="memory-item">
                      <div className="memory-meta">
                        <span>📰 RUMOR (Fidelity: {rum.fidelity.toFixed(2)})</span>
                        <span>Tick {rum.timestamp}</span>
                      </div>
                      <div>{rum.content}</div>
                    </div>
                  ))}
                  
                  {activeNPC.last_reasoning && (
                    <div className="memory-item">
                      <div className="memory-meta">
                        <span>👁️ ACTION HISTORY</span>
                        <span>Tick {worldState?.tick}</span>
                      </div>
                      <div>Executed action: <strong>{activeNPC.last_action.type}</strong> to {activeNPC.last_action.target || 'self'}</div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'social' && socialGraph && (
                <SocialGraphView graphData={socialGraph} />
              )}
            </div>
          </section>
        </main>

        {/* Right column player HUD */}
        <section className="right-column">
          <div className="panel-header">
            <MessageSquare size={18} />
            <span>Interrogate {activeNPC?.name}</span>
          </div>

          {/* Dialogue chat logs */}
          <div className="chat-box">
            <div className="chat-messages">
              <div className="chat-msg npc">
                Hello investigator. I am {activeNPC?.name}. I'm shocked by Arthur's murder. Ask me about my alibi, what I know about the crime, or about other villagers.
              </div>
              
              {activeNPCLogs.map((msg, idx) => (
                <div key={idx} className={`chat-msg ${msg.sender}`}>
                  {msg.text}
                </div>
              ))}
            </div>
            
            <form onSubmit={handleSendChat} className="chat-input-row">
              <input 
                type="text" 
                placeholder="Ask about alibis, rumors, secrets..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
              />
              <button type="submit" className="btn-primary" style={{ padding: '8px 12px' }}>Send</button>
            </form>
          </div>

          {/* Clues Board */}
          <div className="action-board">
            <div className="panel-header">
              <Scroll size={18} />
              <span>Evidence Case Board</span>
            </div>
            
            <div className="corkboard">
              {cluesFound.length > 0 ? (
                cluesFound.map((clue, idx) => (
                  <div key={idx} className="pinned-note">
                    <div className="note-title">📍 {clue.name}</div>
                    <div style={{ flex: 1 }}>{clue.description}</div>
                    <div style={{ fontSize: '8px', color: '#ef4444', marginTop: '4px', textAlign: 'right' }}>Owner: {clue.owner}</div>
                  </div>
                ))
              ) : (
                <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c9bb4', fontSize: '12px', fontStyle: 'italic', padding: '20px' }}>
                  No evidence discovered yet. Search locations where suspects stand!
                </div>
              )}
            </div>

            {/* Special Action buttons */}
            <div className="action-buttons-group">
              <button className="btn-search" onClick={handleSearchLocation}>
                <Search size={14} style={{ marginRight: '6px' }} />
                Search Location
              </button>
              <button className="btn-accuse" onClick={handleAccuse}>
                <ShieldAlert size={14} style={{ marginRight: '6px' }} />
                Accuse Suspect
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
