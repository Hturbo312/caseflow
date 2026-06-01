import { create } from 'zustand';
import { schemaApi, caseApi, authApi, agentApi, chatApi, extractionApi } from '../services/api';
import { authHelper, API_BASE_URL } from '../utils';

// ============================================
// Auth Store
// ============================================
export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: authHelper.isAuthenticated(),
  isLoading: false,
  error: null,

  // 登录
  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await authApi.login(username, password);
      console.log('登录成功，token已保存:', !!localStorage.getItem('caseflow_token'));
      set({
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
      return { success: true };
    } catch (error) {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  },

  // 注册
  register: async (username, password, email) => {
    set({ isLoading: true, error: null });
    try {
      const data = await authApi.register(username, password, email);
      set({
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
      return { success: true };
    } catch (error) {
      set({
        isLoading: false,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  },

  // 登出
  logout: () => {
    authHelper.removeToken();
    set({
      user: null,
      isAuthenticated: false,
      error: null
    });
  },

  // 验证登录状态
  verifyAuth: async () => {
    if (!authHelper.isAuthenticated()) {
      set({ isAuthenticated: false, user: null });
      return false;
    }

    try {
      const data = await authApi.verify();
      set({
        isAuthenticated: data.valid,
        user: data.user
      });
      return data.valid;
    } catch {
      set({ isAuthenticated: false, user: null });
      return false;
    }
  },

  // 清除错误
  clearError: () => set({ error: null }),

  // 语言设置
  locale: localStorage.getItem('caseflow_locale') || 'zh',
  setLocale: (locale) => {
    localStorage.setItem('caseflow_locale', locale);
    set({ locale });
  },
}));

// 默认 Schema 数据
const DEFAULT_SCHEMA = {
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
    { id: 'r1', name: '主导', from: '项目主体', to: '项目主体', direction: 'directed', color: '#3b82f6', style: 'solid', properties: [] },
    { id: 'r2', name: '采用', from: '项目主体', to: '改造方式', direction: 'directed', color: '#10b981', style: 'solid', properties: [] },
    { id: 'r3', name: '位于', from: '项目主体', to: '地块属性', direction: 'directed', color: '#f59e0b', style: 'solid', properties: [] },
    { id: 'r4', name: '投资于', from: '资金来源', to: '项目主体', direction: 'directed', color: '#8b5cf6', style: 'solid', properties: [] },
  ],
};

// 默认案例数据
const DEFAULT_CASES = [
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
];

// ============ Schema Store ============
export const useSchemaStore = create((set, get) => ({
  currentSchemaId: null,
  schemas: [],
  isLoading: false,

  setCurrentSchema: (id) => set({ currentSchemaId: id }),

  // 从 API 加载 Schemas
  loadSchemas: async () => {
    set({ isLoading: true });
    try {
      const response = await schemaApi.getAll();
      const schemas = response.schemas || [];

      if (schemas.length > 0) {
        // 为每个 schema 加载实体类型和关系
        const fullSchemas = await Promise.all(schemas.map(async (s) => {
          try {
            const detail = await schemaApi.getById(s.id);
            return {
              ...s,
              id: s.id?.toString(),
              entityTypes: (detail.entityTypes || []).map(et => ({
                ...et,
                id: et.id?.toString(),
                properties: et.properties || []
              })),
              relations: (detail.relations || []).map(r => ({
                ...r,
                id: r.id?.toString(),
                from: r.from_entity_type,
                to: r.to_entity_type,
                description: r.description || '',
                direction: r.direction || 'directed',
                color: r.color || '#9ca3af',
                style: r.style || 'solid'
              }))
            };
          } catch (e) {
            console.error('加载 Schema 详情失败:', e);
            return { ...s, id: s.id?.toString(), entityTypes: [], relations: [] };
          }
        }));

        set({
          schemas: fullSchemas,
          currentSchemaId: (fullSchemas.find(s => s.id === '3') || fullSchemas[0])?.id?.toString() || null,
          isLoading: false
        });
      } else {
        set({ schemas: [], currentSchemaId: null, isLoading: false });
      }
    } catch (error) {
      console.error('加载 Schemas 失败:', error);
      set({ isLoading: false });
    }
  },

  // 创建 Schema（调用 API）
  addSchema: async (name, description = '') => {
    try {
      const response = await schemaApi.create({ name: name || '新建 Schema', description });
      const newSchema = response.schema;
      set((state) => ({
        schemas: [...state.schemas, { ...newSchema, entityTypes: [], relations: [] }],
        currentSchemaId: newSchema.id
      }));
      return newSchema;
    } catch (error) {
      console.error('创建 Schema 失败:', error);
      // 本地 fallback
      const newSchema = { id: Date.now().toString(), name: name || '新建 Schema', description, entityTypes: [], relations: [] };
      set((state) => ({ schemas: [...state.schemas, newSchema], currentSchemaId: newSchema.id }));
      return newSchema;
    }
  },

  deleteSchema: async (id) => {
    // 先更新本地状态
    set((state) => {
      const newSchemas = state.schemas.filter(s => s.id !== id);
      return {
        schemas: newSchemas,
        currentSchemaId: state.currentSchemaId === id ? (newSchemas[0]?.id || null) : state.currentSchemaId
      };
    });

    // 调用 API 删除
    try {
      await schemaApi.delete(id);
    } catch (error) {
      console.error('删除 Schema 失败:', error);
    }
  },
  updateSchema: async (id, updates) => {
    // 先更新本地状态
    set((state) => ({ schemas: state.schemas.map(s => s.id === id || s.id === parseInt(id) ? { ...s, ...updates } : s) }));

    // 调用 API 保存
    try {
      await schemaApi.update(id, updates);
    } catch (error) {
      console.error('更新 Schema 失败:', error);
    }
  },

  // 添加实体类型（调用 API）
  addEntityType: async (schemaId, entityType) => {
    try {
      const response = await schemaApi.addEntityType(schemaId, {
        name: entityType.name,
        color: entityType.color,
        properties: entityType.properties || []
      });
      const newEntityType = {
        ...response.entityType,
        id: response.entityType.id?.toString() || Date.now().toString(),
        properties: response.entityType.properties || []
      };
      set((state) => ({
        schemas: state.schemas.map(s =>
          s.id === schemaId || s.id === parseInt(schemaId)
            ? { ...s, entityTypes: [...s.entityTypes, newEntityType] }
            : s
        )
      }));
      return newEntityType;
    } catch (error) {
      console.error('添加实体类型失败:', error);
      alert(`添加实体类型失败：${error.message || '未知错误'}\n\n请检查是否已登录，或查看浏览器控制台了解详情。`);
      throw error;
    }
  },

  // 更新实体类型（调用 API）
  updateEntityType: async (schemaId, entityTypeId, updates) => {
    // 先更新本地状态
    set((state) => ({
      schemas: state.schemas.map(s =>
        s.id === schemaId || s.id === parseInt(schemaId)
          ? { ...s, entityTypes: s.entityTypes.map(e => e.id === entityTypeId ? { ...e, ...updates } : e) }
          : s
      )
    }));

    // 调用 API 保存
    try {
      const schema = get().schemas.find(s => s.id === schemaId || s.id === parseInt(schemaId));
      const entity = schema?.entityTypes.find(e => e.id === entityTypeId);
      if (entity) {
        await schemaApi.updateEntityType(schemaId, entityTypeId, {
          name: entity.name,
          color: entity.color,
          properties: entity.properties
        });
      }
    } catch (error) {
      console.error('更新实体类型失败:', error);
    }
  },

  // 删除实体类型（调用 API）
  deleteEntityType: async (schemaId, entityTypeId) => {
    // 先更新本地状态
    set((state) => ({
      schemas: state.schemas.map(s =>
        s.id === schemaId || s.id === parseInt(schemaId)
          ? { ...s, entityTypes: s.entityTypes.filter(e => e.id !== entityTypeId) }
          : s
      )
    }));

    // 调用 API 删除
    try {
      await schemaApi.deleteEntityType(schemaId, entityTypeId);
    } catch (error) {
      console.error('删除实体类型失败:', error);
    }
  },

  // 添加属性（通过更新实体类型保存到数据库）
  addProperty: async (schemaId, entityTypeId, property) => {
    const schema = get().schemas.find(s => s.id === schemaId || s.id === parseInt(schemaId));
    const entity = schema?.entityTypes.find(e => e.id === entityTypeId);
    if (!entity) return;

    const newProperties = [...(entity.properties || []), { ...property, id: Date.now().toString() }];

    // 更新本地状态
    set((state) => ({
      schemas: state.schemas.map(s =>
        s.id === schemaId || s.id === parseInt(schemaId)
          ? { ...s, entityTypes: s.entityTypes.map(e =>
              e.id === entityTypeId ? { ...e, properties: newProperties } : e
            )}
          : s
      )
    }));

    // 调用 API 保存
    try {
      await schemaApi.updateEntityType(schemaId, entityTypeId, { properties: newProperties });
    } catch (error) {
      console.error('添加属性失败:', error);
      alert(`添加属性失败：${error.message || '未知错误'}`);
      // 回滚本地状态
      set((state) => ({
        schemas: state.schemas.map(s =>
          s.id === schemaId || s.id === parseInt(schemaId)
            ? { ...s, entityTypes: s.entityTypes.map(e =>
                e.id === entityTypeId ? { ...e, properties: entity.properties } : e
              )}
            : s
        )
      }));
    }
  },
  updateProperty: async (schemaId, entityTypeId, propertyName, updates) => {
    const schema = get().schemas.find(s => s.id === schemaId || s.id === parseInt(schemaId));
    const entity = schema?.entityTypes.find(e => e.id === entityTypeId);
    if (!entity) return;

    const newProperties = (entity.properties || []).map(p =>
      p.name === propertyName ? { ...p, ...updates } : p
    );

    set((state) => ({
      schemas: state.schemas.map(s =>
        s.id === schemaId || s.id === parseInt(schemaId)
          ? { ...s, entityTypes: s.entityTypes.map(e =>
              e.id === entityTypeId ? { ...e, properties: newProperties } : e
            )}
          : s
      )
    }));

    try {
      await schemaApi.updateEntityType(schemaId, entityTypeId, { properties: newProperties });
    } catch (error) {
      console.error('更新属性失败:', error);
    }
  },

  // 删除属性
  deleteProperty: async (schemaId, entityTypeId, propertyName) => {
    const schema = get().schemas.find(s => s.id === schemaId || s.id === parseInt(schemaId));
    const entity = schema?.entityTypes.find(e => e.id === entityTypeId);
    if (!entity) return;

    const newProperties = (entity.properties || []).filter(p => p.name !== propertyName);

    set((state) => ({
      schemas: state.schemas.map(s =>
        s.id === schemaId || s.id === parseInt(schemaId)
          ? { ...s, entityTypes: s.entityTypes.map(e =>
              e.id === entityTypeId ? { ...e, properties: newProperties } : e
            )}
          : s
      )
    }));

    try {
      await schemaApi.updateEntityType(schemaId, entityTypeId, { properties: newProperties });
    } catch (error) {
      console.error('删除属性失败:', error);
    }
  },

  // 添加关系（调用 API）
  addRelation: async (schemaId, relation) => {
    try {
      const response = await schemaApi.addRelation(schemaId, {
        name: relation.name,
        fromEntityType: relation.from,
        toEntityType: relation.to,
        description: relation.description,
        direction: relation.direction || 'directed',
        color: relation.color || '#9ca3af',
        style: relation.style || 'solid',
        properties: relation.properties || []
      });
      const newRelation = {
        ...response.relation,
        id: response.relation.id?.toString() || Date.now().toString(),
        from: response.relation.from_entity_type,
        to: response.relation.to_entity_type,
        description: response.relation.description || '',
        direction: response.relation.direction || 'directed',
        color: response.relation.color || '#9ca3af',
        style: response.relation.style || 'solid',
        properties: response.relation.properties || []
      };
      set((state) => ({
        schemas: state.schemas.map(s =>
          s.id === schemaId || s.id === parseInt(schemaId)
            ? { ...s, relations: [...s.relations, newRelation] }
            : s
        )
      }));
      return newRelation;
    } catch (error) {
      console.error('添加关系失败:', error);
      const newRelation = { ...relation, id: Date.now().toString(), properties: relation.properties || [] };
      set((state) => ({
        schemas: state.schemas.map(s =>
          s.id === schemaId || s.id === parseInt(schemaId)
            ? { ...s, relations: [...s.relations, newRelation] }
            : s
        )
      }));
      return newRelation;
    }
  },

  // 更新关系（调用 API）
  updateRelation: async (schemaId, relationId, updates) => {
    set((state) => ({
      schemas: state.schemas.map(s =>
        s.id === schemaId || s.id === parseInt(schemaId)
          ? { ...s, relations: s.relations.map(r => r.id === relationId ? { ...r, ...updates } : r) }
          : s
      )
    }));

    try {
      const schema = get().schemas.find(s => s.id === schemaId || s.id === parseInt(schemaId));
      const relation = schema?.relations.find(r => r.id === relationId);
      if (relation) {
        await schemaApi.updateRelation(schemaId, relationId, {
          name: relation.name,
          fromEntityType: relation.from,
          toEntityType: relation.to,
          description: relation.description,
          direction: relation.direction,
          color: relation.color,
          style: relation.style,
          properties: relation.properties || []
        });
      }
    } catch (error) {
      console.error('更新关系失败:', error);
    }
  },

  // 删除关系（调用 API）
  deleteRelation: async (schemaId, relationId) => {
    set((state) => ({
      schemas: state.schemas.map(s =>
        s.id === schemaId || s.id === parseInt(schemaId)
          ? { ...s, relations: s.relations.filter(r => r.id !== relationId) }
          : s
      )
    }));

    try {
      await schemaApi.deleteRelation(schemaId, relationId);
    } catch (error) {
      console.error('删除关系失败:', error);
    }
  },
  exportSchema: (schemaId) => { const schema = get().schemas.find(s => s.id === schemaId); if (schema) { const link = document.createElement('a'); link.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(schema, null, 2)); link.download = `${schema.name}_schema.json`; link.click(); } },
  importSchema: (jsonData) => set((state) => { try { const schema = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData; if (schema?.name) { const newSchema = { ...schema, id: Date.now().toString() }; return { schemas: [...state.schemas, newSchema], currentSchemaId: newSchema.id }; } } catch (e) { console.error(e); } return state; }),
  getCurrentSchema: () => {
    const state = get();
    if (state.schemas.length === 0) return null;
    return state.schemas.find(s => s.id === state.currentSchemaId) || state.schemas[0];
  },
}));

// ============ Case Store ============
export const useCaseStore = create((set, get) => ({
  cases: [],
  currentCaseId: null,
  isLoading: false,

  // 从 API 加载案例
  loadCases: async () => {
    set({ isLoading: true });
    try {
      const response = await caseApi.getAll();
      const cases = response.cases || [];

      // 处理 API 返回的数据格式
      const processedCases = cases.map(c => ({
        ...c,
        id: c.id?.toString(),
        schemaId: c.schemaId || c.schema_id?.toString(),
        entities: (c.entities || []).map(e => ({
          ...e,
          id: e.id?.toString(),
          entityType: e.entityType || e.entity_type
        })),
        relations: (c.relations || []).map(r => ({
          ...r,
          id: r.id?.toString(),
          sourceId: r.sourceId || r.source_entity_id?.toString(),
          targetId: r.targetId || r.target_entity_id?.toString(),
          name: r.name || r.relation_type
        }))
      }));

      set({
        cases: processedCases,
        currentCaseId: processedCases[0]?.id?.toString() || null,
        isLoading: false
      });
    } catch (error) {
      console.error('加载案例失败:', error);
      set({ isLoading: false });
    }
  },

  // 创建案例（调用 API）
  createCase: async (caseData) => {
    try {
      const response = await caseApi.create(caseData);
      const newCase = {
        ...response.case,
        id: response.case.id?.toString(),
        schemaId: response.case.schema_id?.toString() || caseData.schemaId,
        entities: [],
        relations: []
      };
      set((state) => ({ cases: [...state.cases, newCase] }));
      return newCase;
    } catch (error) {
      console.error('创建案例失败:', error);
      throw error;
    }
  },

  addCase: (caseData) => set((state) => ({
    cases: [...state.cases, {
      ...caseData,
      id: caseData.id || Date.now().toString(),
      entities: caseData.entities || [],
      relations: caseData.relations || []
    }]
  })),
  updateCase: (id, updates) => set((state) => ({ cases: state.cases.map(c => c.id === id ? { ...c, ...updates } : c) })),

  // 删除案例（调用 API）
  deleteCase: async (id) => {
    // 先更新本地状态
    set((state) => ({
      cases: state.cases.filter(c => c.id !== id),
      currentCaseId: state.currentCaseId === id ? null : state.currentCaseId
    }));

    // 调用 API 删除
    try {
      await caseApi.delete(id);
    } catch (error) {
      console.error('删除案例失败:', error);
    }
  },

  setCurrentCase: (id) => set({ currentCaseId: id?.toString() }),
  getCurrentCase: () => get().cases.find(c => c.id === get().currentCaseId),

  // 添加实体到案例
  addEntityToCase: async (caseId, entity) => {
    try {
      const response = await caseApi.addEntity(caseId, {
        name: entity.name,
        entityType: entity.entityType,
        properties: entity.properties
      });
      const newEntity = {
        ...response.entity,
        id: response.entity.id?.toString(),
        entityType: response.entity.entity_type || entity.entityType,
        properties: response.entity.properties || entity.properties
      };

      // 更新本地状态
      set((state) => ({
        cases: state.cases.map(c =>
          c.id === caseId || c.id === parseInt(caseId)
            ? { ...c, entities: [...(c.entities || []), newEntity] }
            : c
        )
      }));

      return newEntity;
    } catch (error) {
      console.error('添加实体失败:', error);
      // 本地 fallback
      const newEntity = { ...entity, id: Date.now().toString() };
      set((state) => ({
        cases: state.cases.map(c =>
          c.id === caseId ? { ...c, entities: [...(c.entities || []), newEntity] } : c
        )
      }));
      return newEntity;
    }
  },

  // 添加关系到案例
  addRelationToCase: async (caseId, relation) => {
    try {
      const response = await caseApi.addRelation(caseId, {
        sourceEntityId: relation.sourceId,
        targetEntityId: relation.targetId,
        relationType: relation.name
      });
      const newRelation = {
        ...response.relation,
        id: response.relation.id?.toString(),
        sourceId: response.relation.source_entity_id?.toString() || relation.sourceId,
        targetId: response.relation.target_entity_id?.toString() || relation.targetId,
        name: response.relation.relation_type || relation.name
      };

      // 更新本地状态
      set((state) => ({
        cases: state.cases.map(c =>
          c.id === caseId || c.id === parseInt(caseId)
            ? { ...c, relations: [...(c.relations || []), newRelation] }
            : c
        )
      }));

      return newRelation;
    } catch (error) {
      console.error('添加关系失败:', error);
      // 本地 fallback
      const newRelation = { ...relation, id: Date.now().toString() };
      set((state) => ({
        cases: state.cases.map(c =>
          c.id === caseId ? { ...c, relations: [...(c.relations || []), newRelation] } : c
        )
      }));
      return newRelation;
    }
  },

  // 从案例删除实体（调用 API）
  deleteEntityFromCase: async (caseId, entityId) => {
    set((state) => ({
      cases: state.cases.map(c =>
        c.id === caseId ? {
          ...c,
          entities: c.entities.filter(e => e.id !== entityId),
          relations: c.relations.filter(r => r.sourceId !== entityId && r.targetId !== entityId)
        } : c
      )
    }));

    try {
      await caseApi.deleteEntity(caseId, entityId);
    } catch (error) {
      console.error('删除实体失败:', error);
    }
  },

  // 从案例删除关系（调用 API）
  deleteRelationFromCase: async (caseId, relationId) => {
    set((state) => ({
      cases: state.cases.map(c =>
        c.id === caseId ? { ...c, relations: c.relations.filter(r => r.id !== relationId) } : c
      )
    }));

    try {
      await caseApi.deleteRelation(caseId, relationId);
    } catch (error) {
      console.error('删除关系失败:', error);
    }
  },
}));

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

    // 过滤当前 schema 下的所有案例（兼容字符串和数字类型）
    const schemaCases = allCases.filter(c =>
      c.schemaId === currentSchemaId ||
      c.schemaId === parseInt(currentSchemaId) ||
      parseInt(c.schemaId) === parseInt(currentSchemaId)
    );

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
    const nodeData = { id: entity.id, name: entity.name, type: entity.type || entity.entityType, properties: entity.properties, x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 };
    return ({
    allNodes: [...state.allNodes, nodeData],
    nodes: [...state.nodes, nodeData]
  })}),
  addLinkToGraph: (relation) => set((state) => ({
    allLinks: [...state.allLinks, { id: relation.id, source: relation.source || relation.sourceId, target: relation.target || relation.targetId, name: relation.name }],
    links: [...state.links, { id: relation.id, source: relation.source || relation.sourceId, target: relation.target || relation.targetId, name: relation.name }]
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

  addMessage: (message) => set((state) => ({ messages: [...state.messages, { ...message, id: Date.now(), timestamp: new Date() }] })),
  setThinking: (isThinking) => set({ isThinking }),
  setContext: (context) => set({ currentContext: context }),
  clearMessages: () => set({ messages: [] }),
}));

