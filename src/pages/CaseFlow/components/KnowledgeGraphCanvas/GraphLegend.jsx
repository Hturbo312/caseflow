import React from 'react';
import { useI18n } from '../../../../i18n';

const GraphLegend = ({ entityTypes, onClose }) => {
  const { t } = useI18n();
  return (
    <div
      className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 bg-white rounded-lg shadow-md border border-gray-200 p-2 sm:p-3"
      role="region"
      aria-label={t('legend.title')}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-gray-500">{t('legend.title')}</h4>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title={t('legend.hide')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div className="space-y-1.5">
        {entityTypes?.map(type => (
          <div key={type.id} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: type.color }}
            />
            <span className="text-xs text-gray-600">{type.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GraphLegend;