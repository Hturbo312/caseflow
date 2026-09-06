import { X, Database, FileUp, ClipboardCheck, Share2, BarChart3 } from 'lucide-react';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { useI18n } from '../../../../i18n';

/**
 * 研究流水线条（顶栏下的任务导航）
 * 按真实研究流程串联五个阶段，替代「猜功能在哪个 tab」的心智负担
 * 定框架(Schema) → 录入(文档导入) → 审阅(案例审阅) → 探索(图谱) → 分析(对比)
 * 可关闭，状态持久化（cf_pipeline）
 */
const STEPS = [
  { id: 'schema', icon: Database, label: 'ux.step.schema', task: 'v2.task.schema' },
  { id: 'import', icon: FileUp, label: 'ux.step.import', task: null },
  { id: 'review', icon: ClipboardCheck, label: 'ux.step.review', task: 'v2.task.case' },
  { id: 'graph', icon: Share2, label: 'ux.step.graph', task: 'v2.task.graph' },
  { id: 'analysis', icon: BarChart3, label: 'ux.step.analysis', task: 'v2.task.analysis' },
];

const WorkflowNav = ({ switchTab, caseCount, isAuthenticated, onShowLogin }) => {
  const { t } = useI18n();
  const { mainTab, caseSubTab, setExtractorOpen, setPipelineVisible, setContextTask } = useWorkspaceStore();

  const goto = (tab, taskKey) => {
    switchTab(tab);
    if (taskKey) setContextTask(taskKey);
  };

  const onStep = (id) => {
    if (id === 'schema') return goto('schema', 'v2.task.schema');
    if (id === 'import') {
      if (!isAuthenticated) return onShowLogin?.();
      setExtractorOpen(true);
      return;
    }
    if (id === 'review') {
      // 审阅 = 案例 tab 的 review 子页
      goto('case', 'v2.task.case');
      return;
    }
    if (id === 'graph') return goto('graph', 'v2.task.graph');
    if (id === 'analysis') return goto('analysis', 'v2.task.analysis');
  };

  const activeId = mainTab === 'case' && caseSubTab === 'review' ? 'review' : mainTab;

  return (
    <div className="v2-pipeline" role="navigation" aria-label={t('ux.pipeline.aria')}>
      <span className="v2-pipeline-label">{t('ux.pipeline.label')}</span>
      <div className="v2-pipeline-steps">
        {STEPS.map(({ id, icon: Icon, label, task }) => (
          <button
            key={id}
            className={`v2-pipeline-step ${activeId === id ? 'active' : ''}`}
            onClick={() => onStep(id)}
            title={task ? t(task) : t('ux.step.import')}
          >
            <Icon size={13} />
            <span>{t(label)}</span>
            {id === 'import' && caseCount > 0 && <i className="v2-pipeline-count">{caseCount}</i>}
          </button>
        ))}
      </div>
      <button
        className="v2-pipeline-close"
        onClick={() => setPipelineVisible(false)}
        title={t('ux.pipeline.dismiss')}
        aria-label={t('ux.pipeline.dismiss')}
      >
        <X size={13} />
      </button>
    </div>
  );
};

export default WorkflowNav;
