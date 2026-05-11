import React, { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Plus,
  Trash2,
  Edit2,
  X,
  FileText,
  MapPin,
  Calendar,
  Tag,
  CheckCircle,
  Building,
  Link2,
  ArrowRight,
  Wand2
} from 'lucide-react';
import { useCaseStore, useSchemaStore, useGraphStore } from '@store';
import { generateEntityId, generateRelationId } from '@utils';
import {
  CASE_DETAIL_TAB_CONFIG,
  DEFAULT_CASE_FORM_FULL,
  DEFAULT_ENTITY_FORM,
  DEFAULT_RELATION_FORM,
} from './utils';

const CaseDetail = () => {
  const { getCurrentSchema, currentSchemaId } = useSchemaStore();
  const {
    cases,
    currentCaseId,
    addCase,
    setCurrentCase,
    getCurrentCase,
    addEntityToCase,
    addRelationToCase,
    deleteEntityFromCase,
    deleteRelationFromCase,
  } = useCaseStore();
  const {
    setFocusCase,
    addNodeToGraph,
    removeNodeFromGraph,
    addLinkToGraph,
    removeLinkFromGraph,
    loadAllCasesToGraph
  } = useGraphStore();

  const [activeTab, setActiveTab] = useState(CASE_DETAIL_TAB_CONFIG[0]?.id || 'results');
  const [editingCase, setEditingCase] = useState(false);
  const [expandedEntities, setExpandedEntities] = useState({});

  const [newEntity, setNewEntity] = useState(DEFAULT_ENTITY_FORM);
  const [newRelation, setNewRelation] = useState(DEFAULT_RELATION_FORM);

  const currentSchema = getCurrentSchema();
  const currentCase = getCurrentCase();

  const [caseFormData, setCaseFormData] = useState(DEFAULT_CASE_FORM_FULL);

  // Icon mapping
  const TAB_ICONS = {
    results: Building,
    manual: Edit2
  };

  const entityTypes = currentSchema?.entityTypes || [];
  const entities = currentCase?.entities || [];
  const relations = currentCase?.relations || [];

  const handleAddCase = () => {
    if (caseFormData.name) {
      const newCase = {
        ...caseFormData,
        schemaId: currentSchemaId,
        entities: [],
        relations: [],
      };
      addCase(newCase);
      setCaseFormData(DEFAULT_CASE_FORM_FULL);
      setEditingCase(false);
    }
  };

  const handleAddEntity = useCallback(async () => {
    if (newEntity.name && newEntity.entityType && currentCase) {
      const savedEntity = await addEntityToCase(currentCase.id, {
        ...newEntity,
        id: generateEntityId(),
      });
      if (savedEntity) {
        addNodeToGraph(savedEntity);
      }
      setNewEntity(DEFAULT_ENTITY_FORM);
    }
  }, [newEntity, currentCase, addEntityToCase, addNodeToGraph]);

  const handleAddRelation = useCallback(async () => {
    if (newRelation.name && newRelation.sourceId && newRelation.targetId && currentCase) {
      const savedRelation = await addRelationToCase(currentCase.id, {
        ...newRelation,
        id: generateRelationId(),
      });
      if (savedRelation) {
        addLinkToGraph(savedRelation);
      }
      setNewRelation(DEFAULT_RELATION_FORM);
    }
  }, [newRelation, currentCase, addRelationToCase, addLinkToGraph]);

  const handleDeleteEntity = async (entityId) => {
    if (currentCase) {
      await deleteEntityFromCase(currentCase.id, entityId);
      removeNodeFromGraph(entityId);
    }
  };

  const handleDeleteRelation = async (relationId) => {
    if (currentCase) {
      await deleteRelationFromCase(currentCase.id, relationId);
      removeLinkFromGraph(relationId);
    }
  };

  const handleSelectCase = (id) => {
    setCurrentCase(id);
    setFocusCase(id);
    loadAllCasesToGraph();
  };

  const toggleEntityExpand = (entityId) => {
    setExpandedEntities(prev => ({
      ...prev,
      [entityId]: !prev[entityId]
    }));
  };

  return (
    <div className="h-full bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col">
      {/* 顶部 */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
              <Wand2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">案例管理</h2>
              <p className="text-sm text-gray-500">查看和编辑案例的实体与关系</p>
            </div>
          </div>
          <button
            onClick={() => setEditingCase(true)}
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新建案例
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {cases.map(caseItem => (
            <button
              key={caseItem.id}
              onClick={() => handleSelectCase(caseItem.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                currentCaseId === caseItem.id
                  ? 'bg-indigo-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {caseItem.name}
            </button>
          ))}
        </div>
      </div>

      {currentCase ? (
        <div className="flex-1 flex overflow-hidden">
          <div className="w-44 border-r border-gray-200 p-3 flex flex-col gap-1">
            {CASE_DETAIL_TAB_CONFIG.map(item => {
              const IconComponent = TAB_ICONS[item.id];
              if (!IconComponent) return null;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === item.id
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <IconComponent className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}

            <div className="mt-auto pt-3 border-t border-gray-200">
              <div className="text-xs text-gray-500 mb-2">当前 Schema</div>
              <div className="p-2 bg-blue-50 rounded-lg">
                <div className="text-xs font-medium text-blue-700">{currentSchema?.name}</div>
                <div className="text-xs text-blue-500 mt-1">
                  {entityTypes.length} 实体类型
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <AnimatePresence mode="wait">
              {activeTab === 'results' && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Building className="w-4 h-4" />
                      实体列表 ({entities.length})
                    </h3>
                    <div className="space-y-2">
                      {entities.length > 0 ? entities.map(entity => (
                        <div
                          key={entity.id}
                          className="bg-white border border-gray-200 rounded-xl overflow-hidden"
                        >
                          <div
                            className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                            onClick={() => toggleEntityExpand(entity.id)}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: entityTypes.find(e => e.name === entity.entityType)?.color }}
                              />
                              <span className="font-medium text-gray-900">{entity.name}</span>
                              <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-100 rounded">
                                {entity.entityType}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteEntity(entity.id); }}
                                className="p-1.5 hover:bg-red-50 rounded-lg"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </button>
                            </div>
                          </div>
                          {expandedEntities[entity.id] && entity.properties && (
                            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                              {Object.entries(entity.properties).map(([key, value]) => (
                                <div key={key} className="flex justify-between text-xs py-1">
                                  <span className="text-gray-500">{key}</span>
                                  <span className="text-gray-700">{value}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )) : (
                        <div className="text-center py-8 text-gray-400">
                          <Building className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">暂无实体</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Link2 className="w-4 h-4" />
                      关系列表 ({relations.length})
                    </h3>
                    <div className="space-y-2">
                      {relations.length > 0 ? relations.map(rel => {
                        const sourceEntity = entities.find(e => e.id === rel.sourceId);
                        const targetEntity = entities.find(e => e.id === rel.targetId);
                        return (
                          <div
                            key={rel.id}
                            className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl"
                          >
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium text-blue-600">{sourceEntity?.name || '未知'}</span>
                              <ArrowRight className="w-4 h-4 text-gray-400" />
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-xs font-medium">
                                {rel.name}
                              </span>
                              <ArrowRight className="w-4 h-4 text-gray-400" />
                              <span className="font-medium text-purple-600">{targetEntity?.name || '未知'}</span>
                            </div>
                            <button
                              onClick={() => handleDeleteRelation(rel.id)}
                              className="p-1.5 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </button>
                          </div>
                        );
                      }) : (
                        <div className="text-center py-8 text-gray-400">
                          <Link2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">暂无关系</p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'manual' && (
                <motion.div
                  key="manual"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">添加实体</h3>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="实体名称"
                        value={newEntity.name}
                        onChange={(e) => setNewEntity({ ...newEntity, name: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <select
                        value={newEntity.entityType}
                        onChange={(e) => setNewEntity({ ...newEntity, entityType: e.target.value })}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">选择类型</option>
                        {entityTypes.map(e => (
                          <option key={e.id} value={e.name}>{e.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleAddEntity}
                        className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">添加关系</h3>
                    <div className="flex gap-2 flex-wrap">
                      <select
                        value={newRelation.sourceId}
                        onChange={(e) => setNewRelation({ ...newRelation, sourceId: e.target.value })}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">源实体</option>
                        {entities.map(e => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="关系名称"
                        value={newRelation.name}
                        onChange={(e) => setNewRelation({ ...newRelation, name: e.target.value })}
                        className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <select
                        value={newRelation.targetId}
                        onChange={(e) => setNewRelation({ ...newRelation, targetId: e.target.value })}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">目标实体</option>
                        {entities.map(e => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleAddRelation}
                        className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">案例信息</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> 位置
                        </div>
                        <div className="text-sm font-medium">{currentCase.location || '未指定'}</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> 年份
                        </div>
                        <div className="text-sm font-medium">{currentCase.year || '未指定'}</div>
                      </div>
                    </div>
                    {currentCase.tags?.length > 0 && (
                      <div className="flex gap-2 mt-3 flex-wrap">
                        {currentCase.tags.map((tag, i) => (
                          <span key={i} className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <Wand2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-sm mb-2">请选择或创建一个案例</p>
            <p className="text-xs text-gray-300">在右侧 AI 助手中进行案例拆解</p>
          </div>
        </div>
      )}

      <AnimatePresence>
        {editingCase && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
            onClick={() => setEditingCase(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">新建案例</h3>
                <button onClick={() => setEditingCase(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">案例名称 *</label>
                  <input
                    type="text"
                    value={caseFormData.name}
                    onChange={(e) => setCaseFormData({ ...caseFormData, name: e.target.value })}
                    placeholder="例如：上海新天地改造项目"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">位置</label>
                    <input
                      type="text"
                      value={caseFormData.location}
                      onChange={(e) => setCaseFormData({ ...caseFormData, location: e.target.value })}
                      placeholder="上海市黄浦区"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">年份</label>
                    <input
                      type="text"
                      value={caseFormData.year}
                      onChange={(e) => setCaseFormData({ ...caseFormData, year: e.target.value })}
                      placeholder="2000"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">描述文本</label>
                  <textarea
                    value={caseFormData.description}
                    onChange={(e) => setCaseFormData({ ...caseFormData, description: e.target.value })}
                    rows={4}
                    placeholder="粘贴案例描述文本，可在拆解时使用..."
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
                <button
                  onClick={handleAddCase}
                  disabled={!caseFormData.name}
                  className="w-full py-2.5 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-4 h-4" />
                  创建案例
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CaseDetail;
