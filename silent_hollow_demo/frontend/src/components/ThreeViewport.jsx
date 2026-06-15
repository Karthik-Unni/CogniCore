import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const LOCATION_COORDINATES = {
  "Town Hall": { x: 0, y: 0.5, z: -10, color: 0xef4444 },
  "Marketplace": { x: 0, y: 0.1, z: 0, color: 0x3b82f6 },
  "Tavern": { x: -8, y: 0.5, z: 6, color: 0xf59e0b },
  "Blacksmith": { x: 8, y: 0.5, z: -6, color: 0x6b7280 },
  "Doctor Clinic": { x: -8, y: 0.5, z: -6, color: 0x10b981 },
  "Farms": { x: -12, y: 0.1, z: -12, color: 0x84cc16 },
  "Forest Edge": { x: 10, y: 0.5, z: 10, color: 0x047857 },
  "Merchant Store": { x: 8, y: 0.5, z: 6, color: 0x06b6d4 }
};

const NPC_COLORS = {
  "Alden": 0xef4444,
  "Katherine": 0x3b82f6,
  "Marcus": 0x06b6d4,
  "Dennis": 0x6b7280,
  "Clara": 0x10b981,
  "Elena": 0xf59e0b,
  "Silas": 0x84cc16,
  "Gerald": 0xa855f7
};

