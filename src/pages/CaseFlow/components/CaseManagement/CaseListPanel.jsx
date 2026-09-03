import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { Plus, PanelRightClose } from 'lucide-react';
import { useI18n } from '../../../../i18n';
import CaseCard from './CaseCard';
import PreviewPanel from './PreviewPanel';

/**
 * CaseListPanel - 右栏案例列表面板
 * 包含案例列表和预览面板
 */
const CaseListPanel = ({
  cases,
  filteredCasesList,
  focusCaseId,
  focusMode,
  showCreateCase,
  setShowCreateCase,
  handleCaseSelect,
  handleCaseDeselect,
  onDeleteCase,
  getCaseSchemaName,
  setMainView,
  isAuthenticated,
  onShowLogin,
  currentSchema,
  isMobile,
  onToggleCollapse
}) => {
  const { t } = useI18n();
  // 获取聚焦案例
  const focusedCase = cases.find(c => c.id === focusCaseId);

  // 处理创建案例按钮点击
  const handleCreateClick = () => {
    if (!isAuthenticated) {
      onShowLogin?.();
      return;
    }
    setShowCreateCase(true);
  };

  return (
    <>
      <div className="caseflow-right-header">
        <div className="caseflow-right-header-top">
          <div>
            <h2 className="caseflow-right-title">{t('case.title')}</h2>
            <p className="caseflow-right-count">{t('case.total', { count: filteredCasesList.length })}</p>
          </div>
          <div className="caseflow-right-header-actions">
            {!isMobile && onToggleCollapse && (
              <button
                className="caseflow-sidebar-toggle"
                onClick={onToggleCollapse}
                title="折叠案例栏"
              >
                <PanelRightClose size={16} />
              </button>
            )}
            <button
              onClick={handleCreateClick}
              className="caseflow-create-btn"
              title={isAuthenticated ? t('case.new') : t('app.loginPrompt')}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="caseflow-right-list">
        {filteredCasesList.map((caseItem) => (
          <CaseCard
            key={caseItem.id}
            caseItem={caseItem}
            isSelected={focusCaseId === caseItem.id}
            schemaName={getCaseSchemaName(caseItem)}
            focusMode={focusMode}
            entityTypes={currentSchema?.entityTypes || []}
            cardConfig={currentSchema?.cardConfig}
            onSelect={handleCaseSelect}
            onDeselect={handleCaseDeselect}
            onDelete={onDeleteCase}
          />
        ))}
      </div>

      {/* 预览面板 */}
      <AnimatePresence>
        {focusCaseId && focusedCase && (
          <PreviewPanel
            focusedCase={focusedCase}
            onDeselect={handleCaseDeselect}
            setMainView={setMainView}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default CaseListPanel;