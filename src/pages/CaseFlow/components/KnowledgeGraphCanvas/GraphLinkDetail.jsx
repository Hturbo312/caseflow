import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, Trash2 } from 'lucide-react';
import { useI18n } from '../../../../i18n';

const GraphLinkDetail = ({
  selectedLink,
  relationStyleMap,
  onClose,
  onRequestDelete,
}) => {
  const { t } = useI18n();
  const prefersReducedMotion = useReducedMotion();

  const getLineStyle = () => {
    const style = relationStyleMap[selectedLink?.name]?.style;
    if (style === 'dashed') return t('rel.dashed');
    if (style === 'dotted') return t('rel.dotted');
    return t('rel.solid');
  };

  const getLineDirection = () => {
    const dir = relationStyleMap[selectedLink?.name]?.direction;
    if (dir === 'bidirectional') return t('rel.bidirectional');
    if (dir === 'undirected') return t('rel.undirected');
    return t('rel.directed');
  };

  const lineColor = relationStyleMap[selectedLink?.name]?.color || '#9ca3af';

  return (
    <AnimatePresence>
      {selectedLink && (
        <>
          {/* 桌面端浮动面板 */}
          <motion.div
            key="link-detail"
            initial={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25 }}
            className="absolute top-4 right-4 w-64 sm:w-72 bg-white rounded-xl shadow-lg border border-gray-200 p-3 sm:p-4 z-20 sm:block hidden"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">{t('detail.link.title')}</h4>
              <button
                type="button"
                onClick={onClose}
                className="p-1 hover:bg-gray-100 rounded"
                aria-label={t('detail.link.close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-500 text-xs">{t('detail.link.type')}</span>
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className="w-1 h-6 rounded-full"
                    style={{ backgroundColor: lineColor }}
                  />
                  <span className="font-medium">{selectedLink?.name}</span>
                </div>
              </div>
              <div>
                <span className="text-gray-500 text-xs">{t('detail.link.source')}</span>
                <div className="font-medium">{selectedLink?.source?.name || t('detail.link.unknown')}</div>
              </div>
              <div>
                <span className="text-gray-500 text-xs">{t('detail.link.target')}</span>
                <div className="font-medium">{selectedLink?.target?.name || t('detail.link.unknown')}</div>
              </div>
              <div className="flex gap-2 pt-2">
                <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                  {getLineStyle()}
                </span>
                <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                  {getLineDirection()}
                </span>
              </div>
            </div>
            {/* 删除按钮 */}
            <div className="mt-4 pt-3 border-t border-gray-100">
              <button
                onClick={() => {
                  const caseId = selectedLink?.caseId;
                  const linkId = typeof selectedLink?.id === 'object' ? selectedLink.id.id : selectedLink?.id;
                  if (!caseId || !linkId) return;
                  onRequestDelete({ ...selectedLink, caseId, linkId });
                }}
                className="w-full py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                {t('detail.link.delete')}
              </button>
            </div>
          </motion.div>

          {/* 移动端底部面板 */}
          <motion.div
            key="link-detail-mobile"
            initial={prefersReducedMotion ? false : { y: '100%' }}
            animate={{ y: 0 }}
            exit={prefersReducedMotion ? false : { y: '100%' }}
            transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', damping: 25, stiffness: 300 }}
            className="sm:hidden fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-20 max-h-[70vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-white px-4 pt-3 pb-2 border-b border-gray-100">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-base">{t('detail.link.title')}</h4>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                  aria-label={t('detail.link.close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4 text-sm">
              <div>
                <span className="text-gray-500 text-xs">{t('detail.link.type')}</span>
                <div className="flex items-center gap-3 mt-2">
                  <div
                    className="w-1.5 h-8 rounded-full"
                    style={{ backgroundColor: lineColor }}
                  />
                  <span className="font-medium text-lg">{selectedLink?.name}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                <div className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" />
                <div>
                  <span className="text-gray-400 text-xs">{t('detail.link.source')}</span>
                  <div className="font-medium">{selectedLink?.source?.name || t('detail.link.unknown')}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
                <div>
                  <span className="text-gray-400 text-xs">{t('detail.link.target')}</span>
                  <div className="font-medium">{selectedLink?.target?.name || t('detail.link.unknown')}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-600">
                  {getLineStyle()}
                </span>
                <span className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-600">
                  {getLineDirection()}
                </span>
              </div>
              {/* 删除按钮 */}
              <button
                onClick={() => {
                  const caseId = selectedLink?.caseId;
                  const linkId = typeof selectedLink?.id === 'object' ? selectedLink.id.id : selectedLink?.id;
                  if (!caseId || !linkId) return;
                  onRequestDelete({ ...selectedLink, caseId, linkId });
                }}
                className="w-full py-3 text-sm text-red-600 hover:bg-red-50 rounded-xl flex items-center justify-center gap-2 transition-colors border border-red-200 bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                {t('detail.link.delete')}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default GraphLinkDetail;
