/**
 * Authentication helper utilities
 */

import { TOKEN_KEY } from './constants';

// 认证过期回调列表（store 注册监听）
let authExpiredListeners = [];

/**
 * Authentication helper object for token management
 */
export const authHelper = {
  /**
   * Get authentication token from localStorage
   */
  getToken: () => localStorage.getItem(TOKEN_KEY),

  /**
   * Set authentication token in localStorage
   */
  setToken: (token) => localStorage.setItem(TOKEN_KEY, token),

  /**
   * Remove authentication token from localStorage，并通知所有监听者
   */
  removeToken: () => {
    localStorage.removeItem(TOKEN_KEY);
    authExpiredListeners.forEach(fn => { try { fn(); } catch {} });
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated: () => !!localStorage.getItem(TOKEN_KEY),

  /**
   * 注册认证过期回调（store 用它来同步清除状态）
   */
  onAuthExpired: (fn) => {
    authExpiredListeners.push(fn);
    return () => { authExpiredListeners = authExpiredListeners.filter(f => f !== fn); };
  },
};

/**
 * Get authorization header for API requests
 * @returns {Object} Headers object with Authorization if token exists
 */
export const getAuthHeaders = () => {
  const token = authHelper.getToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

/**
 * Clear authentication state
 */
export const clearAuth = () => {
  authHelper.removeToken();
};