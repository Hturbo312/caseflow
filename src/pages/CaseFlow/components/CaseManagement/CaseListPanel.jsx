import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
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
  viewMode,
  showCreateCase,
  setShowCreateCase,
  handleCaseSelect,
  handleCaseDeselect,
  onDeleteCase,
  getCaseSchemaName,
  setMainView,
  isAuthenticated,
  onShowLogin,
  currentSchema
}) => {
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
    <aside className="caseflow-right">
      <div className="caseflow-right-header">
        <div className="caseflow-right-header-top">
          <div>
            <h2 className="caseflow-right-title">案例列表</h2>
            <p className="caseflow-right-count">共 {filteredCasesList.length} 个案例</p>
          </div>
          <button
            onClick={handleCreateClick}
            className="caseflow-create-btn"
            title={isAuthenticated ? "新建案例" : "登录后可创建案例"}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="caseflow-right-list">
        {filteredCasesList.map((caseItem) => (
          <CaseCard
            key={caseItem.id}
            caseItem={caseItem}
            isSelected={focusCaseId === caseItem.id}
            schemaName={getCaseSchemaName(caseItem)}
            viewMode={viewMode}
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
    </aside>
  );
};

export default CaseListPanel;