import React, { memo, useState, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, Network, LayoutList } from 'lucide-react';
import { useExtractionStore, useSchemaStore } from '@store';
import { useToastStore } from '@components/Toast/ToastStore.js';
import ConfirmModal from '@components/Toast/ConfirmModal';
import { useI18n } from '../../../../../i18n';
import { API_BASE_URL, authHelper } from '../../../../../utils';
import ProgressPanel from './ProgressPanel';
import CardReviewPanel from './CardReviewPanel';
import RelationReviewPanel from './RelationReviewPanel';
import SegmentViewer from './SegmentViewer';
import PipelineControls from './PipelineControls';

// 合并候选实体和 DB 实体，优先使用 DB 实体的 color
function mergeEntities(candidates, dbEntities) {
  const byName = new Map();
  // 先放 DB 实体（有 color）
  for (const e of dbEntities) {
    byName.set(e.name, { name: e.name, color: e.color || '#9ca3af', entityType: e.entity_type });
  }
  // 再放候选实体（补充 DB 中没有的），但不覆盖已有的 color
  for (const c of candidates) {
    if (!byName.has(c.name)) {
      byName.set(c.name, { name: c.name, color: c.color || '#9ca3af', entityType: c.entityType });
    }
  }
  return Array.from(byName.values());
}

