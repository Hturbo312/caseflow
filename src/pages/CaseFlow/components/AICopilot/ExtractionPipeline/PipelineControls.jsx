import React, { memo } from 'react';
import { Loader2, Play, SkipForward, Save, RotateCcw } from 'lucide-react';
import { useI18n } from '../../../../../i18n';

const PipelineControls = memo(({ phase, isProcessing, onParseText, onGeneratePlan, onNext, onFinalize, onReset, plan, extractedTypes }) => {
  const { t } = useI18n();
  const renderControls = () => {
    if (isProcessing) {
      return (
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-blue-600">
          <Loader2 size={16} className="animate-spin" />
          <span>{t('ai.processing')}</span>
        </div>
      );
    }

    switch (phase) {
      case 'idle':
        return (
          <button
            onClick={onParseText}
            className="w-full py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
          >
            <Play size={16} />
            {t('ai.startExtraction')}
          </button>
        );

      case 'planning':
        return (
          <button
            onClick={onGeneratePlan}
            className="w-full py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
          >
            <Play size={16} />
            {t('ai.phasePlanning')}
          </button>
        );

      case 'extracting':
        const allExtracted = plan?.every(item => extractedTypes?.includes(item.entity_type));
        if (allExtracted) {
          return (
            <button
              onClick={onNext}
              className="w-full py-2.5 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
            >
              {t('ai.phaseRelation')}
              <SkipForward size={16} />
            </button>
          );
        }
        return null;

      case 'inferring_relations':
      case 'finalizing':
        return (
          <button
            onClick={onFinalize}
            className="w-full py-2.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
          >
            <Save size={16} />
            {t('ai.confirmSave')}
          </button>
        );

      case 'completed':
        return (
          <button
            onClick={onReset}
            className="w-full py-2.5 bg-gray-500 text-white rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw size={16} />
            {t('ai.newSession')}
          </button>
        );

      case 'error':
        return (
          <button
            onClick={onReset}
            className="w-full py-2.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw size={16} />
            {t('ai.retry')}
          </button>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        {renderControls()}
      </div>
      {phase !== 'idle' && phase !== 'completed' && (
        <button
          onClick={onReset}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          title={t('ai.newSession')}
        >
          <RotateCcw size={16} />
        </button>
      )}
    </div>
  );
});

PipelineControls.displayName = 'PipelineControls';

export default PipelineControls;
