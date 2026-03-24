import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  Share2,
  MessageSquare,
  ChevronLeft,
  FileText,
  X,
  Focus
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGraphStore, useCaseStore, useSchemaStore } from '../store';
import SchemaArchitect from '../components/SchemaArchitect';
import CaseDetail from '../components/CaseDetail';
import KnowledgeGraphCanvas from '../components/KnowledgeGraphCanvas';
import AICopilot from '../components/AICopilot';
import './CaseFlow.css';

const CaseFlow = () => {
  const [leftActiveModule, setLeftActiveModule] = useState('schema');
  const [mainView, setMainView] = useState('graph');
  const { initializeGraph, setFocusCase, focusCaseId, viewMode, loadAllCasesToGraph } = useGraphStore();
  const { cases, currentCaseId, setCurrentCase, loadCases, isLoading: casesLoading } = useCaseStore();
  const { loadSchemas, isLoading: schemasLoading, currentSchemaId } = useSchemaStore();

  // 初始化：从API加载数据
  useEffect(() => {
    const initData = async () => {
      await Promise.all([loadSchemas(), loadCases()]);
      initializeGraph();
    };
    initData();
  }, []);

  // 当 schema 变化时重新加载所有案例
  useEffect(() => {
    loadAllCasesToGraph();
  }, [currentSchemaId]);

  // 处理案例选择 - 切换到聚焦模式
  const handleCaseSelect = (caseItem) => {
    setCurrentCase(caseItem.id);
    // 设置聚焦案例，自动切换到聚焦模式
    setFocusCase(caseItem.id);
  };

  // 处理取消案例选择 - 返回全量模式
  const handleCaseDeselect = () => {
    setCurrentCase(null);
    setFocusCase(null); // 返回全量模式
  };

  const leftModules = [
    { id: 'schema', title: 'Schema 建模', icon: Database, component: SchemaArchitect },
    { id: 'case', title: '案例拆解', icon: FileText, component: CaseDetail },
  ];

  const LeftComponent = leftModules.find(m => m.id === leftActiveModule)?.component || leftModules[0].component;

  // 从 store 获取案例状态显示
  const getCaseStatus = (caseItem) => {
    if (!caseItem.entities || caseItem.entities.length === 0) return 'planning';
    if (caseItem.relations && caseItem.relations.length > 0) return 'completed';
    return 'active';
  };

  const getStatusClass = (status) => {
    if (status === 'active') return 'active';
    if (status === 'completed') return 'completed';
    return 'planning';
  };

  const getStatusText = (status) => {
    if (status === 'active') return '进行中';
    if (status === 'completed') return '已完成';
    return '规划中';
  };

  return (
    <div className="caseflow-wrapper">
      {/* 跳过导航链接 - 无障碍 */}
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
          <LeftComponent />
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
              知识图谱
            </button>
            <button
              onClick={() => setMainView('ai')}
              className={`caseflow-view-tab ${mainView === 'ai' ? 'active' : ''}`}
              role="tab"
              aria-selected={mainView === 'ai'}
              aria-label="切换到 AI 助手视图"
            >
              <MessageSquare size={16} aria-hidden="true" />
              AI 助手
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
                <KnowledgeGraphCanvas />
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
                <AICopilot />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* 右栏 - 案例卡片栏 */}
      <aside className="caseflow-right">
        <div className="caseflow-right-header">
          <h2 className="caseflow-right-title">案例列表</h2>
          <p className="caseflow-right-count">共 {cases.length} 个案例</p>
        </div>

        <div className="caseflow-right-list">
          {cases.map((caseItem) => {
            const status = getCaseStatus(caseItem);
            const isSelected = focusCaseId === caseItem.id;
            const caseType = caseItem.tags?.[0] || caseItem.schemaId || '未分类';

            return (
              <motion.div
                key={caseItem.id}
                onClick={() => handleCaseSelect(caseItem)}
                whileHover={{ y: -3 }}
                className={`caseflow-card ${isSelected ? 'selected' : ''}`}
              >
                <div className="caseflow-card-header">
                  <h3 className="caseflow-card-title">{caseItem.name}</h3>
                  {isSelected && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCaseDeselect();
                      }}
                      className="caseflow-card-close"
                      aria-label="取消聚焦，返回全量模式"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <span className="caseflow-card-badge">{caseType}</span>
                <div className="caseflow-card-status">
                  <div className={`caseflow-status-dot ${getStatusClass(status)}`} />
                  <span className="caseflow-status-text">{getStatusText(status)}</span>
                </div>
                {caseItem.entities && caseItem.entities.length > 0 && (
                  <div className="caseflow-card-meta">
                    <span>{caseItem.entities.length} 实体</span>
                    <span>{caseItem.relations?.length || 0} 关系</span>
                  </div>
                )}
                {isSelected && viewMode === 'focused' && (
                  <div className="caseflow-card-focus-indicator">
                    <Focus size={12} />
                    <span>聚焦中</span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        <AnimatePresence>
          {focusCaseId && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="caseflow-preview-panel"
            >
              <h4 className="caseflow-preview-title">
                聚焦案例 · {viewMode === 'focused' ? '深度模式' : '全量模式'}
              </h4>
              <p className="caseflow-preview-text">
                {cases.find(c => c.id === focusCaseId)?.description || '暂无描述'}
              </p>
              <div className="caseflow-preview-actions">
                <button
                  className="caseflow-preview-btn"
                  onClick={() => setLeftActiveModule('case')}
                  aria-label="查看案例详情"
                >
                  查看详情
                </button>
                <button
                  className="caseflow-preview-btn-secondary"
                  onClick={handleCaseDeselect}
                  aria-label="返回全量视图"
                >
                  返回全量
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </aside>
    </div>
  );
};

export default CaseFlow;
