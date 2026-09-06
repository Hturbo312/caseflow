import { create } from 'zustand';
import { schemaApi, caseApi, authApi, agentApi, chatApi, extractionApi } from '../services/api';
import { authHelper, API_BASE_URL } from '../utils';

// ============ AI Store ============
export const useAIStore = create((set, get) => ({
  messages: [],
  isThinking: false,
  currentContext: null,

  addMessage: (message) => set((state) => ({ messages: [...state.messages, { ...message, id: Date.now(), timestamp: new Date() }] })),
  setThinking: (isThinking) => set({ isThinking }),
  setContext: (context) => set({ currentContext: context }),
  clearMessages: () => set({ messages: [] }),
}));
