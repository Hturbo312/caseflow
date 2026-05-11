/**
 * Authentication helper utilities
 */

import { TOKEN_KEY } from './constants';

/**
 * Authentication helper object for token management
 */
export const authHelper = {
  /**
   * Get authentication token from localStorage
   * @returns {string|null} Token string or null
   */
  getToken: () => localStorage.getItem(TOKEN_KEY),

  /**
   * Set authentication token in localStorage
   * @param {string} token - Token string
   */
  setToken: (token) => localStorage.setItem(TOKEN_KEY, token),

  /**
   * Remove authentication token from localStorage
   */
  removeToken: () => localStorage.removeItem(TOKEN_KEY),

  /**
   * Check if user is authenticated
   * @returns {boolean} True if token exists
   */
  isAuthenticated: () => !!localStorage.getItem(TOKEN_KEY),
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