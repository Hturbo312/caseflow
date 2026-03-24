import { create } from 'zustand';

// ============ Schema Store ============
export const useSchemaStore = create((set, get) => ({
  // 当前选中的 Schema
  currentSchemaId: null,

  // Schema 列表
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

  // 动作
  setCurrentSchema: (id) => set({ currentSchemaId: id }),

  // 添加新 Schema
  addSchema: (name, description = '') => set((state) => {
    const newSchema = {
      id: Date.now().toString(),
      name: name || `新建 Schema ${state.schemas.length + 1}`,
      description,
      entityTypes: [],
      relations: [],
    };
    return {
      schemas: [...state.schemas, newSchema],
      currentSchemaId: newSchema.id // 自动选中新建的 Schema
    };
  }),

  // 删除 Schema
  deleteSchema: (id) => set((state) => ({
    schemas: state.schemas.filter(s => s.id !== id),
    currentSchemaId: state.currentSchemaId === id ? (state.schemas[0]?.id || null) : state.currentSchemaId
  })),

  updateSchema: (id, updates) => set((state) => ({
    schemas: state.schemas.map(s => s.id === id ? { ...s, ...updates } : s)
  })),

  // 添加实体类型
  addEntityType: (schemaId, entityType) => set((state) => ({
    schemas: state.schemas.map(s =>
      s.id === schemaId
        ? { ...s, entityTypes: [...s.entityTypes, { ...entityType, id: Date.now().toString(), properties: entityType.properties || [] }] }
        : s
    )
  })),

  // 更新实体类型
  updateEntityType: (schemaId, entityTypeId, updates) => set((state) => ({
    schemas: state.schemas.map(s =>
      s.id === schemaId
        ? {
            ...s,
            entityTypes: s.entityTypes.map(e => e.id === entityTypeId ? { ...e, ...updates } : e)
          }
        : s
    )
  })),

  // 删除实体类型
  deleteEntityType: (schemaId, entityTypeId) => set((state) => ({
    schemas: state.schemas.map(s =>
      s.id === schemaId
        ? { ...s, entityTypes: s.entityTypes.filter(e => e.id !== entityTypeId) }
        : s
    )
  })),

  // 为实体类型添加属性
  addProperty: (schemaId, entityTypeId, property) => set((state) => ({
    schemas: state.schemas.map(s =>
      s.id === schemaId
        ? {
            ...s,
            entityTypes: s.entityTypes.map(e =>
              e.id === entityTypeId
                ? { ...e, properties: [...(e.properties || []), { ...property, id: Date.now().toString() }] }
                : e
            )
          }
        : s
    )
  })),

  // 更新实体类型的属性
  updateProperty: (schemaId, entityTypeId, propertyName, updates) => set((state) => ({
    schemas: state.schemas.map(s =>
      s.id === schemaId
        ? {
            ...s,
            entityTypes: s.entityTypes.map(e =>
              e.id === entityTypeId
                ? {
                    ...e,
                    properties: (e.properties || []).map(p =>
                      p.name === propertyName ? { ...p, ...updates } : p
                    )
                  }
                : e
            )
          }
        : s
    )
  })),

  // 删除实体类型的属性
  deleteProperty: (schemaId, entityTypeId, propertyName) => set((state) => ({
    schemas: state.schemas.map(s =>
      s.id === schemaId
        ? {
            ...s,
            entityTypes: s.entityTypes.map(e =>
              e.id === entityTypeId
                ? { ...e, properties: (e.properties || []).filter(p => p.name !== propertyName) }
                : e
            )
          }
        : s
    )
  })),

  // 添加关系
  addRelation: (schemaId, relation) => set((state) => ({
    schemas: state.schemas.map(s =>
      s.id === schemaId
        ? { ...s, relations: [...s.relations, { ...relation, id: Date.now().toString(), direction: relation.direction || 'directed', color: relation.color || '#9ca3af', style: relation.style || 'solid' }] }
        : s
    )
  })),

  // 更新关系
  updateRelation: (schemaId, relationId, updates) => set((state) => ({
    schemas: state.schemas.map(s =>
      s.id === schemaId
        ? { ...s, relations: s.relations.map(r => r.id === relationId ? { ...r, ...updates } : r) }
        : s
    )
  })),

  // 删除关系
  deleteRelation: (schemaId, relationId) => set((state) => ({
    schemas: state.schemas.map(s =>
      s.id === schemaId
        ? { ...s, relations: s.relations.filter(r => r.id !== relationId) }
        : s
    )
  })),

  // 导出 Schema 为 JSON
  exportSchema: (schemaId) => {
    const { schemas } = get();
    const schema = schemas.find(s => s.id === schemaId);
    if (schema) {
      const dataStr = JSON.stringify(schema, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      const exportFileDefaultName = `${schema.name.replace(/\s+/g, '_')}_schema.json`;
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    }
  },

  // 导入 Schema 从 JSON
  importSchema: (jsonData) => set((state) => {
    try {
      const schema = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      if (schema && schema.name && Array.isArray(schema.entityTypes) && Array.isArray(schema.relations)) {
        const newSchema = {
          ...schema,
          id: Date.now().toString(),
        };
        return {
          schemas: [...state.schemas, newSchema],
          currentSchemaId: newSchema.id
        };
      }
    } catch (e) {
      console.error('导入 Schema 失败:', e);
    }
    return state;
  }),

  getCurrentSchema: () => {
    const { currentSchemaId, schemas } = get();
    return schemas.find(s => s.id === currentSchemaId) || schemas[0];
  }
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
    {
      id: 'case3',
      name: '广州太古汇',
      location: '广州市天河区',
      year: '2011',
      description: '太古地产在广州开发的综合商业项目，包含高端购物、办公和酒店。',
      tags: ['商业综合体', '市场主导', '高端开发'],
      schemaId: 'default',
      entities: [
        { id: 'e9', name: '太古地产', entityType: '项目主体', properties: { 类型: '外资企业', 角色: '开发商' } },
        { id: 'e10', name: '综合开发', entityType: '改造方式', properties: { 模式: '新建开发', 周期: '8 年' } },
        { id: 'e11', name: '天河路地块', entityType: '地块属性', properties: { 面积: '35000㎡', 用地性质: '商业', 容积率: '8.0' } },
        { id: 'e12', name: '港资银行贷款', entityType: '资金来源', properties: { 类型: '外资', 金额: '30 亿', 占比: '70%' } },
      ],
      relations: [
        { id: 'r7', name: '主导', sourceId: 'e9', targetId: 'e10' },
        { id: 'r8', name: '位于', sourceId: 'e9', targetId: 'e11' },
        { id: 'r9', name: '投资于', sourceId: 'e12', targetId: 'e9' },
      ],
    },
  ],
  currentCaseId: 'case1',

  // 添加案例
  addCase: (caseData) => set((state) => ({
    cases: [...state.cases, { ...caseData, id: Date.now().toString(), entities: [], relations: [] }]
  })),

  // 更新案例
  updateCase: (id, updates) => set((state) => ({
    cases: state.cases.map(c => c.id === id ? { ...c, ...updates } : c)
  })),

  // 删除案例
  deleteCase: (id) => set((state) => ({
    cases: state.cases.filter(c => c.id !== id),
    currentCaseId: state.currentCaseId === id ? null : state.currentCaseId
  })),

  // 设置当前案例
  setCurrentCase: (id) => set({ currentCaseId: id }),

  // 获取当前案例
  getCurrentCase: () => {
    const { currentCaseId, cases } = get();
    return cases.find(c => c.id === currentCaseId);
  },

  // 添加实体到案例
  addEntityToCase: (caseId, entity) => set((state) => ({
    cases: state.cases.map(c =>
      c.id === caseId
        ? { ...c, entities: [...c.entities, { ...entity, id: Date.now().toString() }] }
        : c
    )
  })),

  // 添加关系到案例
  addRelationToCase: (caseId, relation) => set((state) => ({
    cases: state.cases.map(c =>
      c.id === caseId
        ? { ...c, relations: [...c.relations, relation] }
        : c
    )
  })),

  // 删除实体 from 案例
  deleteEntityFromCase: (caseId, entityId) => set((state) => ({
    cases: state.cases.map(c =>
      c.id === caseId
        ? { ...c, entities: c.entities.filter(e => e.id !== entityId) }
        : c
    )
  })),

  // 删除关系 from 案例
  deleteRelationFromCase: (caseId, relationId) => set((state) => ({
    cases: state.cases.map(c =>
      c.id === caseId
        ? { ...c, relations: c.relations.filter(r => r.id !== relationId) }
        : c
    )
  })),
}));

