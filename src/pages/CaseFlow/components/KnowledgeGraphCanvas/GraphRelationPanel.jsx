import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Link2, X, ArrowRight } from 'lucide-react';
import { useI18n } from '../../../../i18n';

const GraphRelationPanel = ({
  // Mode panel
  relationMode,
  relationSource,
  relationTarget,
  onCloseMode,
  // Type selector modal
  relationTypeSelectorOpen,
  currentSchema,
  onSelectRelationType,
  relationSaving,
  onCloseTypeSelector,
  onCancelSelection,
}) => {
  const { t } = useI18n();
  const prefersReducedMotion = useReducedMotion();

  if (!relationMode) return null;

  return (
    <>
      {/* 关系创建模式面板 */}
      <motion.div
        initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25 }}
        className="mt-2 p-2 bg-emerald-50 rounded-lg overflow-hidden border border-emerald-200"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5 text-emerald-600" />
            <h4 className="text-xs font-semibold text-emerald-700">{t('relation.save')}</h4>
          </div>
          <button
            type="button"
            onClick={onCloseMode}
            aria-label={t('toolbar.close')}
            className="p-1 hover:bg-emerald-200 rounded"
          >
            <X className="w-3 h-3 text-emerald-600" />
          </button>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-emerald-600">{t('path.start')}：</span>
            {relationSource ? (
              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium">
                {relationSource.name}
              </span>
            ) : (
              <span className="text-[10px] text-gray-400 italic">{t('path.waiting')}</span>
            )}
          </div>
          <ArrowRight className="w-3 h-3 text-gray-400" />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-emerald-600">{t('path.end')}：</span>
            {relationTarget ? (
              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium">
                {relationTarget.name}
              </span>
            ) : (
              <span className="text-[10px] text-gray-400 italic">{t('path.waiting')}</span>
            )}
          </div>
        </div>
      </motion.div>

      {/* 关系类型选择弹窗 */}
      <AnimatePresence>
        {relationTypeSelectorOpen && relationSource && relationTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={onCloseTypeSelector}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-lg font-semibold mb-4">{t('entity.type')}</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {currentSchema?.relations?.map(rel => (
                  <button
                    key={rel.id}
                    onClick={() => onSelectRelationType(rel.name)}
                    disabled={relationSaving}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div
                      className="w-1 h-8 rounded-full"
                      style={{ backgroundColor: rel.color || '#9ca3af' }}
                    />
                    <div>
                      <div className="font-medium">{rel.name}</div>
                      <div className="text-xs text-gray-500">{rel.from} → {rel.to}</div>
                    </div>
                  </button>
                ))}
                {(!currentSchema?.relations || currentSchema.relations.length === 0) && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    {t('schema.noRelations')}
                  </p>
                )}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={onCancelSelection}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                >
                  {t('toolbar.cancel')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default GraphRelationPanel;