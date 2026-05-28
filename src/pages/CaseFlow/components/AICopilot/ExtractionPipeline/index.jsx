import React, { memo, useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, Network, LayoutList } from 'lucide-react';
import { useExtractionStore, useSchemaStore } from '@store';
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
  const {
    phase, phaseLabel, isProcessing, plan, candidates, relationCandidates,
    segments, currentSchemaId, setContext, parseText, generatePlan,
    extractType, extractAllParallel, updateCardStatus, batchUpdateCardStatus, updateRelationStatus,
    inferRelations, finalize, loadSegments, loadProgress,
  } = useExtractionStore();

  const { currentSchema } = useSchemaStore();
  const [activeTab, setActiveTab] = useState('progress'); // progress | entities | relations | segments
  const [dbEntities, setDbEntities] = useState([]); // 从数据库加载的已保存实体（含 color）

  // 初始化
  useEffect(() => {
    if (caseId && caseText) {
      setContext(caseId, currentSchemaId, caseText);
    }
  }, [caseId, caseText]);

  // 已提取的类型
  const extractedTypes = Object.keys(candidates);

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

  const handleFinalize = useCallback(async () => {
    try {
      // 1. 先通过 store 保存已审核的实体
      const result = await finalize();
      if (!result?.success) return;

      // 2. 保存已审核的关系
      const approvedRelations = relationCandidates?.filter(r => r.status === 'approved') || [];
      if (approvedRelations.length > 0) {
        const token = authHelper.getToken();
        const relRes = await fetch(`${API_BASE_URL}/extraction/${caseId}/batch-save-relations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ relations: approvedRelations }),
        });
        if (relRes.ok) {
          const relData = await relRes.json();
          console.log(`[handleFinalize] 保存了 ${relData.saved ?? approvedRelations.length} 条关系`);
          if (relData.skipped?.length > 0) {
            console.warn(`[handleFinalize] 跳过了 ${relData.skipped.length} 条关系:`, relData.skipped);
          }
        } else {
          console.error(`[handleFinalize] 关系保存失败: ${relRes.status}`);
        }
      }

      // 3. 调用后端 finalize 接口：标记 case_memory 为 completed + 触发 autoEmbed
      const token = authHelper.getToken();
      const finalizeRes = await fetch(`${API_BASE_URL}/extraction/${caseId}/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ relations: [], autoEmbed: true }),
      });
      if (finalizeRes.ok) {
        const finalizeData = await finalizeRes.json();
        console.log(`[handleFinalize] 后端 finalize 完成:`, finalizeData.data);
      } else {
        console.warn(`[handleFinalize] 后端 finalize 失败: ${finalizeRes.status}`);
      }

      if (onComplete) {
        onComplete();
      }
    } catch (e) {
      console.error('保存失败:', e);
    }
  }, [finalize, onComplete, relationCandidates, caseId]);

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

  // 切换到 relations tab 时加载 DB 实体（用于颜色显示）
  useEffect(() => {
    if (activeTab === 'relations' && dbEntities.length === 0) {
      loadDbEntities();
    }
  }, [activeTab, dbEntities.length, loadDbEntities]);

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
                  <p className="text-center text-sm text-gray-400 py-8">{t('pipeline.noEntitiesYet')}</p>
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
    </div>
  );
});

ExtractionPipeline.displayName = 'ExtractionPipeline';

export default ExtractionPipeline;
