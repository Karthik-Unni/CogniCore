import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// Spherical coordinates for game mode houses
const SPHERICAL_LOCATIONS = {
  "Alden": { phi: Math.PI / 4, psi: 0, color: 0xef4444, name: "Mayor Alden" },
  "Katherine": { phi: Math.PI / 3, psi: Math.PI / 2, color: 0x3b82f6, name: "Guard Katherine" },
  "Marcus": { phi: Math.PI / 2, psi: Math.PI / 4, color: 0x06b6d4, name: "Merchant Marcus" },
  "Dennis": { phi: 2 * Math.PI / 3, psi: 3 * Math.PI / 4, color: 0x6b7280, name: "Blacksmith Dennis" },
  "Clara": { phi: Math.PI / 3, psi: Math.PI, color: 0x10b981, name: "Doctor Clara" },
  "Elena": { phi: Math.PI / 2, psi: 5 * Math.PI / 4, color: 0xf59e0b, name: "Elena the Innkeeper" },
  "Silas": { phi: 2 * Math.PI / 3, psi: 3 * Math.PI / 2, color: 0x84cc16, name: "Farmer Silas" },
  "Gerald": { phi: Math.PI / 4, psi: 7 * Math.PI / 4, color: 0xa855f7, name: "Hunter Gerald" }
};

// Location coordinates mapped on sphere
const LOCATION_SPHERICAL = {
  "Town Hall": { phi: Math.PI / 4, psi: 0 },
  "Merchant Store": { phi: Math.PI / 2, psi: Math.PI / 4 },
  "Blacksmith": { phi: 2 * Math.PI / 3, psi: 3 * Math.PI / 4 },
  "Doctor Clinic": { phi: Math.PI / 3, psi: Math.PI },
  "Tavern": { phi: Math.PI / 2, psi: 5 * Math.PI / 4 },
  "Farms": { phi: 2 * Math.PI / 3, psi: 3 * Math.PI / 2 },
  "Forest Edge": { phi: Math.PI / 4, psi: 7 * Math.PI / 4 },
  "Marketplace": { phi: Math.PI / 3, psi: Math.PI / 2 }
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

function createChibiNPC(color) {
  const group = new THREE.Group();

  // Chibi Head
  const headGeo = new THREE.SphereGeometry(0.24, 12, 12);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffcad4, roughness: 0.6 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 0.95;
  group.add(head);

  // Eyes
  const eyeGeo = new THREE.SphereGeometry(0.035, 6, 6);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.08, 0.02, 0.2);
  head.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.08, 0.02, 0.2);
  head.add(rightEye);

  // Cute Hat / Cap matching their color
  const capGeo = new THREE.CylinderGeometry(0.25, 0.22, 0.08, 10);
  const capMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.5 });
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.position.y = 0.18;
  head.add(cap);

  // Body Coat
  const bodyGeo = new THREE.CylinderGeometry(0.24, 0.18, 0.65, 10);
  const bodyMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.5 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.5;
  body.castShadow = true;
  group.add(body);

  // Arms
  const armGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.35, 6);
  const armMat = new THREE.MeshStandardMaterial({ color: color });
  
  const leftArm = new THREE.Mesh(armGeo, armMat);
  leftArm.position.set(-0.3, 0.45, 0);
  leftArm.castShadow = true;
  group.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, armMat);
  rightArm.position.set(0.3, 0.45, 0);
  rightArm.castShadow = true;
  group.add(rightArm);

  // Legs
  const legGeo = new THREE.BoxGeometry(0.08, 0.3, 0.08);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1d3557 });
  
  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.1, 0.15, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, legMat);
  rightLeg.position.set(0.1, 0.15, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);

  return {
    group,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    body
  };
}

