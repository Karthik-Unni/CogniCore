import React, { useEffect, useRef, useState } from 'react';

export default function SocialGraphView({ graphData }) {
  const canvasRef = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [draggedNode, setDraggedNode] = useState(null);

  // Initialize node positions and velocities
  useEffect(() => {
    if (!graphData || !graphData.nodes) return;

    const canvas = canvasRef.current;
    const width = canvas.width;
    const height = canvas.height;

    // Preserve positions of existing nodes if they match IDs
    const existingMap = new Map(nodes.map(n => [n.id, n]));

    const newNodes = graphData.nodes.map((n, idx) => {
      const existing = existingMap.get(n.id);
      if (existing) {
        // Update attributes but keep position
        return { ...existing, label: n.label, role: n.role, emotions: n.emotions };
      }
      
      // Arrange in circle initially
      const angle = (idx / graphData.nodes.length) * Math.PI * 2;
      return {
        id: n.id,
        label: n.label,
        role: n.role,
        emotions: n.emotions,
        x: width / 2 + Math.cos(angle) * 120,
        y: height / 2 + Math.sin(angle) * 120,
        vx: 0,
        vy: 0,
        radius: 20
      };
    });

    setNodes(newNodes);
    setEdges(graphData.edges || []);
  }, [graphData]);

  // Simulation loop (Force-directed layout)
  useEffect(() => {
    let animationFrameId;
    
    const updatePhysics = () => {
      if (nodes.length === 0) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      // Physics Constants
      const kRepulsion = 800; // Force pushing nodes apart
      const kAttraction = 0.05; // Spring constant pulling linked nodes
      const kGravity = 0.01;   // Force pulling nodes to center
      const friction = 0.85;

      // 1. Repulsion between all node pairs
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        if (n1 === draggedNode) continue;
        
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const distSq = dx * dx + dy * dy + 0.1;
          const dist = Math.sqrt(distSq);
          
          if (dist < 180) {
            // Repulsion force
            const force = kRepulsion / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            
            n1.vx -= fx;
            n1.vy -= fy;
            n2.vx += fx;
            n2.vy += fy;
          }
        }
      }

      // 2. Attraction along edges
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      edges.forEach(edge => {
        const source = nodeMap.get(edge.from);
        const target = nodeMap.get(edge.to);
        
        if (source && target) {
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
          
          // Resting spring length
          const springLength = 120;
          const displacement = dist - springLength;
          const force = displacement * kAttraction;
          
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          
          if (source !== draggedNode) {
            source.vx += fx;
            source.vy += fy;
          }
          if (target !== draggedNode) {
            target.vx -= fx;
            target.vy -= fy;
          }
        }
      });

      // 3. Gravity pulling to center & Update Positions
      nodes.forEach(node => {
        if (node === draggedNode) return;

        const dx = centerX - node.x;
        const dy = centerY - node.y;
        
        node.vx += dx * kGravity;
        node.vy += dy * kGravity;
        
        // Apply velocity & friction
        node.x += node.vx;
        node.y += node.vy;
        
        node.vx *= friction;
        node.vy *= friction;

        // Boundaries clamping
        node.x = Math.max(30, Math.min(width - 30, node.x));
        node.y = Math.max(30, Math.min(height - 30, node.y));
      });

      // 4. Render
      renderCanvas();
      animationFrameId = requestAnimationFrame(updatePhysics);
    };

    const renderCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;

      // Clear
      ctx.clearRect(0, 0, width, height);

      // Draw Edges
      edges.forEach(edge => {
        const source = nodes.find(n => n.id === edge.from);
        const target = nodes.find(n => n.id === edge.to);
        
        if (source && target) {
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);

          // Get edge color based on metrics
          let edgeColor = 'rgba(255, 255, 255, 0.1)';
          const friendship = edge.metrics?.friendship || 0.0;
          const trust = edge.metrics?.trust || 0.0;
          const fear = edge.metrics?.fear || 0.0;

          if (friendship > 0.3) {
            edgeColor = `rgba(16, 185, 129, ${0.15 + friendship * 0.4})`; // Friendship (Green)
          } else if (friendship < -0.3) {
            edgeColor = `rgba(255, 74, 90, ${0.15 + Math.abs(friendship) * 0.4})`; // Enmity (Red)
          } else if (fear > 0.3) {
            edgeColor = `rgba(168, 85, 247, ${0.15 + fear * 0.4})`; // Fear (Purple)
          } else if (trust > 0.3) {
            edgeColor = `rgba(59, 130, 246, ${0.15 + trust * 0.4})`; // Trust (Blue)
          } else if (trust < -0.3) {
            edgeColor = `rgba(234, 179, 8, ${0.15 + Math.abs(trust) * 0.4})`; // Distrust (Orange)
          }

          ctx.strokeStyle = edgeColor;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Draw Arrow head
          const angle = Math.atan2(target.y - source.y, target.x - source.x);
          const arrowDist = target.radius + 6;
          const arrowX = target.x - Math.cos(angle) * arrowDist;
          const arrowY = target.y - Math.sin(angle) * arrowDist;
          
          ctx.beginPath();
          ctx.moveTo(arrowX, arrowY);
          ctx.lineTo(arrowX - 8 * Math.cos(angle - Math.PI / 6), arrowY - 8 * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(arrowX - 8 * Math.cos(angle + Math.PI / 6), arrowY - 8 * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fillStyle = edgeColor;
          ctx.fill();

          // Label edge if primary label exists
          if (edge.label) {
            const midX = (source.x + target.x) / 2;
            const midY = (source.y + target.y) / 2;
            ctx.font = '9px system-ui';
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillText(edge.label, midX + 5, midY - 5);
          }
        }
      });

      // Draw Nodes
      nodes.forEach(node => {
        // Shadow/glow based on dominant emotion
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#1e2544';
        ctx.fill();
        ctx.strokeStyle = '#00a2ff';
        ctx.lineWidth = node === draggedNode ? 3 : 1.5;
        ctx.stroke();
        
        // Reset shadows
        ctx.shadowBlur = 0;

        // Label
        ctx.font = 'bold 11px system-ui';
        ctx.fillStyle = '#f1f3f9';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.label.split(' ')[1] || node.label, node.x, node.y - 2);

        // Subtitle (Role)
        ctx.font = '8px system-ui';
        ctx.fillStyle = '#8c9bb4';
        ctx.fillText(node.role, node.x, node.y + 8);
      });
    };

    updatePhysics();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [nodes, edges, draggedNode]);

  // Interactive mouse controls
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Find clicked node
    const clicked = nodes.find(n => {
      const dx = n.x - x;
      const dy = n.y - y;
      return dx * dx + dy * dy < n.radius * n.radius;
    });

    if (clicked) {
      setDraggedNode(clicked);
    }
  };

  const handleMouseMove = (e) => {
    if (!draggedNode) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    draggedNode.x = e.clientX - rect.left;
    draggedNode.y = e.clientY - rect.top;
    draggedNode.vx = 0;
    draggedNode.vy = 0;
  };

  const handleMouseUp = () => {
    setDraggedNode(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <canvas
        ref={canvasRef}
        width={700}
        height={260}
        style={{ cursor: draggedNode ? 'grabbing' : 'grab', width: '100%', maxWidth: '700px', background: 'rgba(0,0,0,0.1)', borderRadius: '8px' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <div style={{ fontSize: '10px', color: '#8c9bb4', marginTop: '6px', textAlign: 'center' }}>
        🟢 Friendship | 🔴 Enmity | 🔵 Trust | 🟡 Distrust | 🟣 Fear. Drag nodes to inspect social spacing.
      </div>
    </div>
  );
}
