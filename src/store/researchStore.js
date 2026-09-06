import { create } from 'zustand';
import { researchApi } from '../services/api';
import { useAuthStore } from './index';

export const useResearchStore = create((set, get) => ({
  records: {}, busy: {}, errors: {}, selection: {},
  async load(key, caseId) {
    try { const record = await researchApi.get(caseId); set(s => ({ records: { ...s.records, [key]: (s.records[key]?.revision > record.revision ? s.records[key] : record) }, errors: { ...s.errors, [key]: '' } })); }
    catch (e) { set(s => ({ errors: { ...s.errors, [key]: e.message } })); }
  },
  async act(key, caseId, action, payload) {
    if (key !== `${useAuthStore.getState().user?.id}:${caseId}`) throw new Error('账户已变化，任务已停止，请重新登录后重试。');
    const record = get().records[key];
    if (!record) throw new Error('请先加载研究材料。');
    const updated = await researchApi.act(caseId, record.revision, action, payload);
    set(s => ({ records: { ...s.records, [key]: updated } }));
    return updated;
  },
  setBusy: (key, value) => set(s => ({ busy: { ...s.busy, [key]: value } })),
  select: (key, selection) => set(s => ({ selection: { ...s.selection, [key]: selection } })),
}));
