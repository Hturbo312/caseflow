import { useMemo, useState, useEffect, useRef } from 'react';
import { ReactFlow, Background, Controls, MarkerType } from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import '@xyflow/react/dist/style.css';

const colors = ['#3478b8', '#388578', '#8868aa', '#b1843e', '#5e7c96'];
export default function ResearchGraph({ units, onSelect, selectedId }) {
  const [flow, setFlow] = useState(null);
  const root = useRef(null);
  useEffect(() => {
    if (!root.current || !flow) return;
    let timer;
    const observer = new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(() => flow.fitView({ padding: 0.25, maxZoom: 1 }), 100); });
    observer.observe(root.current);
    return () => { observer.disconnect(); clearTimeout(timer); };
  }, [flow]);
  const { nodes, edges } = useMemo(() => {
    const graph = new dagre.graphlib.Graph().setGraph({ rankdir: 'LR', nodesep: 35, ranksep: 100 }).setDefaultEdgeLabel(() => ({}));
    const names = new Map();
    const getNode = (name, type) => {
      const key = `${type || ''}:${name}`;
      if (!names.has(key)) {
        const id = `node-${names.size}`;
        names.set(key, { id, data: { label: <><small>{type || '案例概念'}</small><strong>{name}</strong></> }, position: { x: 0, y: 0 }, style: { borderTop: `3px solid ${colors[names.size % colors.length]}` }, sourcePosition: 'right', targetPosition: 'left' });
        graph.setNode(id, { width: 156, height: 62 });
      }
      return names.get(key).id;
    };
    const edgeMap = new Map();
    units.filter(u => u.status !== 'rejected').forEach(u => {
      const source = getNode(u.subject, u.subjectType), target = getNode(u.object, u.objectType);
      const key = `${source}:${u.predicate}:${target}:${u.time || ''}`;
      if (edgeMap.has(key)) { edgeMap.get(key).data.units.push(u); return; }
      graph.setEdge(source, target);
      edgeMap.set(key, { id: u.id, source, target, label: u.predicate, data: { units: [u] }, markerEnd: { type: MarkerType.ArrowClosed, color: '#8295a6' }, style: { stroke: selectedId === u.id ? '#226ca5' : '#8295a6', strokeWidth: selectedId === u.id ? 2.5 : 1.4, strokeDasharray: u.status === 'confirmed' ? undefined : '5 3' }, labelStyle: { fill: '#41586c', fontSize: 11 }, labelBgStyle: { fill: '#fff', fillOpacity: 0.92 } });
    });
    dagre.layout(graph);
    return { nodes: [...names.values()].map(n => ({ ...n, position: { x: graph.node(n.id).x - 78, y: graph.node(n.id).y - 31 } })), edges: [...edgeMap.values()] };
  }, [units, selectedId]);
  useEffect(() => { const timer = setTimeout(() => flow?.fitView({ padding: 0.25, maxZoom: 1 }), 100); return () => clearTimeout(timer); }, [flow, units]);
  if (!nodes.length) return <div className="crw-graph-empty"><strong>这里将显示当前案例的关系图</strong><p>在左侧上传材料并说明研究要求。生成后，点击总结稿片段可查看对应关系子图。</p></div>;
  return <div ref={root} style={{ width: '100%', height: '100%' }}><ReactFlow nodes={nodes} edges={edges} onInit={setFlow} onEdgeClick={(_, edge) => onSelect(edge.data.units)} onNodeClick={(_, node) => onSelect(edges.filter(e => e.source === node.id || e.target === node.id).flatMap(e => e.data.units))} nodesDraggable={false} nodesConnectable={false} fitView minZoom={0.1} maxZoom={2} attributionPosition="bottom-right"><Background color="#dbe3e9" gap={22} size={1} /><Controls showInteractive={false} /></ReactFlow></div>;
}
