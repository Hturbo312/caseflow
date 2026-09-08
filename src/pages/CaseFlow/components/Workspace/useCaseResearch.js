import { useEffect } from 'react';
import { useAuthStore } from '../../../../store';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { useResearchStore } from '../../../../store/researchStore';

// 当前登录用户 × 当前案例 的研究材料记录（来源/整理稿/候选知识）。
// 原 ResearchAgent 面板已内化进统一 Copilot，此 hook 供中栏审阅（ThreeLayerCase）继续使用。
export function useCaseResearch() {
  const user = useAuthStore(s => s.user);
  const id = useWorkspaceStore(s => s.caseDetailId);
  const key = `${user?.id}:${id}`;
  const state = useResearchStore();
  useEffect(() => { if (user?.id && id) state.load(key, id); }, [key]);
  return { ...state, key, id, record: state.records[key], working: state.busy[key], error: state.errors[key], selected: state.selection[key] };
}
