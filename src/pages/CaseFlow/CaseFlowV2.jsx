import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Database, FolderOpen, BarChart3, Share2, ChevronLeft, ChevronRight, LogIn, History,
  User, LogOut, X, Settings,
} from 'lucide-react';
import { useGraphStore, useSchemaStore, useCaseStore } from '../../store';
import { useAuth } from '../../hooks';
import { useCaseData } from '../../hooks';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useI18n } from '../../i18n';
import CopilotRail from './components/Workspace/CopilotRail';
import CaseWorkspace from './components/Workspace/ResearchCase';
import AnalysisWorkspace from './components/Workspace/ResearchAnalysis';
import SchemaWorkspace from './components/Workspace/SchemaWorkspace';
import WorkflowNav from './components/Workspace/WorkflowNav';
import CasePreviewCard from './components/Workspace/CasePreviewCard';
import KnowledgeGraphCanvas from './components/KnowledgeGraphCanvas';
import UnifiedSettings from './components/Workspace/UnifiedSettings';
import LoginModal from './components/LoginModal';
import { CaseListPanel, CreateCaseModal } from './components/CaseManagement';
import './CaseFlow.css';
import './components/CaseManagement/CaseCard.css';
import './workspace.css';
import './design-system.css';
import './academic.css';
import FrameworkGuide from './components/Workspace/FrameworkGuide';
import CaseShelf from './components/Workspace/CaseShelf';

const MAIN_TABS = [
  { id: 'case', label: 'v2.tab.case', icon: FolderOpen, task: 'v2.task.case' },
  { id: 'analysis', label: 'v2.tab.analysis', icon: BarChart3, task: 'v2.task.analysis' },
  { id: 'graph', label: 'v2.tab.graph', icon: Share2, task: 'v2.task.graph' },
];

/**
 * CaseFlow 2.0 三栏研究工作台（Spec §0/§3）
 * 左：AI Copilot ｜ 中：Dynamic Schema / Case / Analysis ｜ 右：CaseLibrary
 * 顶栏下：研究流水线条（定框架→录案例→审数据→探索→比案例）
 * 右栏单击案例 → 预览卡（不抢占中栏）；Ctrl/Cmd+K → 全局命令面板
 * 访客装载演示数据，可浏览，写操作引导登录
 */
