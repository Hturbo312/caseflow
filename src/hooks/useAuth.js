import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store';

/**
 * Custom hook for authentication state management and initialization
 * Extracts common auth patterns from components
 */
export const useAuth = () => {
  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    verifyAuth,
    clearError
  } = useAuthStore();

  const [initialized, setInitialized] = useState(false);

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      await verifyAuth();
      setInitialized(true);
    };
    initAuth();
  }, [verifyAuth]);

  // Handle login with redirect option
  const handleLogin = useCallback(async (username, password) => {
    const result = await login(username, password);
    return result;
  }, [login]);

  // Handle logout with optional redirect
  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  // Check if user has specific permission
  const hasPermission = useCallback((permission) => {
    if (!user || !user.permissions) return false;
    return user.permissions.includes(permission);
  }, [user]);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    initialized,
    handleLogin,
    logout: handleLogout,  // 重命名以匹配调用方期望
    hasPermission,
    clearError,
    verifyAuth
  };
};

export default useAuth;