export default function ThreeViewport({ 
  agentPositions, 
  selectedAgentId, 
  onSelectAgent, 
  activeDeliveryNPC = "Elena",
  onDeliverySuccess = () => {},
  onNearNPC = () => {}
}) {
  const mountRef = useRef(null);
  const containerRef = useRef(null);
  
  // Track 3D elements
  const npcMeshesRef = useRef({});
  const npcLimbsRef = useRef({});
  const npcTargetsRef = useRef({});
  
  const cameraRef = useRef(null);
  const sceneRef = useRef(null);

  // Create refs to prevent rebuild loop
  const activeDeliveryNPCRef = useRef(activeDeliveryNPC);
  const onDeliverySuccessRef = useRef(onDeliverySuccess);
  const onNearNPCRef = useRef(onNearNPC);
  const keysRef = useRef({ w: false, a: false, s: false, d: false, space: false });

  useEffect(() => {
    activeDeliveryNPCRef.current = activeDeliveryNPC;
  }, [activeDeliveryNPC]);

  useEffect(() => {
    onDeliverySuccessRef.current = onDeliverySuccess;
  }, [onDeliverySuccess]);

  useEffect(() => {
    onNearNPCRef.current = onNearNPC;
  }, [onNearNPC]);

  // Main 3D Engine Setup
  useEffect(() => {
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x04060f); // Dark luxury blue
    scene.fog = new THREE.FogExp2(0x04060f, 0.015);

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
    cameraRef.current = camera;

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);

    // 4. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(15, 30, 15);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x00f2fe, 2.0, 50);
    pointLight.position.set(0, 4, 0);
    scene.add(pointLight);

    // Variables for animation loop
    let animationFrameId;
    let clock = new THREE.Clock();

    // ----------------------------------------------------
    // MESSENGER SPHERICAL PLANET MODE
    // ----------------------------------------------------
    const R = 10; // Planet radius
    
    // Helper to compute 3D point on sphere from polar coordinates (phi, psi)
    const getSphericalPos = (phi, psi, h = 0) => {
      const radius = R + h;
      return new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(psi),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(psi)
      );
    };

    // 0. Helper to create dynamic planet texture
    const createPlanetTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');

      // Base grass green
      ctx.fillStyle = '#6b9055'; 
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw soft wavy pathways (roads)
      ctx.strokeStyle = '#ebd9be';
      ctx.lineWidth = 35;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Equator highway
      ctx.beginPath();
      for (let x = 0; x <= canvas.width; x += 10) {
        const y = canvas.height / 2 + Math.sin(x * 0.008) * 40;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Longitudinal vertical roads
      for (let i = 0; i < 4; i++) {
        const startX = (i * canvas.width) / 4 + canvas.width / 8;
        ctx.beginPath();
        for (let y = 0; y <= canvas.height; y += 10) {
          const x = startX + Math.cos(y * 0.01) * 35;
          if (y === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Draw darker green grass blades (detail)
      ctx.strokeStyle = '#527040';
      ctx.lineWidth = 3;
      for (let i = 0; i < 250; i++) {
        const gx = Math.random() * canvas.width;
        const gy = Math.random() * canvas.height;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx - 3, gy - 6);
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx, gy - 8);
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + 3, gy - 6);
        ctx.stroke();
      }

      // Draw flower clusters
      for (let i = 0; i < 120; i++) {
        const fx = Math.random() * canvas.width;
        const fy = Math.random() * canvas.height;
        const color = Math.random() > 0.5 ? '#f4a261' : '#e9c46a';
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(fx, fy, 2, 0, Math.PI*2);
        ctx.arc(fx - 3, fy - 1, 1.5, 0, Math.PI*2);
        ctx.arc(fx + 3, fy + 1, 1.5, 0, Math.PI*2);
        ctx.fill();
      }

      return new THREE.CanvasTexture(canvas);
    };

    // 1. Render the Planet Sphere
    const planetGroup = new THREE.Group();
    scene.add(planetGroup);

    const planetGeo = new THREE.SphereGeometry(R, 40, 40);
    const planetMat = new THREE.MeshStandardMaterial({
      map: createPlanetTexture(),
      roughness: 0.9,
      metalness: 0.05
    });
    const planet = new THREE.Mesh(planetGeo, planetMat);
    planet.receiveShadow = true;
    planetGroup.add(planet);

    // Add a slow-rotating starfield backdrop
    const starGeo = new THREE.BufferGeometry();
    const starCount = 800;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const radius = 150 + Math.random() * 80;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      
      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.cos(phi);
      starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.8,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true
    });
    const starPoints = new THREE.Points(starGeo, starMat);
    scene.add(starPoints);

    // 2. Spawn Cottages, Glowing Mailboxes, and Obstacles
    const obstacles = []; 
    const mailboxes = {};   

    // Spawn 8 cottages
    Object.entries(SPHERICAL_LOCATIONS).forEach(([npcId, config]) => {
      const houseGroup = new THREE.Group();
      const pos = getSphericalPos(config.phi, config.psi, 0);
      
      // Wood log base of house
      const baseGeo = new THREE.BoxGeometry(1.2, 0.8, 1.2);
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x8b5a2b, 
        roughness: 0.8,
        metalness: 0.1
      });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.y = 0.4;
      base.castShadow = true;
      base.receiveShadow = true;
      houseGroup.add(base);

      // Slanted cottage roof colored in the NPC's signature color
      const roofGeo = new THREE.ConeGeometry(1.0, 0.8, 4);
      const roofMat = new THREE.MeshStandardMaterial({ 
        color: config.color, 
        roughness: 0.6 
      });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = 1.2;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      houseGroup.add(roof);

      // Chimney on the roof
      const chimneyGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.3, 6);
      const chimneyMat = new THREE.MeshStandardMaterial({ color: 0x3d3d3d, roughness: 0.8 });
      const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
      chimney.position.set(0.3, 1.1, -0.3);
      chimney.castShadow = true;
      houseGroup.add(chimney);

      // Glowing warm yellow window
      const windowGeo = new THREE.BoxGeometry(0.2, 0.2, 0.02);
      const windowMat = new THREE.MeshBasicMaterial({ color: 0xffd166 }); 
      const frontWindow = new THREE.Mesh(windowGeo, windowMat);
      frontWindow.position.set(0, 0.45, 0.605);
      houseGroup.add(frontWindow);

      // Dark wood door
      const doorGeo = new THREE.BoxGeometry(0.35, 0.5, 0.02);
      const doorMat = new THREE.MeshStandardMaterial({ color: 0x4a2c11 });
      const door = new THREE.Mesh(doorGeo, doorMat);
      door.position.set(0, 0.25, 0.601);
      houseGroup.add(door);

      // Position and orient house to stand perpendicular on the sphere
      houseGroup.position.copy(pos);
      const upVec = pos.clone().normalize();
      houseGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), upVec);
      planetGroup.add(houseGroup);

      // Save as obstacle for collision checking
      obstacles.push({ group: houseGroup, radius: 0.9, type: "house" });

      // Spawn Mailbox slightly offset
      const mailPos = getSphericalPos(config.phi + 0.08, config.psi + 0.08, 0);
      const mailboxGroup = new THREE.Group();

      // Mailbox post
      const postGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.55, 6);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x3d3d3d });
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.y = 0.275;
      mailboxGroup.add(post);

      // Glowing neon mailbox body
      const boxGeo = new THREE.BoxGeometry(0.18, 0.18, 0.26);
      const boxMat = new THREE.MeshStandardMaterial({
        color: config.color,
        emissive: config.color,
        emissiveIntensity: 0.6,
        roughness: 0.3
      });
      const box = new THREE.Mesh(boxGeo, boxMat);
      box.position.y = 0.6;
      box.castShadow = true;
      mailboxGroup.add(box);

      // White paper envelope sticking out of the slot
      const envelopeGeo = new THREE.BoxGeometry(0.08, 0.12, 0.02);
      const envelopeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
      const envelope = new THREE.Mesh(envelopeGeo, envelopeMat);
      envelope.position.set(0, 0.6, 0.14);
      envelope.rotation.x = 0.2;
      mailboxGroup.add(envelope);

      mailboxGroup.position.copy(mailPos);
      const mailUp = mailPos.clone().normalize();
      mailboxGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), mailUp);
      planetGroup.add(mailboxGroup);

      mailboxes[npcId] = mailboxGroup;
    });

    // Spawn central Marketplace kiosk canopy on the sphere
    const kioskGroup = new THREE.Group();
    const kioskPos = getSphericalPos(LOCATION_SPHERICAL["Marketplace"].phi, LOCATION_SPHERICAL["Marketplace"].psi, 0);
    kioskGroup.position.copy(kioskPos);
    const kioskUp = kioskPos.clone().normalize();
    kioskGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), kioskUp);
    planetGroup.add(kioskGroup);

    const kioskBaseGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.15, 8);
    const kioskBaseMat = new THREE.MeshStandardMaterial({ color: 0x4a4e69, roughness: 0.8 });
    const kioskBase = new THREE.Mesh(kioskBaseGeo, kioskBaseMat);
    kioskBase.position.y = 0.075;
    kioskGroup.add(kioskBase);

    const kioskPillarGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6);
    const kioskPillarMat = new THREE.MeshStandardMaterial({ color: 0x5c3d2e });
    const kioskPillar = new THREE.Mesh(kioskPillarGeo, kioskPillarMat);
    kioskPillar.position.y = 0.8;
    kioskGroup.add(kioskPillar);

    const kioskCanopyGeo = new THREE.ConeGeometry(2.0, 0.9, 8);
    const kioskCanopyMat = new THREE.MeshStandardMaterial({ color: 0xc5a880, roughness: 0.5 });
    const kioskCanopy = new THREE.Mesh(kioskCanopyGeo, kioskCanopyMat);
    kioskCanopy.position.y = 1.75;
    kioskCanopy.castShadow = true;
    kioskGroup.add(kioskCanopy);

    obstacles.push({ group: kioskGroup, radius: 1.2, type: "market" });

    // Spawn 35 pine trees randomly distributed across the planet
    let seedVal = 42;
    const seededRandom = () => {
      const x = Math.sin(seedVal++) * 10000;
      return x - Math.floor(x);
    };

    for (let i = 0; i < 35; i++) {
      const phi = seededRandom() * Math.PI;
      const psi = seededRandom() * Math.PI * 2;
      
      let tooClose = false;
      Object.values(SPHERICAL_LOCATIONS).forEach(config => {
        const dist = Math.acos(
          Math.sin(phi) * Math.sin(config.phi) * Math.cos(psi - config.psi) + 
          Math.cos(phi) * Math.cos(config.phi)
        );
        if (dist < 0.25) tooClose = true;
      });

      // Avoid marketplace
      const distToKiosk = Math.acos(
        Math.sin(phi) * Math.sin(LOCATION_SPHERICAL["Marketplace"].phi) * Math.cos(psi - LOCATION_SPHERICAL["Marketplace"].psi) + 
        Math.cos(phi) * Math.cos(LOCATION_SPHERICAL["Marketplace"].phi)
      );
      if (distToKiosk < 0.25) tooClose = true;

      // Avoid spawning trees near the North Pole (player starting position)
      if (phi < 0.35) tooClose = true;

      if (tooClose) continue;

      const treeGroup = new THREE.Group();
      const treePos = getSphericalPos(phi, psi, 0);

      // Trunk
      const trunkGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.4, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 0.2;
      treeGroup.add(trunk);

      // Foliage
      const leavesGeo = new THREE.ConeGeometry(0.5, 1.2, 5);
      const leavesMat = new THREE.MeshStandardMaterial({ color: 0x1b4332, roughness: 0.9 });
      const leaves = new THREE.Mesh(leavesGeo, leavesMat);
      leaves.position.y = 0.9;
      leaves.castShadow = true;
      treeGroup.add(leaves);

      treeGroup.position.copy(treePos);
      const treeUp = treePos.clone().normalize();
      treeGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), treeUp);
      planetGroup.add(treeGroup);

      obstacles.push({ group: treeGroup, radius: 0.5, type: "tree" });
    }

    // Print all obstacles positions for debugging
    planetGroup.updateMatrixWorld(true);
    console.log("Obstacles count:", obstacles.length);
    obstacles.forEach((obs, idx) => {
      const pos = new THREE.Vector3();
      obs.group.getWorldPosition(pos);
      console.log(`Obstacle ${idx} (${obs.type}): localPos=(${obs.group.position.x.toFixed(3)}, ${obs.group.position.y.toFixed(3)}, ${obs.group.position.z.toFixed(3)}), worldPos=(${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)}), radius=${obs.radius}`);
    });

    // 3. Spawn 8 Chibi NPCs on the sphere
    Object.entries(NPC_COLORS).forEach(([id, color]) => {
      const chibi = createChibiNPC(color);
      const initialPos = getSphericalPos(SPHERICAL_LOCATIONS[id].phi - 0.05, SPHERICAL_LOCATIONS[id].psi, 0.1);
      chibi.group.position.copy(initialPos);
      
      const upVec = initialPos.clone().normalize();
      chibi.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), upVec);
      
      planetGroup.add(chibi.group);
      npcMeshesRef.current[id] = chibi.group;
      npcLimbsRef.current[id] = chibi;
    });

    // 4. Render the Player Character (fixed at top: (0, R, 0))
    const courierGroup = new THREE.Group();
    courierGroup.position.set(0, R, 0);
    scene.add(courierGroup);

    // Chibi Head
    const courierHeadGeo = new THREE.SphereGeometry(0.24, 12, 12);
    const courierHeadMat = new THREE.MeshStandardMaterial({ color: 0xffcad4, roughness: 0.6 });
    const courierHead = new THREE.Mesh(courierHeadGeo, courierHeadMat);
    courierHead.position.y = 0.95;
    courierGroup.add(courierHead);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.03, 6, 6);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.08, 0.02, 0.2);
    courierHead.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.08, 0.02, 0.2);
    courierHead.add(rightEye);

    // Postman Cap
    const capGroup = new THREE.Group();
    capGroup.position.set(0, 0.18, 0.02);
    capGroup.rotation.x = -0.15;
    
    const capCrownGeo = new THREE.CylinderGeometry(0.25, 0.22, 0.1, 10);
    const capCrownMat = new THREE.MeshStandardMaterial({ color: 0x1d3557, roughness: 0.5 });
    const capCrown = new THREE.Mesh(capCrownGeo, capCrownMat);
    capCrown.scale.set(1.1, 1.0, 1.25);
    capGroup.add(capCrown);

    const capVisorGeo = new THREE.BoxGeometry(0.26, 0.015, 0.12);
    const capVisorMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
    const capVisor = new THREE.Mesh(capVisorGeo, capVisorMat);
    capVisor.position.set(0, -0.04, 0.14);
    capVisor.rotation.x = 0.25;
    capGroup.add(capVisor);

    const badgeGeo = new THREE.BoxGeometry(0.05, 0.05, 0.02);
    const badgeMat = new THREE.MeshStandardMaterial({ color: 0xffd166, metalness: 0.8, roughness: 0.2 });
    const badge = new THREE.Mesh(badgeGeo, badgeMat);
    badge.position.set(0, 0, 0.125);
    capGroup.add(badge);

    courierHead.add(capGroup);

    // Coat Body
    const courierBodyGeo = new THREE.CylinderGeometry(0.24, 0.18, 0.65, 10);
    const courierBodyMat = new THREE.MeshStandardMaterial({ color: 0x457b9d, roughness: 0.5 });
    const courierBody = new THREE.Mesh(courierBodyGeo, courierBodyMat);
    courierBody.position.y = 0.5;
    courierBody.castShadow = true;
    courierGroup.add(courierBody);

    // Brown Satchel
    const satchelGeo = new THREE.BoxGeometry(0.12, 0.24, 0.32);
    const satchelMat = new THREE.MeshStandardMaterial({ color: 0x7f4f24, roughness: 0.7 });
    const satchel = new THREE.Mesh(satchelGeo, satchelMat);
    satchel.position.set(0.2, 0.05, 0.05);
    satchel.rotation.z = -0.15;
    courierBody.add(satchel);

    const satchelStrapGeo = new THREE.BoxGeometry(0.02, 0.75, 0.06);
    const satchelStrapMat = new THREE.MeshStandardMaterial({ color: 0x582f0e });
    const satchelStrap = new THREE.Mesh(satchelStrapGeo, satchelStrapMat);
    satchelStrap.position.set(-0.05, 0.2, 0);
    satchelStrap.rotation.z = 0.7;
    courierBody.add(satchelStrap);

    // Arms (swinging)
    const armGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.35, 6);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x457b9d, roughness: 0.5 });
    
    const courierLeftArm = new THREE.Mesh(armGeo, armMat);
    courierLeftArm.position.set(-0.3, 0.45, 0);
    courierLeftArm.castShadow = true;
    courierGroup.add(courierLeftArm);

    const courierRightArm = new THREE.Mesh(armGeo, armMat);
    courierRightArm.position.set(0.3, 0.45, 0);
    courierRightArm.castShadow = true;
    courierGroup.add(courierRightArm);

    // Legs (swinging)
    const legGeo = new THREE.BoxGeometry(0.08, 0.3, 0.08);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1d3557 });
    
    const courierLeftLeg = new THREE.Mesh(legGeo, legMat);
    courierLeftLeg.position.set(-0.1, 0.15, 0);
    courierLeftLeg.castShadow = true;
    courierGroup.add(courierLeftLeg);

    const courierRightLeg = new THREE.Mesh(legGeo, legMat);
    courierRightLeg.position.set(0.1, 0.15, 0);
    courierRightLeg.castShadow = true;
    courierGroup.add(courierRightLeg);

    // 5. Glowing Mailbox Pointer Indicator (Neon Arrow)
    const targetPointer = new THREE.Group();
    
    const arrowShaftGeo = new THREE.BoxGeometry(0.08, 0.35, 0.08);
    const arrowShaftMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
    const arrowShaft = new THREE.Mesh(arrowShaftGeo, arrowShaftMat);
    arrowShaft.position.y = 0.25;
    targetPointer.add(arrowShaft);

    const arrowHeadGeo = new THREE.ConeGeometry(0.18, 0.3, 4);
    const arrowHeadMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
    const arrowHead = new THREE.Mesh(arrowHeadGeo, arrowHeadMat);
    arrowHead.rotation.x = Math.PI;
    targetPointer.add(arrowHead);

    scene.add(targetPointer);

    // 6. Particle Trail emitter system
    const trailParticles = [];
    const particleGeo = new THREE.SphereGeometry(0.08, 4, 4);
    const particleMat = new THREE.MeshBasicMaterial({
      color: 0xe9d8a6, 
      transparent: true,
      opacity: 0.6
    });

    const spawnParticle = (heading, speed) => {
      if (speed < 0.01) return;
      const particle = new THREE.Mesh(particleGeo, particleMat.clone());
      
      const offsetDist = 0.3;
      particle.position.set(
        -Math.sin(heading) * offsetDist + (Math.random() - 0.5) * 0.1,
        R + 0.05,
        -Math.cos(heading) * offsetDist + (Math.random() - 0.5) * 0.1
      );
      scene.add(particle);
      trailParticles.push({
        mesh: particle,
        velY: (Math.random() * 0.5 + 0.2) * 0.02,
        opacity: 0.6
      });
    };

    // 7. Keyboard Control listeners
    const handleKeyDown = (e) => {
      console.log("Key Down Event:", e.key);
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') keysRef.current.w = true;
      if (key === 's' || key === 'arrowdown') keysRef.current.s = true;
      if (key === 'a' || key === 'arrowleft') keysRef.current.a = true;
      if (key === 'd' || key === 'arrowright') keysRef.current.d = true;
      if (e.key === ' ') keysRef.current.space = true;
    };
    
    const handleKeyUp = (e) => {
      console.log("Key Up Event:", e.key);
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') keysRef.current.w = false;
      if (key === 's' || key === 'arrowdown') keysRef.current.s = false;
      if (key === 'a' || key === 'arrowleft') keysRef.current.a = false;
      if (key === 'd' || key === 'arrowright') keysRef.current.d = false;
      if (e.key === ' ') keysRef.current.space = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Click raycast selection for backup interaction click on cottages or NPCs
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleCanvasClick = (e) => {
      // Focus window for keyboard controls
      window.focus();

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      
      // Intersect characters
      const characterMeshes = Object.values(npcMeshesRef.current);
      const intersects = raycaster.intersectObjects(characterMeshes, true);

      if (intersects.length > 0) {
        let clickedObj = intersects[0].object;
        let agentId = null;
        
        while (clickedObj && clickedObj !== scene) {
          agentId = Object.keys(npcMeshesRef.current).find(
            key => npcMeshesRef.current[key] === clickedObj
          );
          if (agentId) break;
          clickedObj = clickedObj.parent;
        }
        if (agentId) onSelectAgent(agentId);
      }
    };
    renderer.domElement.addEventListener('click', handleCanvasClick);

    // Handle window resize dynamically
    const handleResize = () => {
      if (!mountRef.current || !camera || !renderer) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    let heading = 0; 
    let jumpHeight = 0;
    let velY = 0; 
    const gravity = 32.0;
    const speed = 3.2;
    
    // Proximity state
    let lastNearNPCId = null;

    // 8. Animation loop
    const animateGame = () => {
      const dt = Math.min(0.03, clock.getDelta()); // Cap delta to avoid jumps on focus loss
      const time = Date.now();

      // Rotate starfield slowly
      starPoints.rotation.y += 0.012 * dt;
      starPoints.rotation.x += 0.004 * dt;

      if (keysRef.current.w || keysRef.current.s || keysRef.current.a || keysRef.current.d) {
        console.log("animateGame loop keys:", 
                    "w:", keysRef.current.w, 
                    "s:", keysRef.current.s, 
                    "a:", keysRef.current.a, 
                    "d:", keysRef.current.d, 
                    "dt:", dt, 
                    "heading:", heading);
      }

      // A. Heading turn controls
      if (keysRef.current.a) {
        heading += 3.8 * dt;
      }
      if (keysRef.current.d) {
        heading -= 3.8 * dt;
      }
      
      courierGroup.rotation.y = heading;

      // B. Running movement (Rotates planet under player)
      let isRunning = false;
      let runningSpeed = 0;

      if (keysRef.current.w || keysRef.current.s) {
        isRunning = true;
        runningSpeed = speed;
        const runDir = keysRef.current.w ? -1 : 1; 

        // Store pre-rotation distances to all obstacles in world space
        const preDistances = [];
        const tempCheckPos = new THREE.Vector3();
        const playerWorldPosAtStart = new THREE.Vector3(0, R + jumpHeight, 0);
        for (let obstacle of obstacles) {
          obstacle.group.getWorldPosition(tempCheckPos);
          preDistances.push(tempCheckPos.distanceTo(playerWorldPosAtStart));
        }

        const prevQuat = planetGroup.quaternion.clone();

        const rotAxis = new THREE.Vector3(-Math.cos(heading), 0, Math.sin(heading));
        planetGroup.rotateOnWorldAxis(rotAxis, runDir * speed * dt);

        // Force update the matrix world of the planet and its children so getWorldPosition is accurate for the current frame
        planetGroup.updateMatrixWorld(true);

        // C. Collision detection against obstacles
        let collisionDetected = false;
        const tempPos = new THREE.Vector3();
        
        for (let idx = 0; idx < obstacles.length; idx++) {
          const obstacle = obstacles[idx];
          obstacle.group.getWorldPosition(tempPos);
          const playerWorldPos = new THREE.Vector3(0, R + jumpHeight, 0);
          
          const dist = tempPos.distanceTo(playerWorldPos);
          if (dist < obstacle.radius) {
            // Only treat it as a collision if we moved closer to the obstacle than we were before
            const prevDist = preDistances[idx];
            if (dist < prevDist) {
              console.log("Collision detected with:", obstacle.type, "at distance:", dist, "radius:", obstacle.radius, "prevDist:", prevDist);
              collisionDetected = true;
              break;
            }
          }
        }

        if (collisionDetected) {
          // Revert rotation if collision detected
          planetGroup.quaternion.copy(prevQuat);
          planetGroup.updateMatrixWorld(true); // Sync matrix world back to pre-collision state
          isRunning = false;
          runningSpeed = 0;
        }
      }

      // D. Jump Physics
      if (keysRef.current.space && jumpHeight === 0) {
        velY = 10.5; 
      }

      if (jumpHeight > 0 || velY > 0) {
        velY -= gravity * dt;
        jumpHeight += velY * dt;
        if (jumpHeight < 0) {
          jumpHeight = 0;
          velY = 0;
        }
      }

      courierGroup.position.y = R + jumpHeight;

      // E. Run leg & arm swing animation
      if (isRunning) {
        courierLeftLeg.rotation.x = Math.sin(time * 0.018) * 0.65;
        courierRightLeg.rotation.x = -Math.sin(time * 0.018) * 0.65;
        courierLeftArm.rotation.x = -Math.sin(time * 0.018) * 0.55;
        courierRightArm.rotation.x = Math.sin(time * 0.018) * 0.55;
        courierBody.position.y = 0.5 + Math.abs(Math.sin(time * 0.018)) * 0.05;
        
        if (Math.random() < 0.3) {
          spawnParticle(heading, runningSpeed);
        }
      } else {
        courierLeftLeg.rotation.x = 0;
        courierRightLeg.rotation.x = 0;
        courierLeftArm.rotation.x = 0;
        courierRightArm.rotation.x = 0;
        courierBody.position.y = 0.5;
      }

      // F. Update Dust Particles
      for (let i = trailParticles.length - 1; i >= 0; i--) {
        const p = trailParticles[i];
        p.mesh.position.y += p.velY;
        p.opacity -= 1.8 * dt;
        p.mesh.material.opacity = p.opacity;
        
        if (p.opacity <= 0) {
          scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          p.mesh.material.dispose();
          trailParticles.splice(i, 1);
        }
      }

      // G. Update Courier Delivery Pointer
      const activeMailbox = mailboxes[activeDeliveryNPCRef.current];
      if (activeMailbox) {
        const mailboxWorldPos = new THREE.Vector3();
        activeMailbox.getWorldPosition(mailboxWorldPos);

        targetPointer.position.copy(mailboxWorldPos).add(mailboxWorldPos.clone().normalize().multiplyScalar(1.25));
        targetPointer.lookAt(mailboxWorldPos);
        targetPointer.rotateX(Math.PI / 2); 
        targetPointer.position.y += Math.sin(time * 0.006) * 0.15; 
        targetPointer.visible = true;

        const scale = 1.0 + Math.sin(time * 0.008) * 0.15;
        activeMailbox.scale.set(scale, scale, scale);

        // Check Delivery zone collision (Player reached mailbox!)
        const playerWorldPos = new THREE.Vector3(0, R + jumpHeight, 0);
        const dist = mailboxWorldPos.distanceTo(playerWorldPos);
        if (dist < 1.35) {
          console.log("Delivery Success triggered! mailboxWorldPos=", mailboxWorldPos, "playerWorldPos=", playerWorldPos, "dist=", dist);
          onDeliverySuccessRef.current(activeDeliveryNPCRef.current);
        }
      } else {
        targetPointer.visible = false;
      }

      // Reset scales for inactive mailboxes
      Object.entries(mailboxes).forEach(([npcId, mesh]) => {
        if (npcId !== activeDeliveryNPCRef.current) {
          mesh.scale.set(1.0, 1.0, 1.0);
        }
      });

      // H. Animate and Update NPCs walking & orienting on the sphere
      Object.entries(npcMeshesRef.current).forEach(([id, mesh]) => {
        const target = npcTargetsRef.current[id];
        if (target) {
          const dist = mesh.position.distanceTo(target);
          const limbs = npcLimbsRef.current[id];
          
          if (dist < 0.25) {
            // Idle breathing
            mesh.position.copy(target);
            mesh.position.y += Math.sin(time * 0.004 + id.charCodeAt(0)) * 0.015;
            
            if (limbs) {
              limbs.leftLeg.rotation.x = 0;
              limbs.rightLeg.rotation.x = 0;
              limbs.leftArm.rotation.x = 0;
              limbs.rightArm.rotation.x = 0;
              limbs.body.position.y = 0.5;
            }

            // Stand upright perpendicular on sphere facing outward
            const upVec = mesh.position.clone().normalize();
            mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), upVec);
          } else {
            // Walking along sphere surface
            mesh.position.lerp(target, 2.5 * dt);
            mesh.position.normalize().multiplyScalar(R + 0.1);

            // Orient upright + facing walk direction
            const normal = mesh.position.clone().normalize();
            const toTarget = target.clone().sub(mesh.position);
            const dot = toTarget.dot(normal);
            const tangentForward = toTarget.addScaledVector(normal, -dot);
            
            if (tangentForward.lengthSq() > 0.0001) {
              tangentForward.normalize();
              const right = new THREE.Vector3().crossVectors(normal, tangentForward).normalize();
              const matrix = new THREE.Matrix4().makeBasis(right, normal, tangentForward);
              mesh.quaternion.setFromRotationMatrix(matrix);
            } else {
              const upVec = mesh.position.clone().normalize();
              mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), upVec);
            }

            // Swing legs and arms
            if (limbs) {
              limbs.leftLeg.rotation.x = Math.sin(time * 0.015) * 0.55;
              limbs.rightLeg.rotation.x = -Math.sin(time * 0.015) * 0.55;
              limbs.leftArm.rotation.x = -Math.sin(time * 0.015) * 0.45;
              limbs.rightArm.rotation.x = Math.sin(time * 0.015) * 0.45;
              limbs.body.position.y = 0.5 + Math.abs(Math.sin(time * 0.015)) * 0.03;
            }
          }
        }
      });

      // I. Proximity checks for popup dialogs (closest NPC within 1.8 range)
      let closestNPCId = null;
      let minDistance = 99999;
      const playerPos = new THREE.Vector3(0, R + jumpHeight, 0);
      const tempWorldPos = new THREE.Vector3();

      Object.entries(npcMeshesRef.current).forEach(([id, mesh]) => {
        mesh.getWorldPosition(tempWorldPos);
        const dist = tempWorldPos.distanceTo(playerPos);
        if (dist < minDistance) {
          minDistance = dist;
          closestNPCId = id;
        }
      });

      const nearNPC = minDistance < 2.0 ? closestNPCId : null;
      if (nearNPC !== lastNearNPCId) {
        lastNearNPCId = nearNPC;
        onNearNPCRef.current(nearNPC);
      }

      // J. Camera placement (Arcade third-person follow)
      camera.position.set(
        -Math.sin(heading) * 4.8,
        R + jumpHeight + 3.4,
        -Math.cos(heading) * 4.8
      );
      camera.lookAt(
        Math.sin(heading) * 1.8,
        R + jumpHeight - 0.3,
        Math.cos(heading) * 1.8
      );

      // Light source follows active mailbox or target
      if (activeMailbox) {
        const pos = new THREE.Vector3();
        activeMailbox.getWorldPosition(pos);
        pointLight.position.copy(pos).multiplyScalar(1.1);
      } else if (nearNPC) {
        const pos = new THREE.Vector3();
        npcMeshesRef.current[nearNPC].getWorldPosition(pos);
        pointLight.position.copy(pos).multiplyScalar(1.1);
      }

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animateGame);
    };
    animateGame();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      
      trailParticles.forEach(p => {
        scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
      });

      try {
        if (renderer.domElement && mountRef.current) {
          renderer.domElement.removeEventListener('click', handleCanvasClick);
          if (mountRef.current.contains(renderer.domElement)) {
            mountRef.current.removeChild(renderer.domElement);
          }
        }
      } catch (err) {
        console.error("Cleanup error:", err);
      }
      scene.clear();
    };
  }, []);

  // Sync positions from agentPositions prop (Simulation Mode locations)
  useEffect(() => {
    if (!agentPositions) return;

    Object.entries(agentPositions).forEach(([id, locName]) => {
      const locSpherical = LOCATION_SPHERICAL[locName] || SPHERICAL_LOCATIONS[id] || { phi: 0, psi: 0 };
      
      // Compute offset so multiple NPCs at the same location do not overlap
      const sameLocAgents = Object.entries(agentPositions)
        .filter(([_, l]) => l === locName)
        .map(([aId, _]) => aId);
      const idx = sameLocAgents.indexOf(id);
      
      const angle = (idx * Math.PI * 2) / Math.max(1, sameLocAgents.length);
      const radiusOffset = sameLocAgents.length > 1 ? 0.05 : 0.0;
      
      const phi = locSpherical.phi + Math.sin(angle) * radiusOffset;
      const psi = locSpherical.psi + Math.cos(angle) * radiusOffset;

      // Project target on sphere
      npcTargetsRef.current[id] = getSphericalPos(phi, psi, 0.1);
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

  // Project spherical coords to get 3D point
  const R = 10;
  const getSphericalPos = (phi, psi, h = 0) => {
    const radius = R + h;
    return new THREE.Vector3(
      radius * Math.sin(phi) * Math.cos(psi),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(psi)
    );
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Viewport canvas */}
      <div ref={mountRef} className="three-container" style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
