import { create } from 'zustand';

// ============ Schema Store ============
export const useSchemaStore = create((set, get) => ({
  currentSchemaId: 'default',
  schemas: [
    {
      id: 'default',
      name: '默认 Schema',
      description: '基础城市更新案例拆解框架',
      entityTypes: [
        { id: 'e1', name: '项目主体', color: '#3b82f6', properties: [
          { name: '名称', type: 'text' },
          { name: '类型', type: 'enum', options: ['企业', '政府', '个人'] },
          { name: '角色', type: 'text' }
        ]},
        { id: 'e2', name: '改造方式', color: '#10b981', properties: [
          { name: '模式', type: 'text' },
          { name: '周期', type: 'text' }
        ]},
        { id: 'e3', name: '地块属性', color: '#f59e0b', properties: [
          { name: '面积', type: 'number' },
          { name: '用地性质', type: 'enum', options: ['商业', '住宅', '工业', '混合'] },
          { name: '容积率', type: 'number' }
        ]},
        { id: 'e4', name: '资金来源', color: '#8b5cf6', properties: [
          { name: '类型', type: 'enum', options: ['国有资本', '民营资本', '外资', '混合'] },
          { name: '金额', type: 'number' },
          { name: '占比', type: 'text' }
        ]},
      ],
      relations: [
        { id: 'r1', name: '主导', from: '项目主体', to: '项目主体', direction: 'directed', color: '#3b82f6', style: 'solid' },
        { id: 'r2', name: '采用', from: '项目主体', to: '改造方式', direction: 'directed', color: '#10b981', style: 'solid' },
        { id: 'r3', name: '位于', from: '项目主体', to: '地块属性', direction: 'directed', color: '#f59e0b', style: 'solid' },
        { id: 'r4', name: '投资于', from: '资金来源', to: '项目主体', direction: 'directed', color: '#8b5cf6', style: 'solid' },
      ],
    }
  ],
  isLoading: false,

  setCurrentSchema: (id) => set({ currentSchemaId: id }),
  addSchema: (name, description = '') => set((state) => {
    const newSchema = { id: Date.now().toString(), name: name || `新建 Schema`, description, entityTypes: [], relations: [] };
    return { schemas: [...state.schemas, newSchema], currentSchemaId: newSchema.id };
  }),
  deleteSchema: (id) => set((state) => ({ schemas: state.schemas.filter(s => s.id !== id) })),
  updateSchema: (id, updates) => set((state) => ({ schemas: state.schemas.map(s => s.id === id ? { ...s, ...updates } : s) })),
  addEntityType: (schemaId, entityType) => set((state) => ({ schemas: state.schemas.map(s => s.id === schemaId ? { ...s, entityTypes: [...s.entityTypes, { ...entityType, id: Date.now().toString() }] } : s) })),
  updateEntityType: (schemaId, entityTypeId, updates) => set((state) => ({ schemas: state.schemas.map(s => s.id === schemaId ? { ...s, entityTypes: s.entityTypes.map(e => e.id === entityTypeId ? { ...e, ...updates } : e) } : s) })),
  deleteEntityType: (schemaId, entityTypeId) => set((state) => ({ schemas: state.schemas.map(s => s.id === schemaId ? { ...s, entityTypes: s.entityTypes.filter(e => e.id !== entityTypeId) } : s) })),
  addProperty: (schemaId, entityTypeId, property) => set((state) => ({ schemas: state.schemas.map(s => s.id === schemaId ? { ...s, entityTypes: s.entityTypes.map(e => e.id === entityTypeId ? { ...e, properties: [...(e.properties || []), { ...property, id: Date.now().toString() }] } : e) } : s) })),
  updateProperty: (schemaId, entityTypeId, propertyName, updates) => set((state) => ({ schemas: state.schemas.map(s => s.id === schemaId ? { ...s, entityTypes: s.entityTypes.map(e => e.id === entityTypeId ? { ...e, properties: (e.properties || []).map(p => p.name === propertyName ? { ...p, ...updates } : p) } : e) } : s) })),
  deleteProperty: (schemaId, entityTypeId, propertyName) => set((state) => ({ schemas: state.schemas.map(s => s.id === schemaId ? { ...s, entityTypes: s.entityTypes.map(e => e.id === entityTypeId ? { ...e, properties: (e.properties || []).filter(p => p.name !== propertyName) } : e) } : s) })),
  addRelation: (schemaId, relation) => set((state) => ({ schemas: state.schemas.map(s => s.id === schemaId ? { ...s, relations: [...s.relations, { ...relation, id: Date.now().toString() }] } : s) })),
  updateRelation: (schemaId, relationId, updates) => set((state) => ({ schemas: state.schemas.map(s => s.id === schemaId ? { ...s, relations: s.relations.map(r => r.id === relationId ? { ...r, ...updates } : r) } : s) })),
  deleteRelation: (schemaId, relationId) => set((state) => ({ schemas: state.schemas.map(s => s.id === schemaId ? { ...s, relations: s.relations.filter(r => r.id !== relationId) } : s) })),
  exportSchema: (schemaId) => { const schema = get().schemas.find(s => s.id === schemaId); if (schema) { const link = document.createElement('a'); link.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(schema, null, 2)); link.download = `${schema.name}_schema.json`; link.click(); } },
  importSchema: (jsonData) => set((state) => { try { const schema = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData; if (schema?.name) { const newSchema = { ...schema, id: Date.now().toString() }; return { schemas: [...state.schemas, newSchema], currentSchemaId: newSchema.id }; } } catch (e) { console.error(e); } return state; }),
  getCurrentSchema: () => get().schemas.find(s => s.id === get().currentSchemaId) || get().schemas[0],
  loadSchemas: async () => {},
}));

