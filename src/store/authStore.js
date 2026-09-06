import { create } from 'zustand';
import { schemaApi, caseApi, authApi, agentApi, chatApi, extractionApi } from '../services/api';
import { authHelper, API_BASE_URL } from '../utils';

// Auth Store
// ============================================
export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: authHelper.isAuthenticated(),
  isLoading: false,
  error: null,

  // 登录
  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await authApi.login(username, password);
      set({
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
      return { success: true };
    } catch (error) {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  },

  // 注册
  register: async (username, password, email) => {
    set({ isLoading: true, error: null });
    try {
      const data = await authApi.register(username, password, email);
      set({
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
      return { success: true };
    } catch (error) {
      set({
        isLoading: false,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  },

  // 登出
  logout: () => {
    authHelper.removeToken();
    set({
      user: null,
      isAuthenticated: false,
      error: null
    });
  },

  // 验证登录状态
  verifyAuth: async () => {
    if (!authHelper.isAuthenticated()) {
      set({ isAuthenticated: false, user: null });
      return false;
    }

    try {
      const data = await authApi.verify();
      set({
        isAuthenticated: data.valid,
        user: data.user
      });
      return data.valid;
    } catch {
      set({ isAuthenticated: false, user: null });
      return false;
    }
  },

  // 清除错误
  clearError: () => set({ error: null }),

  // 语言设置（?lang=en/zh URL 参数优先，便于分享与测试）
  locale: (() => {
    const q = new URLSearchParams(window.location.search).get('lang');
    if (q === 'zh' || q === 'en') return q;
    return localStorage.getItem('caseflow_locale') || 'zh';
  })(),
  setLocale: (locale) => {
    localStorage.setItem('caseflow_locale', locale);
    set({ locale });
  },
}));

// 默认 Schema 数据

// 注册认证过期回调：API 返回 401 清除 token 时，同步清除 auth store
authHelper.onAuthExpired(() => {
  useAuthStore.setState({ isAuthenticated: false, user: null });
});
