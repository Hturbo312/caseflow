import React, { memo } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Shield,
  CheckCircle,
  Lightbulb,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';
import { useI18n } from '../../../../i18n';

/**
 * SettingsModal - AI配置设置弹窗
 * 允许用户配置API Endpoint、API Key和Model
 */
const SettingsModal = memo(({
  showSettings,
  isAuthenticated,
  configStatus,
  localConfig,
  isSavingConfig,
  showApiKey,
  onSaveConfig,
  onDeleteConfig,
  onClose,
  onSetLocalConfig,
  onToggleApiKey
}) => {
  const { t } = useI18n();
  if (!showSettings || !isAuthenticated) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-500" />
            <h3 className="text-lg font-bold">{t('ai.aiConfig')}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {configStatus.configured && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-700 mb-2">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">{t('ai.configured')}</span>
            </div>
            <div className="text-xs text-green-600 space-y-1">
              <p>Endpoint: {configStatus.endpoint}</p>
              <p>API Key: {configStatus.apiKeyMasked}</p>
              {configStatus.model && <p>Model: {configStatus.model}</p>}
              {configStatus.embeddingConfigured && configStatus.embeddingEndpoint && (
                <p>Embedding: {configStatus.embeddingEndpoint} ({configStatus.embeddingModel})</p>
              )}
            </div>
          </div>
        )}

        {!configStatus.configured && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 text-amber-700">
              <Lightbulb className="w-4 h-4" />
              <span className="text-sm">{t('ai.unconfigured')}</span>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('ai.apiEndpoint')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={localConfig.endpoint}
              onChange={(e) => onSetLocalConfig({ ...localConfig, endpoint: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('ai.apiKey')} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={localConfig.apiKey}
                onChange={(e) => onSetLocalConfig({ ...localConfig, apiKey: e.target.value })}
                placeholder={configStatus.apiKeyMasked || 'sk-...'}
                className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
              />
              <button
                type="button"
                onClick={onToggleApiKey}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
            <input
              type="text"
              value={localConfig.model}
              onChange={(e) => onSetLocalConfig({ ...localConfig, model: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
            />
          </div>

          {/* Embedding 配置（可选） */}
          <div className="pt-2 border-t border-gray-100">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Embedding 配置</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('ai.embeddingEndpoint')}
                </label>
                <input
                  type="text"
                  value={localConfig.embeddingEndpoint || ''}
                  onChange={(e) => onSetLocalConfig({ ...localConfig, embeddingEndpoint: e.target.value })}
                  placeholder="https://api.openai.com/v1/embeddings"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('ai.embeddingModel')}
                </label>
                <input
                  type="text"
                  value={localConfig.embeddingModel || ''}
                  onChange={(e) => onSetLocalConfig({ ...localConfig, embeddingModel: e.target.value })}
                  placeholder="text-embedding-v3"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                />
              </div>
              <p className="text-xs text-gray-400">{t('ai.embeddingHint')}</p>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={onSaveConfig}
              disabled={isSavingConfig || !localConfig.endpoint}
              className="flex-1 py-2.5 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSavingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {t('ai.saveConfig')}
            </button>
            {configStatus.configured && (
              <button
                onClick={onDeleteConfig}
                className="px-4 py-2.5 text-red-600 border border-red-200 rounded-lg font-medium hover:bg-red-50 transition-colors"
              >
                {t('ai.delete')}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});

SettingsModal.displayName = 'SettingsModal';

export default SettingsModal;