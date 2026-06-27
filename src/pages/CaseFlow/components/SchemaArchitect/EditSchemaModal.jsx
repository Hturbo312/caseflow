import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Save,
  Plus,
  Trash2,
  Edit2,
  FileText,
  Eye,
  Zap,
  Box,
  Settings,
  GripVertical
} from 'lucide-react';
import { useI18n } from '../../../../i18n';

const EditSchemaModal = ({ schema, onSave, onClose }) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('basic');
  const [editingFieldId, setEditingFieldId] = useState(null);
  const [editingFieldData, setEditingFieldData] = useState({});
  const [formData, setFormData] = useState({
    name: schema.name,
    description: schema.description || '',
    cardConfig: schema.cardConfig || {
      showSummary: true,
      showMetrics: true,
      showEntities: true,
      showTags: true,
      customFields: []
    }
  });

  const presetFunctions = [
    { id: 'entityCount', name: t('schema.funcEntityCount'), desc: t('schema.funcEntityCountDesc') },
    { id: 'relationCount', name: t('schema.funcRelationCount'), desc: t('schema.funcRelationCountDesc') },
    { id: 'avgDegree', name: t('schema.funcAvgDegree'), desc: t('schema.funcAvgDegreeDesc') },
    { id: 'density', name: t('schema.funcDensity'), desc: t('schema.funcDensityDesc') },
    { id: 'completeness', name: t('schema.funcCompleteness'), desc: t('schema.funcCompletenessDesc') },
    { id: 'entityTypes', name: t('schema.funcEntityTypes'), desc: t('schema.funcEntityTypesDesc') },
    { id: 'coreEntities', name: t('schema.funcCoreEntities'), desc: t('schema.funcCoreEntitiesDesc') },
    { id: 'year', name: t('schema.funcYear'), desc: t('schema.funcYearDesc') },
    { id: 'location', name: t('schema.funcLocation'), desc: t('schema.funcLocationDesc') },
  ];

  const addPresetField = (func) => {
    if (!formData.cardConfig.customFields?.find(f => f.id === func.id)) {
      setFormData({
        ...formData,
        cardConfig: {
          ...formData.cardConfig,
          customFields: [...(formData.cardConfig.customFields || []), {
            id: func.id,
            type: 'preset',
            name: func.name,
            function: func.id
          }]
        }
      });
    }
  };

  const removeField = (fieldId) => {
    setFormData({
      ...formData,
      cardConfig: {
        ...formData.cardConfig,
        customFields: formData.cardConfig.customFields.filter(f => f.id !== fieldId)
      }
    });
    if (editingFieldId === fieldId) {
      setEditingFieldId(null);
    }
  };

  const startEditField = (field) => {
    setEditingFieldId(field.id);
    setEditingFieldData({ ...field });
  };

  const saveEditField = () => {
    if (!editingFieldId) return;
    setFormData({
      ...formData,
      cardConfig: {
        ...formData.cardConfig,
        customFields: formData.cardConfig.customFields.map(f =>
          f.id === editingFieldId ? { ...editingFieldData } : f
        )
      }
    });
    setEditingFieldId(null);
    setEditingFieldData({});
  };

  const cancelEditField = () => {
    setEditingFieldId(null);
    setEditingFieldData({});
  };

  const basicItems = [
    { key: 'showSummary', name: t('schema.logicSummary'), desc: t('schema.logicSummaryDesc') },
    { key: 'showMetrics', name: t('schema.topologyMetrics'), desc: t('schema.topologyMetricsDesc') },
    { key: 'showEntities', name: t('schema.coreEntities'), desc: t('schema.coreEntitiesDesc') },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="text-lg font-semibold">{t('schema.editSchemaTitle')}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex border-b border-gray-200 px-5">
          <button
            onClick={() => setActiveTab('basic')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'basic' ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            {t('schema.editSchemaBasic')}
          </button>
          <button
            onClick={() => setActiveTab('card')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
              activeTab === 'card' ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            {t('schema.editSchemaCard')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('schema.name')}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('schema.desc')}</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder={t('schema.schemaDescPlaceholder')}
                />
              </div>
            </div>
          )}

          {activeTab === 'card' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">{t('schema.cardConfigDesc')}</p>

              <div>
                <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  {t('schema.basicItems')}
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {basicItems.map(item => (
                    <label key={item.key} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.cardConfig[item.key] || false}
                        onChange={(e) => setFormData({
                          ...formData,
                          cardConfig: { ...formData.cardConfig, [item.key]: e.target.checked }
                        })}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-xs font-medium text-gray-700">{item.name}</span>
                        <p className="text-[10px] text-gray-500">{item.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Box className="w-3 h-3" />
                  {t('schema.defaultFuncs')}
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {presetFunctions.map(func => (
                    <button
                      key={func.id}
                      onClick={() => addPresetField(func)}
                      disabled={formData.cardConfig.customFields?.find(f => f.id === func.id)}
                      className="px-2 py-1 text-[11px] rounded border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={func.desc}
                    >
                      {func.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium text-gray-700 flex items-center gap-1">
                    <Settings className="w-3 h-3" />
                    {t('schema.addedItems')}
                  </h4>
                  <button
                    onClick={() => {
                      const newField = {
                        id: `custom-${Date.now()}`,
                        type: 'custom',
                        name: t('schema.customField'),
                        label: t('schema.label'),
                        source: 'entity',
                        property: ''
                      };
                      setFormData({
                        ...formData,
                        cardConfig: {
                          ...formData.cardConfig,
                          customFields: [...(formData.cardConfig.customFields || []), newField]
                        }
                      });
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    {t('schema.addCustom')}
                  </button>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {(formData.cardConfig.customFields || []).map(field => (
                    <div key={field.id} className={`p-2 bg-gray-50 rounded-lg ${editingFieldId === field.id ? 'ring-2 ring-blue-300' : ''}`}>
                      {editingFieldId === field.id ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingFieldData.name || ''}
                              onChange={(e) => setEditingFieldData({ ...editingFieldData, name: e.target.value })}
                              placeholder={t('schema.fieldName')}
                              className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400"
                            />
                            {field.type === 'custom' && (
                              <select
                                value={editingFieldData.source || 'entity'}
                                onChange={(e) => setEditingFieldData({ ...editingFieldData, source: e.target.value })}
                                className="px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400"
                              >
                                <option value="entity">{t('schema.entityAttr')}</option>
                                <option value="case">{t('schema.caseAttr')}</option>
                              </select>
                            )}
                          </div>
                          {field.type === 'custom' && (
                            <input
                              type="text"
                              value={editingFieldData.property || ''}
                              onChange={(e) => setEditingFieldData({ ...editingFieldData, property: e.target.value })}
                              placeholder={t('schema.propertyName')}
                              className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400"
                            />
                          )}
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={saveEditField}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors"
                            >
                              <Save className="w-3 h-3" />
                              {t('schema.saveBtn')}
                            </button>
                            <button
                              onClick={cancelEditField}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                            >
                              <X className="w-3 h-3" />
                              {t('schema.cancelBtn')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <GripVertical className="w-3 h-3 text-gray-400 cursor-move" />
                          <span className="text-xs font-medium text-gray-700 flex-1 truncate">{field.name}</span>
                          {field.type === 'custom' && field.property && (
                            <span className="text-[10px] text-blue-500">{field.source}.{field.property}</span>
                          )}
                          <span className="text-[10px] text-gray-500 bg-white px-1.5 py-0.5 rounded border">
                            {field.type === 'preset' ? t('schema.preset') : t('schema.custom')}
                          </span>
                          <button
                            onClick={() => startEditField(field)}
                            className="p-1 hover:bg-blue-50 rounded transition-colors"
                            title={t('schema.edit')}
                          >
                            <Edit2 className="w-3 h-3 text-blue-500" />
                          </button>
                          <button
                            onClick={() => removeField(field.id)}
                            className="p-1 hover:bg-red-50 rounded transition-colors"
                            title={t('detail.delete')}
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {(formData.cardConfig.customFields || []).length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-3">{t('schema.noItemsYet')}</p>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="text-[11px] font-medium text-gray-500 mb-2 flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  {t('schema.cardPreview')}
                </h4>
                <div className="bg-white rounded-lg border border-gray-200 p-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-gray-900">{t('schema.exampleCaseName')}</span>
                    <span className="text-[10px] text-gray-500">{formData.name || t('schema.schemaNamePlaceholder')}</span>
                  </div>
                  {formData.cardConfig.showSummary && (
                    <div className="text-[10px] text-gray-600 bg-gray-50 rounded px-2 py-1 mb-1.5">
                      {t('schema.coreEntitySample')}
                    </div>
                  )}
                  {formData.cardConfig.showEntities && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{t('schema.entityA')}</span>
                      <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{t('schema.entityB')}</span>
                    </div>
                  )}
                  {formData.cardConfig.showMetrics && (
                    <div className="flex gap-2 text-[9px] text-gray-500 border-t border-gray-100 pt-1.5">
                      <span>{t('schema.entitySuffix').replace('{count}', '3')}</span>
                      <span>{t('schema.relationSuffix').replace('{count}', '2')}</span>
                      <span>{t('schema.completenessSuffix').replace('{percent}', '60')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-200">
          <button
            onClick={() => onSave(formData)}
            className="w-full py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {t('schema.save')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default EditSchemaModal;
