import React, { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  Tag,
  Link2,
  ArrowRight,
  Save,
  RefreshCw,
  Loader2,
  Check,
  ChevronDown,
  ChevronUp,
  X,
  Edit2
} from 'lucide-react';
import { useI18n } from '../../../../i18n';

/**
 * SchemaResultPanel - AI 建议的 Schema 结构预览面板
 * 显示 AI 生成的实体类型（含属性）和关系，支持一键入库或调整
 */
const SchemaResultPanel = memo(({
  schemaResult,
  isThinking,
  isSaving,
  onCreateSchema,
  onRequestAdjustment
}) => {
  const { t } = useI18n();

  const [expandedTypes, setExpandedTypes] = useState(new Set());
  const [selectedTypes, setSelectedTypes] = useState(new Set());
  const [selectedRels, setSelectedRels] = useState(new Set());

  const entityTypes = schemaResult?.entityTypes || [];
  const relations = schemaResult?.relations || [];

  // 处理中状态
  if (isThinking && !schemaResult) {
    return (
      <div className="h-full flex flex-col items-center justify-center py-8">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        <p className="text-sm text-gray-500 mt-3">{t('ai.schemaGenerating')}</p>
      </div>
    );
  }

  // 解析错误
  if (schemaResult?.parse_error) {
    return (
      <div className="p-4 bg-red-50 rounded-xl border border-red-200 text-center">
        <p className="text-sm text-red-600">{t('ai.schemaParseError')}</p>
      </div>
    );
  }

  // 无结果
  if (!schemaResult || (entityTypes.length === 0 && relations.length === 0)) {
    return null;
  }

  // 默认全选
  if (selectedTypes.size === 0 && selectedRels.size === 0) {
    entityTypes.forEach((_, i) => selectedTypes.add(i));
    relations.forEach((_, i) => selectedRels.add(i));
  }

  const toggleType = (idx) => {
    const next = new Set(selectedTypes);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    setSelectedTypes(next);
  };

  const toggleRel = (idx) => {
    const next = new Set(selectedRels);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    setSelectedRels(next);
  };

  const toggleAllTypes = () => {
    if (selectedTypes.size === entityTypes.length) {
      setSelectedTypes(new Set());
    } else {
      setSelectedTypes(new Set(entityTypes.map((_, i) => i)));
    }
  };

  const toggleAllRels = () => {
    if (selectedRels.size === relations.length) {
      setSelectedRels(new Set());
    } else {
      setSelectedRels(new Set(relations.map((_, i) => i)));
    }
  };

  const toggleExpand = (idx) => {
    const next = new Set(expandedTypes);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    setExpandedTypes(next);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* AI 建议说明 */}
      {schemaResult.message && (
        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
          <p className="text-sm text-emerald-700">{schemaResult.message}</p>
        </div>
      )}

      {/* 实体类型 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-emerald-500" />
            <span className="font-semibold text-gray-700">{t('ai.suggestedEntityTypes')}</span>
            <span className="text-xs text-gray-400">({entityTypes.length})</span>
          </div>
          <button
            onClick={toggleAllTypes}
            className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            {selectedTypes.size === entityTypes.length ? t('ai.deselectAll') : t('ai.selectAll')}
          </button>
        </div>
        <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
          {entityTypes.map((type, idx) => (
            <div
              key={idx}
              className={`transition-colors ${selectedTypes.has(idx) ? 'bg-white' : 'bg-gray-50 opacity-50'}`}
            >
              {/* 类型标题行 */}
              <div className="flex items-center gap-2 px-4 py-2.5">
                <label className="flex items-center gap-2 flex-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedTypes.has(idx)}
                    onChange={() => toggleType(idx)}
                    className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                  />
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: type.color || '#3b82f6' }} />
                  <span className="font-medium text-gray-800 text-sm">{type.name}</span>
                </label>
                {type.properties && type.properties.length > 0 && (
                  <button
                    onClick={() => toggleExpand(idx)}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                  >
                    {expandedTypes.has(idx) ? (
                      <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                    )}
                  </button>
                )}
              </div>

              {/* 属性展开 */}
              <AnimatePresence>
                {expandedTypes.has(idx) && type.properties && type.properties.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-2 pl-10">
                      <div className="flex flex-wrap gap-1.5">
                        {type.properties.map((prop, pIdx) => (
                          <span
                            key={pIdx}
                            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md"
                          >
                            <span>{prop.name}</span>
                            <span className="text-gray-400 font-mono text-[10px]">{prop.type}</span>
                            {prop.type === 'enum' && prop.options && prop.options.length > 0 && (
                              <span className="text-gray-400 text-[10px]">[{prop.options.join(', ')}]</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* 关系 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-purple-500" />
            <span className="font-semibold text-gray-700">{t('ai.suggestedRelations')}</span>
            <span className="text-xs text-gray-400">({relations.length})</span>
          </div>
          <button
            onClick={toggleAllRels}
            className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            {selectedRels.size === relations.length ? t('ai.deselectAll') : t('ai.selectAll')}
          </button>
        </div>
        <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
          {relations.map((rel, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-2 px-4 py-2.5 transition-colors ${selectedRels.has(idx) ? 'bg-white' : 'bg-gray-50 opacity-50'}`}
            >
              <label className="flex items-center gap-2 flex-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedRels.has(idx)}
                  onChange={() => toggleRel(idx)}
                  className="w-4 h-4 rounded border-gray-300 text-purple-500 focus:ring-purple-500"
                />
                <span className="font-medium text-blue-600 text-sm">{rel.from}</span>
                <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <span className="px-2 py-0.5 bg-purple-100 text-purple-600 rounded text-xs font-medium">{rel.name}</span>
                <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <span className="font-medium text-green-600 text-sm">{rel.to}</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* 统计摘要 */}
      <div className="flex items-center gap-4 text-xs text-gray-500 px-1">
        <div className="flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 text-emerald-500" />
          <span>{selectedTypes.size} / {entityTypes.length} {t('ai.entityTypesSelected')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 text-purple-500" />
          <span>{selectedRels.size} / {relations.length} {t('ai.relationsSelected')}</span>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => onCreateSchema(selectedTypes, selectedRels)}
          disabled={isSaving || (selectedTypes.size === 0 && selectedRels.size === 0)}
          className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('ai.schemaCreating')}
            </>
          ) : (
            <>
              <Database className="w-4 h-4" />
              {t('ai.createSchema')}
            </>
          )}
        </button>
        <button
          onClick={onRequestAdjustment}
          className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          {t('ai.adjustSchema')}
        </button>
      </div>
    </motion.div>
  );
});

SchemaResultPanel.displayName = 'SchemaResultPanel';

export default SchemaResultPanel;
