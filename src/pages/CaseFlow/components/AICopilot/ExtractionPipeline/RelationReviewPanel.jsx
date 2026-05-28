import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, X, CheckCheck, XCircle } from 'lucide-react';
import { useI18n } from '../../../../../i18n';

const RelationReviewPanel = memo(({ relations, entities, onUpdateStatus }) => {
  const { t } = useI18n();
  const stats = {
    total: relations.length,
    approved: relations.filter(r => r.status === 'approved').length,
    skipped: relations.filter(r => r.status === 'skipped').length,
    pending: relations.filter(r => r.status === 'pending').length,
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.5) return 'text-amber-600';
    return 'text-gray-400';
  };

  const getEntityColor = (entityName) => {
    const entity = entities?.find(e => e.name === entityName);
    return entity?.color || '#9ca3af';
  };

  // 批量操作
  const handleConfirmAll = () => {
    relations.filter(r => r.status === 'pending').forEach(r => onUpdateStatus(r.id, 'approved'));
  };

  const handleSkipAll = () => {
    relations.filter(r => r.status === 'pending').forEach(r => onUpdateStatus(r.id, 'skipped'));
  };

  return (
    <div className="space-y-3">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-900 text-sm">{t('toolbar.relation')}</span>
        <div className="flex gap-3 text-xs text-gray-500">
          <span>{t('pipeline.totalRelations', { count: stats.total })}</span>
          <span className="text-green-600">{t('pipeline.approved')} {stats.approved}</span>
          {stats.pending > 0 && <span className="text-amber-600">{t('pipeline.pending')} {stats.pending}</span>}
        </div>
      </div>

      {/* 批量操作 */}
      {stats.pending > 0 && (
        <div className="flex items-center gap-2 px-1">
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
        </div>
      )}

      {/* 关系列表 */}
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        <AnimatePresence>
          {relations.map((rel) => (
            <motion.div
              key={rel.id}
              layout
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`rounded-lg border px-3 py-2.5 transition-all ${
                rel.status === 'approved' ? 'border-green-200 bg-green-50/50' :
                rel.status === 'skipped' ? 'border-gray-200 bg-gray-50 opacity-60' :
                'border-gray-200 bg-white hover:shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                {/* 关系展示 */}
                <div className="flex items-center gap-1.5 flex-wrap text-sm">
                  <span
                    className="font-medium px-2 py-0.5 rounded"
                    style={{ backgroundColor: `${getEntityColor(rel.sourceName)}15`, color: getEntityColor(rel.sourceName) }}
                  >
                    {rel.sourceName}
                  </span>
                  <ArrowRight size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-600 rounded text-xs font-medium">
                    {rel.name}
                  </span>
                  <ArrowRight size={14} className="text-gray-400 flex-shrink-0" />
                  <span
                    className="font-medium px-2 py-0.5 rounded"
                    style={{ backgroundColor: `${getEntityColor(rel.targetName)}15`, color: getEntityColor(rel.targetName) }}
                  >
                    {rel.targetName}
                  </span>
                  <span className={`text-xs ${getConfidenceColor(rel.confidence)}`}>
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

              {/* 证据 */}
              {rel.evidence && (
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{rel.evidence}</p>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {relations.length === 0 && (
          <p className="text-center text-xs text-gray-400 py-4">{t('ai.noRelations')}</p>
        )}
      </div>
    </div>
  );
});

RelationReviewPanel.displayName = 'RelationReviewPanel';

export default RelationReviewPanel;
