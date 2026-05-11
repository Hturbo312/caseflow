import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, Trash2 } from 'lucide-react';
import { getNodeColor } from '@utils';

const GraphNodeDetail = ({
  selectedNode,
  entityTypeColorMap,
  onClose,
  onRequestDelete,
}) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {selectedNode && (
        <motion.div
          key="node-detail"
          initial={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25 }}
          className="absolute top-4 right-4 w-64 sm:w-72 bg-white rounded-xl shadow-lg border border-gray-200 p-3 sm:p-4 z-20"
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold">节点详情</h4>
            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded"
              aria-label="关闭节点详情"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-gray-500 text-xs">名称</span>
              <div className="font-medium text-base">{selectedNode?.name}</div>
            </div>
            <div>
              <span className="text-gray-500 text-xs">类型</span>
              <div className="flex items-center gap-2 mt-1">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getNodeColor(selectedNode?.type, entityTypeColorMap || {}) }}
                />
                <span className="font-medium">{selectedNode?.type}</span>
              </div>
            </div>
            {/* 显示属性 */}
            {selectedNode?.properties && Object.keys(selectedNode.properties).length > 0 && (
              <div>
                <span className="text-gray-500 text-xs">属性</span>
                <div className="mt-2 space-y-1.5">
                  {Object.entries(selectedNode.properties).map(([key, value]) => (
                    <div key={key} className="flex items-start gap-2 text-xs">
                      <span className="text-gray-400 min-w-16">{key}:</span>
                      <span className="text-gray-700">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* 所属案例 */}
            {selectedNode?.caseName && (
              <div className="pt-2 border-t border-gray-100">
                <span className="text-gray-500 text-xs">所属案例</span>
                <div className="text-xs text-blue-600 font-medium">{selectedNode.caseName}</div>
              </div>
            )}
          </div>
          {/* 删除按钮 */}
          <div className="mt-4 pt-3 border-t border-gray-100">
            <button
              onClick={() => {
                if (!selectedNode?.caseId || !selectedNode?.id) return;
                onRequestDelete(selectedNode);
              }}
              className="w-full py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              删除此实体
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GraphNodeDetail;