import React from 'react';
import { motion } from 'framer-motion';
import { Send, Loader2, RefreshCw } from 'lucide-react';
import { useI18n } from '../../../../../i18n';

/**
 * AdjustmentModal — 案例拆解模式的调整输入弹窗
 * 从 AICopilot/index.jsx 中提取
 */
const AdjustmentModal = ({
  inputValue,
  setInputValue,
  isThinking,
  onSend,
  tKey = 'ai.adjustTitle'
}) => {
  const { t } = useI18n();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black/30 backdrop-blur-sm z-20 flex items-end p-4"
      onClick={() => setInputValue('')}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className="w-full bg-white rounded-2xl shadow-xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-3">
          <RefreshCw className="w-4 h-4 text-indigo-500" />
          <span className="font-medium text-gray-700">{t(tKey)}</span>
        </div>
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={t('ai.adjustPlaceholder')}
          rows={3}
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          autoFocus
        />
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setInputValue('')}
            className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={async () => {
              if (inputValue.trim()) {
                try {
                  await onSend(inputValue);
                } catch (error) {
                  console.error('Adjustment send failed:', error);
                }
              }
            }}
            disabled={!inputValue.trim() || isThinking}
            className="flex-1 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isThinking ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('ai.processing')}
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                {t('ai.sendAdjustment')}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AdjustmentModal;