// ============ Agent Store ============
export const useAgentStore = create((set, get) => ({
  // Agent 列表
  agents: [],
  currentAgentName: 'schema_builder', // 'schema_builder' | 'case_extractor' | 'analysis_assistant'

  // 各 Agent 的会话状态
  sessions: {
    schema_builder: { sessionId: null, messages: [], isThinking: false },
    case_extractor: { sessionId: null, messages: [], isThinking: false, extractResult: null },
    analysis_assistant: { sessionId: null, messages: [], isThinking: false, ragContext: [] },
  },

  // 会话历史列表
  sessionHistory: [],

  // 加载 Agent 列表
  loadAgents: async () => {
    try {
      const data = await agentApi.getAll();
      set({ agents: data.agents || [] });
    } catch (error) {
      console.error('加载 Agent 列表失败:', error);
    }
  },

  // 加载会话历史列表
  loadSessionHistory: async (agentName) => {
    try {
      const data = await chatApi.getSessions(agentName);
      set({ sessionHistory: data.sessions || [] });
    } catch (error) {
      console.error('加载会话历史失败:', error);
    }
  },

  // 加载特定会话的聊天记录
  loadSessionMessages: async (sessionId) => {
    try {
      const data = await chatApi.getSessionHistory(sessionId);
      const { currentAgentName, sessions } = get();

      // 转换数据库格式为前端格式
      const messages = (data.messages || []).map(msg => ({
        role: msg.role,
        content: msg.content,
        id: msg.id
      }));

      set({
        sessions: {
          ...sessions,
          [currentAgentName]: {
            ...sessions[currentAgentName],
            sessionId,
            messages,
            isThinking: false
          }
        }
      });
    } catch (error) {
      console.error('加载聊天记录失败:', error);
    }
  },

  // 开始新会话
  startNewSession: () => {
    const { currentAgentName, sessions } = get();
    const agentDefaults = {
      schema_builder: { sessionId: null, messages: [], isThinking: false },
      case_extractor: { sessionId: null, messages: [], isThinking: false, extractResult: null },
      analysis_assistant: { sessionId: null, messages: [], isThinking: false, ragContext: [] },
    };

    set({
      sessions: {
        ...sessions,
        [currentAgentName]: agentDefaults[currentAgentName]
      }
    });
  },

  // 删除会话
  deleteSession: async (sessionId) => {
    try {
      const { currentAgentName } = get();
      await chatApi.deleteSession(currentAgentName, sessionId);

      // 刷新历史列表
      get().loadSessionHistory(currentAgentName);

      // 如果删除的是当前会话，开始新会话
      const { sessions } = get();
      if (sessions[currentAgentName].sessionId === sessionId) {
        get().startNewSession();
      }
    } catch (error) {
      console.error('删除会话失败:', error);
    }
  },

  // 切换 Agent
  setCurrentAgent: (agentName) => set({ currentAgentName: agentName }),

  // 获取当前 Agent 会话
  getCurrentSession: () => {
    const { currentAgentName, sessions } = get();
    return sessions[currentAgentName] || { sessionId: null, messages: [], isThinking: false };
  },

  // 清空当前 Agent 会话
  clearCurrentSession: async () => {
    const { currentAgentName, sessions } = get();
    const session = sessions[currentAgentName];

    // 如果有服务端会话，清除它
    if (session.sessionId) {
      try {
        await fetch(`/api/agents/${currentAgentName}/sessions/${session.sessionId}`, {
          method: 'DELETE'
        });
      } catch (error) {
        console.error('清除会话失败:', error);
      }
    }

    set({
      sessions: {
        ...sessions,
        [currentAgentName]: {
          sessionId: null,
          messages: [],
          isThinking: false,
          extractResult: null,
          ragContext: []
        }
      }
    });
  },

  // 调用 Agent (流式)
  invokeAgent: async (userInput, context = {}) => {
    const { currentAgentName, sessions } = get();
    const session = sessions[currentAgentName];

    // 添加用户消息
    const userMessage = { role: 'user', content: userInput, id: Date.now() };
    const assistantMessageId = Date.now() + 1;

    // 添加一个空的助手消息用于流式更新
    const assistantMessage = {
      role: 'assistant',
      content: '',
      id: assistantMessageId,
      isStreaming: true
    };

    set({
      sessions: {
        ...sessions,
        [currentAgentName]: {
          ...session,
          messages: [...session.messages, userMessage, assistantMessage],
          isThinking: true
        }
      }
    });

    // 流式更新助手消息
    const onChunk = (chunk, fullContent) => {
      const currentSessions = get().sessions;
      const currentMessages = currentSessions[currentAgentName].messages;

      set({
        sessions: {
          ...currentSessions,
          [currentAgentName]: {
            ...currentSessions[currentAgentName],
            messages: currentMessages.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: fullContent, isStreaming: true }
                : msg
            )
          }
        }
      });
    };

    const onDone = (fullResponse, sessionId, outputFromServer) => {
      const currentSessions = get().sessions;
      const currentMessages = currentSessions[currentAgentName].messages;

      // 优先使用服务端解析的输出，否则本地解析
      let output = outputFromServer || null;
      if (!output) {
        try {
          const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            output = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.error('JSON parse error:', e);
        }
      }

      set({
        sessions: {
          ...currentSessions,
          [currentAgentName]: {
            sessionId,
            messages: currentMessages.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: fullResponse, isStreaming: false, output }
                : msg
            ),
            isThinking: false,
            extractResult: (currentAgentName === 'case_extractor' || currentAgentName === 'schema_builder') ? output : null
          }
        }
      });

      // 刷新历史列表
      get().loadSessionHistory(currentAgentName);
    };

    const onError = (error) => {
      const currentSessions = get().sessions;
      const currentMessages = currentSessions[currentAgentName].messages;

      set({
        sessions: {
          ...currentSessions,
          [currentAgentName]: {
            ...currentSessions[currentAgentName],
            messages: currentMessages.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: `错误: ${error}`, isStreaming: false, isError: true }
                : msg
            ),
            isThinking: false
          }
        }
      });
    };

    await agentApi.invokeStream(
      currentAgentName,
      {
        session_id: session.sessionId,
        user_input: userInput,
        context
      },
      onChunk,
      onDone,
      onError
    );
  },

  // Schema构建专用方法
  buildSchema: async (description) => {
    return get().invokeAgent(description);
  },

  // 案例拆解专用方法
  extractFromCase: async (schemaId, caseId, caseText) => {
    return get().invokeAgent(caseText, {
      schema_id: schemaId,
      case_id: caseId,
      case_text: caseText
    });
  },

  // 对话分析专用方法
  analyze: async (question, context = {}) => {
    return get().invokeAgent(question, context);
  },

  // 设置提取结果（用于前端直接设置）
  setExtractResult: (result) => {
    const { currentAgentName, sessions } = get();
    set({
      sessions: {
        ...sessions,
        [currentAgentName]: {
          ...sessions[currentAgentName],
          extractResult: result
        }
      }
    });
  }
}));

