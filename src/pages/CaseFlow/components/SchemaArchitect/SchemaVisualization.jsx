import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  ConnectionMode,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { nodeTypes } from './EntityNode';

/**
 * dagre 层级布局：按关系结构分层排布（左→右），自动减少交叉。
 * 参数与案例研究关系图（ResearchGraph）一致：层间距 100、同层间距 35、节点 156x62。
 */
function dagreLayout(entityTypes, relations) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 35, ranksep: 100, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));
  entityTypes.forEach((et) => g.setNode(String(et.id), { width: 156, height: 62 }));
  relations.forEach((rel) => {
    const f = entityTypes.find((e) => e.name === rel.from);
    const t = entityTypes.find((e) => e.name === rel.to);
    if (f && t) g.setEdge(String(f.id), String(t.id));
  });
  dagre.layout(g);
  return g;
}

/**
 * 关系连线（自定义边）：标签常显（与案例研究关系图一致），标签旁附删除按钮。
 * 删除按钮经 data.onDelete 注入——FrameworkGuide 传入 onEdgeDelete 时才显示，SchemaArchitect 用法不受影响。
 */
function RelationEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, markerEnd }) {
  const [path, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 12 });
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? '#226ca5' : (data?.color || '#8295a6'),
          strokeWidth: selected ? 2.5 : 1.4,
          strokeDasharray: data?.dasharray,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="fw-edge-label"
          style={{ transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)` }}
          onClick={(e) => e.stopPropagation()}
        >
          <span>{data?.label}</span>
          {data?.onDelete && (
            <button className="fw-edge-del" title="删除关系" onClick={data.onDelete}>×</button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
const edgeTypes = { relation: RelationEdge };

const SchemaVisualization = ({ schema, onNodeClick, onEdgeClick, onConnect, onEdgeDelete, onNodeDelete, tidySignal, layoutPlan }) => {
  const { entityTypes, relations } = schema;

  // 删除回调经 ref 转发进节点/边 data，避免回调身份变化导致布局反复重算
  const nodeDeleteRef = useRef(onNodeDelete);
  useEffect(() => { nodeDeleteRef.current = onNodeDelete; }, [onNodeDelete]);
  const edgeDeleteRef = useRef(onEdgeDelete);
  useEffect(() => { edgeDeleteRef.current = onEdgeDelete; }, [onEdgeDelete]);

  const initialNodes = useMemo(() => {
    if (entityTypes.length === 0) return [];

    const rawNodes = entityTypes.map((entity, index) => ({
      id: entity.id?.toString() || `entity-${index}`,
      type: 'entity',
      connectable: true,
      position: { x: 0, y: 0 },
      data: {
        label: entity.name,
        color: entity.color || '#3b82f6',
        propertyCount: entity.properties?.length || 0,
        ...(onNodeDelete ? {
          onDelete: (e) => { e.stopPropagation(); e.preventDefault(); nodeDeleteRef.current(entity.id); },
        } : {}),
      },
    }));

    // 每次进入都按 dagre 自动排布（与案例研究关系图一致）；会话内可拖动微调，坐标不持久化
    const g = dagreLayout(entityTypes, relations);
    const positioned = rawNodes.map(n => {
      const pos = g.node(n.id);
      return { ...n, position: { x: pos.x - 78, y: pos.y - 31 } };
    });

    // 归一化：统一缩放/居中到约 760x480，保证 fitView 后节点可读
    const xs = positioned.map(n => n.position.x);
    const ys = positioned.map(n => n.position.y);
    const w = Math.max(Math.max(...xs) - Math.min(...xs), 1);
    const h = Math.max(Math.max(...ys) - Math.min(...ys), 1);
    const scale = Math.min(900 / w, 560 / h, 1.2);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    return positioned.map(n => ({
      ...n,
      position: { x: 400 + (n.position.x - cx) * scale, y: 300 + (n.position.y - cy) * scale }
    }));
  }, [entityTypes, relations, onNodeDelete]);

  const initialEdges = useMemo(() => {
    if (relations.length === 0) return [];

    return relations.map((rel) => {
      const fromEntity = entityTypes.find(e => e.name === rel.from);
      const toEntity = entityTypes.find(e => e.name === rel.to);
      if (!fromEntity || !toEntity) return null;

      const id = rel.id?.toString() || `rel-${rel.name}-${rel.from}-${rel.to}`;
      return {
        id,
        source: fromEntity.id?.toString(),
        target: toEntity.id?.toString(),
        type: 'relation',
        data: {
          label: rel.name,
          color: rel.color || '#8295a6',
          dasharray: rel.style === 'dashed' ? '5,5' : rel.style === 'dotted' ? '2,2' : undefined,
          ...(onEdgeDelete ? {
            onDelete: (e) => { e.stopPropagation(); e.preventDefault(); edgeDeleteRef.current([id]); },
          } : {}),
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: rel.color || '#8295a6',
        },
      };
    }).filter(Boolean);
  }, [relations, entityTypes, onEdgeDelete]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const relationsSignature = useMemo(
    () => JSON.stringify(relations.map(r => [r.id, r.name, r.from, r.to])),
    [relations]
  );
  useEffect(() => {
    setEdges(initialEdges);
    // 关系新增/删除/改名后重建连线（保留节点手动位置，节点布局不受影响）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationsSignature]);
  // AI 排版方案：按行分组定位（LR=行从左往右流动；TB=从上往下），行内按相邻行邻居重心排序就近连接
  useEffect(() => {
    if (!layoutPlan || !Array.isArray(layoutPlan.rows) || entityTypes.length === 0) return;
    // 名称归一化匹配：取「（」前的主体、忽略大小写与空白差异，容忍 AI 输出的名称细微出入
    const norm = (n) => String(n).split('（')[0].trim().toLowerCase().replace(/\s+/g, ' ');
    const nameToId = new Map(entityTypes.map(e => [norm(String(e.name)), String(e.id)]));
    const rows = layoutPlan.rows
      .map(r => ({ title: r.title || '', items: (Array.isArray(r.items) ? r.items : []).filter(n => nameToId.has(norm(n))) }))
      .filter(r => r.items.length);
    if (!rows.length) return;
    const rowOf = new Map();
    rows.forEach((row, ri) => row.items.forEach(name => { const id = nameToId.get(norm(name)); if (id) rowOf.set(id, ri); }));
    const orderRows = [];
    rows.forEach((row, ri) => {
      if (ri === 0 || !(orderRows[ri - 1] || []).length) { orderRows.push([...row.items]); return; }
      const prevPos = new Map();
      (orderRows[ri - 1] || []).forEach((name, idx) => prevPos.set(name, idx));
      const bary = (name) => {
        const vals = relations
          .filter(r => (r.from === name && prevPos.has(r.to)) || (r.to === name && prevPos.has(r.from)))
          .map(r => prevPos.get(r.from === name ? r.to : r.from));
        return vals.length ? vals.reduce((acc, v) => acc + v, 0) / vals.length : Number.MAX_SAFE_INTEGER;
      };
      orderRows.push([...row.items].sort((a, b) => bary(a) - bary(b)));
    });
    const isLR = layoutPlan.orientation !== 'TB';
    const COL = 240, ROWH = 92, NODEW = 190, ROWV = 150;
    const updates = {};
    orderRows.forEach((items, ri) => {
      items.forEach((name, idx) => {
        const id = nameToId.get(norm(name));
        if (isLR) {
          updates[id] = { x: 60 + ri * COL, y: 300 - (items.length * ROWH) / 2 + idx * ROWH + 16 };
        } else {
          updates[id] = { x: 450 - (items.length * NODEW) / 2 + idx * NODEW, y: 60 + ri * ROWV };
        }
      });
    });
    setNodes(nds => nds.map(n => (updates[n.id] ? { ...n, position: updates[n.id] } : n)));
  }, [layoutPlan, entityTypes, relations, setNodes]);

  const appliedTidy = useRef(0);
  useEffect(() => {
    if (!tidySignal || tidySignal === appliedTidy.current || entityTypes.length === 0) return;
    appliedTidy.current = tidySignal;
    const g = dagreLayout(entityTypes, relations);
    setNodes((nds) => nds.map((n) => {
      const pos = g.node(n.id);
      return pos ? { ...n, position: { x: pos.x - 78, y: pos.y - 31 } } : n;
    }));
  }, [tidySignal, entityTypes, relations, setNodes]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const handleNodesChange = useCallback((changes) => {
    // 实体不能在画布上删除（防误删，删除走节点悬停 × 或下方面板）；位置/尺寸变化照常应用
    onNodesChange(changes.filter(c => c.type !== 'remove'));
  }, [onNodesChange]);
  const handleEdgesChange = useCallback((changes) => {
    const removes = changes.filter(c => c.type === 'remove');
    onEdgesChange(changes.filter(c => c.type !== 'remove'));
    if (removes.length && onEdgeDelete) onEdgeDelete(removes.map(c => c.id));
  }, [onEdgesChange, onEdgeDelete]);

  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current && initialNodes.length > 0) {
      setNodes(initialNodes);
      setEdges(initialEdges);
      initializedRef.current = true;
    }
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  useEffect(() => {
    initializedRef.current = false;
  }, [entityTypes.length, relations.length]);

  if (entityTypes.length === 0) {
    return null;
  }

  return (
    <div style={{ width: '100%', maxWidth: '100%', height: '100%', minHeight: '500px', position: 'relative', overflow: 'hidden' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        nodesConnectable
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={(connection) => {
          const from = entityTypes.find(e => String(e.id) === String(connection.source));
          const to = entityTypes.find(e => String(e.id) === String(connection.target));
          if (from && to && onConnect) onConnect({ sourceName: from.name, targetName: to.name });
        }}
        onNodeClick={(event, node) => onNodeClick?.(node)}
        onEdgeClick={(event, edge) => onEdgeClick?.(edge)}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.5 }}
        minZoom={0.3}
        maxZoom={2}
        attributionPosition="bottom-left"
      >
        <Background color="#e5e7eb" gap={16} />
        <Controls position="bottom-right" />
        <MiniMap
          nodeColor={(node) => node.data?.color || '#3b82f6'}
          maskColor="rgba(0,0,0,0.05)"
          style={{ background: '#f9fafb' }}
        />
      </ReactFlow>
    </div>
  );
};

export default SchemaVisualization;
