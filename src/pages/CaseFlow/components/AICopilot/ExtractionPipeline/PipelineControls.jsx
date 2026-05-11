import React, { memo } from 'react';
import { Loader2, Play, SkipForward, ChevronRight, Save, RotateCcw } from 'lucide-react';

const PipelineControls = memo(({ phase, isProcessing, onParseText, onGeneratePlan, onNext, onFinalize, onReset, plan, extractedTypes }) => {
  const renderControls = () => {
    if (isProcessing) {
      return (
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-blue-600">
          <Loader2 size={16} className="animate-spin" />
          <span>处理中...</span>
        </div>
      );
    }

    switch (phase) {
      case 'idle':
        return (
          <button
            onClick={onParseText}
            className="w-full py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
          >
            <Play size={16} />
            开始多轮提取
          </button>
        );

      case 'planning':
        return (
          <button
            onClick={onGeneratePlan}
            className="w-full py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
          >
            <Play size={16} />
            生成提取计划
          </button>
        );

      case 'extracting':
        // 检查是否所有类型都提取完了
        const allExtracted = plan?.every(item => extractedTypes?.includes(item.entity_type));
        if (allExtracted) {
          return (
            <button
              onClick={onNext}
              className="w-full py-2.5 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
            >
              进入关系推断
              <SkipForward size={16} />
            </button>
          );
        }
        return null;

      case 'inferring_relations':
      case 'finalizing':
        return (
          <button
            onClick={onFinalize}
            className="w-full py-2.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
          >
            <Save size={16} />
            确认保存全部
          </button>
        );

      case 'completed':
        return (
          <button
            onClick={onReset}
            className="w-full py-2.5 bg-gray-500 text-white rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw size={16} />
            重新开始
          </button>
        );

      case 'error':
        return (
          <button
            onClick={onReset}
            className="w-full py-2.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw size={16} />
            重试
          </button>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        {renderControls()}
      </div>
      {phase !== 'idle' && phase !== 'completed' && (
        <button
          onClick={onReset}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          title="重置"
        >
          <RotateCcw size={16} />
        </button>
      )}
    </div>
  );
});

PipelineControls.displayName = 'PipelineControls';

export default PipelineControls;
