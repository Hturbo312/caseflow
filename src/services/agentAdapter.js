import { useWorkspaceStore } from '../store/workspaceStore';
import { useGraphStore } from '../store';

export const WORKBENCH_ACTIONS = Object.freeze({
  OPEN_CASE: 'open_case', SWITCH_WORKSPACE: 'switch_workspace', FOCUS_NODE: 'focus_node',
  SHOW_PATH: 'show_path', SHOW_COMPARISON: 'show_comparison', OPEN_EVIDENCE: 'open_evidence',
});

function normalizeActions(value) {
  return Array.isArray(value) ? value.filter((action) => action && typeof action.type === 'string') : [];
}

export function parseAgentEnvelope(content) {
  if (content && typeof content === 'object') return content;
  const text = String(content || '').trim();
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  try {
    const parsed = JSON.parse(match ? match[1] : text);
    return parsed && typeof parsed === 'object' ? parsed : { message: text, actions: [] };
  } catch { return { message: text, actions: [] }; }
}

export function dispatchWorkbenchActions(actions) {
  const workspace = useWorkspaceStore.getState();
  const graph = useGraphStore.getState();
  normalizeActions(actions).forEach(({ type, payload = {} }) => {
    switch (type) {
      case WORKBENCH_ACTIONS.OPEN_CASE: if (payload.caseId != null) workspace.openCaseDetail(payload.caseId, payload.subTab); break;
      case WORKBENCH_ACTIONS.SWITCH_WORKSPACE: if (payload.workspace) workspace.setMainTab(payload.workspace); break;
      case WORKBENCH_ACTIONS.FOCUS_NODE:
        graph.setFocusNode(payload.nodeId || payload.id || null);
        workspace.selectEntity(payload.nodeId || payload.id || null); break;
      case WORKBENCH_ACTIONS.SHOW_PATH: workspace.showWorkbenchResult('path', payload); break;
      case WORKBENCH_ACTIONS.SHOW_COMPARISON: workspace.showWorkbenchResult('comparison', payload); break;
      case WORKBENCH_ACTIONS.OPEN_EVIDENCE: workspace.showWorkbenchResult('evidence', payload); break;
      default: break;
    }
  });
}
