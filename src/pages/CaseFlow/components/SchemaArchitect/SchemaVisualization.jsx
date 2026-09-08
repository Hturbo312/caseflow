import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  ConnectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { useSchemaStore } from '../../../../store';
import { useToastStore } from '@components/Toast/ToastStore';
import { useI18n } from '../../../../i18n';
import { nodeTypes } from './EntityNode';

/**
 * dagre 层级布局：按关系结构分层排布（左→右），自动减少交叉
 */
function dagreLayout(entityTypes, relations) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 55, ranksep: 130, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));
  entityTypes.forEach((et) => g.setNode(String(et.id), { width: 180, height: 68 }));
  relations.forEach((rel) => {
    const f = entityTypes.find((e) => e.name === rel.from);
    const t = entityTypes.find((e) => e.name === rel.to);
    if (f && t) g.setEdge(String(f.id), String(t.id));
  });
  dagre.layout(g);
  return g;
}

/**
 * SchemaVisualization — Schema 结构可视化（ReactFlow 力导向图）
 */
const SchemaVisualization = ({ schema, onNodeClick, onEdgeClick, onConnect, onEdgeDelete, tidySignal, layoutPlan }) => {
  const { entityTypes, relations } = schema;
  const { t } = useI18n();
  const { updateSchema } = useSchemaStore();
  const { success: showSuccess } = useToastStore();
  const [saving, setSaving] = useState(false);

  const initialNodes = useMemo(() => {
    if (entityTypes.length === 0) return [];

    const savedLayout = schema?.layout?.nodes || {};

    const rawNodes = entityTypes.map((entity, index) => {
      const angle = (2 * Math.PI * index) / entityTypes.length - Math.PI / 2;
      const radius = Math.max(120, entityTypes.length * 18);
      return {
        id: entity.id?.toString() || `entity-${index}`,
        type: 'entity',
        connectable: true,
        x: 400 + radius * Math.cos(angle),
        y: 300 + radius * Math.sin(angle),
        data: {
          label: entity.name,
          color: entity.color || '#3b82f6',
          propertyCount: entity.properties?.length || 0
        }
      };
    });

    let positioned;
    if (Object.keys(savedLayout).length > 0) {
      positioned = rawNodes.map(n => {
        const saved = savedLayout[n.id];
        return saved ? { ...n, position: { x: saved.x, y: saved.y } } : n;
      });
    } else {
      const g = dagreLayout(entityTypes, relations);
      positioned = rawNodes.map(n => {
        const pos = g.node(n.id);
        return { ...n, position: { x: pos.x - 85, y: pos.y - 31 } };
      });
    }

    // 归一化：无论保存布局多散，统一缩放/居中到约 760x480，保证 fitView 后节点可读
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
  }, [entityTypes, relations, schema?.layout]);

  const initialEdges = useMemo(() => {
    if (relations.length === 0) return [];

    return relations.map((rel) => {
      const fromEntity = entityTypes.find(e => e.name === rel.from);
      const toEntity = entityTypes.find(e => e.name === rel.to);
      if (!fromEntity || !toEntity) return null;

      return {
        id: rel.id?.toString() || `rel-${rel.name}-${rel.from}-${rel.to}`,
        source: fromEntity.id?.toString(),
        target: toEntity.id?.toString(),
        label: rel.name,
        labelStyle: { fill: '#6b7280', fontWeight: 500, fontSize: 11 },
        labelBgStyle: { fill: 'white', fillOpacity: 0.9 },
        labelBgPadding: [4, 4],
        labelBgBorderRadius: 4,
        style: {
          stroke: rel.color || '#9ca3af',
          strokeWidth: 2,
          strokeDasharray: rel.style === 'dashed' ? '5,5' : rel.style === 'dotted' ? '2,2' : undefined,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: rel.color || '#9ca3af',
        },
        animated: false
      };
    }).filter(Boolean);
  }, [relations, entityTypes]);

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
      return pos ? { ...n, position: { x: pos.x - 85, y: pos.y - 31 } } : n;
    }));
  }, [tidySignal, entityTypes, relations, setNodes]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const handleNodesChange = useCallback((changes) => {
    // 实体不能在画布上删除（防误删）；位置/尺寸变化照常应用
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

  const handleSaveLayout = useCallback(async () => {
    setSaving(true);
    try {
      const layout = { nodes: {} };
      nodes.forEach(n => {
        layout.nodes[n.id] = { x: n.position.x, y: n.position.y };
      });
      await updateSchema(schema.id, { layout });
      showSuccess(t('schema.layoutSaved'));
    } catch (e) {
      console.error('保存布局失败:', e);
    }
    setSaving(false);
  }, [nodes, schema?.id, updateSchema, showSuccess, t]);

  useEffect(() => {
    initializedRef.current = false;
  }, [entityTypes.length, relations.length]);

  if (entityTypes.length === 0) {
    return null;
  }

  return (
    <div style={{ width: '100%', maxWidth: '100%', height: '100%', minHeight: '500px', position: 'relative', overflow: 'hidden' }}>
      <button
        onClick={handleSaveLayout}
        disabled={saving}
        style={{
          position: 'absolute',
          top: 12,
          right: 60,
          zIndex: 10,
          padding: '6px 14px',
          borderRadius: 8,
          border: '1px solid #d1d5db',
          background: saving ? '#e5e7eb' : 'white',
          color: saving ? '#9ca3af' : '#374151',
          fontSize: 12,
          fontWeight: 500,
          cursor: saving ? 'not-allowed' : 'pointer',
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {saving ? (
          <>
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
            </svg>
            {t('schema.saving') || '保存中...'}
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <polyline points="17,21 17,13 7,13 7,21" />
              <polyline points="7,3 7,8 15,8" />
            </svg>
            {t('schema.saveLayout') || '保存布局'}
          </>
        )}
      </button>

      <ReactFlow
        nodes={nodes}
        edges={edges}
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