// ============ Case Store ============
export const useCaseStore = create((set, get) => ({
  cases: [
    {
      id: 'case1',
      name: '上海新天地改造项目',
      location: '上海市黄浦区',
      year: '2000',
      description: '上海新天地是一个成功的城市更新案例，将传统的石库门建筑改造为现代化的商业、娱乐和餐饮中心。',
      tags: ['工业遗产改造', '商业开发', '历史保护'],
      schemaId: 'default',
      entities: [
        { id: 'e1', name: '锦江集团', entityType: '项目主体', properties: { 类型: '企业', 角色: '开发商' } },
        { id: 'e2', name: '石库门改造', entityType: '改造方式', properties: { 模式: '保护性开发', 周期: '3 年' } },
        { id: 'e3', name: '太平桥地块', entityType: '地块属性', properties: { 面积: '52000㎡', 用地性质: '商业', 容积率: '2.5' } },
        { id: 'e4', name: '政府投资平台', entityType: '资金来源', properties: { 类型: '国有资本', 金额: '5 亿', 占比: '60%' } },
      ],
      relations: [
        { id: 'r1', name: '主导', sourceId: 'e1', targetId: 'e2' },
        { id: 'r2', name: '位于', sourceId: 'e1', targetId: 'e3' },
        { id: 'r3', name: '投资于', sourceId: 'e4', targetId: 'e1' },
      ],
    },
    {
      id: 'case2',
      name: '北京 798 艺术区',
      location: '北京市朝阳区',
      year: '2002',
      description: '由废弃的军工厂房改造而成的当代艺术聚集区，成为中国艺术地标。',
      tags: ['文创园区', '艺术改造', '政府主导'],
      schemaId: 'default',
      entities: [
        { id: 'e5', name: '七星华电集团', entityType: '项目主体', properties: { 类型: '企业', 角色: '产权方' } },
        { id: 'e6', name: '艺术园区改造', entityType: '改造方式', properties: { 模式: '文创转型', 周期: '5 年' } },
        { id: 'e7', name: '大山子地块', entityType: '地块属性', properties: { 面积: '600000㎡', 用地性质: '工业', 容积率: '1.2' } },
        { id: 'e8', name: '朝阳区文化产业基金', entityType: '资金来源', properties: { 类型: '国有资本', 金额: '2 亿', 占比: '40%' } },
      ],
      relations: [
        { id: 'r4', name: '主导', sourceId: 'e5', targetId: 'e6' },
        { id: 'r5', name: '位于', sourceId: 'e5', targetId: 'e7' },
        { id: 'r6', name: '投资于', sourceId: 'e8', targetId: 'e5' },
      ],
    },
  ],
  currentCaseId: 'case1',
  isLoading: false,

  addCase: (caseData) => set((state) => ({ cases: [...state.cases, { ...caseData, id: Date.now().toString(), entities: [], relations: [] }] })),
  updateCase: (id, updates) => set((state) => ({ cases: state.cases.map(c => c.id === id ? { ...c, ...updates } : c) })),
  deleteCase: (id) => set((state) => ({ cases: state.cases.filter(c => c.id !== id), currentCaseId: state.currentCaseId === id ? null : state.currentCaseId })),
  setCurrentCase: (id) => set({ currentCaseId: id }),
  getCurrentCase: () => get().cases.find(c => c.id === get().currentCaseId),
  addEntityToCase: (caseId, entity) => set((state) => ({ cases: state.cases.map(c => c.id === caseId ? { ...c, entities: [...c.entities, { ...entity, id: Date.now().toString() }] } : c) })),
  addRelationToCase: (caseId, relation) => set((state) => ({ cases: state.cases.map(c => c.id === caseId ? { ...c, relations: [...c.relations, relation] } : c) })),
  deleteEntityFromCase: (caseId, entityId) => set((state) => ({ cases: state.cases.map(c => c.id === caseId ? { ...c, entities: c.entities.filter(e => e.id !== entityId), relations: c.relations.filter(r => r.sourceId !== entityId && r.targetId !== entityId) } : c) })),
  deleteRelationFromCase: (caseId, relationId) => set((state) => ({ cases: state.cases.map(c => c.id === caseId ? { ...c, relations: c.relations.filter(r => r.id !== relationId) } : c) })),
  loadCases: async () => {},
}));

