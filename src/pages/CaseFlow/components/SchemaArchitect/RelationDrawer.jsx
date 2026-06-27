import React from 'react';
import { motion } from 'framer-motion';
import { X, Save, Plus, Trash2, Edit2, Check } from 'lucide-react';
import { useI18n } from '../../../../i18n';
import { PROPERTY_TYPES, RELATION_STYLES, RELATION_DIRECTIONS } from '../../../../utils';

const RelationDrawer = ({
  relation,
  form,
  setForm,
  entityTypes,
  onSave,
  onDelete,
  onClose,
  editingProperty,
  setEditingProperty,
  propertyForm,
  setPropertyForm,
  presetColors
}) => {
  const { t } = useI18n();

  const onAddProperty = () => {
    setEditingProperty('new');
    setPropertyForm({ name: '', type: 'text', options: [] });
  };

  const onEditProperty = (prop) => {
    setEditingProperty(prop);
    setPropertyForm({ name: prop.name, type: prop.type, options: prop.options || [] });
  };

  const onSaveProperty = () => {
    if (!propertyForm.name.trim()) return;
    const newProperty = {
      name: propertyForm.name,
      type: propertyForm.type,
      options: propertyForm.type === 'enum' ? propertyForm.options : undefined
    };
    if (editingProperty && editingProperty !== 'new') {
      const updatedProperties = form.properties.map(p =>
        p.name === editingProperty.name ? newProperty : p
      );
      setForm({ ...form, properties: updatedProperties });
    } else {
      setForm({ ...form, properties: [...(form.properties || []), newProperty] });
    }
    setEditingProperty(null);
    setPropertyForm({ name: '', type: 'text', options: [] });
  };

  const onCancelEditProperty = () => {
    setEditingProperty(null);
    setPropertyForm({ name: '', type: 'text', options: [] });
  };

  const onDeleteProperty = (propertyName) => {
    setForm({ ...form, properties: (form.properties || []).filter(p => p.name !== propertyName) });
  };

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
              {relation ? t('schema.editRelationTitle') : t('schema.newRelationTitle')}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {relation ? `编辑 "${relation.name}"` : t('schema.relationSubtitle')}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('schema.relationName')}</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('schema.relationPlaceholder')}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('schema.relationMeaning')}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('schema.relationDescPlaceholder')}
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('schema.source')}</label>
              <select
                value={form.from}
                onChange={(e) => setForm({ ...form, from: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {entityTypes.map(e => (
                  <option key={e.id} value={e.name}>{e.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('schema.target')}</label>
              <select
                value={form.to}
                onChange={(e) => setForm({ ...form, to: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {entityTypes.map(e => (
                  <option key={e.id} value={e.name}>{e.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('schema.direction')}</label>
            <div className="grid grid-cols-3 gap-2">
              {RELATION_DIRECTIONS.map(d => (
                <button
                  key={d.value}
                  onClick={() => setForm({ ...form, direction: d.value })}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    form.direction === d.value
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('schema.lineStyle')}</label>
            <div className="grid grid-cols-3 gap-2">
              {RELATION_STYLES.map(s => (
                <button
                  key={s.value}
                  onClick={() => setForm({ ...form, style: s.value })}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    form.style === s.value
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('schema.colorLabel')}</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-12 h-12 border border-gray-200 rounded-lg cursor-pointer"
              />
              <div className="flex-1 h-2 rounded" style={{ backgroundColor: form.color }} />
              <span className="text-sm text-gray-500 font-mono uppercase">{form.color}</span>
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
              <div className="mb-3 p-3 bg-gray-50 rounded-lg space-y-2">
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
                    value={propertyForm.options?.join(',') || ''}
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
                    disabled={!propertyForm.name.trim()}
                    className="flex-1 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {t('schema.saveBtn')}
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

            <div className="space-y-2">
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
              {(form.properties?.length || 0) === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">{t('schema.noPropertiesHint')}</p>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          {relation && (
            <button
              onClick={onDelete}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {t('schema.deleteRelation')}
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

export default RelationDrawer;
