import { create } from 'zustand';
import { schemaApi, caseApi, authApi, agentApi, chatApi, extractionApi } from '../services/api';
import { authHelper, API_BASE_URL } from '../utils';

import { useCaseStore } from './caseStore';
import { useSchemaStore } from './schemaStore';
// ============ Graph Store ============
export const useGraphStore = create((set, get) => ({
  // 图谱数据
  nodes: [],
  links: [],
  allNodes: [],  // 全量节点缓存
  allLinks: [],  // 全量链接缓存

  // 视图状态
  focusMode: 'full',    // 'full' 全量 | 'case' 案例聚焦 | 'node' 节点聚焦
  focusDepth: 1,        // 聚焦深度 1 或 2
  focusCaseId: null,    // 聚焦的案例 ID
  focusNodeId: null,    // 聚焦的节点 ID

  // 交互状态
  highlightedNodes: [],
  selectedNode: null,
  selectedLink: null,
  filter: { entityTypes: [], minRelationStrength: 0 },

  setGraphData: (nodes, links) => set({ nodes, links }),
  setHighlightedNodes: (nodeIds) => set({ highlightedNodes: nodeIds }),
  setSelectedNode: (node) => set({ selectedNode: node }),
  setSelectedLink: (link) => set({ selectedLink: link }),
  setFilter: (filter) => set((state) => ({ filter: { ...state.filter, ...filter } })),

  // 设置聚焦模式
  setFocusMode: (mode) => {
    set({ focusMode: mode, focusCaseId: mode === 'full' ? null : get().focusCaseId, focusNodeId: mode === 'full' ? null : get().focusNodeId });
    get().applyViewFilter();
  },

  // 设置聚焦深度
  setFocusDepth: (depth) => {
    set({ focusDepth: depth });
    if (get().focusMode === 'case') {
      get().applyViewFilter();
    }
  },

  // 设置聚焦案例
  setFocusCase: (caseId) => {
    set({ focusCaseId: caseId, focusNodeId: null, focusMode: caseId ? 'case' : 'full' });
    get().applyViewFilter();
  },

  // 设置聚焦节点
  setFocusNode: (node) => {
    set({ focusNodeId: node?.id || null, focusCaseId: null, focusMode: node ? 'node' : 'full' });
    get().applyViewFilter();
  },

  // 加载单个案例到图谱
  loadCaseToGraph: (caseData) => {
    const nodes = (caseData.entities || []).map((e, i) => ({
      id: e.id,
      name: e.name,
      type: e.entityType,
      properties: e.properties,
      caseId: caseData.id,
      caseName: caseData.name,
      x: 150 + (i % 5) * 120,
      y: 100 + Math.floor(i / 5) * 100
    }));
    const links = (caseData.relations || []).map(r => ({
      id: r.id,
      source: r.sourceId,
      target: r.targetId,
      name: r.name,
      caseId: caseData.id
    }));
    set({ nodes, links, allNodes: nodes, allLinks: links });
  },

  // 加载所有案例到图谱（schema-driven 全量模式）
  loadAllCasesToGraph: () => {
    const currentSchemaId = useSchemaStore.getState().currentSchemaId;
    const allCases = useCaseStore.getState().cases;

    // 守卫：数据未就绪时跳过，防止清空图谱
    if (!currentSchemaId || !allCases || allCases.length === 0) return;

    // 过滤当前 schema 下的所有案例（兼容字符串/数字类型，排除 schemaId 为 null 的孤儿案例）
    const schemaCases = allCases.filter(c => {
      if (c.schemaId == null) return false; // FK SET NULL 产生的孤儿案例，跳过
      const cId = String(c.schemaId);
      const sId = String(currentSchemaId);
      return cId === sId;
    });

    const allNodes = [];
    const allLinks = [];

    schemaCases.forEach(caseData => {
      const nodes = (caseData.entities || []).map(e => ({
        id: e.id,
        name: e.name,
        type: e.entityType,
        properties: e.properties,
        caseId: caseData.id,
        caseName: caseData.name,
        // 添加随机初始坐标以避免 force-graph 初始化问题
        x: Math.random() * 400 + 100,
        y: Math.random() * 300 + 100
      }));
      const links = (caseData.relations || []).map(r => ({
        id: r.id,
        source: r.sourceId,
        target: r.targetId,
        name: r.name,
        caseId: caseData.id
      }));
      allNodes.push(...nodes);
      allLinks.push(...links);
    });

    set({ allNodes, allLinks, nodes: allNodes, links: allLinks, focusMode: 'full', focusCaseId: null, focusNodeId: null });
  },

  // 应用视图过滤器（统一处理 full / case / node 三种模式）
  applyViewFilter: () => {
    const { allNodes, allLinks, focusMode, focusCaseId, focusDepth, focusNodeId } = get();

    // 全量模式：显示所有节点，赋予随机初始位置，links 规范化防止 d3 对象引用污染
    if (focusMode === 'full' || !focusCaseId) {
      const resetNodes = allNodes.map(n => ({ ...n, x: Math.random() * 400 + 200, y: Math.random() * 300 + 150 }));
      const normalizedLinks = allLinks.map(l => ({
        ...l,
        source: typeof l.source === 'object' ? String(l.source.id) : String(l.source),
        target: typeof l.target === 'object' ? String(l.target.id) : String(l.target),
      }));
      set({ nodes: resetNodes, links: normalizedLinks });
      return;
    }

    // 构建邻接表
    const adjacencyList = {};
    allLinks.forEach(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      if (!adjacencyList[sourceId]) adjacencyList[sourceId] = [];
      if (!adjacencyList[targetId]) adjacencyList[targetId] = [];
      adjacencyList[sourceId].push(targetId);
      adjacencyList[targetId].push(sourceId);
    });

    // 确定种子节点
    let seedIds;
    if (focusMode === 'case') {
      const focusCase = useCaseStore.getState().cases.find(c => c.id === focusCaseId);
      if (!focusCase) {
        const resetNodes = allNodes.map(n => ({ ...n, x: Math.random() * 400 + 200, y: Math.random() * 300 + 150 }));
        const normalizedLinks = allLinks.map(l => ({
          ...l,
          source: typeof l.source === 'object' ? String(l.source.id) : String(l.source),
          target: typeof l.target === 'object' ? String(l.target.id) : String(l.target),
        }));
        set({ nodes: resetNodes, links: normalizedLinks });
        return;
      }
      seedIds = new Set(focusCase.entities?.map(e => e.id) || []);
    } else {
      // node 模式
      seedIds = new Set([focusNodeId]);
    }

    // BFS 扩展邻居节点
    const visibleNodeIds = new Set(seedIds);
    let frontier = [...seedIds];

    for (let d = 0; d < focusDepth; d++) {
      const nextFrontier = [];
      frontier.forEach(nodeId => {
        const neighbors = adjacencyList[nodeId] || [];
        neighbors.forEach(neighborId => {
          if (!visibleNodeIds.has(neighborId)) {
            visibleNodeIds.add(neighborId);
            nextFrontier.push(neighborId);
          }
        });
      });
      frontier = nextFrontier;
    }

    // 过滤节点和链接，赋予圆形初始位置
    const filteredArr = allNodes.filter(n => visibleNodeIds.has(n.id));
    const cx = 400, cy = 300, r = Math.min(200, visibleNodeIds.size * 15);
    const filteredNodes = filteredArr.map((n, i) => {
      const angle = (2 * Math.PI * i) / (filteredArr.length || 1);
      return { ...n, x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
    });
    const filteredLinks = allLinks.filter(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
    }).map(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      return { ...link, source: String(sourceId), target: String(targetId) };
    });


    set({ nodes: filteredNodes, links: filteredLinks });
  },

  syncCurrentCaseToGraph: () => {
    const currentCase = useCaseStore.getState().getCurrentCase();
    if (currentCase) {
      get().setFocusCase(currentCase.id);
    }
  },

  initializeGraph: () => {
    // 初始化时加载当前 schema 下所有案例
    get().loadAllCasesToGraph();
  },

  addNodeToGraph: (entity) => set((state) => {
    // 防止重复添加：如果节点已存在则跳过
    if (state.allNodes.some(n => n.id === entity.id)) return {};
    const nodeData = { id: entity.id, name: entity.name, type: entity.type || entity.entityType, properties: entity.properties, x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 };
    return ({
    allNodes: [...state.allNodes, nodeData],
    nodes: [...state.nodes, nodeData]
  })}),
  addLinkToGraph: (relation) => set((state) => {
    // 防止重复添加：如果链接已存在则跳过
    if (state.allLinks.some(l => l.id === relation.id)) return {};
    return ({
    allLinks: [...state.allLinks, { id: relation.id, source: relation.source || relation.sourceId, target: relation.target || relation.targetId, name: relation.name }],
    links: [...state.links, { id: relation.id, source: relation.source || relation.sourceId, target: relation.target || relation.targetId, name: relation.name }]
  })}),
  removeNodeFromGraph: (nodeId) => set((state) => ({
    allNodes: state.allNodes.filter(n => n.id !== nodeId),
    nodes: state.nodes.filter(n => n.id !== nodeId),
    allLinks: state.allLinks.filter(l => { const s = typeof l.source === 'object' ? l.source.id : l.source; const t = typeof l.target === 'object' ? l.target.id : l.target; return s !== nodeId && t !== nodeId; }),
    links: state.links.filter(l => { const s = typeof l.source === 'object' ? l.source.id : l.source; const t = typeof l.target === 'object' ? l.target.id : l.target; return s !== nodeId && t !== nodeId; })
  })),
  removeLinkFromGraph: (linkId) => set((state) => ({
    allLinks: state.allLinks.filter(l => l.id !== linkId),
    links: state.links.filter(l => l.id !== linkId)
  })),
}));