// ============ Graph Store ============
export const useGraphStore = create((set, get) => ({
  // 图谱数据
  nodes: [],
  links: [],
  allNodes: [],  // 全量节点缓存
  allLinks: [],  // 全量链接缓存

  // 视图状态
  viewMode: 'full', // 'full' 全量模式 | 'focused' 聚焦模式
  focusDepth: 1,    // 聚焦深度 1 或 2
  focusCaseId: null, // 聚焦的案例 ID

  // 交互状态
  highlightedNodes: [],
  selectedNode: null,
  filter: { entityTypes: [], minRelationStrength: 0 },

  setGraphData: (nodes, links) => set({ nodes, links }),
  setHighlightedNodes: (nodeIds) => set({ highlightedNodes: nodeIds }),
  setSelectedNode: (node) => set({ selectedNode: node }),
  setFilter: (filter) => set((state) => ({ filter: { ...state.filter, ...filter } })),

  // 设置视图模式
  setViewMode: (mode) => {
    set({ viewMode: mode });
    get().applyViewFilter();
  },

  // 设置聚焦深度
  setFocusDepth: (depth) => {
    set({ focusDepth: depth });
    if (get().viewMode === 'focused') {
      get().applyViewFilter();
    }
  },

  // 设置聚焦案例
  setFocusCase: (caseId) => {
    set({ focusCaseId: caseId, viewMode: caseId ? 'focused' : 'full' });
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

    // 过滤当前 schema 下的所有案例
    const schemaCases = allCases.filter(c => c.schemaId === currentSchemaId);

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

    set({ allNodes, allLinks, nodes: allNodes, links: allLinks, viewMode: 'full', focusCaseId: null });
  },

  // 应用视图过滤器
  applyViewFilter: () => {
    const { allNodes, allLinks, viewMode, focusCaseId, focusDepth } = get();

    if (viewMode === 'full' || !focusCaseId) {
      // 全量模式：显示所有节点
      set({ nodes: allNodes, links: allLinks });
      return;
    }

    // 聚焦模式：查找案例相关节点和邻居
    const focusCase = useCaseStore.getState().cases.find(c => c.id === focusCaseId);
    if (!focusCase) {
      set({ nodes: allNodes, links: allLinks });
      return;
    }

    // 获取该案例的所有节点 ID
    const caseNodeIds = new Set(focusCase.entities?.map(e => e.id) || []);

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

    // BFS 扩展邻居节点
    const visibleNodeIds = new Set(caseNodeIds);
    let frontier = [...caseNodeIds];

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

    // 过滤节点和链接
    const filteredNodes = allNodes.filter(n => visibleNodeIds.has(n.id));
    const filteredLinks = allLinks.filter(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
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

  addNodeToGraph: (entity) => set((state) => ({
    allNodes: [...state.allNodes, { id: entity.id, name: entity.name, type: entity.entityType, properties: entity.properties }],
    nodes: [...state.nodes, { id: entity.id, name: entity.name, type: entity.entityType, properties: entity.properties, x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 }]
  })),
  addLinkToGraph: (relation) => set((state) => ({
    allLinks: [...state.allLinks, { id: relation.id, source: relation.sourceId, target: relation.targetId, name: relation.name }],
    links: [...state.links, { id: relation.id, source: relation.sourceId, target: relation.targetId, name: relation.name }]
  })),
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

// ============ AI Store ============
export const useAIStore = create((set, get) => ({
  messages: [],
  isThinking: false,
  currentContext: null,
  // 默认 coding plan 配置
  apiConfig: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    model: '',
    temperature: 0.7,
    maxTokens: 4096,
  },

  addMessage: (message) => set((state) => ({ messages: [...state.messages, { ...message, id: Date.now(), timestamp: new Date() }] })),
  setThinking: (isThinking) => set({ isThinking }),
  setContext: (context) => set({ currentContext: context }),
  clearMessages: () => set({ messages: [] }),
  setApiConfig: (config) => set((state) => ({ apiConfig: { ...state.apiConfig, ...config } })),

  // 案例拆解 Agent 提示词模板
  caseExtractionPrompt: (schema, caseText) => {
    const entityTypes = schema?.entityTypes || [];
    const relations = schema?.relations || [];

    return `你是一个专业的城市更新案例拆解专家。请根据以下 Schema 结构从案例文本中提取实体和关系。

## Schema 结构定义

### 实体类型：
${entityTypes.map(e => {
  const props = e.properties?.map(p => `${p.name}(${p.type})`).join(', ') || '无';
  return `- ${e.name}: 属性 [${props}]`;
}).join('\n')}

### 关系类型：
${relations.map(r => `- ${r.name}: ${r.from} → ${r.to}`).join('\n') || '无预定义关系'}

## 案例文本
${caseText}

## 输出要求
请严格按照以下 JSON 格式输出：
{
  "entities": [
    {
      "name": "实体名称",
      "entityType": "实体类型（必须匹配上述定义）",
      "properties": {
        "属性名": "属性值"
      }
    }
  ],
  "relations": [
    {
      "name": "关系名称",
      "sourceName": "源实体名称",
      "targetName": "目标实体名称"
    }
  ],
  "summary": "案例拆解总结（简短描述提取的关键信息）"
}

注意：
1. 实体类型必须严格匹配 Schema 中定义的类型
2. 关系必须在 Schema 中有对应的定义
3. 如果文本中没有提到某个实体类型的相关信息，可以不提取
4. 属性值应尽量从文本中提取原始信息，避免推断`;
  },

  sendToAI: async (userMessage) => {
    const { addMessage, setThinking, apiConfig, caseExtractionPrompt } = get();
    const { nodes, links } = useGraphStore.getState();
    const currentSchema = useSchemaStore.getState().getCurrentSchema();

    addMessage({ role: 'user', content: userMessage });
    setThinking(true);

    // 检查是否有 API 配置
    if (!apiConfig.apiKey || !apiConfig.endpoint) {
      addMessage({
        role: 'assistant',
        content: '请先配置 AI API。点击右上角的设置按钮，填写 API Endpoint 和 API Key。'
      });
      setThinking(false);
      return;
    }

    try {
      // 构建系统提示
      const systemPrompt = `你是 CaseFlow 的 AI 助手，专门帮助用户进行城市更新案例的知识图谱分析。
当前图谱包含 ${nodes.length} 个节点和 ${links.length} 条关系。
当前 Schema: ${currentSchema?.name || '未知'}

你可以帮助用户：
1. 分析案例之间的关系
2. 基于 Schema 结构进行案例拆解
3. 查询特定实体或关系
4. 比较不同案例的特点`;

      const response = await fetch(apiConfig.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: apiConfig.model || 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            ...get().messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMessage }
          ],
          temperature: apiConfig.temperature || 0.7,
          max_tokens: apiConfig.maxTokens || 4096,
        }),
      });

      const data = await response.json();
      const assistantMessage = data.choices?.[0]?.message?.content || '抱歉，我无法生成回复。';

      addMessage({ role: 'assistant', content: assistantMessage });
    } catch (error) {
      console.error('AI API Error:', error);
      addMessage({
        role: 'assistant',
        content: `调用 AI API 失败: ${error.message}\n\n请检查 API 配置是否正确。`
      });
    }

    setThinking(false);
  },

  // 案例拆解专用方法
  extractFromCase: async (caseText) => {
    const { apiConfig, caseExtractionPrompt, addMessage, setThinking } = get();
    const currentSchema = useSchemaStore.getState().getCurrentSchema();

    if (!apiConfig.apiKey || !apiConfig.endpoint) {
      return { success: false, error: '请先配置 AI API' };
    }

    setThinking(true);
    addMessage({ role: 'user', content: `开始拆解案例...\n\n案例文本：${caseText.substring(0, 300)}...` });

    try {
      const prompt = caseExtractionPrompt(currentSchema, caseText);

      const response = await fetch(apiConfig.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: apiConfig.model || 'gpt-4',
          messages: [
            { role: 'system', content: '你是一个专业的案例拆解助手，严格按照 Schema 结构提取实体和关系。只输出 JSON 格式。' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: apiConfig.maxTokens || 4096,
        }),
      });

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      // 尝试解析 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        addMessage({ role: 'assistant', content: `拆解完成！提取了 ${result.entities?.length || 0} 个实体和 ${result.relations?.length || 0} 条关系。\n\n${result.summary || ''}` });
        setThinking(false);
        return { success: true, data: result };
      }

      addMessage({ role: 'assistant', content: content });
      setThinking(false);
      return { success: false, error: '无法解析 AI 响应' };
    } catch (error) {
      addMessage({ role: 'assistant', content: `拆解失败: ${error.message}` });
      setThinking(false);
      return { success: false, error: error.message };
    }
  },
}));