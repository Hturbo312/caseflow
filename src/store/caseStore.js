import { create } from 'zustand';
import { schemaApi, caseApi, authApi, agentApi, chatApi, extractionApi } from '../services/api';
import { authHelper, API_BASE_URL } from '../utils';

import { DEFAULT_SCHEMA, DEFAULT_CASES } from './demoData';
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

  // 访客演示模式：装载内置演示案例（只读，写操作会引导登录）
  loadDemoCases: () => set(() => ({
    cases: DEFAULT_CASES.map(c => ({ ...c, isDemo: true })),
    currentCaseId: DEFAULT_CASES[0]?.id || null,
    isLoading: false,
  })),

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
