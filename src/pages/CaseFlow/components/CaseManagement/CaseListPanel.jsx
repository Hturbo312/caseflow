import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Plus, PanelRightClose, GitCompare, X } from 'lucide-react';
import { useI18n } from '../../../../i18n';
import { useCompareStore } from '../../../../store/compareStore';
import CaseCard from './CaseCard';
import PreviewPanel from './PreviewPanel';

/**
 * CaseListPanel - 右栏案例列表面板
 * 包含案例列表和预览面板；内置跨案例对比：选择模式 + 吸顶托盘，选择集与主区对比面板共用（compareStore）
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
  onToggleCollapse,
  compact = false
}) => {
  const { t } = useI18n();
  const [picking, setPicking] = useState(false);
  const { ids: compareIds, toggle: toggleCompare, clear: clearCompare } = useCompareStore();

  // 获取聚焦案例
  const focusedCase = cases.find(c => c.id === focusCaseId);
  const canStart = compareIds.length >= 2;

  // 处理创建案例按钮点击
  const handleCreateClick = () => {
    if (!isAuthenticated) {
      onShowLogin?.();
      return;
    }
    setShowCreateCase(true);
  };

  // 开始对比：切到主区对比视图（移动端同时收起抽屉）
  const startCompare = () => {
    if (!canStart) return;
    setMainView('compare');
  };

  return (
    <>
      <div className="caseflow-right-header">
        <div className="caseflow-right-header-top">
          <div>
            <h2 className="caseflow-right-title">{t('case.title')}</h2>
            <p className="caseflow-right-count">
              {picking
                ? `${compareIds.length}/4 · ${t('compare.pick.hint')}`
                : t('case.total', { count: filteredCasesList.length })}
            </p>
          </div>
          <div className="caseflow-right-header-actions">
            <button
              className={`caseflow-create-btn caseflow-compare-btn ${picking ? 'active' : ''}`}
              onClick={() => setPicking((p) => !p)}
              title={picking ? t('compare.mode.exit') : t('compare.mode.enter')}
            >
              <GitCompare size={16} />
              {compareIds.length > 0 && (
                <span className="caseflow-compare-badge">{compareIds.length}</span>
              )}
            </button>
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

      {/* 对比托盘：选择模式下吸顶展示已选案例 */}
      {picking && (
        <div className="compare-tray">
          <div className="compare-tray-chips">
            {compareIds.length === 0 && (
              <span className="compare-tray-hint">{t('compare.pick.hint')}</span>
            )}
            {compareIds.map((id) => {
              const c = cases.find((x) => String(x.id) === String(id));
              if (!c) return null;
              return (
                <span key={id} className="compare-tray-chip" title={c.name}>
                  {c.name}
                  <button
                    className="compare-tray-chip-remove"
                    onClick={() => toggleCompare(id)}
                  >
                    <X size={10} />
                  </button>
                </span>
              );
            })}
          </div>
          <div className="compare-tray-actions">
            <button
              className="compare-tray-clear"
              onClick={clearCompare}
              disabled={compareIds.length === 0}
            >
              {t('compare.tray.clear')}
            </button>
            <button className="compare-tray-start" onClick={startCompare} disabled={!canStart}>
              {t('compare.tray.start')}
            </button>
          </div>
        </div>
      )}

      <div className={`caseflow-right-list${picking ? ' compare-picking' : ''}`}>
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
            compareMode={picking}
            compareSelected={compareIds.includes(String(caseItem.id))}
            onToggleCompare={() => toggleCompare(caseItem.id)}
            compact={compact}
          />
        ))}
      </div>

      {/* 预览面板（compact/2.0 模式下案例详情在中栏，不渲染） */}
      <AnimatePresence>
        {focusCaseId && focusedCase && !compact && (
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
