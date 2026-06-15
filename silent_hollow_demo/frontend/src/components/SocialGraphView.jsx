import React, { useEffect, useRef, useState } from 'react';

export default function SocialGraphView({ graphData }) {
  const canvasRef = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [draggedNode, setDraggedNode] = useState(null);

  useEffect(() => {
    if (!graphData || !graphData.nodes) return;

    const canvas = canvasRef.current;
    const width = canvas.width;
    const height = canvas.height;

    const existingMap = new Map(nodes.map(n => [n.id, n]));

    const newNodes = graphData.nodes.map((n, idx) => {
      const existing = existingMap.get(n.id);
      if (existing) {
        return { ...existing, label: n.label, role: n.role, emotions: n.emotions };
      }
      
      const angle = (idx / graphData.nodes.length) * Math.PI * 2;
      return {
        id: n.id,
        label: n.label,
        role: n.role,
        emotions: n.emotions,
        x: width / 2 + Math.cos(angle) * 110,
        y: height / 2 + Math.sin(angle) * 110,
        vx: 0,
        vy: 0,
        radius: 22
      };
    });

    setNodes(newNodes);
    setEdges(graphData.edges || []);
  }, [graphData]);

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

      const kRepulsion = 1000;
      const kAttraction = 0.06;
      const kGravity = 0.015;
      const friction = 0.82;

      // 1. Repel nodes
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        if (n1 === draggedNode) continue;
        
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const distSq = dx * dx + dy * dy + 0.1;
          const dist = Math.sqrt(distSq);
          
          if (dist < 150) {
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

      // 2. Attract connected edges
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      edges.forEach(edge => {
        const source = nodeMap.get(edge.from);
        const target = nodeMap.get(edge.to);
        
        if (source && target) {
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
          
          const springLength = 110;
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
        
        node.x += node.vx;
        node.y += node.vy;
        
        node.vx *= friction;
        node.vy *= friction;

        node.x = Math.max(30, Math.min(width - 30, node.x));
        node.y = Math.max(30, Math.min(height - 30, node.y));
      });

      renderCanvas();
      animationFrameId = requestAnimationFrame(updatePhysics);
    };

    const renderCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Draw Edges with corrected color scheme
      // Green = trust, Red = rivalry, Yellow = suspicion, Blue = friendship
      edges.forEach(edge => {
        const source = nodes.find(n => n.id === edge.from);
        const target = nodes.find(n => n.id === edge.to);
        
        if (source && target) {
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);

          let edgeColor = 'rgba(255, 255, 255, 0.08)';
          const friendship = edge.metrics?.friendship || 0.0;
          const trust = edge.metrics?.trust || 0.0;
          const fear = edge.metrics?.fear || 0.0;
          const rivalry = edge.metrics?.rivalry || 0.0;

          // User requested: green = trust, red = rivalry, yellow = suspicion/fear, blue = friendship
          if (trust > 0.3) {
            edgeColor = `rgba(16, 185, 129, ${0.15 + trust * 0.4})`; // Trust (Green)
          } else if (rivalry > 0.3 || friendship < -0.3) {
            edgeColor = `rgba(255, 51, 102, ${0.15 + Math.max(rivalry, Math.abs(friendship)) * 0.4})`; // Rivalry/Hate (Red)
          } else if (fear > 0.3) {
            edgeColor = `rgba(234, 179, 8, ${0.15 + fear * 0.4})`; // Suspicion/Fear (Yellow)
          } else if (friendship > 0.3) {
            edgeColor = `rgba(0, 114, 255, ${0.15 + friendship * 0.4})`; // Friendship (Blue)
          }

          ctx.strokeStyle = edgeColor;
          ctx.lineWidth = 1.8;
          ctx.stroke();

          // Arrow head
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

          if (edge.label) {
            const midX = (source.x + target.x) / 2;
            const midY = (source.y + target.y) / 2;
            ctx.font = '9px system-ui';
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.fillText(edge.label, midX + 5, midY - 5);
          }
        }
      });

      // Draw Nodes (Tech aesthetic)
      nodes.forEach(node => {
        ctx.shadowBlur = 12;
        ctx.shadowColor = 'rgba(0, 242, 254, 0.15)';
        
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#060917';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
        ctx.lineWidth = node === draggedNode ? 3.0 : 1.5;
        ctx.stroke();
        
        ctx.shadowBlur = 0;

        ctx.font = 'bold 11px system-ui';
        ctx.fillStyle = '#f1f3f9';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.label.split(' ')[1] || node.label, node.x, node.y - 2);

        ctx.font = '8px monospace';
        ctx.fillStyle = '#8c9bb4';
        ctx.fillText(node.role, node.x, node.y + 8);
      });
    };

    updatePhysics();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [nodes, edges, draggedNode]);

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

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
        width={720}
        height={260}
        style={{ cursor: draggedNode ? 'grabbing' : 'grab', width: '100%', maxWidth: '720px', background: 'rgba(0,0,0,0.15)', borderRadius: '6px' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <div style={{ fontSize: '10px', color: '#8c9bb4', marginTop: '6px', textAlign: 'center', fontFamily: 'monospace' }}>
        🟢 Trust | 🔴 Rivalry | 🟡 Suspicion/Fear | 🔵 Friendship. Drag nodes to inspect social spacing.
      </div>
    </div>
  );
}