const ExtractionPipeline = memo(({ caseId, caseText, onComplete }) => {
  const { t } = useI18n();
  const toast = useToastStore();
  const {
    phase, phaseLabel, isProcessing, plan, candidates, relationCandidates,
    segments, currentSchemaId, setContext, setPhase, parseText, generatePlan,
    extractType, extractAllParallel, updateCardStatus, batchUpdateCardStatus, updateRelationStatus,
    inferRelations, loadSegments, loadProgress,
  } = useExtractionStore();

  const { currentSchema } = useSchemaStore();
  const [activeTab, setActiveTab] = useState('progress'); // progress | entities | relations | segments
  const [dbEntities, setDbEntities] = useState([]); // 从数据库加载的已保存实体（含 color）
  const [pendingRelationsConfirm, setPendingRelationsConfirm] = useState(false); // 待审核关系确认弹窗

  // 初始化
  useEffect(() => {
    if (caseId && caseText) {
      setContext(caseId, currentSchemaId, caseText);
    }
  }, [caseId, caseText]);

  // 已提取的类型
  const extractedTypes = Object.keys(candidates);

  // 已审核的实体数量（用于控制 Finalize 按钮可用性）
  const approvedEntityCount = Object.values(candidates).flat().filter(c => c.status === 'approved').length;

  // 当前激活的实体类型（第一个未审完的）
  const activeEntityType = plan?.find(p => !extractedTypes.includes(p.entity_type))?.entity_type
    || extractedTypes[0];

  const handleParseText = useCallback(async () => {
    try {
      await parseText();
      await loadSegments(caseId);
      await loadProgress(caseId);
    } catch (e) {
      console.error('解析文本失败:', e);
    }
  }, [caseId, parseText, loadSegments, loadProgress]);

  const handleGeneratePlan = useCallback(async () => {
    try {
      await generatePlan();
      await loadProgress(caseId);
    } catch (e) {
      console.error('生成计划失败:', e);
    }
  }, [generatePlan, loadProgress]);

  const handleExtractType = useCallback(async (entityType) => {
    try {
      await extractType(entityType);
    } catch (e) {
      console.error(`提取 ${entityType} 失败:`, e);
    }
  }, [extractType]);

  const handleExtractAll = useCallback(async () => {
    try {
      await extractAllParallel();
    } catch (e) {
      console.error('并行提取失败:', e);
    }
  }, [extractAllParallel]);

  const handleInferRelations = useCallback(async () => {
    try {
      await inferRelations();
      setActiveTab('relations');
    } catch (e) {
      console.error('关系推断失败:', e);
    }
  }, [inferRelations]);

  // 核心 finalize 执行逻辑（独立函数，供 handleFinalize 和确认弹窗共用）
  const executeFinalize = useCallback(async () => {
    try {
      setPhase('finalizing', t('ai.saving'));
      const token = authHelper.getToken();

      // 1. 保存已审核的实体（直接调用 API，不经过 store 的 finalize）
      const approvedEntities = Object.values(candidates).flat().filter(c => c.status === 'approved');
      if (approvedEntities.length > 0) {
        // 从 schema 的 entityTypes 中获取颜色，补充到实体数据中
        const schemaEntityTypes = currentSchema?.entityTypes || [];
        const colorMap = new Map(schemaEntityTypes.map(et => [et.name, et.color || null]));
        const entitiesWithColor = approvedEntities.map(e => ({
          name: e.name,
          entityType: e.entityType,
          properties: e.properties || {},
          color: e.color || colorMap.get(e.entityType) || null,
        }));

        const entRes = await fetch(`${API_BASE_URL}/extraction/${caseId}/batch-save-entities`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ entities: entitiesWithColor, autoEmbed: true }),
        });
        if (!entRes.ok) {
          console.error(`[handleFinalize] 实体保存失败: ${entRes.status}`);
          setPhase('error', t('common.saveFailed'));
          return;
        }
        const entData = await entRes.json();
        if (entData.skipped?.length > 0) {
          console.error(`[handleFinalize] 跳过了 ${entData.skipped.length} 个重复实体:`, entData.skipped);
        }
      }

      // 2. 保存已审核的关系（在标记完成之前保存，确保数据完整性）
      const approvedRelations = relationCandidates?.filter(r => r.status === 'approved') || [];
      if (approvedRelations.length > 0) {
        const relRes = await fetch(`${API_BASE_URL}/extraction/${caseId}/batch-save-relations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ relations: approvedRelations, autoEmbed: true }),
        });
        if (relRes.ok) {
          const relData = await relRes.json();
          if (relData.skipped?.length > 0) {
            console.error(`[handleFinalize] 跳过了 ${relData.skipped.length} 条关系:`, relData.skipped);
          }
          // 如果实际保存数量少于已审核数量，说明有部分关系保存失败，应阻断 finalize
          if (relData.saved < approvedRelations.length) {
            console.error(`[handleFinalize] 关系保存不完整: 已审核 ${approvedRelations.length}, 实际保存 ${relData.saved}`);
            toast.error(t('ai.relationSaveIncomplete', { approved: approvedRelations.length, saved: relData.saved }));
            setPhase('error', t('common.saveFailed'));
            return;
          }
        } else {
          console.error(`[handleFinalize] 关系保存失败: ${relRes.status}`);
          toast.error(t('ai.relationSaveFailed'));
          setPhase('error', t('common.saveFailed'));
          return;
        }
      }

      // 3. 调用后端 finalize：标记 case_memory 为 completed + 触发 autoEmbed 安全网
      // autoEmbed 在 batch-save-entities/relations 中已触发（force=false 避免重复），
      // 此处 finalize 的 autoEmbed 作为兜底，确保无遗漏
      const hasEntitiesSaved = approvedEntities.length > 0;
      const finalizeRes = await fetch(`${API_BASE_URL}/extraction/${caseId}/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ relations: approvedRelations, autoEmbed: hasEntitiesSaved, preSaved: approvedRelations.length > 0 }),
      });
      if (finalizeRes.ok) {
        toast.success(t('ai.finalizeSuccess'));
      } else {
        let errorMsg = t('ai.finalizeFailed');
        try {
          const errorData = await finalizeRes.json();
          if (errorData.error) errorMsg = `${t('ai.finalizeFailed')} ${errorData.error}`;
        } catch { /* ignore parse error */ }
        console.error(`[handleFinalize] 后端 finalize 失败: ${finalizeRes.status}`);
        toast.error(errorMsg);
        setPhase('error', t('common.saveFailed'));
        return;
      }

      setPhase('completed', t('ai.caseBreakdownComplete'));
      // 重置提取状态，避免重新打开时显示旧数据
      useExtractionStore.getState().reset();
      if (onComplete) {
        onComplete();
      }
    } catch (e) {
      console.error('[handleFinalize] 保存失败:', e);
      setPhase('error', `${t('common.saveFailed')}: ${e.message}`);
    }
  }, [candidates, onComplete, currentSchema, relationCandidates, caseId, setPhase, t, toast]);

  // 触发 finalize：如有待审核关系则弹窗确认，否则直接执行
  const handleFinalize = useCallback(() => {
    const pendingRels = relationCandidates?.filter(r => r.status === 'pending') || [];
    if (pendingRels.length > 0) {
      setPendingRelationsConfirm(true);
      return;
    }
    executeFinalize();
  }, [relationCandidates, executeFinalize]);

  const handleConfirmPendingRelations = useCallback(() => {
    setPendingRelationsConfirm(false);
    executeFinalize();
  }, [executeFinalize]);

  const handleNext = useCallback(() => {
    handleInferRelations();
  }, [handleInferRelations]);

  const handleReset = useCallback(() => {
    // Reset state
    loadProgress(caseId);
    loadSegments(caseId);
  }, [caseId, loadProgress, loadSegments]);

  // 加载已保存的实体（用于关系审核时显示实体颜色）
  const loadDbEntities = useCallback(async () => {
    if (!caseId) return;
    try {
      const token = authHelper.getToken();
      const res = await fetch(`${API_BASE_URL}/extraction/${caseId}/entities`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setDbEntities(data.entities || []);
      }
    } catch (e) {
      console.error('加载 DB 实体失败:', e);
    }
  }, [caseId]);

  // 计算当前激活的 tab
  useEffect(() => {
    if (phase === 'extracting' || phase === 'consistency_checking') {
      setActiveTab('entities');
    } else if (phase === 'inferring_relations' || phase === 'finalizing') {
      setActiveTab('relations');
    } else if (phase === 'parsing' || phase === 'planning') {
      setActiveTab('progress');
    } else if (phase === 'completed') {
      setActiveTab('progress');
    }
  }, [phase]);

  // caseId 变化时清空旧实体数据，避免跨案例显示残留
  useEffect(() => {
    setDbEntities([]);
  }, [caseId]);

  // 优化：切换到 relations tab 时加载 DB 实体（用于颜色显示）
  // 使用 ref 追踪已加载的 caseId，避免重复请求和 stale closure 问题
  const loadedCaseIdRef = useRef(null);
  useEffect(() => {
    if (activeTab === 'relations' && caseId && loadedCaseIdRef.current !== caseId) {
      loadedCaseIdRef.current = caseId;
      loadDbEntities();
    }
    // caseId 变化时重置追踪，确保新案例重新加载
    if (!caseId) loadedCaseIdRef.current = null;
  }, [activeTab, caseId]);

  const tabs = [
    { id: 'progress', label: t('ai.progress'), icon: LayoutList },
    { id: 'entities', label: t('toolbar.entity'), icon: FileText },
    { id: 'relations', label: t('toolbar.relation'), icon: Network },
    { id: 'segments', label: t('ai.caseText'), icon: FileText },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* 控制面板 */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-gray-100">
        <PipelineControls
          phase={phase}
          isProcessing={isProcessing}
          onParseText={handleParseText}
          onGeneratePlan={handleGeneratePlan}
          onNext={handleNext}
          onFinalize={handleFinalize}
          onReset={handleReset}
          plan={plan}
          extractedTypes={extractedTypes}
          approvedEntityCount={approvedEntityCount}
        />
        {phaseLabel && phase !== 'idle' && phase !== 'completed' && (
          <p className="text-xs text-gray-400 mt-1.5 text-center">{phaseLabel}</p>
        )}
      </div>

      {/* 标签栏 */}
      {(phase === 'extracting' || phase === 'inferring_relations' || phase === 'completed') && (
        <div className="flex-shrink-0 flex border-b border-gray-100 px-3">
          {tabs.map(tab => {
            if (tab.id === 'entities' && phase !== 'extracting' && phase !== 'completed') return null;
            if (tab.id === 'relations' && phase !== 'inferring_relations' && phase !== 'completed') return null;
            if (tab.id === 'segments' && segments.length === 0) return null;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1 px-3 py-2 text-xs font-medium transition-all relative ${
                  activeTab === tab.id ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <tab.icon size={12} />
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div layoutId="extractionTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-3">
        <AnimatePresence mode="wait">
          {activeTab === 'progress' && (
            <motion.div key="progress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ProgressPanel
                phase={phase}
                plan={plan}
                progress={null}
                onExtractType={handleExtractType}
                onExtractAll={handleExtractAll}
                extractedTypes={extractedTypes}
              />
            </motion.div>
          )}

          {activeTab === 'entities' && (
            <motion.div key="entities" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="space-y-4">
                {Object.entries(candidates).map(([entityType, cards]) => (
                  <CardReviewPanel
                    key={entityType}
                    entityType={entityType}
                    cards={cards}
                    currentSchema={currentSchema}
                    onUpdateStatus={(cardId, status) => updateCardStatus(entityType, cardId, status)}
                    onBatchUpdate={(cardIds, status) => batchUpdateCardStatus(entityType, cardIds, status)}
                  />
                ))}
                {Object.keys(candidates).length === 0 && (
                  <p className="text-center text-sm text-gray-400 py-8">{t('ai.noEntitiesYet')}</p>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'relations' && (
            <motion.div key="relations" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <RelationReviewPanel
                relations={relationCandidates}
                entities={mergeEntities(Object.values(candidates).flat(), dbEntities)}
                onUpdateStatus={updateRelationStatus}
              />
            </motion.div>
          )}

          {activeTab === 'segments' && (
            <motion.div key="segments" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SegmentViewer segments={segments} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 待审核关系确认弹窗 */}
      <ConfirmModal
        isOpen={pendingRelationsConfirm}
        onClose={() => setPendingRelationsConfirm(false)}
        onConfirm={handleConfirmPendingRelations}
        title={t('ai.pendingRelationsTitle')}
        message={t('ai.pendingRelationsWarning', { count: relationCandidates?.filter(r => r.status === 'pending').length || 0 })}
        confirmText={t('ai.confirmFinalizeAnyway')}
        cancelText={t('common.cancel')}
        variant="warning"
      />
    </div>
  );
});

ExtractionPipeline.displayName = 'ExtractionPipeline';

export default ExtractionPipeline;
