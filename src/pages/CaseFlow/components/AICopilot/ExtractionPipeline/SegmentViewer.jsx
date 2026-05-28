import React, { memo } from 'react';
import { FileText } from 'lucide-react';
import { useI18n } from '../../../../../i18n';

const SegmentViewer = memo(({ segments }) => {
  const { t } = useI18n();
  if (!segments || segments.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-4">{t('pipeline.noSegments')}</p>;
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
      {segments.map((seg) => {
        const hintCount = seg.entity_hints?.length || 0;
        return (
          <div key={seg.id || seg.segment_index} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <FileText size={12} />
                <span className="font-medium">{t('pipeline.segmentLabel')} {seg.segment_index + 1}</span>
              </div>
              {hintCount > 0 && (
                <span className="text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                  {hintCount} {t('pipeline.hint')}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{seg.content}</p>
          </div>
        );
      })}
    </div>
  );
});

SegmentViewer.displayName = 'SegmentViewer';

export default SegmentViewer;
