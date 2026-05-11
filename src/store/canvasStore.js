import { create } from 'zustand';

export const useCanvasStore = create((set) => ({
  // 视口状态
  viewport: { x: 0, y: 0, zoom: 1 },
  // 当前展开的节点
  activeNode: null,
  // 节点位置（运行时更新）
  nodePositions: {},
  // 是否移动端
  isMobile: false,

  setViewport: (viewport) => set((state) => ({ viewport: { ...state.viewport, ...viewport } })),
  setActiveNode: (id) => set({ activeNode: id }),
  setNodePosition: (id, pos) => set((state) => ({
    nodePositions: { ...state.nodePositions, [id]: pos },
  })),
  setNodePositions: (positions) => set({ nodePositions: positions }),
  setIsMobile: (isMobile) => set({ isMobile }),
}));
