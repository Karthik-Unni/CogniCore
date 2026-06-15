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
  "Alden": 0xef4444,      // Mayor (Red)
  "Katherine": 0x3b82f6,  // Guard (Blue)
  "Marcus": 0x06b6d4,     // Merchant (Cyan)
  "Dennis": 0x6b7280,     // Blacksmith (Grey)
  "Clara": 0x10b981,      // Doctor (Green)
  "Elena": 0xf59e0b,      // Innkeeper (Orange)
  "Silas": 0x84cc16,      // Farmer (Yellow-Green)
  "Gerald": 0xa855f7      // Hunter (Purple)
};

export default function ThreeViewport({ agentPositions, selectedAgentId, onSelectAgent }) {
  const mountRef = useRef(null);
  const [hoveredLocation, setHoveredLocation] = useState(null);
  
  // Track 3D position meshes of characters
  const npcMeshesRef = useRef({});
  const targetPositionsRef = useRef({});

  useEffect(() => {
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c16);
    scene.fog = new THREE.FogExp2(0x0a0c16, 0.015);

    // 2. Camera Setup (Isometric Angle)
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
    camera.position.set(22, 18, 22);
    camera.lookAt(0, 0, 0);

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x00a2ff, 1.2, 50);
    pointLight.position.set(0, 5, 0);
    scene.add(pointLight);

    // 5. Ground Plane
    const groundGeo = new THREE.PlaneGeometry(50, 50);
    const groundMat = new THREE.MeshStandardMaterial({ 
      color: 0x12162a, 
      roughness: 0.8,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const gridHelper = new THREE.GridHelper(50, 25, 0x334155, 0x1e293b);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // 6. Draw Buildings (Locations)
    const locationMeshes = {};
    Object.entries(LOCATION_COORDINATES).forEach(([name, coords]) => {
      // Build simple architectural models
      let geo;
      if (name === "Town Hall") {
        geo = new THREE.BoxGeometry(4, 3, 4);
      } else if (name === "Marketplace") {
        geo = new THREE.CylinderGeometry(2.5, 2.5, 0.4, 8);
      } else if (name === "Farms") {
        geo = new THREE.BoxGeometry(5, 0.2, 5);
      } else if (name === "Forest Edge") {
        // Group of trees
        const treeGroup = new THREE.Group();
        for (let i = 0; i < 5; i++) {
          const cone = new THREE.Mesh(
            new THREE.ConeGeometry(1, 2.5, 5),
            new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.9 })
          );
          cone.position.set((Math.random() - 0.5) * 3, 1.25, (Math.random() - 0.5) * 3);
          treeGroup.add(cone);
        }
        treeGroup.position.set(coords.x, 0, coords.z);
        scene.add(treeGroup);
        locationMeshes[name] = treeGroup;
        return;
      } else {
        geo = new THREE.BoxGeometry(2.8, 2, 2.8);
      }

      const mat = new THREE.MeshStandardMaterial({ 
        color: coords.color, 
        roughness: 0.5,
        metalness: 0.2,
        transparent: true,
        opacity: 0.9
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(coords.x, coords.y, coords.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      locationMeshes[name] = mesh;

      // Add a small chimney or roof details to houses
      if (name !== "Marketplace" && name !== "Farms") {
        const roofGeo = new THREE.ConeGeometry(2.3, 1.5, 4);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(coords.x, coords.y + 1.6, coords.z);
        roof.rotation.y = Math.PI / 4;
        scene.add(roof);
      }
    });

    // 7. Initialize NPC Visuals (colored capsules)
    const npcGroup = new THREE.Group();
    scene.add(npcGroup);

    Object.entries(NPC_COLORS).forEach(([id, color]) => {
      const npcGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.4, 8);
      const npcMat = new THREE.MeshStandardMaterial({ 
        color: color, 
        roughness: 0.2, 
        metalness: 0.8
      });
      const npcMesh = new THREE.Mesh(npcGeo, npcMat);
      npcMesh.castShadow = true;
      
      // Add head
      const headGeo = new THREE.SphereGeometry(0.35, 8, 8);
      const headMat = new THREE.MeshStandardMaterial({ color: 0xf1f3f9 });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 0.95;
      npcMesh.add(head);

      // Default spawn placement
      npcMesh.position.set(0, 0.7, 0);
      npcGroup.add(npcMesh);
      npcMeshesRef.current[id] = npcMesh;
    });

    // Raycasting for interactive clicks
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleCanvasClick = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      
      // Check intersection with NPC meshes
      const npcMeshesArray = Object.values(npcMeshesRef.current);
      const intersects = raycaster.intersectObjects(npcMeshesArray);

      if (intersects.length > 0) {
        // Find agent ID matching clicked mesh
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

    // 8. Animation/Render Loop
    let animationFrameId;
    const animate = () => {
      // Lerp character positions towards target coordinates
      Object.entries(npcMeshesRef.current).forEach(([id, mesh]) => {
        const target = targetPositionsRef.current[id];
        if (target) {
          // Linear interpolation for smooth walking animation
          mesh.position.x += (target.x - mesh.position.x) * 0.05;
          mesh.position.z += (target.z - mesh.position.z) * 0.05;
          
          // Hover bobbing effect when idle
          const dist = Math.sqrt(Math.pow(target.x - mesh.position.x, 2) + Math.pow(target.z - mesh.position.z, 2));
          if (dist < 0.2) {
            mesh.position.y = 0.7 + Math.sin(Date.now() * 0.005 + id.charCodeAt(0)) * 0.04;
          } else {
            // Walking tilt/bob
            mesh.position.y = 0.7 + Math.abs(Math.sin(Date.now() * 0.015)) * 0.15;
            mesh.rotation.y = Math.atan2(target.x - mesh.position.x, target.z - mesh.position.z);
          }
        }
      });

      // Subtle rotation of point light
      pointLight.position.x = Math.sin(Date.now() * 0.0005) * 10;
      pointLight.position.z = Math.cos(Date.now() * 0.0005) * 10;

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    // Resize handler
    const handleResize = () => {
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
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

  // Update target coordinates when position array updates from API
  useEffect(() => {
    if (!agentPositions) return;

    // Distribute characters slightly around the location so they don't overlap in 3D
    const groupOffsets = {};

    Object.entries(agentPositions).forEach(([id, locName]) => {
      const baseCoords = LOCATION_COORDINATES[locName] || { x: 0, z: 0 };
      
      // Count offsets per building to spread out NPCs
      if (!groupOffsets[locName]) groupOffsets[locName] = 0;
      const idx = groupOffsets[locName]++;
      
      // Ring placement offsets
      const angle = (idx * Math.PI * 2) / 4;
      const radius = locName === "Marketplace" ? 1.5 : 0.9;
      
      targetPositionsRef.current[id] = {
        x: baseCoords.x + Math.cos(angle) * radius,
        z: baseCoords.z + Math.sin(angle) * radius
      };
    });
  }, [agentPositions]);

  // Highlights active selection
  useEffect(() => {
    Object.entries(npcMeshesRef.current).forEach(([id, mesh]) => {
      if (id === selectedAgentId) {
        mesh.scale.set(1.3, 1.3, 1.3);
      } else {
        mesh.scale.set(1.0, 1.0, 1.0);
      }
    });
  }, [selectedAgentId]);

  return (
    <div ref={mountRef} className="three-container">
      <div className="three-overlay-hud">
        <div className="hud-pill">📍 Isometric View: Silent Hollow Village</div>
        <div className="hud-pill">💡 Tip: Click on a character to interrogate them</div>
      </div>
    </div>
  );
}
