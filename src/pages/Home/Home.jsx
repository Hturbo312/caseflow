import { useEffect, useMemo } from 'react';
import { nodes as allNodes } from '@/data/content';
import { useCanvasStore } from '@store/canvasStore';
import { useForceLayout } from '@hooks/useForceLayout';
import { useMobileDetect } from '@hooks/useMobileDetect';
import GraphBackground from '@components/GraphBackground';
import CanvasViewport from '@components/CanvasViewport';
import GraphNode from '@components/GraphNode';
import GraphEdges from '@components/GraphEdges';
import NodeDetail from '@components/NodeDetail';
import NavPanel from '@components/NavPanel';
import MobileLayout from '@components/MobileLayout';
import './Home.css';

function Home() {
  const isMobile = useMobileDetect();
  const { setNodePositions, setIsMobile } = useCanvasStore();
  const edges = useMemo(() => getAllEdges(), []);
  const { runSimulation } = useForceLayout(allNodes, edges);

  // 同步移动端状态到 store
  useEffect(() => {
    setIsMobile(isMobile);
  }, [isMobile, setIsMobile]);

  // 初始力导向布局（仅运行一次）
  useEffect(() => {
    if (isMobile) return;
    const initialPositions = {};
    for (const n of allNodes) {
      initialPositions[n.id] = { ...n.position };
    }
    const finalPositions = runSimulation(initialPositions);
    setNodePositions(finalPositions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isMobile) {
    return <MobileLayout />;
  }

  return (
    <div className="home-canvas">
      <GraphBackground />
      <CanvasViewport>
        <GraphEdges />
        {allNodes.map((node) => (
          <GraphNode key={node.id} node={node} />
        ))}
      </CanvasViewport>
      <NavPanel />
      <NodeDetail />

      {/* 缩放提示 */}
      <ZoomHint />
    </div>
  );
}

function getAllEdges() {
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
}

function ZoomHint() {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 20,
        fontSize: 11,
        color: '#bbb',
        zIndex: 50,
        pointerEvents: 'none',
      }}
    >
      scroll to zoom · drag to pan · click to explore
    </div>
  );
}

export default Home;