const CaseFlowV2 = () => {
  const { t, locale, setLocale } = useI18n();
  const { isAuthenticated, user, logout } = useAuth();
  const { initializeGraph, loadAllCasesToGraph } = useGraphStore();
  const { schemas, currentSchemaId, loadSchemas, loadDemoSchema } = useSchemaStore();
  const { loadDemoCases } = useCaseStore();
  const {
    cases, loadCases, showCreateCase, setShowCreateCase,
    newCaseForm, setNewCaseForm, creatingCase,
    handleCaseSelect, handleCaseDeselect, handleCreateCase, handleDeleteCase,
    filteredCases, getCaseSchemaName,
  } = useCaseData();

  const {
    mainTab, setMainTab, openCaseDetail, contextTask, setContextTask,
    previewCaseId, closePreview, openPreview,
    extractorOpen, setExtractorOpen,
    pipelineVisible,
    askCopilot,
  } = useWorkspaceStore();

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [researchTab, setResearchTab] = useState('case');
  const showLogin = useCallback(() => setShowLoginModal(true), []);
  useEffect(() => { if (extractorOpen) setLeftCollapsed(false); }, [extractorOpen]);

  // 登录用户：从 API 初始化；访客：装载演示数据（只读浏览，写操作引导登录）
  useEffect(() => {
    if (!isAuthenticated) {
      loadDemoSchema();
      loadDemoCases();
      initializeGraph();
      return;
    }
    (async () => {
      await loadSchemas();
      await loadCases();
      initializeGraph();
    })();
  }, [isAuthenticated, loadSchemas, loadCases, initializeGraph, loadDemoSchema, loadDemoCases]);

  useEffect(() => {
    if (cases.length > 0 && currentSchemaId) loadAllCasesToGraph();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cases.length, currentSchemaId]);

  // 右栏单击 → 预览卡（不切 tab、不覆盖中栏）
  const onCasePreview = useCallback((caseItem) => {
    if (mainTab === 'analysis') { openPreview(caseItem.id); return; }
    useCaseStore.getState().setCurrentCase(String(caseItem.id));
    useGraphStore.getState().setFocusCase(String(caseItem.id));
    openCaseDetail(caseItem.id);
  }, [openCaseDetail, mainTab, openPreview]);

  // 预览卡 / 双击 → 正式在中栏打开详情
  const onCaseClick = useCallback((caseItem) => {
    useCaseStore.getState().setCurrentCase(String(caseItem.id));
    useGraphStore.getState().setFocusCase(String(caseItem.id));
    openCaseDetail(caseItem.id);
  }, [handleCaseSelect, openCaseDetail]);

  const onCaseDelete = useCallback(async (caseItem, e) => {
    e?.stopPropagation();
    await handleDeleteCase(caseItem);
  }, [handleDeleteCase]);

  const switchTab = (tab) => {
    if (tab === 'case' || tab === 'analysis') setResearchTab(tab);
    setMainTab(tab);
    const tabDef = MAIN_TABS.find((x) => x.id === tab);
    if (tabDef) setContextTask(tabDef.task);
  };

  const currentSchema = schemas.find((s) => s.id === currentSchemaId || String(s.id) === String(currentSchemaId));

  const previewCase = previewCaseId
    ? cases.find((c) => String(c.id) === String(previewCaseId))
    : null;

  const rightRailProps = {
    cases, filteredCasesList: filteredCases,
    showCreateCase, setShowCreateCase,
    handleCaseSelect: onCaseClick,
    onPreviewCase: onCasePreview,
    handleCaseDeselect,
    onDeleteCase: onCaseDelete,
    getCaseSchemaName,
    // 经典面板的视图跳转在 v2 中映射为打开案例详情
    setMainView: () => {},
    isAuthenticated,
    onShowLogin: showLogin,
    onImport: () => (isAuthenticated ? setExtractorOpen(true) : showLogin()),
    currentSchema,
    compact: true, // 紧凑卡片：详情统一在中栏 Case 工作区
  };

  // 未登录门禁：只呈现登录功能框，任何案例/图谱/分析内容均不渲染
  if (!isAuthenticated) {
    return (
      <div className="v2-shell v2-guest">
        <header className="v2-topbar">
          <div className="v2-brand">
            <div className="v2-brand-name">CaseFlow</div>
          </div>
          <div className="v2-topbar-right">
            <button
              className="v2-lang-btn"
              onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
              title={locale === 'zh' ? 'Switch to English' : '切换到中文'}
            >
              {locale === 'zh' ? 'EN' : '中'}
            </button>
            <Link to="/caseflow/classic" className="v2-classic-link" title={t('v2.topbar.previousTitle')}>
              <History size={13} /> {t('v2.topbar.previous')}
            </Link>
          </div>
        </header>
        <div className="v2-gate">
          <div className="v2-gate-note">
            <Database size={18} />
            <p>案例集、图谱与研究分析仅对登录用户可见</p>
          </div>
        </div>
        <LoginModal isOpen locked onClose={() => {}} />
      </div>
    );
  }

  return (
    <div className="v2-shell">
      {/* 顶栏：品牌 + 账户（左）｜ 三 tab（与中栏对齐）｜ 工具（右） */}
      <header className="v2-topbar">
        <div className="v2-topbar-left">
        <div className="v2-brand">
          <div className="v2-brand-name">CaseFlow</div>
          {isAuthenticated ? (
            <>
              <span className="v2-user-sep" />
              <span className="v2-user-chip" title={user?.username}>
                <User size={12} />
                <span className="v2-user-name">{user?.username}</span>
              </span>
              <button className="v2-user-settings" onClick={() => setSettingsOpen(true)} title={t('settings.title')}>
                <Settings size={13} /> {t('settings.title')}
              </button>
              <button className="v2-user-logout" onClick={logout} title={t('app.logout')}>
                <LogOut size={12} />
              </button>
            </>
          ) : (
            <button className="v2-login-btn" onClick={showLogin}>
              <LogIn size={12} /> {t('app.login')}
            </button>
          )}
        </div>
        </div>

        <div className="v2-topbar-center">
          <button
            className={`academic-framework-entry v2-framework-btn ${mainTab === 'schema' ? 'active' : ''}`}
            onClick={() => switchTab(mainTab === 'schema' ? researchTab : 'schema')}
            title={currentSchema?.name}
          >
            {t('v2.framework')} <span>{currentSchema?.name || t('v2.framework.none')}</span>
          </button>
          <nav className="v2-tabs" role="tablist">
            {MAIN_TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={mainTab === id}
                className={`v2-tab ${mainTab === id ? 'active' : ''}`}
                onClick={() => switchTab(id)}
              >
                <Icon size={15} /> {t(label)}
              </button>
            ))}
          </nav>
        </div>
        <div className="v2-topbar-right">
          <Link to="/caseflow/classic" className="v2-classic-link" title={t('v2.topbar.previousTitle')}>
            <History size={13} /> {t('v2.topbar.previous')}
          </Link>
        </div>
      </header>

      {/* 研究流水线条（可关闭，状态持久化） */}
      {false && pipelineVisible && (
        <WorkflowNav
          switchTab={switchTab}
          caseCount={cases.length}
          isAuthenticated={isAuthenticated}
          onShowLogin={showLogin}
        />
      )}

      <div className="v2-columns">
        {/* 左栏 AI Copilot */}
        <aside className={`v2-rail v2-left ${leftCollapsed ? 'collapsed' : ''}`}>
          {leftCollapsed ? (
            <button className="v2-rail-expand" onClick={() => setLeftCollapsed(false)} title={t('v2.rail.expandCopilot')}>
              <ChevronRight size={15} />
            </button>
          ) : (
            <>
              <CopilotRail onShowLogin={showLogin} />
              <button className="v2-rail-collapse" onClick={() => setLeftCollapsed(true)} title={t('v2.rail.collapseCopilot')}>
                <ChevronLeft size={14} />
              </button>
            </>
          )}
        </aside>

        {/* 中栏主工作区：滚动区 + 预览卡覆盖层 + 导入向导覆盖层 */}
        <main className="v2-main">
          <div className="academic-worktools">{mainTab === 'case' ? <><span>{t('v2.work.caseLabel')}</span><button onClick={() => isAuthenticated ? setShowCreateCase(true) : showLogin()}>{t('v2.work.newCase')}</button><button onClick={() => isAuthenticated ? setExtractorOpen(true) : showLogin()}>{t('v2.work.import')}</button></> : mainTab === 'graph' ? <><span>{t('v2.work.graphLabel')}</span><button onClick={() => switchTab(researchTab)}>{t('v2.work.backResearch')}</button></> : <span>{t('v2.work.analysisLabel')}</span>}</div>
          <div className="v2-main-scroll">
            {mainTab === 'graph' && (
              <div className="v2-graph">
                <KnowledgeGraphCanvas isAuthenticated={isAuthenticated} onShowLogin={showLogin} />
              </div>
            )}
            {(mainTab === 'case' || (mainTab === 'schema' && researchTab === 'case')) && (
              <CaseWorkspace isAuthenticated={isAuthenticated} onShowLogin={showLogin} />
            )}
            {(mainTab === 'analysis' || (mainTab === 'schema' && researchTab === 'analysis')) && <AnalysisWorkspace />}
          </div>

          {mainTab === 'schema' && <div className="v2-extract" role="dialog" aria-label="研究框架">
            <div className="v2-extract-head"><strong>研究框架 · 定义、实例与修订</strong><button onClick={() => switchTab(researchTab)}>关闭框架，返回研究</button></div>
            <div className="v2-extract-body"><FrameworkGuide isAuthenticated={isAuthenticated} onShowLogin={showLogin} /></div>
          </div>}

          {previewCase && (
            <CasePreviewCard
              caseItem={previewCase}
              schemaName={getCaseSchemaName(previewCase)}
              onClose={closePreview}
              onOpen={() => {
                // 访客：案例详情需登录后从服务端加载
                if (!isAuthenticated) return showLogin();
                onCaseClick(previewCase);
              }}
              onAskAI={() => {
                askCopilot(t('ux.preview.askPrompt', { name: previewCase.name || '' }));
                setExtractorOpen(false);
              }}
            />
          )}

        </main>

        {/* 右栏 CaseLibrary（固定索引，Spec §3.3/§7.1） */}
        <aside className={`v2-rail v2-right ${rightCollapsed ? 'collapsed' : ''}`}>
          {rightCollapsed ? (
            <button className="v2-rail-expand" onClick={() => setRightCollapsed(false)} title={t('v2.rail.expandLibrary')}>
              <ChevronLeft size={15} />
            </button>
          ) : (
            <>
              <CaseShelf cases={cases} onOpen={onCasePreview} onGraph={() => { useGraphStore.getState().setFocusCase(null); switchTab('graph'); }} />
              <button className="v2-rail-collapse" onClick={() => setRightCollapsed(true)} title={t('v2.rail.collapseLibrary')}>
                <ChevronRight size={14} />
              </button>
            </>
          )}
        </aside>
      </div>

      <CreateCaseModal
        show={showCreateCase}
        onClose={() => setShowCreateCase(false)}
        onCreate={async () => { await handleCreateCase(isAuthenticated, showLogin); }}
        newCaseForm={newCaseForm}
        setNewCaseForm={setNewCaseForm}
        creatingCase={creatingCase}
        schemas={schemas}
        currentSchemaId={currentSchemaId}
      />
      <UnifiedSettings isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  );
};

export default CaseFlowV2;
