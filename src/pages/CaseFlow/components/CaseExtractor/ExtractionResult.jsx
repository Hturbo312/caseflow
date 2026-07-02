import React, { memo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Building, Link2, ArrowRight, Save, RefreshCw, Loader2,
  Check, X, Edit3, Plus, Search
} from 'lucide-react';
import { useI18n } from '../../../../i18n';

/**
 * ExtractionResult - 案例拆解结果展示面板
 * 支持 inline 编辑实体名、逐条确认/删除、手动添加实体
 */
const ExtractionResult = memo(({
  extractResult,
  isThinking,
  isSaving,
  selectedCaseId,
  onConfirmSave,
  onRequestAdjustment,
  onStartDeepExtract
}) => {
  const { t } = useI18n();

  const [confirmedEntities, setConfirmedEntities] = useState(() => {
    if (!extractResult?.entities) return new Set();
    return new Set(extractResult.entities.map((_, i) => i));
  });
  const [confirmedRelations, setConfirmedRelations] = useState(() => {
    if (!extractResult?.relations) return new Set();
    return new Set(extractResult.relations.map((_, i) => i));
  });
  const [editingEntity, setEditingEntity] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editedEntities, setEditedEntities] = useState({});
  const [showAddEntity, setShowAddEntity] = useState(false);
  const [newEntityName, setNewEntityName] = useState('');
  const [newEntityType, setNewEntityType] = useState('');
  const [manualEntities, setManualEntities] = useState([]);

  if (isThinking && !extractResult) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-sm text-gray-500 mt-3">{t('ai.extracting')}</p>
      </div>
    );
  }

  if (extractResult?.parse_error) {
    return (
      <div className="p-4 bg-red-50 rounded-xl border border-red-200 text-center">
        <p className="text-sm text-red-600">{t('ai.parseError')}</p>
      </div>
    );
  }

  if (!extractResult) return null;

  const toggleEntity = (index) => {
    setConfirmedEntities(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const toggleRelation = (index) => {
    setConfirmedRelations(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const startEditEntity = (index, field) => {
    const entity = extractResult.entities[index];
    setEditingEntity({ index, field });
    setEditValue(entity[field] || '');
  };

  const saveEdit = () => {
    if (!editingEntity) return;
    setEditedEntities(prev => ({
      ...prev,
      [editingEntity.index]: {
        ...prev[editingEntity.index],
        [editingEntity.field]: editValue
      }
    }));
    setEditingEntity(null);
  };

  const addManualEntity = () => {
    if (!newEntityName.trim() || !newEntityType.trim()) return;
    setManualEntities(prev => [...prev, {
      name: newEntityName.trim(),
      entityType: newEntityType.trim(),
      properties: {},
      _manual: true,
    }]);
    setNewEntityName('');
    setNewEntityType('');
    setShowAddEntity(false);
  };

  const getEntity = (index) => {
    const entity = extractResult.entities[index];
    const edited = editedEntities[index] || {};
    return { ...entity, ...edited };
  };

  const allEntities = [
    ...extractResult.entities.map((e, i) => ({ ...getEntity(i), _index: i })),
    ...manualEntities.map((e, i) => ({ ...e, _index: `manual-${i}`, _manual: true })),
  ];

  const handleSave = () => {
    const savedEntities = allEntities
      .filter((e) => e._manual || confirmedEntities.has(e._index))
      .map(({ _index, _manual, ...entity }) => entity);
    const savedRelations = (extractResult.relations || [])
      .filter((_, i) => confirmedRelations.has(i));
    onConfirmSave({ entities: savedEntities, relations: savedRelations });
  };

  const existingTypes = [...new Set(
    (extractResult.entities || []).map(e => e.entityType).filter(Boolean)
  )];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {extractResult.summary && (
        <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
          <p className="text-sm text-indigo-700">{extractResult.summary}</p>
        </div>
      )}

      {/* 实体列表 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-indigo-500" />
            <span className="font-semibold text-gray-700">{t('ai.extractedEntities')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {confirmedEntities.size + manualEntities.length}/{allEntities.length}
            </span>
            <button
              onClick={() => setShowAddEntity(!showAddEntity)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-indigo-500 bg-indigo-50 rounded hover:bg-indigo-100"
            >
              <Plus className="w-3 h-3" />{t('extraction.addEntity')}
            </button>
          </div>
        </div>

        {showAddEntity && (
          <div className="p-3 bg-indigo-25 border-b border-indigo-100 flex gap-2">
            <input
              value={newEntityName}
              onChange={e => setNewEntityName(e.target.value)}
              placeholder={t('extraction.entityNamePlaceholder')}
              className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
              onKeyDown={e => e.key === 'Enter' && addManualEntity()}
            />
            <input
              value={newEntityType}
              onChange={e => setNewEntityType(e.target.value)}
              placeholder={t('extraction.entityTypePlaceholder')}
              list="entity-types"
              className="w-32 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
              onKeyDown={e => e.key === 'Enter' && addManualEntity()}
            />
            <datalist id="entity-types">
              {existingTypes.map(et => <option key={et} value={et} />)}
            </datalist>
            <button
              onClick={addManualEntity}
              disabled={!newEntityName.trim() || !newEntityType.trim()}
              className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
            >
              {t('common.confirm')}
            </button>
          </div>
        )}

        <div className="max-h-56 overflow-y-auto">
          {allEntities.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {allEntities.map((entity) => {
                const isConfirmed = entity._manual || confirmedEntities.has(entity._index);
                const isEditing = editingEntity?.index === entity._index;
                return (
                  <div key={entity._index} className={`p-3 hover:bg-gray-50 flex items-center gap-2 ${!isConfirmed ? 'opacity-45' : ''}`}>
                    <button
                      onClick={() => entity._manual ? setManualEntities(prev => prev.filter((_, i) => `manual-${i}` !== entity._index)) : toggleEntity(entity._index)}
                      className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs transition-colors ${isConfirmed ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-300 hover:bg-red-400'}`}
                    >
                      {isConfirmed ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    </button>
                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                      {isEditing ? (
                        <input
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingEntity(null); }}
                          className="flex-1 px-1.5 py-0.5 text-sm border border-indigo-300 rounded focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <span className="font-medium text-gray-800 text-sm cursor-pointer hover:text-indigo-600 truncate"
                          onDoubleClick={() => startEditEntity(entity._index, 'name')}
                          title={t('extraction.doubleClickToEdit')}>
                          {entity.name}
                        </span>
                      )}
                      <button onClick={() => isEditing ? saveEdit() : startEditEntity(entity._index, 'name')}
                        className="flex-shrink-0 p-0.5 text-gray-300 hover:text-indigo-500">
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full flex-shrink-0">
                      {entity.entityType}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500 text-sm">{t('ai.noEntities')}</div>
          )}
        </div>
      </div>

      {/* 关系列表 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-purple-500" />
            <span className="font-semibold text-gray-700">{t('ai.extractedRelations')}</span>
          </div>
          <span className="text-xs text-gray-400">{confirmedRelations.size}/{(extractResult.relations || []).length}</span>
        </div>
        <div className="max-h-40 overflow-y-auto">
          {(extractResult.relations || []).length > 0 ? (
            <div className="divide-y divide-gray-100">
              {(extractResult.relations || []).map((rel, index) => {
                const isConfirmed = confirmedRelations.has(index);
                return (
                  <div key={`${rel.sourceName}-${rel.name}-${rel.targetName}`} className={`p-3 flex items-center gap-2 text-sm hover:bg-gray-50 ${!isConfirmed ? 'opacity-40' : ''}`}>
                    <button onClick={() => toggleRelation(index)}
                      className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs transition-colors ${isConfirmed ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-300 hover:bg-red-400'}`}>
                      {isConfirmed ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    </button>
                    <span className="font-medium text-blue-600">{rel.sourceName}</span>
                    <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-600 rounded text-xs font-medium">{rel.name}</span>
                    <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <span className="font-medium text-green-600">{rel.targetName}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500 text-sm">{t('ai.noRelations')}</div>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-3 pt-2">
        <button onClick={handleSave} disabled={isSaving || (confirmedEntities.size === 0 && manualEntities.length === 0)}
          className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm">
          {isSaving ? (<><Loader2 className="w-4 h-4 animate-spin" />{t('ai.saving')}</>) : (<><Save className="w-4 h-4" />{t('ai.confirmSave')}</>)}
        </button>
        <button onClick={onRequestAdjustment}
          className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4" />{t('ai.adjustResult')}
        </button>
      </div>

      {onStartDeepExtract && (
        <button onClick={onStartDeepExtract}
          className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-sm">
          <Search className="w-4 h-4" />{t('extraction.deepExtract')}
        </button>
      )}

      {!selectedCaseId && (
        <p className="text-xs text-gray-500 text-center bg-amber-50 p-2 rounded-lg">{t('ai.hintNewCase')}</p>
      )}
      {extractResult.entities?.length > 0 && (
        <p className="text-xs text-gray-400 text-center">{t('extraction.editHint')}</p>
      )}
    </motion.div>
  );
});

ExtractionResult.displayName = 'ExtractionResult';

export default ExtractionResult;
