import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, Trash2 } from 'lucide-react';
import { getNodeColor } from '@utils';
import { useI18n } from '../../../../i18n';

const GraphNodeDetail = ({
  selectedNode,
  entityTypeColorMap,
  onClose,
  onRequestDelete,
}) => {
  const { t } = useI18n();
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {selectedNode && (
        <>
          {/* 移动端遮罩 */}
          <motion.div
            key="node-detail-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="sm:hidden fixed inset-0 bg-black/30 z-19"
            onClick={onClose}
          />
          <motion.div
            key="node-detail"
            initial={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25 }}
            className="absolute top-4 right-4 w-64 sm:w-72 bg-white rounded-xl shadow-lg border border-gray-200 p-3 sm:p-4 z-20 sm:block hidden"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">{t('detail.node.title')}</h4>
              <button
                type="button"
                onClick={onClose}
                className="p-1 hover:bg-gray-100 rounded"
                aria-label={t('detail.node.close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-500 text-xs">名称</span>
                <div className="font-medium text-base">{selectedNode?.name}</div>
              </div>
              <div>
                <span className="text-gray-500 text-xs">类型</span>
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getNodeColor(selectedNode?.type, entityTypeColorMap || {}) }}
                  />
                  <span className="font-medium">{selectedNode?.type}</span>
                </div>
              </div>
              {/* 显示属性 */}
              {selectedNode?.properties && Object.keys(selectedNode.properties).length > 0 && (
                <div>
                  <span className="text-gray-500 text-xs">{t('detail.properties')}</span>
                  <div className="mt-2 space-y-1.5">
                    {Object.entries(selectedNode.properties).map(([key, value]) => (
                      <div key={key} className="flex items-start gap-2 text-xs">
                        <span className="text-gray-400 min-w-16">{key}:</span>
                        <span className="text-gray-700">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* 所属案例 */}
              {selectedNode?.caseName && (
                <div className="pt-2 border-t border-gray-100">
                  <span className="text-gray-500 text-xs">{t('detail.case')}</span>
                  <div className="text-xs text-blue-600 font-medium">{selectedNode.caseName}</div>
                </div>
              )}
            </div>
            {/* 删除按钮 */}
            <div className="mt-4 pt-3 border-t border-gray-100">
              <button
                onClick={() => {
                  if (!selectedNode?.caseId || !selectedNode?.id) return;
                  onRequestDelete(selectedNode);
                }}
                className="w-full py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                {t('detail.node.delete')}
              </button>
            </div>
          </motion.div>

          {/* 移动端底部面板 */}
          <motion.div
            key="node-detail-mobile"
            initial={prefersReducedMotion ? false : { y: '100%' }}
            animate={{ y: 0 }}
            exit={prefersReducedMotion ? false : { y: '100%' }}
            transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', damping: 25, stiffness: 300 }}
            className="sm:hidden fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-20 max-h-[70vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-white px-4 pt-3 pb-2 border-b border-gray-100">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-base">{t('detail.node.title')}</h4>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                  aria-label={t('detail.node.close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4 text-sm">
              <div>
                <span className="text-gray-500 text-xs">名称</span>
                <div className="font-medium text-lg mt-1">{selectedNode?.name}</div>
              </div>
              <div>
                <span className="text-gray-500 text-xs">类型</span>
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: getNodeColor(selectedNode?.type, entityTypeColorMap || {}) }}
                  />
                  <span className="font-medium">{selectedNode?.type}</span>
                </div>
              </div>
              {/* 显示属性 */}
              {selectedNode?.properties && Object.keys(selectedNode.properties).length > 0 && (
                <div>
                  <span className="text-gray-500 text-xs">{t('detail.properties')}</span>
                  <div className="mt-2 space-y-2">
                    {Object.entries(selectedNode.properties).map(([key, value]) => (
                      <div key={key} className="flex items-start gap-2 text-sm">
                        <span className="text-gray-400 min-w-20">{key}:</span>
                        <span className="text-gray-700">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* 所属案例 */}
              {selectedNode?.caseName && (
                <div className="pt-3 border-t border-gray-100">
                  <span className="text-gray-500 text-xs">{t('detail.case')}</span>
                  <div className="text-sm text-blue-600 font-medium mt-1">{selectedNode.caseName}</div>
                </div>
              )}
              {/* 删除按钮 */}
              <button
                onClick={() => {
                  if (!selectedNode?.caseId || !selectedNode?.id) return;
                  onRequestDelete(selectedNode);
                }}
                className="w-full py-3 text-sm text-red-600 hover:bg-red-50 rounded-xl flex items-center justify-center gap-2 transition-colors border border-red-200 bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                {t('detail.node.delete')}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default GraphNodeDetail;