// ============ Graph Store ============
export const useGraphStore = create((set, get) => ({
  // 图谱数据 - 初始化时从案例加载
  nodes: [],
  links: [],

  // 视图状态
  highlightedNodes: [],
  selectedNode: null,
  filter: {
    entityTypes: [],
    minRelationStrength: 0,
  },

  // 设置图谱数据
  setGraphData: (nodes, links) => set({ nodes, links }),

  // 高亮节点
  setHighlightedNodes: (nodeIds) => set({ highlightedNodes: nodeIds }),

  // 选中节点
  setSelectedNode: (node) => set({ selectedNode: node }),

  // 设置过滤
  setFilter: (filter) => set((state) => ({
    filter: { ...state.filter, ...filter }
  })),

  // 从案例生成图谱数据
  loadCaseToGraph: (caseData) => {
    const { entities, relations } = caseData;
    // 为节点分配随机位置（简单的布局）
    const nodes = entities.map((e, index) => ({
      id: e.id,
      name: e.name,
      type: e.entityType,
      properties: e.properties,
      x: 150 + (index % 5) * 120 + Math.random() * 30,
      y: 100 + Math.floor(index / 5) * 100 + Math.random() * 30,
    }));
    const links = relations.map(r => ({
      source: r.sourceId,
      target: r.targetId,
      name: r.name || r.relationType,
    }));
    set({ nodes, links });
  },

  // 从当前案例同步数据到图谱（新增方法）
  syncCurrentCaseToGraph: () => {
    const { currentCaseId, cases } = useCaseStore.getState();
    const currentCase = cases.find(c => c.id === currentCaseId);
    if (currentCase) {
      const { entities = [], relations = [] } = currentCase;
      const nodes = entities.map((e, index) => ({
        id: e.id,
        name: e.name,
        type: e.entityType,
        properties: e.properties,
        x: 150 + (index % 5) * 120 + Math.random() * 30,
        y: 100 + Math.floor(index / 5) * 100 + Math.random() * 30,
      }));
      const links = relations.map(r => ({
        source: r.sourceId,
        target: r.targetId,
        name: r.name,
      }));
      set({ nodes, links });
    }
  },

  // 初始化图谱数据（应用启动时调用）
  initializeGraph: () => {
    const { currentCaseId, cases } = useCaseStore.getState();
    const currentCase = cases.find(c => c.id === currentCaseId);
    if (currentCase) {
      const { entities = [], relations = [] } = currentCase;
      const nodes = entities.map((e, index) => ({
        id: e.id,
        name: e.name,
        type: e.entityType,
        properties: e.properties,
        x: 150 + (index % 5) * 120 + Math.random() * 30,
        y: 100 + Math.floor(index / 5) * 100 + Math.random() * 30,
      }));
      const links = relations.map(r => ({
        source: r.sourceId,
        target: r.targetId,
        name: r.name,
      }));
      set({ nodes, links });
    }
  },

  // 添加单个节点到图谱
  addNodeToGraph: (entity) => {
    const { nodes } = get();
    const newNode = {
      id: entity.id,
      name: entity.name,
      type: entity.entityType,
      properties: entity.properties,
      x: Math.random() * 400 + 100,
      y: Math.random() * 300 + 100,
    };
    set({ nodes: [...nodes, newNode] });
  },

  // 添加单个关系到图谱
  addLinkToGraph: (relation) => {
    const { links } = get();
    const newLink = {
      source: relation.sourceId,
      target: relation.targetId,
      name: relation.name,
    };
    set({ links: [...links, newLink] });
  },

  // 从图谱删除节点
  removeNodeFromGraph: (nodeId) => {
    const { nodes, links } = get();
    set({
      nodes: nodes.filter(n => n.id !== nodeId),
      links: links.filter(l => l.source !== nodeId && l.target !== nodeId),
    });
  },

  // 从图谱删除关系
  removeLinkFromGraph: (linkId) => {
    const { links } = get();
    set({ links: links.filter(l => l.id !== linkId) });
  },
}));

