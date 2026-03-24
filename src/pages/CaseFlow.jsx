import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  Share2,
  MessageSquare,
  ChevronLeft,
  FileText,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGraphStore, useCaseStore } from '../store';
import SchemaArchitect from '../components/SchemaArchitect';
import CaseDetail from '../components/CaseDetail';
import KnowledgeGraphCanvas from '../components/KnowledgeGraphCanvas';
import AICopilot from '../components/AICopilot';
import './CaseFlow.css';

const CaseFlow = () => {
  const [leftActiveModule, setLeftActiveModule] = useState('schema');
  const [mainView, setMainView] = useState('graph');
  const { initializeGraph, syncCurrentCaseToGraph } = useGraphStore();
  const { cases, currentCaseId, setCurrentCase } = useCaseStore();

  // 初始化图谱数据
  useEffect(() => {
    initializeGraph();
  }, []);

  // 处理案例选择 - 同步到 store 和图谱
  const handleCaseSelect = (caseItem) => {
    setCurrentCase(caseItem.id);
    // 延迟一帧确保 store 更新后再同步图谱
    setTimeout(() => {
      syncCurrentCaseToGraph();
    }, 0);
  };

  const leftModules = [
    { id: 'schema', title: 'Schema 建模', icon: Database, component: SchemaArchitect },
    { id: 'case', title: '案例详情', icon: FileText, component: CaseDetail },
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
            const isSelected = currentCaseId === caseItem.id;
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
                        setCurrentCase(null);
                      }}
                      className="caseflow-card-close"
                      aria-label="关闭选中案例"
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
              </motion.div>
            );
          })}
        </div>

        <AnimatePresence>
          {currentCaseId && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="caseflow-preview-panel"
            >
              <h4 className="caseflow-preview-title">快速预览</h4>
              <p className="caseflow-preview-text">
                {cases.find(c => c.id === currentCaseId)?.description || '暂无描述'}
              </p>
              <button
                className="caseflow-preview-btn"
                onClick={() => setLeftActiveModule('case')}
                aria-label="查看案例详情"
              >
                查看详情
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </aside>
    </div>
  );
};

export default CaseFlow;
