import React from 'react';
import { motion } from 'framer-motion';
import { Focus, X, MessageSquare } from 'lucide-react';

/**
 * PreviewPanel - 案例预览面板子组件
 * 显示选中案例的预览信息和快捷操作
 */
const PreviewPanel = ({ focusedCase, onDeselect, setMainView }) => {
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
            {focusedCase.location || '未知地点'} · {focusedCase.year || '未知年份'}
          </span>
        </div>
        <button
          onClick={onDeselect}
          className="caseflow-preview-close"
          aria-label="关闭详情"
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
          <span className="caseflow-preview-stat-label">实体</span>
        </div>
        <div className="caseflow-preview-stat-divider" />
        <div className="caseflow-preview-stat">
          <span className="caseflow-preview-stat-value">{relationCount}</span>
          <span className="caseflow-preview-stat-label">关系</span>
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
          aria-label="在AI助手查看案例"
        >
          <MessageSquare size={14} />
          <span>AI 助手分析</span>
        </button>
        <button
          className="caseflow-preview-btn-secondary"
          onClick={onDeselect}
          aria-label="返回全量视图"
        >
          <Focus size={14} />
          <span>返回全局模式</span>
        </button>
      </div>
    </motion.div>
  );
};

export default PreviewPanel;