// ============ AI Assistant Store ============
export const useAIStore = create((set, get) => ({
  messages: [],
  isThinking: false,
  currentContext: null,

  // AI API 配置
  apiConfig: {
    endpoint: process.env.REACT_APP_AI_API_ENDPOINT || '',
    apiKey: process.env.REACT_APP_AI_API_KEY || '',
    model: process.env.REACT_APP_AI_MODEL || 'gpt-3.5-turbo',
  },

  // 添加消息
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, { ...message, id: Date.now(), timestamp: new Date() }]
  })),

  // 设置思考状态
  setThinking: (isThinking) => set({ isThinking }),

  // 设置上下文
  setContext: (context) => set({ currentContext: context }),

  // 清空对话
  clearMessages: () => set({ messages: [] }),

  // 配置 AI API
  setApiConfig: (config) => set((state) => ({
    apiConfig: { ...state.apiConfig, ...config }
  })),

  // 基于图谱的智能响应
  sendToAI: async (userMessage) => {
    const { addMessage, setThinking, currentContext, apiConfig } = get();
    const { nodes, links, cases } = useGraphStore.getState();

    addMessage({ role: 'user', content: userMessage });
    setThinking(true);

    // 检查是否配置了真实 API
    if (apiConfig.endpoint && apiConfig.apiKey) {
      try {
        // 构建图谱上下文
        const graphContext = {
          nodes: nodes.map(n => ({ name: n.name, type: n.type })),
          links: links.map(l => ({
            source: typeof l.source === 'object' ? l.source.name : nodes.find(n => n.id === l.source)?.name,
            target: typeof l.target === 'object' ? l.target.name : nodes.find(n => n.id === l.target)?.name,
            name: l.name
          })),
          cases: cases.map(c => ({ name: c.name, entityCount: c.entities?.length || 0 }))
        };

        const response = await fetch(apiConfig.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiConfig.apiKey}`,
          },
          body: JSON.stringify({
            model: apiConfig.model,
            messages: [
              {
                role: 'system',
                content: `你是一个知识图谱分析助手。当前图谱包含以下数据：${JSON.stringify(graphContext, null, 2)}. 请基于图谱数据回答用户问题。`
              },
              { role: 'user', content: userMessage }
            ],
            temperature: 0.7,
            max_tokens: 1000,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const aiResponse = data.choices?.[0]?.message?.content || '抱歉，我无法回答这个问题。';
          addMessage({ role: 'assistant', content: aiResponse });
          setThinking(false);
          return;
        }
      } catch (error) {
        console.error('AI API 调用失败:', error);
        // 降级到模拟响应
      }
    }

    // 模拟 AI 响应 - 基于图谱数据生成智能回答（降级方案）
    setTimeout(() => {
      let response = '';

      // 分析用户问题并生成响应
      const question = userMessage.toLowerCase();

      // 统计信息
      const nodeCount = nodes.length;
      const linkCount = links.length;
      const entityTypes = [...new Set(nodes.map(n => n.type))];

      if (question.includes('总结') || question.includes('所有')) {
        if (question.includes('工业遗产改造')) {
          const matchingNodes = nodes.filter(n => n.type === '改造方式' && n.name.includes('改造'));
          response = `根据图谱分析，当前共有 ${matchingNodes.length} 个采用'工业遗产改造'模式的项目节点。\n\n这些项目包括：${matchingNodes.map(n => n.name).join('、') || '暂无具体项目'}。\n\n工业遗产改造模式是一种将废弃工业建筑重新利用的城市更新方式，通常具有保留历史风貌、注入创意产业等特点。`;
        } else if (question.includes('案例')) {
          response = `当前系统中共有 ${cases.length} 个案例。\n\n图谱中包含 ${nodeCount} 个实体节点和 ${linkCount} 条关系，涵盖 ${entityTypes.length} 种实体类型：${entityTypes.join('、')}。`;
        } else {
          response = `根据图谱数据统计：\n- 实体节点：${nodeCount} 个\n- 关系连接：${linkCount} 条\n- 实体类型：${entityTypes.join('、')}\n\n图谱结构完整，可以用于进一步的分析查询。`;
        }
      } else if (question.includes('关系') || question.includes('逻辑')) {
        response = `根据图谱中的关系分析：\n\n`;
        const relations = links.map(l => {
          const source = nodes.find(n => typeof l.source === 'object' ? l.source.id === n.id : l.source === n.id);
          const target = nodes.find(n => typeof l.target === 'object' ? l.target.id === n.id : l.target === n.id);
          return `- ${source?.name || '未知'} ${l.name || '关联'} ${target?.name || '未知'}`;
        }).slice(0, 5).join('\n');
        response += relations || '暂无明确关系数据';
        response += '\n\n以上是基于当前图谱数据的关系分析结果。';
      } else if (question.includes('比较') || question.includes('差异')) {
        response = `对比分析结果：\n\n`;
        response += `1. 政府主导模式：通常涉及公共设施改造，投资规模大，周期较长\n`;
        response += `2. 市场主导模式：更灵活高效，注重商业价值回报\n\n`;
        response += `当前图谱中有 ${nodeCount} 个节点参与不同类型的改造项目，可进一步筛选查看具体案例对比。`;
      } else if (question.includes('容积率') || question.includes('超过')) {
        response = `根据图谱中的地块属性数据分析：\n\n`;
        response += `目前图谱中尚未记录具体的容积率数值，建议在 Schema 管理中为"地块属性"实体添加"容积率"属性字段，以便进行精确的数值筛选和比较。`;
      } else if (currentContext && currentContext.data) {
        const contextName = currentContext.data?.name || '未命名';
        response = `当前上下文：${currentContext.type === 'node' ? `节点"${contextName}"` : `案例"${contextName}"`}\n\n`;
        response += `基于此上下文的分析：${currentContext.data?.type ? `该实体类型为"${currentContext.data.type}"` : '无特定类型信息'}。\n\n`;
        if (currentContext.data?.properties && Object.keys(currentContext.data.properties).length > 0) {
          response += `属性信息：${JSON.stringify(currentContext.data.properties, null, 2)}`;
        } else {
          response += `您可以继续询问关于此实体的相关问题，我会基于图谱为您提供详细信息。`;
        }
      } else {
        response = `感谢您的提问！基于当前图谱数据，我可以帮您：\n\n`;
        response += `1. 总结特定类型的案例或项目\n`;
        response += `2. 分析实体之间的关系逻辑\n`;
        response += `3. 比较不同模式的差异\n`;
        response += `4. 查询具体案例的详细信息\n\n`;
        response += `当前图谱规模：${nodeCount}个实体，${linkCount}条关系。请随时提出您的问题。`;
      }

      addMessage({
        role: 'assistant',
        content: response
      });
      setThinking(false);
    }, 1200);
  },
}));
