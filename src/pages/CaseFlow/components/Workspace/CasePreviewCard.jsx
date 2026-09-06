import { MapPin, Calendar, Tag, X, Maximize2, Sparkles } from 'lucide-react';
import { useI18n } from '../../../../i18n';

/**
 * 案例预览卡：右栏单击案例时在中栏右侧滑出，
 * 让用户「查一下」不打断正在进行的图谱/分析工作。
 * 双击卡片或点「打开」才正式进入中栏案例工作区。
 */
const CasePreviewCard = ({ caseItem, schemaName, onClose, onOpen, onAskAI }) => {
  const { t } = useI18n();
  if (!caseItem) return null;

  return (
    <aside className="v2-preview-card" role="dialog" aria-label={t('ux.preview.aria')}>
      <div className="v2-preview-head">
        <span className="v2-preview-tag">{t('ux.preview.tag')}</span>
        <button className="v2-preview-x" onClick={onClose} aria-label={t('common.cancel')} title={t('common.cancel')}>
          <X size={14} />
        </button>
      </div>

      <h3 className="v2-preview-title">{caseItem.name}</h3>

      <div className="v2-preview-meta">
        {caseItem.location && (
          <span><MapPin size={12} /> {caseItem.location}</span>
        )}
        {caseItem.year && (
          <span><Calendar size={12} /> {caseItem.year}{t('case.yearSuffix') || ''}</span>
        )}
        {schemaName && (
          <span><Tag size={12} /> {schemaName}</span>
        )}
      </div>

      {caseItem.description && (
        <p className="v2-preview-desc">{caseItem.description}</p>
      )}

      {Array.isArray(caseItem.tags) && caseItem.tags.length > 0 && (
        <div className="v2-preview-tags">
          {caseItem.tags.map((tag) => (
            <span key={tag} className="v2-preview-chip">{tag}</span>
          ))}
        </div>
      )}

      <div className="v2-preview-stat">
        <span>{t('ux.preview.entities', { count: (caseItem.entities || []).length })}</span>
        <span>{t('ux.preview.relations', { count: (caseItem.relations || []).length })}</span>
      </div>

      <div className="v2-preview-actions">
        <button className="v2-preview-open" onClick={onOpen}>
          <Maximize2 size={13} /> {t('ux.preview.open')}
        </button>
        <button className="v2-preview-ask" onClick={onAskAI}>
          <Sparkles size={13} /> {t('ux.preview.ask')}
        </button>
      </div>
    </aside>
  );
};

export default CasePreviewCard;
