import { create } from 'zustand';

/**
 * CaseFlow 2.0 工作台全局状态（三栏布局）
 * 中栏 tab、当前案例详情、选中实体/关系、Copilot 上下文任务
 * 与经典布局共享 useCaseStore / useGraphStore / useCompareStore，只换壳不换脑
 */
export const useWorkspaceStore = create((set) => ({
  mainTab: 'schema',            // schema | case | analysis
  caseDetailId: null,           // 中栏 Case 工作区当前打开的案例 id（字符串）
  caseSubTab: 'overview',       // overview | source | evidence | review
  selectedEntityId: null,
  contextTask: '案例审阅',       // Copilot 上下文条：当前任务

  setMainTab: (tab) => set({ mainTab: tab }),

  // 单击案例 → 选中并在中栏打开详情（Spec §3.3 交互规则）
  openCaseDetail: (id, subTab) => set((state) => ({
    caseDetailId: String(id),
    caseSubTab: subTab || state.caseSubTab || 'overview',
    mainTab: 'case',
  })),
  closeCaseDetail: () => set({ caseDetailId: null }),
  setCaseSubTab: (sub) => set({ caseSubTab: sub }),

  selectEntity: (id) => set({ selectedEntityId: id ? String(id) : null }),
  setContextTask: (t) => set({ contextTask: t }),
}));
