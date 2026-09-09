import { create } from 'zustand';
import { researchRequest } from '../services/researchWorkspace';

export const useResearchWorkspaceStore = create((set) => ({
  records: {}, selections: {},
  async load(key, caseId) {
    const record = await researchRequest(caseId);
    set(state => {
      const previous = state.records[key];
      if (previous?.revision > record.revision) return state;
      return { records: { ...state.records, [key]: { ...record, data: previous?.revision === record.revision ? previous.data : record.data } } };
    });
    return record;
  },
  select: (key, selection) => set(state => ({ selections: { ...state.selections, [key]: selection } })),
}));
