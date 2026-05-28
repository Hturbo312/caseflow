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

  return (
    <AnimatePresence>
      {selectedLink && (
        <motion.div
          key="link-detail"
          initial={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25 }}
          className="absolute top-4 right-4 w-64 sm:w-72 bg-white rounded-xl shadow-lg border border-gray-200 p-3 sm:p-4 z-20"
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
                  style={{ backgroundColor: relationStyleMap[selectedLink?.name]?.color || '#9ca3af' }}
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
                {relationStyleMap[selectedLink?.name]?.style === 'dashed' ? t('rel.dashed') :
                 relationStyleMap[selectedLink?.name]?.style === 'dotted' ? t('rel.dotted') : t('rel.solid')}
              </span>
              <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                {relationStyleMap[selectedLink?.name]?.direction === 'bidirectional' ? t('rel.bidirectional') :
                 relationStyleMap[selectedLink?.name]?.direction === 'undirected' ? t('rel.undirected') : t('rel.directed')}
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
      )}
    </AnimatePresence>
  );
};

export default GraphLinkDetail;