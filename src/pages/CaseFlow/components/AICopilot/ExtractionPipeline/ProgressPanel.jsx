import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, Circle, AlertCircle, ChevronRight } from 'lucide-react';

const PHASES = [
  { key: 'parsing', label: '解析文本', icon: 'text' },
  { key: 'planning', label: '生成计划', icon: 'plan' },
  { key: 'extracting', label: '实体提取', icon: 'extract', isMulti: true },
  { key: 'consistency_checking', label: '一致性检查', icon: 'check' },
  { key: 'inferring_relations', label: '关系推断', icon: 'relation' },
  { key: 'finalizing', label: '保存入库', icon: 'save' },
];

const ProgressPanel = memo(({ phase, plan, progress, onExtractType, onExtractAll, extractedTypes }) => {
  const phaseOrder = PHASES.map(p => p.key);
  const currentIdx = phaseOrder.indexOf(phase);

  const getStepStatus = (phaseKey) => {
    if (phaseKey === phase) return 'active';
    if (phaseOrder.indexOf(phaseKey) < currentIdx) return 'done';
    return 'pending';
  };

  const getIcon = (phaseKey) => {
    const status = getStepStatus(phaseKey);
    if (status === 'active') return <Loader2 size={16} className="animate-spin text-blue-500" />;
    if (status === 'done') return <CheckCircle size={16} className="text-green-500" />;
    return <Circle size={16} className="text-gray-300" />;
  };

  return (
    <div className="space-y-2">
      {PHASES.map((p) => {
        const status = getStepStatus(p.key);
        const isCurrent = p.key === phase;
        const isDone = status === 'done';

        return (
          <div key={p.key} className="flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0">
              {getIcon(p.key)}
            </div>

            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium ${isCurrent ? 'text-blue-600' : isDone ? 'text-green-600' : 'text-gray-400'}`}>
                {p.label}
              </div>

              {/* 实体提取子步骤 */}
              {p.isMulti && plan && (
                <div className="mt-1 space-y-1">
                  {/* 全部提取按钮 */}
                  {extractedTypes?.length < plan.length && onExtractAll && (
                    <button
                      onClick={onExtractAll}
                      className="w-full flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium text-white bg-blue-500 rounded hover:bg-blue-600 transition-colors mb-1"
                    >
                      <Loader2 size={12} />
                      全部并行提取 ({extractedTypes.length}/{plan.length})
                    </button>
                  )}
                  {plan.map((item, i) => {
                    const isExtracted = extractedTypes?.includes(item.entity_type);
                    const isCurrentType = isCurrent && !isExtracted && i === (plan.findIndex(x => !extractedTypes?.includes(x.entity_type)));

                    return (
                      <div key={item.entity_type} className="flex items-center gap-2">
                        {isExtracted ? (
                          <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
                        ) : isCurrentType ? (
                          <Loader2 size={12} className="text-blue-500 animate-spin flex-shrink-0" />
                        ) : (
                          <Circle size={12} className="text-gray-300 flex-shrink-0" />
                        )}
                        <span className={`text-xs ${isExtracted ? 'text-green-600' : isCurrentType ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                          {item.entity_type}
                          {item.hint_count > 0 && (
                            <span className="text-gray-400 ml-1">({item.hint_count} 线索)</span>
                          )}
                        </span>
                        {!isExtracted && (
                          <button
                            onClick={() => onExtractType?.(item.entity_type)}
                            className={`text-xs flex items-center gap-0.5 ${
                              isCurrentType ? 'text-blue-500 hover:text-blue-600' : 'text-gray-400 hover:text-gray-600'
                            }`}
                          >
                            <ChevronRight size={10} />
                            {isExtracted ? '已完成' : isCurrentType ? '提取中' : '提取'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});

ProgressPanel.displayName = 'ProgressPanel';

export default ProgressPanel;