// ============ Extraction Pipeline Store ============
export const useExtractionStore = create((set, get) => ({
  // 流水线阶段
  phase: 'idle', // idle | parsing | planning | extracting | consistency_checking | inferring_relations | finalizing | completed | error
  phaseLabel: '',

  // 当前案例和 Schema
  currentCaseId: null,
  currentSchemaId: null,
  caseText: '',

  // 提取计划
  plan: null,

  // 候选实体卡片（按类型分组）
  candidates: {}, // { [entityType]: [{ id, name, entityType, properties, evidence, status }] }

  // 候选关系
  relationCandidates: [],

  // 文本片段（溯源）
  segments: [],

  // 进度
  progress: null,

  // 加载状态
  isProcessing: false,
  currentEntityType: null,

  // 设置基础信息
  setContext: (caseId, schemaId, caseText) => set({
    currentCaseId: caseId,
    currentSchemaId: schemaId,
    caseText,
    phase: 'idle',
    phaseLabel: '准备开始',
    candidates: {},
    relationCandidates: [],
    segments: [],
    plan: null,
    progress: null,
    isProcessing: false,
    currentEntityType: null,
  }),

  // 设置阶段
  setPhase: (phase, label) => set({ phase, phaseLabel: label || phase }),

  // 解析文本
  parseText: async () => {
    const { currentCaseId, caseText, currentSchemaId } = get();
    if (!currentCaseId || !caseText) return;

    set({ phase: 'parsing', phaseLabel: '解析文本中...', isProcessing: true });
    try {
      const res = await extractionApi.parseText(currentCaseId, caseText, currentSchemaId);
      set({ segments: res.data?.segments || [], phase: 'planning', phaseLabel: '生成提取计划...', isProcessing: false });
      return res;
    } catch (e) {
      set({ phase: 'error', phaseLabel: `解析失败: ${e.message}`, isProcessing: false });
      throw e;
    }
  },

  // 生成计划
  generatePlan: async () => {
    const { currentCaseId, currentSchemaId } = get();
    if (!currentCaseId) return;

    set({ phase: 'planning', phaseLabel: '生成提取计划...', isProcessing: true });
    try {
      const res = await extractionApi.generatePlan(currentCaseId, currentSchemaId);
      set({ plan: res.data?.plan || null, phase: 'extracting', phaseLabel: '开始提取', isProcessing: false });
      return res;
    } catch (e) {
      set({ phase: 'error', phaseLabel: `规划失败: ${e.message}`, isProcessing: false });
      throw e;
    }
  },

  // 提取某类实体
  extractType: async (entityType) => {
    const { currentCaseId, currentSchemaId } = get();
    if (!currentCaseId) return;

    set({ phase: 'extracting', phaseLabel: `提取「${entityType}」...`, isProcessing: true, currentEntityType: entityType });
    try {
      const res = await extractionApi.extractEntities(currentCaseId, entityType, currentSchemaId);
      const entities = res.data?.entities || [];

      // 一致性检查
      set({ phase: 'consistency_checking', phaseLabel: '检查一致性...' });
      let finalEntities = entities;
      if (entities.length > 1) {
        try {
          const consistencyRes = await extractionApi.checkConsistency(currentCaseId, entityType, entities);
          finalEntities = consistencyRes.data?.candidates || entities;
        } catch {
          // 一致性检查失败，使用原始结果
        }
      }

      set((state) => ({
        candidates: { ...state.candidates, [entityType]: finalEntities },
        phase: 'extracting',
        phaseLabel: '提取中',
        isProcessing: false,
        currentEntityType: null,
      }));

      // 更新进度
      get().loadProgress();
      return { entities: finalEntities };
    } catch (e) {
      set({ phase: 'error', phaseLabel: `提取「${entityType}」失败: ${e.message}`, isProcessing: false, currentEntityType: null });
      throw e;
    }
  },

  // 并行提取所有类型实体
  extractAllParallel: async () => {
    const { currentCaseId, currentSchemaId, plan } = get();
    if (!currentCaseId || !plan) return;

    set({ phase: 'extracting', phaseLabel: '并行提取中...', isProcessing: true });
    try {
      const res = await extractionApi.extractAllEntities(currentCaseId, currentSchemaId);
      const candidates = res.data?.candidates || {};

      // 对每个有实体的类型做一致性检查
      set({ phase: 'consistency_checking', phaseLabel: '检查一致性...' });
      const finalCandidates = {};
      for (const [entityType, entities] of Object.entries(candidates)) {
        let finalEntities = entities;
        if (entities.length > 1) {
          try {
            const consistencyRes = await extractionApi.checkConsistency(currentCaseId, entityType, entities);
            finalEntities = consistencyRes.data?.candidates || entities;
          } catch {
            // 一致性检查失败，使用原始结果
          }
        }
        finalCandidates[entityType] = finalEntities;
      }

      // 基于候选实体推断关系（不依赖 DB）
      set({ phase: 'inferring_relations', phaseLabel: '推断关系中...' });
      try {
        const allEntities = Object.values(finalCandidates).flat();
        const relationRes = await extractionApi.inferRelations(currentCaseId, currentSchemaId, allEntities);
        const relations = relationRes.data?.relations || [];
        set({ relationCandidates: relations });
      } catch (e) {
        console.error('关系推断失败:', e.message);
      }

      set({
        candidates: finalCandidates,
        phase: 'extracting',
        phaseLabel: '提取完成，请审核',
        isProcessing: false,
        currentEntityType: null,
      });

      get().loadProgress();
      return { candidates: finalCandidates };
    } catch (e) {
      set({ phase: 'error', phaseLabel: `并行提取失败: ${e.message}`, isProcessing: false, currentEntityType: null });
      throw e;
    }
  },

  // 更新卡片状态
  updateCardStatus: (entityType, cardId, status) => set((state) => ({
    candidates: {
      ...state.candidates,
      [entityType]: (state.candidates[entityType] || []).map(c =>
        c.id === cardId ? { ...c, status } : c
      )
    }
  })),

  // 批量更新卡片状态
  batchUpdateCardStatus: (entityType, cardIds, status) => set((state) => ({
    candidates: {
      ...state.candidates,
      [entityType]: (state.candidates[entityType] || []).map(c =>
        cardIds.includes(c.id) ? { ...c, status } : c
      )
    }
  })),

  // 推断关系
  inferRelations: async () => {
    const { currentCaseId, currentSchemaId } = get();
    if (!currentCaseId) return;

    set({ phase: 'inferring_relations', phaseLabel: '推断关系中...', isProcessing: true });
    try {
      const res = await extractionApi.inferRelations(currentCaseId, currentSchemaId);
      const relations = res.data?.relations || [];
      set({ relationCandidates: relations, phase: 'finalizing', phaseLabel: '审核关系', isProcessing: false });
      return res;
    } catch (e) {
      set({ phase: 'error', phaseLabel: `关系推断失败: ${e.message}`, isProcessing: false });
      throw e;
    }
  },

  // 更新关系状态
  updateRelationStatus: (relationId, status) => set((state) => ({
    relationCandidates: state.relationCandidates.map(r =>
      r.id === relationId ? { ...r, status } : r
    )
  })),

  // 保存所有已审核的实体和关系，完成提取
  finalize: async () => {
    const { currentCaseId } = get();
    if (!currentCaseId) return;

    set({ phase: 'finalizing', phaseLabel: '保存中...', isProcessing: true });
    try {
      const token = authHelper.getToken();
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      };

      // 收集所有 approved 的实体和关系
      const { candidates, relationCandidates } = get();
      const approvedEntities = Object.values(candidates).flat().filter(c => c.status === 'approved');
      const approvedRelations = relationCandidates?.filter(r => r.status === 'approved') || [];

      // 批量保存实体
      if (approvedEntities.length > 0) {
        await fetch(`${API_BASE_URL}/extraction/${currentCaseId}/batch-save-entities`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ entities: approvedEntities.map(c => ({
            name: c.name,
            entityType: c.entityType,
            properties: c.properties
          })), autoEmbed: false }),
        });
      }

      // 批量保存已审核的关系
      if (approvedRelations.length > 0) {
        await fetch(`${API_BASE_URL}/extraction/${currentCaseId}/batch-save-relations`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ relations: approvedRelations, autoEmbed: false }),
        });
      }

      // 调用后端 finalize：标记 completed + 触发 autoEmbed
      await fetch(`${API_BASE_URL}/extraction/${currentCaseId}/finalize`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ autoEmbed: true }),
      });

      set({ phase: 'completed', phaseLabel: '提取完成', isProcessing: false });
      return { success: true };
    } catch (e) {
      set({ phase: 'error', phaseLabel: `保存失败: ${e.message}`, isProcessing: false });
      throw e;
    }
  },

  // 加载进度
  loadProgress: async (caseId) => {
    const { currentCaseId } = get();
    const cid = caseId || currentCaseId;
    if (!cid) return;
    try {
      const res = await extractionApi.getProgress(cid);
      set({ progress: res });
    } catch (e) {
      console.error('加载进度失败:', e);
    }
  },

  // 加载文本片段
  loadSegments: async (caseId) => {
    const { currentCaseId } = get();
    const cid = caseId || currentCaseId;
    if (!cid) return;
    try {
      const res = await extractionApi.getSegments(cid);
      set({ segments: res.segments || [] });
    } catch (e) {
      console.error('加载片段失败:', e);
    }
  },

  // 重置
  reset: () => set({
    phase: 'idle',
    phaseLabel: '准备开始',
    plan: null,
    candidates: {},
    relationCandidates: [],
    segments: [],
    progress: null,
    isProcessing: false,
    currentEntityType: null,
  }),
}));