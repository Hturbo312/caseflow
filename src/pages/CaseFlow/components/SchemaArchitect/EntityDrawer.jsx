import React from 'react';
import { motion } from 'framer-motion';
import { X, Save, Plus, Trash2, Edit2, Check, Eye } from 'lucide-react';
import { useI18n } from '../../../../i18n';
import { PROPERTY_TYPES } from '../../../../utils';

const EntityDrawer = ({
  entity,
  form,
  setForm,
  onSave,
  onDelete,
  onClose,
  onAddProperty,
  onEditProperty,
  onDeleteProperty,
  editingProperty,
  propertyForm,
  setPropertyForm,
  onSaveProperty,
  onCancelEditProperty,
  presetColors
}) => {
  const { t } = useI18n();
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {entity ? t('schema.editEntityTitle') : t('schema.newEntityTitle')}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {entity ? `编辑 "${entity.name}"` : t('schema.newEntitySubtitle')}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('schema.entityName')}</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('schema.entityPlaceholder')}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('schema.color')}</label>
              <div className="flex flex-wrap gap-2">
                {presetColors.map(color => (
                  <button
                    key={color}
                    onClick={() => setForm({ ...form, color })}
                    className={`w-8 h-8 rounded-lg transition-all ${
                      form.color === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-8 h-8 border border-gray-200 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">{t('schema.propertyFieldsLabel')}</label>
              <button
                onClick={onAddProperty}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {t('schema.addProp')}
              </button>
            </div>

            {editingProperty !== null && (
              <div className="mb-3 p-3 bg-green-50 rounded-lg border border-green-200 space-y-2">
                <div className="text-xs font-medium text-green-700 mb-2">
                  {editingProperty === 'new' ? t('schema.addNewProp') : t('schema.editProp')}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={propertyForm.name}
                    onChange={(e) => setPropertyForm({ ...propertyForm, name: e.target.value })}
                    placeholder={t('schema.propName')}
                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={propertyForm.type}
                    onChange={(e) => setPropertyForm({ ...propertyForm, type: e.target.value })}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PROPERTY_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                {propertyForm.type === 'enum' && (
                  <input
                    type="text"
                    value={propertyForm.options?.join(',')}
                    onChange={(e) => setPropertyForm({
                      ...propertyForm,
                      options: e.target.value.split(',').filter(Boolean)
                    })}
                    placeholder={t('schema.optionsPlaceholder')}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
                <div className="flex gap-2">
                  <button
                    onClick={onSaveProperty}
                    className="flex-1 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {t('schema.confirmAdd')}
                  </button>
                  <button
                    onClick={onCancelEditProperty}
                    className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors flex items-center justify-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    {t('schema.cancelBtn')}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2 mb-4">
              {(form.properties || []).map((prop, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{prop.name}</span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {PROPERTY_TYPES.find(t => t.value === prop.type)?.label || prop.type}
                    </span>
                    {prop.type === 'enum' && prop.options?.length > 0 && (
                      <span className="text-xs text-gray-400">({prop.options.join(', ')})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEditProperty(prop)}
                      className="p-1 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                    </button>
                    <button
                      onClick={() => onDeleteProperty(prop.name)}
                      className="p-1 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
              {(form.properties?.length || 0) === 0 && editingProperty === null && (
                <p className="text-sm text-gray-500 text-center py-4">{t('schema.noPropertiesHint')}</p>
              )}
            </div>

            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <div className="text-xs font-medium text-blue-700 mb-2 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                {t('schema.cardConfigTitle')}
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isCore || false}
                    onChange={(e) => setForm({ ...form, isCore: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700">{t('schema.coreEntityPriority')}</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          {entity && (
            <button
              onClick={onDelete}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {t('schema.deleteEntity')}
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t('schema.cancelBtn')}
            </button>
            <button
              onClick={onSave}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {t('schema.save')}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default EntityDrawer;
