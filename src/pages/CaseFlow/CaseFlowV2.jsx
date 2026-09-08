import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Database, FolderOpen, BarChart3, Share2, BookOpen, ChevronLeft, ChevronRight, LogIn, History,
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
// 顶栏不放图谱 tab（入口收敛到右侧案例库的「案例集图谱」），但保留任务映射供 switchTab 使用
const TOPBAR_TABS = MAIN_TABS.filter(({ id }) => id !== 'graph');

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
    askCopilot,
  } = useWorkspaceStore();

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [researchTab, setResearchTab] = useState('case');
  const showLogin = useCallback(() => setShowLoginModal(true), []);

  // 左栏宽度：拖拽手柄调整（顶栏网格经 --v2-left-w 同步对齐），持久化，双击手柄恢复默认
  const shellRef = useRef(null);
  const [leftWidth, setLeftWidth] = useState(() => {
    const v = parseInt(localStorage.getItem('cf_left_w'), 10);
    return Number.isFinite(v) ? v : null;
  });
  const leftDragRef = useRef(null);
  useEffect(() => {
    const onMove = (e) => {
      if (!leftDragRef.current) return;
      const w = Math.min(640, Math.max(260, leftDragRef.current.start + e.clientX - leftDragRef.current.x));
      setLeftWidth(w);
    };
    const onUp = () => {
      if (!leftDragRef.current) return;
      leftDragRef.current = null;
      document.body.classList.remove('cf-col-resizing');
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);
  useEffect(() => {
    if (!shellRef.current) return;
    // 左栏收起时让位于 design-system 的 :has(.v2-left.collapsed){--v2-left-w:36px} 折叠轨道
    if (leftCollapsed || leftWidth == null) shellRef.current.style.removeProperty('--v2-left-w');
    else shellRef.current.style.setProperty('--v2-left-w', `${leftWidth}px`);
    if (leftWidth != null) localStorage.setItem('cf_left_w', String(leftWidth));
  }, [leftWidth, leftCollapsed]);
  const startLeftResize = (e) => {
    e.preventDefault();
    const current = leftWidth ?? shellRef.current?.querySelector('.v2-left')?.getBoundingClientRect().width ?? 340;
    leftDragRef.current = { x: e.clientX, start: current };
    document.body.classList.add('cf-col-resizing');
  };
  const resetLeftWidth = () => {
    setLeftWidth(null);
    localStorage.removeItem('cf_left_w');
  };
  // 中栏「从文档导入」→ 展开左栏并唤起 Copilot 附件选择（材料登记入口已内化进对话）
  const openImport = useCallback(() => {
    if (!isAuthenticated) return showLogin();
    setLeftCollapsed(false);
    setTimeout(() => window.dispatchEvent(new Event('cf:chat-attach')), 80);
  }, [isAuthenticated, showLogin]);

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
    <div className="v2-shell" ref={shellRef}>
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
          <nav className="v2-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={mainTab === 'schema'}
              className={`v2-tab v2-tab-framework ${mainTab === 'schema' ? 'active' : ''}`}
              onClick={() => switchTab(mainTab === 'schema' ? researchTab : 'schema')}
              title={currentSchema?.name || t('v2.framework.none')}
            >
              <BookOpen size={15} /> {t('v2.framework')}
            </button>
            {TOPBAR_TABS.map(({ id, label, icon: Icon }) => (
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
          <Link to="/caseflow/classic" className="v2-classic-link" title={t('v2.topbar.previousTitle')} aria-label={t('v2.topbar.previous')}>
            <History size={14} />
          </Link>
        </div>
      </header>

      <div className="v2-columns">
        {/* 左栏 AI Copilot（右缘拖宽手柄；双击恢复默认宽度） */}
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
              <div
                className="v2-rail-resize"
                onPointerDown={startLeftResize}
                onDoubleClick={resetLeftWidth}
                title={t('ux.rail.resize')}
                role="separator"
                aria-orientation="vertical"
              />
            </>
          )}
        </aside>

        {/* 中栏主工作区：滚动区 + 预览卡覆盖层 + 导入向导覆盖层 */}
        <main className="v2-main">
          {mainTab !== 'schema' && <div className="academic-worktools">{mainTab === 'case' ? <><span>{t('v2.work.caseLabel')}</span><button onClick={() => isAuthenticated ? setShowCreateCase(true) : showLogin()}>{t('v2.work.newCase')}</button><button onClick={openImport}>{t('v2.work.import')}</button></> : mainTab === 'graph' ? <><span>{t('v2.work.graphLabel')}</span><button onClick={() => switchTab(researchTab)}>{t('v2.work.backResearch')}</button></> : <span>{t('v2.work.analysisLabel')}</span>}</div>}
          <div className="v2-main-scroll">
            {mainTab === 'graph' && (
              <div className="v2-graph">
                <KnowledgeGraphCanvas isAuthenticated={isAuthenticated} onShowLogin={showLogin} />
              </div>
            )}
            {mainTab === 'case' && (
              <CaseWorkspace isAuthenticated={isAuthenticated} onShowLogin={showLogin} />
            )}
            {mainTab === 'analysis' && <AnalysisWorkspace />}
            {/* 框架视图独占中栏，自带版本状态条（覆盖层与「关闭框架」按钮已废弃） */}
            {mainTab === 'schema' && <FrameworkGuide isAuthenticated={isAuthenticated} onShowLogin={showLogin} />}
          </div>

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
