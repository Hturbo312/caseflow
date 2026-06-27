import React, { memo } from 'react';
import { motion } from 'framer-motion';
import {
  Building,
  Link2,
  ArrowRight,
  Save,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { useI18n } from '../../../../i18n';

/**
 * ExtractResultPanel - 案例拆解结果展示面板
 * 显示AI提取的实体和关系，支持保存和调整操作
 */
const ExtractResultPanel = memo(({
  extractResult,
  isThinking,
  isSaving,
  selectedCaseId,
  onConfirmSave,
  onRequestAdjustment,
  onStartPipeline
}) => {
  const { t } = useI18n();

  // 处理中状态
  if (isThinking && !extractResult) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  // 解析错误
  if (extractResult?.parse_error) {
    return (
      <div className="p-4 bg-red-50 rounded-xl border border-red-200 text-center">
        <p className="text-sm text-red-600">{t('ai.parseError')}</p>
      </div>
    );
  }

  // 无结果
  if (!extractResult) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* 总结 */}
      {extractResult.summary && (
        <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
          <p className="text-sm text-indigo-700">{extractResult.summary}</p>
        </div>
      )}

      {/* 实体列表 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-indigo-500" />
            <span className="font-semibold text-gray-700">{t('ai.extractedEntities')}</span>
          </div>
          <span className="text-sm text-gray-500">{extractResult.entities?.length || 0}</span>
        </div>
        <div className="max-h-48 overflow-y-auto">
          {extractResult.entities?.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {extractResult.entities.map((entity, index) => (
                <div key={index} className="p-3 hover:bg-gray-50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-800">{entity.name}</span>
                    <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full">
                      {entity.entityType}
                    </span>
                  </div>
                  {entity.properties && Object.keys(entity.properties).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {Object.entries(entity.properties).slice(0, 4).map(([key, value]) => (
                        <span key={key} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                          {key}: {String(value).substring(0, 15)}{String(value).length > 15 ? '...' : ''}
                        </span>
                      ))}
                      {Object.keys(entity.properties).length > 4 && (
                        <span className="text-xs text-gray-400">+{Object.keys(entity.properties).length - 4}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500 text-sm">{t('ai.noEntities')}</div>
          )}
        </div>
      </div>

      {/* 关系列表 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-purple-500" />
            <span className="font-semibold text-gray-700">{t('ai.extractedRelations')}</span>
          </div>
          <span className="text-sm text-gray-500">{extractResult.relations?.length || 0}</span>
        </div>
        <div className="max-h-40 overflow-y-auto">
          {extractResult.relations?.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {extractResult.relations.map((rel, index) => (
                <div key={index} className="p-3 flex items-center gap-2 text-sm">
                  <span className="font-medium text-blue-600">{rel.sourceName}</span>
                  <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-600 rounded text-xs font-medium">
                    {rel.name}
                  </span>
                  <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <span className="font-medium text-green-600">{rel.targetName}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500 text-sm">{t('ai.noRelations')}</div>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onConfirmSave}
          disabled={isSaving}
          className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('ai.saving')}
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {t('ai.confirmSave')}
            </>
          )}
        </button>
        <button
          onClick={onRequestAdjustment}
          className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          {t('ai.adjustResult')}
        </button>
      </div>

      {/* 进入多轮提取（Pipeline 模式） */}
      {onStartPipeline && (
        <button
          onClick={onStartPipeline}
          className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          {t('ai.startPipeline')}
        </button>
      )}

      {/* 提示信息 */}
      {!selectedCaseId && (
        <p className="text-xs text-gray-500 text-center bg-amber-50 p-2 rounded-lg">
          {t('ai.hintNewCase')}
        </p>
      )}
    </motion.div>
  );
});

ExtractResultPanel.displayName = 'ExtractResultPanel';

export default ExtractResultPanel;