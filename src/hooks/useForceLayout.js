import { useEffect, useRef, useCallback } from 'react';

/**
 * 简易力导向布局引擎
 * 节点间斥力 + 连线引力 + 中心引力
 * 运行若干轮后停止，位置固定
 */
export function useForceLayout(nodes, edges, config = {}) {
  const {
    repulsion = 8000,
    attraction = 0.005,
    centerGravity = 0.01,
    damping = 0.85,
    iterations = 200,
    maxMove = 50,
  } = config;

  const runningRef = useRef(false);

  const runSimulation = useCallback((positions) => {
    const pos = {};
    const vel = {};

    // 初始化
    for (const n of nodes) {
      pos[n.id] = { ...(positions[n.id] || n.position) };
      vel[n.id] = { x: 0, y: 0 };
    }

    const edgeSet = new Set();
    for (const e of edges) {
      edgeSet.add(`${e.source}-${e.target}`);
    }

    for (let iter = 0; iter < iterations; iter++) {
      const forces = {};
      for (const n of nodes) {
        forces[n.id] = { x: 0, y: 0 };
      }

      // 斥力（所有节点对）
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = pos[nodes[i].id];
          const b = pos[nodes[j].id];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 1;
          let force = repulsion / (dist * dist);
          let fx = (dx / dist) * force;
          let fy = (dy / dist) * force;
          forces[nodes[i].id].x += fx;
          forces[nodes[i].id].y += fy;
          forces[nodes[j].id].x -= fx;
          forces[nodes[j].id].y -= fy;
        }
      }

      // 连线引力
      for (const e of edges) {
        const a = pos[e.source];
        const b = pos[e.target];
        if (!a || !b) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        let force = dist * attraction;
        let fx = (dx / dist) * force;
        let fy = (dy / dist) * force;
        forces[e.source].x += fx;
        forces[e.source].y += fy;
        forces[e.target].x -= fx;
        forces[e.target].y -= fy;
      }

      // 中心引力 + 更新位置
      for (const n of nodes) {
        forces[n.id].x -= pos[n.id].x * centerGravity;
        forces[n.id].y -= pos[n.id].y * centerGravity;

        vel[n.id].x = (vel[n.id].x + forces[n.id].x) * damping;
        vel[n.id].y = (vel[n.id].y + forces[n.id].y) * damping;

        pos[n.id].x += Math.max(-maxMove, Math.min(maxMove, vel[n.id].x));
        pos[n.id].y += Math.max(-maxMove, Math.min(maxMove, vel[n.id].y));
      }
    }

    // 取整
    const result = {};
    for (const n of nodes) {
      result[n.id] = {
        x: Math.round(pos[n.id].x),
        y: Math.round(pos[n.id].y),
      };
    }
    return result;
  }, [nodes, edges, repulsion, attraction, centerGravity, damping, iterations, maxMove]);

  return { runSimulation };
}
