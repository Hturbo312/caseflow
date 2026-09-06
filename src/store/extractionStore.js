import { create } from 'zustand';
import { schemaApi, caseApi, authApi, agentApi, chatApi, extractionApi } from '../services/api';
import { authHelper, API_BASE_URL } from '../utils';

import { useSchemaStore } from './schemaStore';
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

  // 注意：finalize 已迁移至组件层（ExtractionPipeline.executeFinalize / CaseExtractor.handleConfirmSave）
  // 此函数保留仅作向后兼容，建议使用组件层的最终保存逻辑
  finalize: async () => {
    const { currentCaseId, candidates, relationCandidates } = get();
    if (!currentCaseId) return;

    set({ phase: 'finalizing', phaseLabel: '保存中...', isProcessing: true });
    try {
      const token = authHelper.getToken();
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      };

      const approvedEntities = Object.values(candidates).flat().filter(c => c.status === 'approved');
      const approvedRelations = relationCandidates?.filter(r => r.status === 'approved') || [];

      if (approvedEntities.length > 0) {
        const schemaEntityTypes = useSchemaStore.getState().currentSchema?.entityTypes || [];
        const colorMap = new Map(schemaEntityTypes.map(et => [et.name, et.color || null]));
        await fetch(`${API_BASE_URL}/extraction/${currentCaseId}/batch-save-entities`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            entities: approvedEntities.map(c => ({
              name: c.name,
              entityType: c.entityType,
              properties: c.properties,
              color: c.color || colorMap.get(c.entityType) || null,
            })),
            autoEmbed: true,
          }),
        });
      }

      if (approvedRelations.length > 0) {
        await fetch(`${API_BASE_URL}/extraction/${currentCaseId}/batch-save-relations`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ relations: approvedRelations, autoEmbed: true }),
        });
      }

      await fetch(`${API_BASE_URL}/extraction/${currentCaseId}/finalize`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ relations: approvedRelations, autoEmbed: approvedEntities.length > 0, preSaved: false }),
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

