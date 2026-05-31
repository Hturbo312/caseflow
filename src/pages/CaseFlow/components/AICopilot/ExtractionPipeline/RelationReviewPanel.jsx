import React, { memo, useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, X, CheckCheck, XCircle, ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';
import { useI18n } from '../../../../../i18n';
import { useToastStore } from '@components/Toast/ToastStore.js';

const RelationReviewPanel = memo(({ relations, entities, onUpdateStatus }) => {
  const { t } = useI18n();
  const toast = useToastStore();
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [expandedEvidence, setExpandedEvidence] = useState(new Set());
  const prevPendingRef = useRef(-1);

  // 优化：useMemo 缓存 stats，避免每次渲染重复 filter 4 次
  const stats = useMemo(() => ({
    total: relations.length,
    approved: relations.filter(r => r.status === 'approved').length,
    skipped: relations.filter(r => r.status === 'skipped').length,
    pending: relations.filter(r => r.status === 'pending').length,
  }), [relations]);

  // 优化：当所有关系审核完成时（pending 从 >0 变为 0），toast 提示用户
  useEffect(() => {
    if (prevPendingRef.current > 0 && stats.pending === 0 && stats.total > 0) {
      toast.success(
        stats.approved > 0
          ? t('pipeline.reviewComplete', { approved: stats.approved, skipped: stats.skipped })
          : t('pipeline.reviewAllSkipped')
      );
    }
    prevPendingRef.current = stats.pending;
  }, [stats.pending, stats.total, stats.approved, stats.skipped, t, toast]);

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.5) return 'text-amber-600';
    return 'text-gray-400';
  };

  // 优化：将 entities 转为 Map，O(1) 查找替代 O(n) .find()
  const entityInfoMap = useMemo(() => {
    const map = new Map();
    if (entities) {
      for (const e of entities) {
        map.set(e.name, { color: e.color || '#9ca3af', entityType: e.entityType || '' });
      }
    }
    return map;
  }, [entities]);

  // 优化：按置信度降序排列关系，高置信度的优先展示便于用户审核
  const sortedRelations = useMemo(() => {
    return [...relations].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  }, [relations]);

  // 优化：将 relation 的 source/target entity info 缓存，避免渲染时重复 Map 查找
  const relationEntityInfoMap = useMemo(() => {
    const map = new Map();
    for (const rel of sortedRelations) {
      const sourceInfo = entityInfoMap.get(rel.sourceName) || { color: '#9ca3af', entityType: '' };
      const targetInfo = entityInfoMap.get(rel.targetName) || { color: '#9ca3af', entityType: '' };
      map.set(rel.id, { source: sourceInfo, target: targetInfo });
    }
    return map;
  }, [sortedRelations, entityInfoMap]);

  // 批量操作
  const handleSelectAll = () => {
    const pendingIds = sortedRelations.filter(r => r.status === 'pending').map(r => r.id);
    setSelectedIds(prev =>
      pendingIds.every(id => prev.has(id)) ? new Set() : new Set(pendingIds)
    );
  };

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmAll = () => {
    sortedRelations.filter(r => r.status === 'pending').forEach(r => onUpdateStatus(r.id, 'approved'));
    setSelectedIds(new Set()); // 清空选中状态，避免残留指示器
  };

  const handleSkipAll = () => {
    sortedRelations.filter(r => r.status === 'pending').forEach(r => onUpdateStatus(r.id, 'skipped'));
    setSelectedIds(new Set()); // 清空选中状态，避免残留指示器
  };

  const handleBatchApprove = () => {
    if (selectedIds.size === 0) return;
    Array.from(selectedIds).forEach(id => onUpdateStatus(id, 'approved'));
    setSelectedIds(new Set());
  };

  const handleBatchSkip = () => {
    if (selectedIds.size === 0) return;
    Array.from(selectedIds).forEach(id => onUpdateStatus(id, 'skipped'));
    setSelectedIds(new Set());
  };

  const toggleEvidence = (relId) => {
    setExpandedEvidence(prev => {
      const next = new Set(prev);
      if (next.has(relId)) next.delete(relId);
      else next.add(relId);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-gray-900 text-sm">{t('toolbar.relation')}</span>
          <span className="flex items-center gap-0.5 text-[10px] text-gray-400" title={t('pipeline.sortByConfidence')}>
            <ArrowUpDown size={10} />
            {t('pipeline.sortByConfidence')}
          </span>
        </div>
        <div className="flex gap-3 text-xs text-gray-500">
          <span>{t('pipeline.totalRelations', { count: stats.total })}</span>
          <span className="text-green-600">{t('pipeline.approved')} {stats.approved}</span>
          {stats.skipped > 0 && <span className="text-gray-400">{t('pipeline.skipped')} {stats.skipped}</span>}
          {stats.pending > 0 && <span className="text-amber-600">{t('pipeline.pending')} {stats.pending}</span>}
        </div>
      </div>

      {/* 批量操作 */}
      {stats.pending > 0 && (
        <div className="flex items-center gap-2 px-1 flex-wrap">
          <button
            onClick={handleSelectAll}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <CheckCheck size={14} />
            {selectedIds.size > 0 ? t('pipeline.selected', { count: selectedIds.size }) : t('pipeline.selectPending')}
          </button>
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={handleBatchApprove}
                className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
              >
                <Check size={14} /> {t('pipeline.confirmSelected')}
              </button>
              <button
                onClick={handleBatchSkip}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                <XCircle size={14} /> {t('pipeline.skipSelected')}
              </button>
            </>
          )}
          {selectedIds.size === 0 && (
            <>
              <button
                onClick={handleConfirmAll}
                className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
              >
                <CheckCheck size={14} /> {t('pipeline.confirmAll')}
              </button>
              <button
                onClick={handleSkipAll}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                <XCircle size={14} /> {t('pipeline.skipAll')}
              </button>
            </>
          )}
        </div>
      )}

      {/* 关系列表 */}
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        <AnimatePresence>
          {sortedRelations.map((rel) => {
            // 从预计算的 Map 中获取 entity info，只查找一次
            const relInfo = relationEntityInfoMap.get(rel.id) || {
              source: { color: '#9ca3af', entityType: '' },
              target: { color: '#9ca3af', entityType: '' },
            };
            return (
            <motion.div
              key={rel.id}
              layout
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`rounded-lg border px-3 py-2.5 transition-all relative ${
                rel.status === 'approved' ? 'border-green-200 bg-green-50/50' :
                rel.status === 'skipped' ? 'border-gray-200 bg-gray-50 opacity-60' :
                'border-gray-200 bg-white hover:shadow-sm'
              }`}
            >
              {/* 选中指示器 */}
              {selectedIds.has(rel.id) && (
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-400 rounded-full" />
              )}

              <div className="flex items-center justify-between">
                {/* 关系展示 */}
                <div className="flex items-center gap-1.5 flex-wrap text-sm flex-1 min-w-0">
                  {/* 复选框（仅待审核状态显示） */}
                  {rel.status === 'pending' && (
                    <button
                      onClick={() => handleToggleSelect(rel.id)}
                      className={`flex-shrink-0 w-4 h-4 rounded border transition-colors ${
                        selectedIds.has(rel.id)
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : 'border-gray-300 hover:border-blue-400'
                      }`}
                      title={selectedIds.has(rel.id) ? t('toolbar.cancel') : t('toolbar.select')}
                    >
                      {selectedIds.has(rel.id) && <Check size={12} />}
                    </button>
                  )}
                  <span
                    className="font-medium px-2 py-0.5 rounded"
                    style={{ backgroundColor: `${relInfo.source.color}15`, color: relInfo.source.color }}
                  >
                    {rel.sourceName}
                    {relInfo.source.entityType && (
                      <span className="ml-1 text-[10px] opacity-60">({relInfo.source.entityType})</span>
                    )}
                  </span>
                  <ArrowRight size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-600 rounded text-xs font-medium">
                    {rel.name}
                  </span>
                  <ArrowRight size={14} className="text-gray-400 flex-shrink-0" />
                  <span
                    className="font-medium px-2 py-0.5 rounded"
                    style={{ backgroundColor: `${relInfo.target.color}15`, color: relInfo.target.color }}
                  >
                    {rel.targetName}
                    {relInfo.target.entityType && (
                      <span className="ml-1 text-[10px] opacity-60">({relInfo.target.entityType})</span>
                    )}
                  </span>
                  <span className={`text-xs ${getConfidenceColor(rel.confidence)}`} title={t('ai.confidence')}>
                    {Math.round((rel.confidence || 0) * 100)}%
                  </span>
                </div>

                {/* 操作 */}
                {rel.status === 'pending' && (
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <button
                      onClick={() => onUpdateStatus(rel.id, 'skipped')}
                      className="p-1 hover:bg-red-50 rounded transition-colors text-gray-400 hover:text-red-500"
                      title={t('pipeline.skip')}
                    >
                      <X size={14} />
                    </button>
                    <button
                      onClick={() => onUpdateStatus(rel.id, 'approved')}
                      className="p-1 hover:bg-green-50 rounded transition-colors text-gray-400 hover:text-green-500"
                      title={t('pipeline.confirm')}
                    >
                      <Check size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* 证据（可折叠） */}
              {rel.evidence && (
                <div className="mt-1.5">
                  <button
                    onClick={() => toggleEvidence(rel.id)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {expandedEvidence.has(rel.id) ? (
                      <ChevronUp size={12} />
                    ) : (
                      <ChevronDown size={12} />
                    )}
                    {expandedEvidence.has(rel.id) ? t('pipeline.hideEvidence') : t('pipeline.viewEvidence')}
                  </button>
                  <AnimatePresence>
                    {expandedEvidence.has(rel.id) && (
                      <motion.p
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="text-xs text-gray-400 leading-relaxed overflow-hidden"
                      >
                        {rel.evidence}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
            );
          })}
        </AnimatePresence>

        {relations.length === 0 && (
          <div className="text-center py-6">
            <p className="text-xs text-gray-400">{t('ai.noRelations')}</p>
            <p className="text-xs text-gray-300 mt-1">{t('pipeline.noRelationsHint')}</p>
          </div>
        )}
      </div>
    </div>
  );
});

RelationReviewPanel.displayName = 'RelationReviewPanel';

export default RelationReviewPanel;
