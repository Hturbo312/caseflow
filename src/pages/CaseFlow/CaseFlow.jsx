import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Database,
  Share2,
  MessageSquare,
  GitCompare,
  ChevronLeft,
  LogIn,
  LogOut,
  User,
  Menu,
  X,
  List,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGraphStore, useSchemaStore, useAuthStore } from '../../store';
import { useAuth, useCaseData } from '../../hooks';
import { useMobileDetect } from '../../hooks/useMobileDetect';
import SchemaArchitect from './components/SchemaArchitect/index';
import KnowledgeGraphCanvas from './components/KnowledgeGraphCanvas';
import CaseExtractor from './components/CaseExtractor';
import LoginModal from './components/LoginModal';
import { CaseListPanel, CreateCaseModal } from './components/CaseManagement';
import ComparePanel from './components/ComparePanel';
import { useI18n } from '../../i18n';
import './CaseFlow.css';
import './components/CaseManagement/CaseCard.css';
import './responsive.css';

const CaseFlow = () => {
  const [leftActiveModule, setLeftActiveModule] = useState('schema');
  const [mainView, setMainView] = useState('graph');

  // Mobile detection
  const isMobile = useMobileDetect(768);
  // Mobile drawer state
  const [mobileDrawer, setMobileDrawer] = useState(null); // null | 'left' | 'right'

  // Desktop sidebar state
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [leftWidth, setLeftWidth] = useState(380);
  const [rightWidth, setRightWidth] = useState(320);
  const resizing = useRef(null); // { side: 'left'|'right', startX, startWidth }
  const wrapperRef = useRef(null);

  // Resize handlers
  const handleResizeStart = useCallback((side, e) => {
    e.preventDefault();
    const sidebar = side === 'left'
      ? wrapperRef.current?.querySelector('.caseflow-left')
      : wrapperRef.current?.querySelector('.caseflow-right');
    const currentWidth = sidebar ? parseFloat(getComputedStyle(sidebar).width) : (side === 'left' ? leftWidth : rightWidth);
    resizing.current = { side, startX: e.clientX, startWidth: currentWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [leftWidth, rightWidth]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizing.current) return;
      const { side, startX, startWidth } = resizing.current;
      const delta = side === 'left' ? e.clientX - startX : startX - e.clientX;
      const newWidth = Math.min(500, Math.max(200, startWidth + delta));
      if (side === 'left') setLeftWidth(newWidth);
      else setRightWidth(newWidth);
    };
    const handleMouseUp = () => {
      if (!resizing.current) return;
      resizing.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Use extracted hooks
  const { isAuthenticated, user, logout } = useAuth();
  const { initializeGraph, focusCaseId, focusMode, loadAllCasesToGraph } = useGraphStore();
  const { t, locale, setLocale } = useI18n();
  const {
    cases,
    loadCases,
    showCreateCase,
    setShowCreateCase,
    newCaseForm,
    setNewCaseForm,
    creatingCase,
    handleCaseSelect,
    handleCaseDeselect,
    handleCreateCase,
    handleDeleteCase,
    filteredCases,
    getCaseSchemaName
  } = useCaseData();

  const { schemas, currentSchemaId, loadSchemas } = useSchemaStore();

  // 直接从 schemas 获取当前 schema
  const currentSchema = schemas.find(s => s.id === currentSchemaId || s.id === parseInt(currentSchemaId));

  // 登录弹窗状态
  const [showLoginModal, setShowLoginModal] = useState(false);

  // 初始化：加载数据（verifyAuth 由 useAuth hook 负责，这里只加载业务数据）
  useEffect(() => {
    const initData = async () => {
      await loadSchemas();
      await loadCases();
      initializeGraph();
    };
    if (isAuthenticated) {
      initData();
    }
  }, [isAuthenticated, loadSchemas, loadCases, initializeGraph]);

  // cases 加载完成后加载图谱
  useEffect(() => {
    if (cases.length > 0 && currentSchemaId) {
      loadAllCasesToGraph();
    }
  }, [cases, currentSchemaId]);

  // 当 schema 变化时重新加载所有案例
  // 注意：不要将 loadAllCasesToGraph 放入依赖数组，因为 zustand store 中的
  // 箭头函数每次渲染都会创建新的引用，导致 useEffect 每次渲染都执行，
  // 在数据未就绪时清空图谱
  useEffect(() => {
    if (currentSchemaId) {
      loadAllCasesToGraph();
    }
  }, [currentSchemaId]);

  // 创建新案例
  const onCreateCase = useCallback(async () => {
    await handleCreateCase(isAuthenticated, () => setShowLoginModal(true));
  }, [handleCreateCase, isAuthenticated]);

  // 删除案例回调
  const onDeleteCase = useCallback(async (caseItem, e) => {
    e?.stopPropagation();
    await handleDeleteCase(caseItem);
  }, [handleDeleteCase]);

  // 选中案例回调
  const onCaseSelect = useCallback((caseItem) => {
    handleCaseSelect(caseItem);
    // 移动端选中案例后关闭抽屉
    if (isMobile) setMobileDrawer(null);
  }, [handleCaseSelect, isMobile]);

  // 取消选中回调
  const onCaseDeselect = useCallback(() => {
    handleCaseDeselect();
  }, [handleCaseDeselect]);

  const leftModules = useMemo(() => [
    { id: 'schema', titleKey: 'schema.overview', icon: Database, component: SchemaArchitect },
  ], []);

  const filteredCasesList = filteredCases;
  const LeftComponent = leftModules.find(m => m.id === leftActiveModule)?.component || SchemaArchitect;

  // 移动端：关闭抽屉
  const closeMobileDrawer = useCallback(() => setMobileDrawer(null), []);

  // 移动端：打开左侧抽屉
  const openLeftDrawer = useCallback(() => setMobileDrawer('left'), []);
  // 移动端：打开右侧抽屉
  const openRightDrawer = useCallback(() => setMobileDrawer('right'), []);

  // 选中案例时自动关闭抽屉（移动端）
  const handleCaseSelectMobile = useCallback((caseItem) => {
    handleCaseSelect(caseItem);
    if (isMobile) setMobileDrawer(null);
  }, [handleCaseSelect, isMobile]);

  return (
    <div className={`caseflow-wrapper${isMobile ? ' caseflow-mobile' : ''}`}>
      <a href="#caseflow-main-content" className="caseflow-skip-link">
        {t('app.skipNav')}
      </a>

      {/* 移动端顶部导航栏 */}
      {isMobile && (
        <header className="caseflow-mobile-header">
          <button
            className="caseflow-mobile-menu-btn"
            onClick={openLeftDrawer}
            aria-label={t('schema.overview')}
          >
            <Database size={20} />
          </button>
          <div className="caseflow-mobile-view-tabs">
            <button
              onClick={() => setMainView('graph')}
              className={`caseflow-mobile-tab ${mainView === 'graph' ? 'active' : ''}`}
            >
              <Share2 size={18} />
              <span>{t('tab.graph')}</span>
            </button>
            <button
              onClick={() => setMainView('ai')}
              className={`caseflow-mobile-tab ${mainView === 'ai' ? 'active' : ''}`}
            >
              <MessageSquare size={18} />
              <span>{t('tab.ai')}</span>
            </button>
            <button
              onClick={() => setMainView('compare')}
              className={`caseflow-mobile-tab ${mainView === 'compare' ? 'active' : ''}`}
            >
              <GitCompare size={18} />
              <span>{t('tab.compare')}</span>
            </button>
          </div>
          <button
            className="caseflow-mobile-menu-btn"
            onClick={openRightDrawer}
            aria-label={t('case.title')}
          >
            <List size={20} />
            {focusCaseId && <span className="caseflow-mobile-badge" />}
          </button>
        </header>
      )}

      {/* 左栏 - Schema 管理栏 */}
      <aside
        className={`caseflow-left${isMobile && mobileDrawer === 'left' ? ' caseflow-drawer-open' : ''}${leftCollapsed ? ' collapsed' : ''}`}
        style={{ width: isMobile ? undefined : (leftCollapsed ? 0 : leftWidth) }}
      >
        {isMobile && (
          <button className="caseflow-drawer-close" onClick={closeMobileDrawer} aria-label="Close">
            <X size={20} />
          </button>
        )}
        <div className="caseflow-left-header">
          <div className="caseflow-left-header-top">
            <div className="caseflow-logo">
              <div className="caseflow-logo-icon">
                <Share2 size={18} color="#ffffff" />
              </div>
              <div>
                <div className="caseflow-logo-text">CaseFlow</div>
                <div className="caseflow-logo-subtitle">{t('app.logo.subtitle')}</div>
              </div>
            </div>
            {!isMobile && (
              <button
                className="caseflow-sidebar-toggle"
                onClick={() => setLeftCollapsed(true)}
                title="折叠 Schema 栏"
              >
                <PanelLeftClose size={16} />
              </button>
            )}
          </div>

          {/* 登录/用户信息 */}
          <div className="caseflow-auth-section">
            {isAuthenticated ? (
              <div className="caseflow-user-info">
                <div className="caseflow-user-avatar">
                  <User size={14} />
                </div>
                <span className="caseflow-username">{user?.username}</span>
                <button
                  onClick={logout}
                  className="caseflow-logout-btn"
                  title={t('app.logout')}
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="caseflow-login-btn"
              >
                <LogIn size={14} />
                <span>{t('app.login')}</span>
              </button>
            )}
          </div>

          <nav className="caseflow-nav" role="tablist">
            {leftModules.map((module) => (
              <button
                key={module.id}
                onClick={() => setLeftActiveModule(module.id)}
                className={`caseflow-nav-item ${leftActiveModule === module.id ? 'active' : ''}`}
                role="tab"
                aria-selected={leftActiveModule === module.id}
                aria-controls={`tabpanel-${module.id}`}
              >
                <module.icon size={18} aria-hidden="true" />
                {t(module.titleKey)}
              </button>
            ))}
          </nav>
        </div>

        <div className="caseflow-left-content">
          <LeftComponent
            isAuthenticated={isAuthenticated}
            onShowLogin={() => setShowLoginModal(true)}
          />
        </div>

        <div className="caseflow-left-footer">
          <Link to="/" className="caseflow-back-link">
            <ChevronLeft size={18} />
            {t('app.backHome')}
          </Link>
        </div>
      </aside>

      {/* 左栏拖拽手柄 */}
      {!isMobile && !leftCollapsed && (
        <div
          className="caseflow-resizer"
          onMouseDown={(e) => handleResizeStart('left', e)}
        />
      )}

      {/* 左栏折叠后展开 tab */}
      {!isMobile && leftCollapsed && (
        <button
          className="caseflow-sidebar-expand-tab caseflow-sidebar-expand-tab-left"
          onClick={() => setLeftCollapsed(false)}
          title="展开 Schema 栏"
        >
          <PanelLeftOpen size={16} />
        </button>
      )}

      {/* 中间主窗口 */}
      <main className="caseflow-main" id="caseflow-main-content">
        {/* 桌面端顶栏 */}
        {!isMobile && (
          <div className="caseflow-top-bar">
            <div className="caseflow-view-tabs" role="tablist">
              <button
                onClick={() => setMainView('graph')}
                className={`caseflow-view-tab ${mainView === 'graph' ? 'active' : ''}`}
                role="tab"
                aria-selected={mainView === 'graph'}
                aria-label={t('tab.graph')}
              >
                <Share2 size={16} aria-hidden="true" />
                <span className="caseflow-view-tab-text">{t('tab.graph')}</span>
              </button>
              <button
                onClick={() => setMainView('ai')}
                className={`caseflow-view-tab ${mainView === 'ai' ? 'active' : ''}`}
                role="tab"
                aria-selected={mainView === 'ai'}
                aria-label={t('tab.ai')}
              >
                <MessageSquare size={16} aria-hidden="true" />
                <span className="caseflow-view-tab-text">{t('tab.ai')}</span>
              </button>
              <button
                onClick={() => setMainView('compare')}
                className={`caseflow-view-tab ${mainView === 'compare' ? 'active' : ''}`}
                role="tab"
                aria-selected={mainView === 'compare'}
                aria-label={t('tab.compare')}
              >
                <GitCompare size={16} aria-hidden="true" />
                <span className="caseflow-view-tab-text">{t('tab.compare')}</span>
              </button>
            </div>
            <span className="caseflow-date">
              {new Date().toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
            <button
              onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
              className="caseflow-lang-switch"
              title={locale === 'zh' ? 'Switch to English' : '切换到中文'}
            >
              {locale === 'zh' ? 'EN' : '中'}
            </button>
          </div>
        )}

        <div className="caseflow-main-content">
          <AnimatePresence mode="wait">
            {mainView === 'graph' ? (
              <motion.div
                key="graph"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
                className="h-full"
              >
                <KnowledgeGraphCanvas
                  isAuthenticated={isAuthenticated}
                  onShowLogin={() => setShowLoginModal(true)}
                />
              </motion.div>
            ) : mainView === 'compare' ? (
              <motion.div
                key="compare"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
                className="h-full"
              >
                <ComparePanel />
              </motion.div>
            ) : (
              <motion.div
                key="ai"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
                className="h-full"
              >
                <CaseExtractor onShowLogin={() => setShowLoginModal(true)} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* 右栏拖拽手柄 */}
      {!isMobile && !rightCollapsed && (
        <div
          className="caseflow-resizer"
          onMouseDown={(e) => handleResizeStart('right', e)}
        />
      )}

      {/* 右栏折叠后展开 tab */}
      {!isMobile && rightCollapsed && (
        <button
          className="caseflow-sidebar-expand-tab caseflow-sidebar-expand-tab-right"
          onClick={() => setRightCollapsed(false)}
          title="展开案例栏"
        >
          <PanelRightOpen size={16} />
        </button>
      )}

      {/* 右栏 - 案例卡片栏 */}
      <aside
        className={`caseflow-right${isMobile && mobileDrawer === 'right' ? ' caseflow-drawer-open' : ''}${rightCollapsed ? ' collapsed' : ''}`}
        style={{ width: isMobile ? undefined : (rightCollapsed ? 0 : rightWidth) }}
      >
        {isMobile && (
          <button className="caseflow-drawer-close" onClick={closeMobileDrawer} aria-label="Close">
            <X size={20} />
          </button>
        )}
        <CaseListPanel
          cases={cases}
          filteredCasesList={filteredCasesList}
          focusCaseId={focusCaseId}
          focusMode={focusMode}
          showCreateCase={showCreateCase}
          setShowCreateCase={setShowCreateCase}
          handleCaseSelect={handleCaseSelectMobile}
          handleCaseDeselect={onCaseDeselect}
          onDeleteCase={onDeleteCase}
          getCaseSchemaName={getCaseSchemaName}
          setMainView={(view) => { setMainView(view); if (isMobile) setMobileDrawer(null); }}
          isAuthenticated={isAuthenticated}
          onShowLogin={() => setShowLoginModal(true)}
          currentSchema={currentSchema}
          isMobile={isMobile}
          onToggleCollapse={() => setRightCollapsed(true)}
        />
      </aside>

      {/* 移动端遮罩层 */}
      {isMobile && mobileDrawer && (
        <div className="caseflow-mobile-overlay" onClick={closeMobileDrawer} />
      )}

      {/* 创建案例弹窗 */}
      <AnimatePresence>
        <CreateCaseModal
          show={showCreateCase}
          onClose={() => setShowCreateCase(false)}
          onCreate={onCreateCase}
          newCaseForm={newCaseForm}
          setNewCaseForm={setNewCaseForm}
          creatingCase={creatingCase}
          schemas={schemas}
          currentSchemaId={currentSchemaId}
        />
      </AnimatePresence>

      {/* 登录弹窗 */}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  );
};

export default CaseFlow;
