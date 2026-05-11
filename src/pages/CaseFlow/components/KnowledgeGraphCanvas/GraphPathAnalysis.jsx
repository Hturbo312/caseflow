import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Route, Target, ArrowRight, X, AlertTriangle } from 'lucide-react';

const GraphPathAnalysis = ({
  show,
  onClose,
  nodes,
  pathStartNode,
  pathEndNode,
  pathResult,
  onResetSelection,
}) => {
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
          <h4 className="text-xs font-semibold text-green-700">路径分析</h4>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭路径分析面板"
          className="p-1 hover:bg-green-200 rounded"
        >
          <X className="w-3 h-3 text-green-600" />
        </button>
      </div>

      {/* 使用指引 */}
      <div className="text-[10px] text-green-600 mb-2 bg-green-100/50 px-2 py-1 rounded">
        {nodes.length === 0 ? (
          <span className="text-amber-600">当前图谱无节点，请先添加实体</span>
        ) : !pathStartNode ? (
          <span>💡 点击图谱中的节点作为起点</span>
        ) : !pathEndNode ? (
          <span>💡 再点击另一个节点作为终点</span>
        ) : null}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Target className="w-3 h-3 text-blue-500" />
          <span className="text-[10px] text-green-600">起点：</span>
          {pathStartNode ? (
            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium">
              {pathStartNode.name}
            </span>
          ) : (
            <span className="text-[10px] text-gray-400 italic">等待选择</span>
          )}
        </div>
        <ArrowRight className="w-3 h-3 text-gray-400" />
        <div className="flex items-center gap-1.5">
          <Target className="w-3 h-3 text-purple-500" />
          <span className="text-[10px] text-green-600">终点：</span>
          {pathEndNode ? (
            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium">
              {pathEndNode.name}
            </span>
          ) : (
            <span className="text-[10px] text-gray-400 italic">等待选择</span>
          )}
        </div>
        {/* 重置选择按钮 */}
        {pathStartNode && (
          <button
            type="button"
            onClick={onResetSelection}
            className="text-[10px] text-green-600 hover:text-green-700 underline"
          >
            重选
          </button>
        )}
      </div>

      {/* 路径结果 - 显示完整路径序列 */}
      {pathResult.length > 0 && (
        <div className="mt-3 pt-3 border-t border-green-200">
          <div className="text-xs text-green-600 mb-2">
            找到路径（经过 {pathResult.length} 条关系）：
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
                    {targetNode?.name || '未知'}
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
          两个节点之间没有路径相连
        </div>
      )}
    </motion.div>
  );
};

export default GraphPathAnalysis;