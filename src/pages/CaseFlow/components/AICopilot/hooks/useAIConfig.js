import { useState, useCallback, useEffect } from 'react';
import { useAuthStore } from '@store';
import { useToastStore } from '@components/Toast/ToastStore';
import { aiApi } from '@services/api';

/**
 * Custom hook for AI configuration management
 * Extracts config loading/saving/deleting logic from AICopilot
 */
export const useAIConfig = (onShowLogin) => {
  const { isAuthenticated } = useAuthStore();
  const { error: showError } = useToastStore();

  // Config status from server
  const [configStatus, setConfigStatus] = useState({
    configured: false,
    endpoint: '',
    model: '',
    temperature: 0.7,
    maxTokens: 4096,
    useTemperature: true,
    useMaxTokens: true,
    apiKeyMasked: '',
    embeddingConfigured: false,
    embeddingEndpoint: '',
    embeddingModel: '',
  });

  // Loading states
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Local editing state
  const [localConfig, setLocalConfig] = useState({
    endpoint: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    model: 'qwen-plus',
    temperature: 0.7,
    maxTokens: 4096,
    useTemperature: true,
    useMaxTokens: true,
    embeddingEndpoint: '',
    embeddingModel: 'text-embedding-v3',
  });

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Load config status from server
  const loadConfigStatus = useCallback(async () => {
    setIsLoadingConfig(true);
    try {
      const status = await aiApi.getConfig();
      setConfigStatus(status);
    } catch (error) {
      console.error('Load config status failed:', error);
    }
    setIsLoadingConfig(false);
  }, []);

  // Initialize on mount
  useEffect(() => {
    loadConfigStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open settings modal
  const handleOpenSettings = useCallback(() => {
    setLocalConfig({
      endpoint: configStatus.endpoint || 'https://api.openai.com/v1/chat/completions',
      apiKey: '',
      model: configStatus.model || 'qwen-plus',
      temperature: configStatus.temperature || 0.7,
      maxTokens: configStatus.maxTokens || 4096,
      useTemperature: configStatus.useTemperature !== false,
      useMaxTokens: configStatus.useMaxTokens !== false,
      embeddingEndpoint: configStatus.embeddingEndpoint || '',
      embeddingModel: configStatus.embeddingModel || 'text-embedding-v3',
    });
    setShowApiKey(false);
    setShowSettings(true);
  }, [configStatus]);

  // Save config
  const handleSaveConfig = useCallback(async () => {
    if (!isAuthenticated) {
      setShowSettings(false);
      onShowLogin?.();
      return;
    }

    setIsSavingConfig(true);
    try {
      const configToSave = {
        endpoint: localConfig.endpoint,
        model: localConfig.model,
        temperature: localConfig.temperature,
        maxTokens: localConfig.maxTokens,
        useTemperature: localConfig.useTemperature,
        useMaxTokens: localConfig.useMaxTokens,
        embeddingEndpoint: localConfig.embeddingEndpoint,
        embeddingModel: localConfig.embeddingModel,
      };

      if (localConfig.apiKey.trim()) {
        configToSave.apiKey = localConfig.apiKey.trim();
      }

      const result = await aiApi.saveConfig(configToSave);

      if (result.success) {
        setConfigStatus(prev => ({
          ...prev,
          configured: result.configured,
          endpoint: localConfig.endpoint,
          model: localConfig.model,
          apiKeyMasked: result.apiKeyMasked || prev.apiKeyMasked,
          embeddingConfigured: result.embeddingConfigured || !!localConfig.embeddingEndpoint,
          embeddingEndpoint: localConfig.embeddingEndpoint,
          embeddingModel: localConfig.embeddingModel,
        }));
        setShowSettings(false);
      }
    } catch (error) {
      console.error('Save config failed:', error);
      if (error.message.includes('未登录') || error.message.includes('登录')) {
        setShowSettings(false);
        onShowLogin?.();
        return;
      }
      showError('Save config failed: ' + error.message);
    }
    setIsSavingConfig(false);
  }, [isAuthenticated, localConfig, onShowLogin, showError]);

  // Delete config
  const handleDeleteConfig = useCallback(async () => {
    if (!confirm('确定要删除 AI 配置吗？')) return;
    try {
      await aiApi.deleteConfig();
      setConfigStatus({
        configured: false,
        endpoint: '',
        model: '',
        temperature: 0.7,
        maxTokens: 4096,
        useTemperature: true,
        useMaxTokens: true,
        apiKeyMasked: '',
      });
      setShowSettings(false);
    } catch (error) {
      console.error('Delete config failed:', error);
    }
  }, []);

  // Update local config field
  const updateLocalConfig = useCallback((field, value) => {
    setLocalConfig(prev => ({ ...prev, [field]: value }));
  }, []);

  return {
    // State
    configStatus,
    localConfig,
    isLoadingConfig,
    isSavingConfig,
    showSettings,
    showApiKey,

    // Actions
    loadConfigStatus,
    handleOpenSettings,
    handleSaveConfig,
    handleDeleteConfig,
    setShowSettings,
    setShowApiKey,
    updateLocalConfig,
    setLocalConfig
  };
};

export default useAIConfig;