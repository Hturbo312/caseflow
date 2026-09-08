import { create } from 'zustand';
import { schemaApi, caseApi, authApi, agentApi, chatApi, extractionApi } from '../services/api';
import { authHelper, API_BASE_URL } from '../utils';

import { DEFAULT_SCHEMA, DEFAULT_CASES } from './demoData';
import { useCaseStore } from './caseStore';
import { useGraphStore } from './graphStore';
// ============ Schema Store ============
export const useSchemaStore = create((set, get) => ({
  currentSchemaId: null,
  schemas: [],
  isLoading: false,

  setCurrentSchema: (id) => {
    if (id != null) { try { localStorage.setItem('cf_schema_id', String(id)); } catch {} }
    set({ currentSchemaId: id });
  },

  // 访客演示模式：装载内置演示 Schema，免登录即可浏览图谱
  loadDemoSchema: () => set({ schemas: [{ ...DEFAULT_SCHEMA }], currentSchemaId: 'default', isLoading: false }),

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
          // 2.0：默认优先论文 Schema 9（Dynamic Schema v1.0），其次兼容旧默认 3
          currentSchemaId: (() => {
            try {
              const saved = localStorage.getItem('cf_schema_id');
              if (saved && fullSchemas.some(x => String(x.id) === String(saved))) return String(saved);
            } catch {}
            return (fullSchemas.find(s => s.id === '9') || fullSchemas.find(s => s.id === '3') || fullSchemas[0])?.id?.toString() || null;
          })(),
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
    // 保存旧状态以便回滚
    const prevState = useSchemaStore.getState();
    const deletedSchema = prevState.schemas.find(s => s.id === id);
    // 使用 String() 比较避免类型不一致（currentSchemaId 可能是字符串或数字）
    const wasCurrentSchema = String(prevState.currentSchemaId) === String(id);

    // 乐观更新：先更新本地
    set((state) => {
      const newSchemas = state.schemas.filter(s => s.id !== id);
      return {
        schemas: newSchemas,
        currentSchemaId: String(state.currentSchemaId) === String(id) ? (newSchemas[0]?.id || null) : state.currentSchemaId
      };
    });

    try {
      await schemaApi.delete(id);
      // 删除成功后刷新案例列表和图谱（确保 schema 切换后数据一致）
      if (wasCurrentSchema) {
        useCaseStore.getState().loadCases().catch(e => console.error('[deleteSchema] loadCases 失败:', e));
      }
      // 始终重载图谱，防止 currentSchemaId 未变但 cases 的 schema_id 被 SET NULL 导致图谱空白
      useGraphStore.getState().loadAllCasesToGraph();
    } catch (error) {
      console.error('删除 Schema 失败:', error);
      // 回滚本地状态
      if (deletedSchema) {
        set((state) => ({
          schemas: [...state.schemas, deletedSchema].sort((a, b) => a.id - b.id),
          currentSchemaId: state.currentSchemaId || deletedSchema.id,
        }));
      }
      throw error; // 向上传播以便 UI 提示用户
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
        description: entityType.description || '',
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
          description: entity.description || '',
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
