import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Plus, X, Check } from 'lucide-react';

const GraphEntityPanel = ({
  open,
  onClose,
  currentCase,
  currentSchema,
  entityForm,
  onFormChange,
  onSave,
  saving,
}) => {
  const prefersReducedMotion = useReducedMotion();

  if (!open) return null;

  const selectedEntityType = currentSchema?.entityTypes?.find(t => t.name === entityForm.entityType);

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25 }}
      className="mt-2 p-2 bg-blue-50 rounded-lg overflow-hidden border border-blue-200"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5 text-blue-600" />
          <h4 className="text-xs font-semibold text-blue-700">添加实体</h4>
          {currentCase && (
            <span className="text-[10px] text-blue-500 ml-1">→ {currentCase.name}</span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 hover:bg-blue-200 rounded"
        >
          <X className="w-3 h-3 text-blue-600" />
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[120px]">
          <label className="block text-[10px] text-blue-600 mb-0.5">名称 *</label>
          <input
            type="text"
            value={entityForm.name}
            onChange={(e) => onFormChange({ ...entityForm, name: e.target.value })}
            placeholder="输入名称"
            className="w-full px-2 py-1.5 text-xs border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
        <div className="min-w-[100px]">
          <label className="block text-[10px] text-blue-600 mb-0.5">类型 *</label>
          <select
            value={entityForm.entityType}
            onChange={(e) => onFormChange({ ...entityForm, entityType: e.target.value, properties: {} })}
            className="w-full px-2 py-1.5 text-xs border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">选择</option>
            {currentSchema?.entityTypes?.map(type => (
              <option key={type.id} value={type.name}>{type.name}</option>
            ))}
          </select>
        </div>
        {entityForm.entityType && selectedEntityType?.properties?.slice(0, 2).map(prop => (
          <div key={prop.name} className="min-w-[80px]">
            <label className="block text-[10px] text-blue-600 mb-0.5">{prop.name}</label>
            {prop.type === 'enum' ? (
              <select
                value={entityForm.properties[prop.name] || ''}
                onChange={(e) => onFormChange({ ...entityForm, properties: { ...entityForm.properties, [prop.name]: e.target.value } })}
                className="w-full px-2 py-1.5 text-xs border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">选择</option>
                {prop.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : (
              <input
                type={prop.type === 'number' ? 'number' : 'text'}
                value={entityForm.properties[prop.name] || ''}
                onChange={(e) => onFormChange({ ...entityForm, properties: { ...entityForm.properties, [prop.name]: e.target.value } })}
                placeholder={prop.name}
                className="w-full px-2 py-1.5 text-xs border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            )}
          </div>
        ))}
        <button
          onClick={onSave}
          disabled={saving || !entityForm.name.trim() || !entityForm.entityType}
          className="h-7 px-3 bg-blue-500 text-white rounded text-xs font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          {saving ? (
            <>
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              保存
            </>
          ) : (
            <>
              <Check className="w-3 h-3" />
              保存
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};

export default GraphEntityPanel;