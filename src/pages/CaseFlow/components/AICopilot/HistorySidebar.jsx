import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { X, Clock, Trash2, MessageCirclePlus } from 'lucide-react';
import { useI18n } from '../../../../i18n';

/**
 * HistorySidebar - 历史会话侧边栏组件
 * 显示用户的历史会话记录，支持加载、删除和新建会话
 */
const HistorySidebar = memo(({
  showHistory,
  isAuthenticated,
  sessionHistory,
  currentSessionId,
  onLoadSession,
  onDeleteSession,
  onNewSession,
  onClose
}) => {
  const { t } = useI18n();
  if (!showHistory || !isAuthenticated) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="absolute left-0 top-0 bottom-0 w-72 bg-gray-50 border-r border-gray-200 z-10 flex flex-col"
    >
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-700">{t('ai.historyTitle')}</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 rounded"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessionHistory.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">
            {t('ai.historyEmpty')}
          </div>
        ) : (
          sessionHistory.map((session) => (
            <div
              key={session.session_id}
              className={`group p-3 rounded-lg hover:bg-white cursor-pointer transition-colors ${
                currentSessionId === session.session_id ? 'bg-white border border-gray-200' : ''
              }`}
              onClick={() => onLoadSession(session.session_id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">
                    {session.title || t('ai.untitled')}
                  </p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {formatDate(session.updated_at || session.created_at, t)}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.session_id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="p-3 border-t border-gray-200">
        <button
          onClick={onNewSession}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white rounded-lg hover:bg-gray-100 transition-colors text-sm text-gray-600"
        >
          <MessageCirclePlus className="w-4 h-4" />
          {t('ai.newSessionBtn')}
        </button>
      </div>
    </motion.div>
  );
});

/**
 * 格式化日期显示
 * @param {string} dateString - ISO日期字符串
 * @returns {string} 格式化后的日期
 */
const formatDate = (dateString, t) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t('ai.justNow');
  if (diffMins < 60) return t('ai.minutesAgo', { count: diffMins });
  if (diffHours < 24) return t('ai.hoursAgo', { count: diffHours });
  if (diffDays < 7) return t('ai.daysAgo', { count: diffDays });

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric'
  });
};

HistorySidebar.displayName = 'HistorySidebar';

export default HistorySidebar;