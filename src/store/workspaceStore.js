import { create } from 'zustand';

/**
 * CaseFlow 2.0 工作台全局状态（三栏布局）
 * 中栏 tab、当前案例详情、选中实体/关系、Copilot 上下文任务
 * 与经典布局共享 useCaseStore / useGraphStore / useCompareStore，只换壳不换脑
 */
export const useWorkspaceStore = create((set) => ({
  mainTab: 'case',              // Research begins with a case; graph remains an exploration tool.
  caseDetailId: null,           // 中栏 Case 工作区当前打开的案例 id（字符串）
  caseSubTab: 'overview',       // overview | source | evidence | review
  selectedEntityId: null,
  contextTask: 'v2.task.case',  // Copilot 上下文条：当前任务（存 i18n key，显示时由 CopilotRail 调 t()）

  // —— 工作流改造（预览 / 导入向导 / 流水线条 / 问AI 种子）——
  previewCaseId: null,          // 右栏单击 → 预览卡案例 id（不抢占中栏）
  extractorOpen: false,         // 「从文档导入」向导覆盖层
  copilotSeed: null,            // { text, ts }：问AI 种子，CopilotRail 监听后自动发送
  pipelineVisible: localStorage.getItem('cf_pipeline') !== '0',

  setMainTab: (tab) => set({ mainTab: tab }),

  // 预览：右栏单击案例只出预览卡，不打断中栏
  openPreview: (id) => set({ previewCaseId: String(id) }),
  closePreview: () => set({ previewCaseId: null }),

  // opts.switchTab === false 时保持当前中栏 tab（预览卡的「打开」才切）
  openCaseDetail: (id, subTab, opts = {}) => set((state) => ({
    caseDetailId: String(id),
    caseSubTab: subTab || state.caseSubTab || 'overview',
    mainTab: opts.switchTab === false ? state.mainTab : 'case',
    previewCaseId: null,
  })),
  closeCaseDetail: () => set({ caseDetailId: null }),
  setCaseSubTab: (sub) => set({ caseSubTab: sub }),

  selectEntity: (id) => set({ selectedEntityId: id ? String(id) : null }),
  setContextTask: (t) => set({ contextTask: t }),

  setExtractorOpen: (v) => set({ extractorOpen: !!v }),
  setPipelineVisible: (v) => {
    localStorage.setItem('cf_pipeline', v ? '1' : '0');
    set({ pipelineVisible: !!v });
  },

  // 「问AI」：任何视图带着上下文问题呼叫 Copilot，CopilotRail 收到种子后自动发送
  askCopilot: (text) => set({ copilotSeed: { text: String(text || '').slice(0, 600), ts: Date.now() } }),
}));
