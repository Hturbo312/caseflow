import { create } from 'zustand';

/**
 * CaseFlow 2.0 工作台全局状态（三栏布局）
 * 中栏 tab、当前案例详情、选中实体/关系、Copilot 上下文任务
 * 与经典布局共享 useCaseStore / useGraphStore / useCompareStore，只换壳不换脑
 */
export const useWorkspaceStore = create((set) => ({
  mainTab: 'home',              // home | graph | schema | case | analysis（home=使用说明，点击任一 tab 后进入对应工作区）
  caseDetailId: null,           // 中栏 Case 工作区当前打开的案例 id（字符串）
  caseSubTab: 'overview',       // overview | source | evidence | review
  selectedEntityId: null,
  workbenchResult: null,
  contextTask: '案例审阅',       // Copilot 上下文任务
  previewCaseId: null,           // 右栏单击 → 预览卡（不抢占中栏，仅 analysis tab）
  copilotSeed: null,             // 「问AI」种子 {text, ts}，CopilotRail 监听后自动发送

  setMainTab: (tab) => set({ mainTab: tab }),
  openPreview: (id) => set({ previewCaseId: String(id) }),
  closePreview: () => set({ previewCaseId: null }),

  // 「问AI」种子：任意视图唤起 Copilot 自动发送（ts 去重）
  askCopilot: (text) => set({ copilotSeed: { text, ts: Date.now() } }),

  // 单击案例 → 选中并在中栏打开详情（Spec §3.3 交互规则）
  openCaseDetail: (id, subTab) => set((state) => ({
    caseDetailId: String(id),
    caseSubTab: subTab || state.caseSubTab || 'overview',
    mainTab: 'case',
  })),
  closeCaseDetail: () => set({ caseDetailId: null }),
  setCaseSubTab: (sub) => set({ caseSubTab: sub }),

  selectEntity: (id) => set({ selectedEntityId: id ? String(id) : null }),
  showWorkbenchResult: (kind, payload = {}) => set({ workbenchResult: { kind, payload, updatedAt: Date.now() } }),
  clearWorkbenchResult: () => set({ workbenchResult: null }),
  setContextTask: (t) => set({ contextTask: t }),
}));
