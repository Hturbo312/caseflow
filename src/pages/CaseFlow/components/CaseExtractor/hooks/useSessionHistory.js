import { useState, useCallback, useEffect } from 'react';
import { useAgentStore, useAuthStore } from '@store';
import { chatApi } from '@services/api';
import { useI18n } from '../../../../../i18n';

/**
 * Custom hook for session history management
 * Extracts session history logic from AICopilot
 */
export const useSessionHistory = (agentName) => {
  const { t } = useI18n();
  const { isAuthenticated } = useAuthStore();
  const {
    sessions,
    currentAgentName,
    loadSessionMessages,
    startNewSession,
    deleteSession
  } = useAgentStore();

  const currentSession = sessions[currentAgentName] || {};
  const [showHistory, setShowHistory] = useState(false);
  const [sessionHistory, setSessionHistory] = useState([]);

  // Load history from API
  const loadHistory = useCallback(async () => {
    try {
      const data = await chatApi.getSessions(agentName);
      setSessionHistory(data.sessions || []);
    } catch (error) {
      console.error('Load session history failed:', error);
    }
  }, [agentName]);

  // Load session history when agent changes (regardless of auth — demo data is public)
  useEffect(() => {
    if (agentName) {
      loadHistory();
    }
  }, [agentName, loadHistory]);

  // Load specific session messages
  const handleLoadSession = useCallback(async (sessionId) => {
    await loadSessionMessages(sessionId);
    setShowHistory(false);
  }, [loadSessionMessages]);

  // Start new session
  const handleNewSession = useCallback(() => {
    startNewSession();
    setShowHistory(false);
    setSessionHistory([]); // Clear local history
  }, [startNewSession]);

  // Delete session
  const handleDeleteSession = useCallback(async (sessionId) => {
    if (!confirm(t('session.confirmDelete'))) return;
    await deleteSession(sessionId);
    // Refresh history
    loadHistory();
  }, [deleteSession, loadHistory, t]);

  // Format date for display
  const formatDate = useCallback((dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return t('session.today') + ' ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return t('session.yesterday') + ' ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
      return t('session.daysAgoShort', { count: diffDays });
    } else {
      return date.toLocaleDateString();
    }
  }, [t]);

  return {
    // State
    showHistory,
    sessionHistory,
    currentSession,

    // Actions
    setShowHistory,
    loadHistory,
    handleLoadSession,
    handleNewSession,
    handleDeleteSession,
    formatDate
  };
};

export default useSessionHistory;