export default function ThreeViewport({ agentPositions, selectedAgentId, onSelectAgent, eventLog }) {
  const mountRef = useRef(null);
  const containerRef = useRef(null);
  
  // Track 3D elements
  const npcMeshesRef = useRef({});
  const targetPositionsRef = useRef({});
  const cameraRef = useRef(null);
  const sceneRef = useRef(null);

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const processedEventIds = useRef(new Set());

  // Handle Event Log updates and spawn floating notifications
  useEffect(() => {
    if (!eventLog || eventLog.length === 0) return;
    
    // Process only the newest event if we haven't seen it yet
    const latestEvent = eventLog[0];
    const eventId = `${latestEvent.type}_${latestEvent.agent_id || latestEvent.speaker || ''}_${latestEvent.description.substring(0, 15)}`;
    
    if (processedEventIds.current.has(eventId)) return;
    processedEventIds.current.add(eventId);

    // Determine 3D coordinates for the notification
    let targetPos = new THREE.Vector3(0, 2, 0);
    
    // Find location coordinate
    if (latestEvent.location && LOCATION_COORDINATES[latestEvent.location]) {
      const c = LOCATION_COORDINATES[latestEvent.location];
      targetPos.set(c.x, 2, c.z);
    } else if (latestEvent.agent_id && npcMeshesRef.current[latestEvent.agent_id]) {
      const pos = npcMeshesRef.current[latestEvent.agent_id].position;
      targetPos.copy(pos).y += 1.8;
    } else if (latestEvent.speaker && npcMeshesRef.current[latestEvent.speaker]) {
      const pos = npcMeshesRef.current[latestEvent.speaker].position;
      targetPos.copy(pos).y += 1.8;
    }

    // Configure text and colors
    let text = latestEvent.description || "Event Triggered";
    let colorClass = "info";

    if (latestEvent.type === "CLUE_FOUND" || latestEvent.type === "PLAYER_CLUE_FOUND") {
      text = `🔎 EVIDENCE: ${text}`;
      colorClass = "clue";
    } else if (latestEvent.type === "ACCUSATION" || latestEvent.type === "PLAYER_ACCUSATION") {
      text = `🚨 ACCUSATION: ${text}`;
      colorClass = "accusation";
    } else if (latestEvent.type === "SECRET_EXPOSED") {
      text = `🤫 EXPOSED: ${text}`;
      colorClass = "secret";
    } else if (latestEvent.type === "TALK") {
      text = `💬 ${text}`;
      colorClass = "talk";
    }

    const newNotification = {
      id: `world_notif_${Date.now()}`,
      text: text,
      colorClass: colorClass,
      pos: targetPos,
      opacity: 1.0,
      age: 0
    };

    setNotifications(prev => [...prev.slice(-3), newNotification]); // Cap at 4 notifications
  }, [eventLog]);

  useEffect(() => {
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x03050c);
    scene.fog = new THREE.FogExp2(0x03050c, 0.012);

    // 2. Camera Setup (Isometric Angle)
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
    cameraRef.current = camera;
    camera.position.set(22, 18, 22);
    camera.lookAt(0, 0, 0);

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x00f2fe, 1.5, 40);
    pointLight.position.set(0, 4, 0);
    scene.add(pointLight);

    // Ground Plane with grid lines
    const groundGeo = new THREE.PlaneGeometry(50, 50);
    const groundMat = new THREE.MeshStandardMaterial({ 
      color: 0x090b14, 
      roughness: 0.9,
      metalness: 0.05
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const gridHelper = new THREE.GridHelper(50, 25, 0x1f293d, 0x0c1322);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // 5. Spawn Locations
    const locationMeshes = {};
    Object.entries(LOCATION_COORDINATES).forEach(([name, coords]) => {
      let geo;
      if (name === "Town Hall") {
        geo = new THREE.BoxGeometry(4.5, 3.2, 4.5);
      } else if (name === "Marketplace") {
        geo = new THREE.CylinderGeometry(2.8, 2.8, 0.4, 8);
      } else if (name === "Farms") {
        geo = new THREE.BoxGeometry(5.5, 0.2, 5.5);
      } else if (name === "Forest Edge") {
        const treeGroup = new THREE.Group();
        for (let i = 0; i < 5; i++) {
          const cone = new THREE.Mesh(
            new THREE.ConeGeometry(0.9, 2.4, 5),
            new THREE.MeshStandardMaterial({ color: 0x022c22, roughness: 0.9 })
          );
          cone.position.set((Math.random() - 0.5) * 3, 1.2, (Math.random() - 0.5) * 3);
          treeGroup.add(cone);
        }
        treeGroup.position.set(coords.x, 0, coords.z);
        scene.add(treeGroup);
        locationMeshes[name] = treeGroup;
        return;
      } else {
        geo = new THREE.BoxGeometry(3, 2.2, 3);
      }

      const mat = new THREE.MeshStandardMaterial({ 
        color: coords.color, 
        roughness: 0.6,
        metalness: 0.15,
        transparent: true,
        opacity: 0.85
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(coords.x, coords.y, coords.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      locationMeshes[name] = mesh;

      if (name !== "Marketplace" && name !== "Farms") {
        const roofGeo = new THREE.ConeGeometry(2.4, 1.6, 4);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(coords.x, coords.y + 1.7, coords.z);
        roof.rotation.y = Math.PI / 4;
        scene.add(roof);
      }
    });

    // 6. Spawn Characters
    const npcGroup = new THREE.Group();
    scene.add(npcGroup);

    Object.entries(NPC_COLORS).forEach(([id, color]) => {
      const npcGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.3, 8);
      const npcMat = new THREE.MeshStandardMaterial({ 
        color: color, 
        roughness: 0.3, 
        metalness: 0.7
      });
      const npcMesh = new THREE.Mesh(npcGeo, npcMat);
      npcMesh.castShadow = true;
      
      const headGeo = new THREE.SphereGeometry(0.32, 8, 8);
      const headMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0 });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 0.85;
      npcMesh.add(head);

      npcMesh.position.set(0, 0.65, 0);
      npcGroup.add(npcMesh);
      npcMeshesRef.current[id] = npcMesh;
    });

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleCanvasClick = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      
      const npcMeshesArray = Object.values(npcMeshesRef.current);
      const intersects = raycaster.intersectObjects(npcMeshesArray);

      if (intersects.length > 0) {
        const clickedMesh = intersects[0].object;
        const agentId = Object.keys(npcMeshesRef.current).find(
          key => npcMeshesRef.current[key] === clickedMesh || npcMeshesRef.current[key] === clickedMesh.parent
        );
        if (agentId) {
          onSelectAgent(agentId);
        }
      }
    };

    renderer.domElement.addEventListener('click', handleCanvasClick);

    // 7. Animation Loop
    let animationFrameId;
    const animate = () => {
      Object.entries(npcMeshesRef.current).forEach(([id, mesh]) => {
        const target = targetPositionsRef.current[id];
        if (target) {
          mesh.position.x += (target.x - mesh.position.x) * 0.05;
          mesh.position.z += (target.z - mesh.position.z) * 0.05;
          
          const dist = Math.sqrt(Math.pow(target.x - mesh.position.x, 2) + Math.pow(target.z - mesh.position.z, 2));
          if (dist < 0.2) {
            mesh.position.y = 0.65 + Math.sin(Date.now() * 0.005 + id.charCodeAt(0)) * 0.04;
          } else {
            mesh.position.y = 0.65 + Math.abs(Math.sin(Date.now() * 0.015)) * 0.12;
            mesh.rotation.y = Math.atan2(target.x - mesh.position.x, target.z - mesh.position.z);
          }
        }
      });

      pointLight.position.x = Math.sin(Date.now() * 0.0005) * 8;
      pointLight.position.z = Math.cos(Date.now() * 0.0005) * 8;

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement && mountRef.current) {
        renderer.domElement.removeEventListener('click', handleCanvasClick);
        mountRef.current.removeChild(renderer.domElement);
      }
      scene.clear();
    };
  }, [onSelectAgent]);

  // Sync positions from prop
  useEffect(() => {
    if (!agentPositions) return;
    const groupOffsets = {};

    Object.entries(agentPositions).forEach(([id, locName]) => {
      const baseCoords = LOCATION_COORDINATES[locName] || { x: 0, z: 0 };
      
      if (!groupOffsets[locName]) groupOffsets[locName] = 0;
      const idx = groupOffsets[locName]++;
      
      const angle = (idx * Math.PI * 2) / 4;
      const radius = locName === "Marketplace" ? 1.6 : 1.0;
      
      targetPositionsRef.current[id] = {
        x: baseCoords.x + Math.cos(angle) * radius,
        z: baseCoords.z + Math.sin(angle) * radius
      };
    });
  }, [agentPositions]);

  // Handle active selections scale
  useEffect(() => {
    Object.entries(npcMeshesRef.current).forEach(([id, mesh]) => {
      if (id === selectedAgentId) {
        mesh.scale.set(1.35, 1.35, 1.35);
      } else {
        mesh.scale.set(1.0, 1.0, 1.0);
      }
    });
  }, [selectedAgentId]);

  // Project 3D coordinates of notifications to 2D CSS placements
  const tempV = new THREE.Vector3();
  const updateNotificationsPlacements = () => {
    if (notifications.length === 0 || !cameraRef.current || !mountRef.current) return;
    
    const camera = cameraRef.current;
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    notifications.forEach(n => {
      tempV.copy(n.pos);
      tempV.project(camera);
      
      const x = (tempV.x * 0.5 + 0.5) * width;
      const y = (tempV.y * -0.5 + 0.5) * height;
      
      const el = document.getElementById(n.id);
      if (el) {
        // Position div absolute above projected coordinate
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.transform = 'translate(-50%, -100%)';
        
        // Let it float upwards slightly over time
        n.age += 1;
        n.pos.y += 0.01; 
        
        if (n.age > 80) {
          n.opacity = Math.max(0, n.opacity - 0.05);
        }
      }
    });

    // Remove expired notifications (opacity = 0)
    const active = notifications.filter(n => n.opacity > 0);
    if (active.length !== notifications.length) {
      setNotifications(active);
    }
  };

  // Run DOM position update cycle on every render / tick
  useEffect(() => {
    const handle = requestAnimationFrame(function loop() {
      updateNotificationsPlacements();
      requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(handle);
  });

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      
      {/* Three.js viewport canvas */}
      <div ref={mountRef} className="three-container" style={{ width: '100%', height: '100%' }} />

      {/* Floating 3D HUD Notification Labels */}
      {notifications.map(n => (
        <div 
          key={n.id} 
          id={n.id}
          className={`intel-event-card ${n.colorClass}`}
          style={{
            position: 'absolute',
            zIndex: 40,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            opacity: n.opacity,
            fontSize: '10px',
            padding: '4px 8px',
            background: 'rgba(5, 8, 20, 0.9)',
            border: '1px solid rgba(0, 242, 254, 0.4)',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
            transition: 'opacity 0.1s linear'
          }}
        >
          {n.text}
        </div>
      ))}

      {/* Interactive controls */}
      <div className="three-overlay-hud">
        <div className="hud-pill" style={{ textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '1px', border: '1px solid rgba(0, 242, 254, 0.3)' }}>
          📡 SIM_GRID_TELEMETRY: active
        </div>
      </div>
    </div>
  );
}
