import { useMemo } from 'react';
import { useCanvasStore } from '@store/canvasStore';
import { nodes as allNodes } from '@/data/content';

/**
 * SVG 连线 — 白底黑线风格
 */
function GraphEdges() {
  const { nodePositions, activeNode } = useCanvasStore();

  // 构建边列表
  const edges = useMemo(() => {
    const edgeSet = new Set();
    const result = [];
    for (const node of allNodes) {
      for (const connId of (node.connections || [])) {
        const key = [node.id, connId].sort().join('-');
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          result.push({ source: node.id, target: connId });
        }
      }
    }
    return result;
  }, []);

  const getPos = (id) => {
    return nodePositions[id] || allNodes.find((n) => n.id === id)?.position || { x: 0, y: 0 };
  };

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 1,
        height: 1,
        overflow: 'visible',
        pointerEvents: 'none',
        zIndex: -1,
      }}
    >
      {edges.map((edge) => {
        const s = getPos(edge.source);
        const t = getPos(edge.target);
        const isRelated = activeNode && (edge.source === activeNode || edge.target === activeNode);
        const mx = (s.x + t.x) / 2;
        const my = (s.y + t.y) / 2;
        // 稍微弯曲
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const cx = mx - dy * 0.1;
        const cy = my + dx * 0.1;

        return (
          <path
            key={`${edge.source}-${edge.target}`}
            d={`M ${s.x} ${s.y} Q ${cx} ${cy} ${t.x} ${t.y}`}
            fill="none"
            stroke={isRelated ? '#111' : '#d0d0d0'}
            strokeWidth={isRelated ? 1.5 : 0.8}
            style={{ transition: 'stroke 0.3s, stroke-width 0.3s' }}
          />
        );
      })}
    </svg>
  );
}

export default GraphEdges;
