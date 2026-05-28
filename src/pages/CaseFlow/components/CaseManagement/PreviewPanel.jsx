import React from 'react';
import { motion } from 'framer-motion';
import { Focus, X, MessageSquare } from 'lucide-react';
import { useI18n } from '../../../../i18n';

/**
 * PreviewPanel - 案例预览面板子组件
 * 显示选中案例的预览信息和快捷操作
 */
const PreviewPanel = ({ focusedCase, onDeselect, setMainView }) => {
  const { t } = useI18n();
  const entityCount = focusedCase.entities?.length || 0;
  const relationCount = focusedCase.relations?.length || 0;
  const tags = focusedCase.tags || [];

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="caseflow-preview-panel"
    >
      {/* 案例头部 */}
      <div className="caseflow-preview-header">
        <div className="caseflow-preview-icon">
          <Focus size={16} />
        </div>
        <div className="caseflow-preview-header-info">
          <h4 className="caseflow-preview-name">{focusedCase.name}</h4>
          <span className="caseflow-preview-badge">
            {focusedCase.location || t('case.unknownLocation')} · {focusedCase.year || t('case.unknownYear')}
          </span>
        </div>
        <button
          onClick={onDeselect}
          className="caseflow-preview-close"
          aria-label={t('toolbar.close')}
        >
          <X size={16} />
        </button>
      </div>

      {/* 案例描述 */}
      {focusedCase.description && (
        <p className="caseflow-preview-desc">{focusedCase.description}</p>
      )}

      {/* 统计信息 */}
      <div className="caseflow-preview-stats">
        <div className="caseflow-preview-stat">
          <span className="caseflow-preview-stat-value">{entityCount}</span>
          <span className="caseflow-preview-stat-label">{t('case.entityCount')}</span>
        </div>
        <div className="caseflow-preview-stat-divider" />
        <div className="caseflow-preview-stat">
          <span className="caseflow-preview-stat-value">{relationCount}</span>
          <span className="caseflow-preview-stat-label">{t('case.linkCount')}</span>
        </div>
      </div>

      {/* 标签 */}
      {tags.length > 0 && (
        <div className="caseflow-preview-tags">
          {tags.slice(0, 4).map((tag, i) => (
            <span key={i} className="caseflow-preview-tag">{tag}</span>
          ))}
          {tags.length > 4 && (
            <span className="caseflow-preview-tag-more">+{tags.length - 4}</span>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="caseflow-preview-actions">
        <button
          className="caseflow-preview-btn"
          onClick={() => setMainView('ai')}
          aria-label={t('case.aiAnalyze')}
        >
          <MessageSquare size={14} />
          <span>{t('case.aiAnalyze')}</span>
        </button>
        <button
          className="caseflow-preview-btn-secondary"
          onClick={onDeselect}
          aria-label={t('case.backGlobal')}
        >
          <Focus size={14} />
          <span>{t('case.backGlobal')}</span>
        </button>
      </div>
    </motion.div>
  );
};

export default PreviewPanel;