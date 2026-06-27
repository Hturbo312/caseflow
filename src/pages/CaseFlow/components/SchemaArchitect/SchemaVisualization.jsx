import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useSchemaStore } from '../../../../store';
import { useToastStore } from '@components/Toast/ToastStore';
import { useI18n } from '../../../../i18n';
import { nodeTypes } from './EntityNode';

/**
 * 力导向布局计算（一次性计算，非实时模拟）
 */
const NODE_W = 165;
const NODE_H = 80;
const MIN_GAP = 30;

function computeLayout(nodes, edges, iterations = 200) {
  const nodeMap = new Map();
  for (const n of nodes) {
    nodeMap.set(n.id, { ...n, vx: 0, vy: 0 });
  }
  const edgeList = edges.filter(e => nodeMap.has(e.source) && nodeMap.has(e.target));

  const nodeIds = [...nodeMap.keys()];
  const k = Math.sqrt((500 * 400) / nodeIds.length);

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 1 - iter / iterations;
    const cooling = alpha * alpha;

    // 斥力
    for (let i = 0; i < nodeIds.length; i++) {
      const a = nodeMap.get(nodeIds[i]);
      a.vx = 0;
      a.vy = 0;
      for (let j = i + 1; j < nodeIds.length; j++) {
        const b = nodeMap.get(nodeIds[j]);
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        let force = (k * k) / dist * 0.3;
        let minDist = NODE_W * 0.7 + MIN_GAP;
        if (dist < minDist) {
          force += (minDist - dist) * 0.4;
        }
        a.vx += (dx / dist) * force;
        a.vy += (dy / dist) * force;
        b.vx -= (dx / dist) * force;
        b.vy -= (dy / dist) * force;
      }
    }

    // 引力
    for (const e of edgeList) {
      const a = nodeMap.get(e.source);
      const b = nodeMap.get(e.target);
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 1;
      let force = (dist - k) * 0.06;
      a.vx += (dx / dist) * force;
      a.vy += (dy / dist) * force;
      b.vx -= (dx / dist) * force;
      b.vy -= (dy / dist) * force;
    }

    // 中心引力
    const cx = 400, cy = 300;
    for (const n of nodeMap.values()) {
      n.vx += (cx - n.x) * 0.01;
      n.vy += (cy - n.y) * 0.01;
    }

    // 应用位移
    for (const n of nodeMap.values()) {
      n.x += n.vx * cooling * 5;
      n.y += n.vy * cooling * 5;
    }
  }

  // 归一化
  let minX = Infinity, minY = Infinity;
  for (const n of nodeMap.values()) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
  }
  const offsetX = 50 - minX;
  const offsetY = 50 - minY;
  for (const n of nodeMap.values()) {
    n.x += offsetX;
    n.y += offsetY;
  }

  return nodeMap;
}

/**
 * SchemaVisualization — Schema 结构可视化（ReactFlow 力导向图）
 */
const SchemaVisualization = ({ schema }) => {
  const { entityTypes, relations } = schema;
  const { t } = useI18n();
  const { updateSchema } = useSchemaStore();
  const { success: showSuccess } = useToastStore();
  const [saving, setSaving] = useState(false);

  const initialNodes = useMemo(() => {
    if (entityTypes.length === 0) return [];

    const savedLayout = schema?.layout?.nodes || {};
    const hasSavedLayout = Object.keys(savedLayout).length > 0;

    const centerX = 400;
    const centerY = 300;
    const baseRadius = Math.max(120, entityTypes.length * 18);

    const rawNodes = entityTypes.map((entity, index) => {
      const angle = (2 * Math.PI * index) / entityTypes.length - Math.PI / 2;
      return {
        id: entity.id?.toString() || `entity-${index}`,
        type: 'entity',
        x: centerX + baseRadius * Math.cos(angle),
        y: centerY + baseRadius * Math.sin(angle),
        data: {
          label: entity.name,
          color: entity.color || '#3b82f6',
          propertyCount: entity.properties?.length || 0
        }
      };
    });

    if (hasSavedLayout) {
      return rawNodes.map(n => {
        const saved = savedLayout[n.id];
        return saved
          ? { ...n, position: { x: saved.x, y: saved.y } }
          : n;
      });
    }

    const rawEdges = relations
      .filter(rel => {
        const fromEntity = entityTypes.find(e => e.name === rel.from);
        const toEntity = entityTypes.find(e => e.name === rel.to);
        return fromEntity && toEntity;
      })
      .map(rel => ({
        source: entityTypes.find(e => e.name === rel.from).id?.toString(),
        target: entityTypes.find(e => e.name === rel.to).id?.toString()
      }));

    const layoutMap = computeLayout(rawNodes, rawEdges);

    return rawNodes.map(n => ({
      ...n,
      position: { x: layoutMap.get(n.id).x, y: layoutMap.get(n.id).y }
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
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

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
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
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
