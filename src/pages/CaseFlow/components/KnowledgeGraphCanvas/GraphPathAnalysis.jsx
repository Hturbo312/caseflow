import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Route, Target, ArrowRight, X, AlertTriangle } from 'lucide-react';
import { useI18n } from '../../../../i18n';

const GraphPathAnalysis = ({
  show,
  onClose,
  nodes,
  pathStartNode,
  pathEndNode,
  pathResult,
  onResetSelection,
}) => {
  const { t } = useI18n();
  const prefersReducedMotion = useReducedMotion();

  if (!show) return null;

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25 }}
      className="mt-2 p-2 bg-green-50 rounded-lg overflow-hidden border border-green-200"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Route className="w-3.5 h-3.5 text-green-600" />
          <h4 className="text-xs font-semibold text-green-700">{t('path.title')}</h4>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('toolbar.close')}
          className="p-1 hover:bg-green-200 rounded"
        >
          <X className="w-3 h-3 text-green-600" />
        </button>
      </div>

      {/* 使用指引 */}
      <div className="text-[10px] text-green-600 mb-2 bg-green-100/50 px-2 py-1 rounded">
        {nodes.length === 0 ? (
          <span className="text-amber-600">{t('path.empty')}</span>
        ) : !pathStartNode ? (
          <span>{t('path.hintStart')}</span>
        ) : !pathEndNode ? (
          <span>{t('path.hintEnd')}</span>
        ) : null}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Target className="w-3 h-3 text-blue-500" />
          <span className="text-[10px] text-green-600">{t('path.start')}：</span>
          {pathStartNode ? (
            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium">
              {pathStartNode.name}
            </span>
          ) : (
            <span className="text-[10px] text-gray-400 italic">{t('path.waiting')}</span>
          )}
        </div>
        <ArrowRight className="w-3 h-3 text-gray-400" />
        <div className="flex items-center gap-1.5">
          <Target className="w-3 h-3 text-purple-500" />
          <span className="text-[10px] text-green-600">{t('path.end')}：</span>
          {pathEndNode ? (
            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium">
              {pathEndNode.name}
            </span>
          ) : (
            <span className="text-[10px] text-gray-400 italic">{t('path.waiting')}</span>
          )}
        </div>
        {/* 重置选择按钮 */}
        {pathStartNode && (
          <button
            type="button"
            onClick={onResetSelection}
            className="text-[10px] text-green-600 hover:text-green-700 underline"
          >
            {t('path.reselect')}
          </button>
        )}
      </div>

      {/* 路径结果 - 显示完整路径序列 */}
      {pathResult.length > 0 && (
        <div className="mt-3 pt-3 border-t border-green-200">
          <div className="text-xs text-green-600 mb-2">
            {t('path.found', { count: pathResult.length })}
          </div>
          <div className="flex flex-wrap items-center gap-1 text-[10px]">
            {/* 起点 */}
            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
              {pathStartNode?.name}
            </span>
            {/* 路径序列 */}
            {pathResult.map((link, index) => {
              const targetId = typeof link.target === 'object' ? link.target.id : link.target;
              const targetNode = nodes.find(n => n.id === targetId);
              return (
                <React.Fragment key={link.id || index}>
                  <ArrowRight className="w-3 h-3 text-gray-400" />
                  <span className="px-1.5 py-0.5 bg-green-200 text-green-700 rounded">
                    {link.name}
                  </span>
                  <ArrowRight className="w-3 h-3 text-gray-400" />
                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded">
                    {targetNode?.name || t('detail.link.unknown')}
                  </span>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
      {pathStartNode && pathEndNode && pathResult.length === 0 && (
        <div className="mt-3 text-xs text-amber-600 italic flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {t('path.notFound')}
        </div>
      )}
    </motion.div>
  );
};

export default GraphPathAnalysis;