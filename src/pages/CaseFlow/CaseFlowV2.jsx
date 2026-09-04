import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Database, FolderOpen, BarChart3, Share2, ChevronLeft, ChevronRight, LogIn, History,
} from 'lucide-react';
import { useGraphStore, useSchemaStore } from '../../store';
import { useAuth } from '../../hooks';
import { useCaseData } from '../../hooks';
import { useWorkspaceStore } from '../../store/workspaceStore';
import CopilotRail from './components/Workspace/CopilotRail';
import CaseWorkspace from './components/Workspace/CaseWorkspace';
import AnalysisWorkspace from './components/Workspace/AnalysisWorkspace';
import SchemaWorkspace from './components/Workspace/SchemaWorkspace';
import KnowledgeGraphCanvas from './components/KnowledgeGraphCanvas';
import LoginModal from './components/LoginModal';
import { CaseListPanel, CreateCaseModal } from './components/CaseManagement';
import './CaseFlow.css';
import './components/CaseManagement/CaseCard.css';
import './workspace.css';

const MAIN_TABS = [
  { id: 'graph', label: '图谱', icon: Share2, task: '整体图谱浏览' },
  { id: 'schema', label: 'Dynamic Schema', icon: Database, task: 'Schema 设计' },
  { id: 'case', label: 'Case', icon: FolderOpen, task: '案例审阅' },
  { id: 'analysis', label: 'Analysis', icon: BarChart3, task: '跨案例分析' },
];

/**
 * CaseFlow 2.0 三栏研究工作台（Spec §0/§3）
 * 左：AI Copilot ｜ 中：Dynamic Schema / Case / Analysis ｜ 右：CaseLibrary
 * 经典布局保留在 /caseflow/classic，可通过「上一版本」互通
 */
