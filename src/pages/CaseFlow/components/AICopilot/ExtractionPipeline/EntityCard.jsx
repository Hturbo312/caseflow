import React, { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { useI18n } from '../../../../../i18n';

const EntityCard = memo(({ card, entityType, color, onApprove, onSkip }) => {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  if (!card || !card.name) return null;

  const statusColor = {
    approved: 'border-green-400 bg-green-50/50',
    skipped: 'border-gray-200 bg-gray-50 opacity-60',
    pending: 'border-gray-200 bg-white hover:shadow-md',
  };

  const statusBadge = {
    approved: <span className="text-xs text-green-600 font-medium flex items-center gap-1"><Check size={12} />{t('pipeline.approved')}</span>,
    skipped: <span className="text-xs text-gray-400 flex items-center gap-1"><X size={12} />{t('pipeline.skipped')}</span>,
    pending: null,
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`rounded-xl border-2 ${statusColor[card.status || 'pending']} overflow-hidden transition-all`}
      style={{ borderLeftColor: color || '#3b82f6', borderLeftWidth: 4 }}
    >
      {/* 头部 */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color || '#3b82f6' }} />
          <span className="font-semibold text-gray-900 text-sm">{card.name}</span>
          {entityType && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: `${color || '#3b82f6'}15`, color: color || '#3b82f6' }}
            >
              {entityType}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {statusBadge[card.status || 'pending']}
          {card.status === 'pending' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onSkip(card.id)}
                className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-gray-400 hover:text-red-500"
                title={t('pipeline.skip')}
              >
                <X size={16} />
              </button>
              <button
                onClick={() => onApprove(card.id)}
                className="p-1.5 hover:bg-green-50 rounded-lg transition-colors text-gray-400 hover:text-green-500"
                title={t('pipeline.confirm')}
              >
                <Check size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 属性 */}
      {card.properties && Object.keys(card.properties).length > 0 && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(card.properties).map(([key, value]) => (
              <span key={key} className="text-xs px-2 py-1 bg-gray-50 rounded-md text-gray-600 border border-gray-100">
                <span className="font-medium text-gray-700">{key}:</span> {String(value)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 证据/溯源 */}
      {card.evidence && (
        <div className="px-4 pb-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FileText size={12} />
            {t('pipeline.viewEvidence')}
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mt-2"
              >
                <p className="text-xs text-gray-500 bg-amber-50/50 p-2 rounded-md border border-amber-100 leading-relaxed">
                  {card.evidence}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
});

EntityCard.displayName = 'EntityCard';

export default EntityCard;
