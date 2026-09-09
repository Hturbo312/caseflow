import { createElement } from 'react';
import { BookOpen, FolderOpen, BarChart3, ChevronRight, MessageSquareText } from 'lucide-react';
import './workspace-guide.css';

/**
 * 工作区使用说明（mainTab='home'，未点击任何 tab 时的中栏首屏）
 * 介绍三个工作区与左右栏分工；点击步骤或顶栏 tab 进入对应工作区。
 */
const STEPS = [
  {
    icon: BookOpen,
    title: '研究框架',
    tab: 'schema',
    text: '定义领域的概念与关系结构。图中点选实体或关系即可查看与修订，右侧时间线记录框架的版本演进。',
  },
  {
    icon: FolderOpen,
    title: '案例研究',
    tab: 'case',
    text: '创建新案例或从右侧案例集选择。在左侧上传材料并与 Agent 对话，得到带来源索引的 AI 总结稿与关系图，点击引用可回到原文。',
  },
  {
    icon: BarChart3,
    title: '研究分析',
    tab: 'analysis',
    text: '跨案例对比主题、实体与关系，支持案例集图谱总览与分析结果核验。',
  },
];

export default function WorkspaceGuide({ onOpenTab }) {
  return <section className="wsg" aria-label="工作区使用说明">
    <div className="wsg-card">
      <span className="wsg-label">CaseFlow 工作台</span>
      <h2>从框架到案例，证据相连的研究流程</h2>
      <p>左侧 AI 助手与右侧案例集始终可用。选择一个工作区开始：</p>
      <ol>
        {STEPS.map(({ icon, title, text, tab }, i) => (
          <li key={tab}>
            <button className="wsg-step" onClick={() => onOpenTab(tab)}>
              <span className="wsg-step-icon">{createElement(icon, { size: 21 })}</span>
              <span className="wsg-step-body">
                <strong>{i + 1}. {title}</strong>
                <p>{text}</p>
              </span>
              <ChevronRight className="wsg-step-next" size={18} />
            </button>
          </li>
        ))}
      </ol>
      <div className="wsg-actions">
        <button className="wsg-primary" onClick={() => onOpenTab('case')}>
          <FolderOpen size={16} /> 进入案例研究
        </button>
        <button className="wsg-secondary" onClick={() => onOpenTab('schema')}>
          <BookOpen size={16} /> 查看研究框架
        </button>
      </div>
      <small className="wsg-hint">
        <MessageSquareText size={13} /> 提示：左侧对话框可直接上传材料；右栏案例集单击预览、双击打开。
      </small>
    </div>
  </section>;
}