const CaseFlowV2 = () => {
  const { isAuthenticated } = useAuth();
  const { initializeGraph, loadAllCasesToGraph } = useGraphStore();
  const { schemas, currentSchemaId, loadSchemas } = useSchemaStore();
  const {
    cases, loadCases, showCreateCase, setShowCreateCase,
    newCaseForm, setNewCaseForm, creatingCase,
    handleCaseSelect, handleCaseDeselect, handleCreateCase, handleDeleteCase,
    filteredCases, getCaseSchemaName,
  } = useCaseData();

  const {
    mainTab, setMainTab, openCaseDetail, contextTask, setContextTask,
  } = useWorkspaceStore();

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // 初始化数据（与经典布局共享同一批 store）
  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      await loadSchemas();
      await loadCases();
      initializeGraph();
    })();
  }, [isAuthenticated, loadSchemas, loadCases, initializeGraph]);

  useEffect(() => {
    if (cases.length > 0 && currentSchemaId) loadAllCasesToGraph();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cases.length, currentSchemaId]);

  // CaseLibrary 单击 → 选中案例并在中栏打开详情（Spec §3.3）
  const onCaseClick = useCallback((caseItem) => {
    handleCaseSelect(caseItem);
    openCaseDetail(caseItem.id);
  }, [handleCaseSelect, openCaseDetail]);

  const onCaseDelete = useCallback(async (caseItem, e) => {
    e?.stopPropagation();
    await handleDeleteCase(caseItem);
  }, [handleDeleteCase]);

  const switchTab = (tab) => {
    setMainTab(tab);
    const t = MAIN_TABS.find((x) => x.id === tab);
    if (t) setContextTask(t.task);
  };

  const currentSchema = schemas.find((s) => s.id === currentSchemaId || String(s.id) === String(currentSchemaId));

  const rightRailProps = {
    cases, filteredCasesList: filteredCases,
    showCreateCase, setShowCreateCase,
    handleCaseSelect: onCaseClick,
    handleCaseDeselect,
    onDeleteCase: onCaseDelete,
    getCaseSchemaName,
    // 经典面板的视图跳转在 v2 中映射为打开案例详情
    setMainView: () => {},
    isAuthenticated,
    onShowLogin: () => setShowLoginModal(true),
    currentSchema,
  };

  return (
    <div className={`v2-shell${isAuthenticated ? '' : ' v2-guest'}`}>
      {/* 顶栏：品牌 + 三 tab + 上一版本入口 */}
      <header className="v2-topbar">
        <div className="v2-brand">
          <span className="v2-brand-mark">CF</span>
          <div>
            <div className="v2-brand-name">CaseFlow <i>2.0</i></div>
            <div className="v2-brand-sub">研究工作台 · Dynamic Schema</div>
          </div>
        </div>

        <nav className="v2-tabs" role="tablist">
          {MAIN_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={mainTab === id}
              className={`v2-tab ${mainTab === id ? 'active' : ''}`}
              onClick={() => switchTab(id)}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </nav>

        <div className="v2-topbar-right">
          <Link to="/caseflow/classic" className="v2-classic-link" title="切回 v1 经典布局">
            <History size={13} /> 上一版本
          </Link>
          {!isAuthenticated && (
            <button className="v2-login-btn" onClick={() => setShowLoginModal(true)}>
              <LogIn size={13} /> 登录
            </button>
          )}
        </div>
      </header>

      <div className="v2-columns">
        {/* 左栏 AI Copilot */}
        <aside className={`v2-rail v2-left ${leftCollapsed ? 'collapsed' : ''}`}>
          {leftCollapsed ? (
            <button className="v2-rail-expand" onClick={() => setLeftCollapsed(false)} title="展开 Copilot">
              <ChevronRight size={15} />
            </button>
          ) : (
            <>
              <CopilotRail onShowLogin={() => setShowLoginModal(true)} />
              <button className="v2-rail-collapse" onClick={() => setLeftCollapsed(true)} title="收起 Copilot">
                <ChevronLeft size={14} />
              </button>
            </>
          )}
        </aside>

        {/* 中栏主工作区 */}
        <main className="v2-main">
          {mainTab === 'graph' && (
            <div className="v2-graph">
              <KnowledgeGraphCanvas isAuthenticated={isAuthenticated} onShowLogin={() => setShowLoginModal(true)} />
            </div>
          )}
          {mainTab === 'schema' && (
            <SchemaWorkspace isAuthenticated={isAuthenticated} onShowLogin={() => setShowLoginModal(true)} />
          )}
          {mainTab === 'case' && (
            <CaseWorkspace isAuthenticated={isAuthenticated} onShowLogin={() => setShowLoginModal(true)} />
          )}
          {mainTab === 'analysis' && <AnalysisWorkspace />}
        </main>

        {/* 右栏 CaseLibrary（固定索引，Spec §3.3/§7.1） */}
        <aside className={`v2-rail v2-right ${rightCollapsed ? 'collapsed' : ''}`}>
          {rightCollapsed ? (
            <button className="v2-rail-expand" onClick={() => setRightCollapsed(false)} title="展开案例库">
              <ChevronLeft size={15} />
            </button>
          ) : (
            <>
              <CaseListPanel
                {...rightRailProps}
                onToggleCollapse={() => setRightCollapsed(true)}
              />
              <button className="v2-rail-collapse" onClick={() => setRightCollapsed(true)} title="收起案例库">
                <ChevronRight size={14} />
              </button>
            </>
          )}
        </aside>
      </div>

      <CreateCaseModal
        show={showCreateCase}
        onClose={() => setShowCreateCase(false)}
        onCreate={async () => { await handleCreateCase(isAuthenticated, () => setShowLoginModal(true)); }}
        newCaseForm={newCaseForm}
        setNewCaseForm={setNewCaseForm}
        creatingCase={creatingCase}
        schemas={schemas}
        currentSchemaId={currentSchemaId}
      />
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  );
};

export default CaseFlowV2;
