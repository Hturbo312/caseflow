import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Database,
  Share2,
  MessageSquare,
  ChevronLeft,
  LogIn,
  LogOut,
  User
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGraphStore, useSchemaStore } from '../../store';
import { useAuth, useCaseData } from '../../hooks';
import SchemaArchitect from './components/SchemaArchitect';
import KnowledgeGraphCanvas from './components/KnowledgeGraphCanvas';
import AICopilot from './components/AICopilot';
import LoginModal from './components/LoginModal';
import { CaseListPanel, CreateCaseModal } from './components/CaseManagement';
import './CaseFlow.css';

const CaseFlow = () => {
  const [leftActiveModule, setLeftActiveModule] = useState('schema');
  const [mainView, setMainView] = useState('graph');

  // Use extracted hooks
  const { isAuthenticated, user, logout, verifyAuth } = useAuth();
  const { initializeGraph, focusCaseId, viewMode, loadAllCasesToGraph } = useGraphStore();
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

  // 初始化：验证登录状态并加载数据
  useEffect(() => {
    const initData = async () => {
      // 验证登录状态
      await verifyAuth();
      // 先加载 schemas，确保 currentSchemaId 有值
      await loadSchemas();
      // 再加载 cases
      await loadCases();
      // 最后初始化图谱
      initializeGraph();
    };
    initData();
  }, [verifyAuth, loadSchemas, loadCases, initializeGraph]);

  // 当 schema 变化时重新加载所有案例
  useEffect(() => {
    loadAllCasesToGraph();
  }, [currentSchemaId, loadAllCasesToGraph]);

  // 创建新案例（使用 hook）
  const onCreateCase = useCallback(async () => {
    await handleCreateCase(isAuthenticated, () => setShowLoginModal(true));
  }, [handleCreateCase, isAuthenticated]);

  // 删除案例回调（使用 useCallback 优化）
  const onDeleteCase = useCallback(async (caseItem, e) => {
    e?.stopPropagation();
    await handleDeleteCase(caseItem);
  }, [handleDeleteCase]);

  // 选中案例回调
  const onCaseSelect = useCallback((caseItem) => {
    handleCaseSelect(caseItem);
  }, [handleCaseSelect]);

  // 取消选中回调
  const onCaseDeselect = useCallback(() => {
    handleCaseDeselect();
  }, [handleCaseDeselect]);

  const leftModules = useMemo(() => [
    { id: 'schema', title: 'Schema 建模', icon: Database, component: SchemaArchitect },
  ], []);

  const filteredCasesList = filteredCases;
  const LeftComponent = leftModules.find(m => m.id === leftActiveModule)?.component || SchemaArchitect;

  return (
    <div className="caseflow-wrapper">
      <a href="#caseflow-main-content" className="caseflow-skip-link">
        跳过导航，直接访问主内容
      </a>

      {/* 左栏 - Schema 管理栏 */}
      <aside className="caseflow-left">
        <div className="caseflow-left-header">
          <div className="caseflow-logo">
            <div className="caseflow-logo-icon">
              <Share2 size={18} color="#ffffff" />
            </div>
            <div>
              <div className="caseflow-logo-text">CaseFlow</div>
              <div className="caseflow-logo-subtitle">知识图谱案例平台</div>
            </div>
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
                  title="退出登录"
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
                <span>登录</span>
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
                {module.title}
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
            返回主页
          </Link>
        </div>
      </aside>

      {/* 中间主窗口 */}
      <main className="caseflow-main" id="caseflow-main-content">
        <div className="caseflow-top-bar">
          <div className="caseflow-view-tabs" role="tablist">
            <button
              onClick={() => setMainView('graph')}
              className={`caseflow-view-tab ${mainView === 'graph' ? 'active' : ''}`}
              role="tab"
              aria-selected={mainView === 'graph'}
              aria-label="切换到知识图谱视图"
            >
              <Share2 size={16} aria-hidden="true" />
              <span className="caseflow-view-tab-text">知识图谱</span>
            </button>
            <button
              onClick={() => setMainView('ai')}
              className={`caseflow-view-tab ${mainView === 'ai' ? 'active' : ''}`}
              role="tab"
              aria-selected={mainView === 'ai'}
              aria-label="切换到 AI 助手视图"
            >
              <MessageSquare size={16} aria-hidden="true" />
              <span className="caseflow-view-tab-text">AI 助手</span>
            </button>
          </div>
          <span className="caseflow-date">
            {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>

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
            ) : (
              <motion.div
                key="ai"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
                className="h-full"
              >
                <AICopilot onShowLogin={() => setShowLoginModal(true)} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* 右栏 - 案例卡片栏 */}
      <CaseListPanel
        cases={cases}
        filteredCasesList={filteredCasesList}
        focusCaseId={focusCaseId}
        viewMode={viewMode}
        showCreateCase={showCreateCase}
        setShowCreateCase={setShowCreateCase}
        handleCaseSelect={onCaseSelect}
        handleCaseDeselect={onCaseDeselect}
        onDeleteCase={onDeleteCase}
        getCaseSchemaName={getCaseSchemaName}
        setMainView={setMainView}
        isAuthenticated={isAuthenticated}
        onShowLogin={() => setShowLoginModal(true)}
        currentSchema={currentSchema}
      />

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