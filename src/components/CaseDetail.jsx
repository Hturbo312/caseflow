import React, { useState, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  FileText,
  MapPin,
  Calendar,
  Tag,
  CheckCircle,
  Building,
  Link2,
  ArrowRight,
  Share2,
  Highlighter,
  MousePointer2
} from 'lucide-react';
import { useCaseStore, useSchemaStore, useGraphStore } from '../store';

const CaseDetail = () => {
  const { getCurrentSchema } = useSchemaStore();
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
  const { syncCurrentCaseToGraph, addNodeToGraph, removeNodeFromGraph, addLinkToGraph, removeLinkFromGraph, setHighlightedNodes } = useGraphStore();

  const [activeTab, setActiveTab] = useState('info');
  const [editingCase, setEditingCase] = useState(false);
  const [newEntity, setNewEntity] = useState({ name: '', entityType: '', properties: {} });
  const [newRelation, setNewRelation] = useState({ name: '', sourceId: '', targetId: '' });

  // 映射编辑器状态
  const [selectedText, setSelectedText] = useState('');
  const [mappingEntityType, setMappingEntityType] = useState('');
  const [textHighlights, setTextHighlights] = useState([]);
  const [mappingText, setMappingText] = useState('');
  const textRef = useRef(null);

  const currentSchema = getCurrentSchema();
  const currentCase = getCurrentCase();

  const [caseFormData, setCaseFormData] = useState({
    name: '',
    location: '',
    year: '',
    description: '',
    tags: [],
  });

  // 安全获取 entityTypes
  const entityTypes = currentSchema?.entityTypes || [];
  const entities = currentCase?.entities || [];
  const relations = currentCase?.relations || [];

  const handleAddCase = () => {
    if (caseFormData.name) {
      addCase({
        ...caseFormData,
        schemaId: currentSchema.id,
        entities: [],
        relations: [],
      });
      setCaseFormData({ name: '', location: '', year: '', description: '', tags: [] });
      setEditingCase(false);
    }
  };

  const handleAddEntity = () => {
    if (newEntity.name && newEntity.entityType && currentCase) {
      const entityId = Date.now().toString();
      const newEntityData = {
        ...newEntity,
        id: entityId,
      };
      addEntityToCase(currentCase.id, newEntityData);
      addNodeToGraph(newEntityData);
      setNewEntity({ name: '', entityType: '', properties: {} });
    }
  };

  const handleAddRelation = () => {
    if (newRelation.name && newRelation.sourceId && newRelation.targetId && currentCase) {
      const relationId = Date.now().toString();
      const newRelationData = {
        ...newRelation,
        id: relationId,
      };
      addRelationToCase(currentCase.id, newRelationData);
      addLinkToGraph(newRelationData);
      setNewRelation({ name: '', sourceId: '', targetId: '' });
    }
  };

  const handleDeleteEntity = (entityId) => {
    if (currentCase) {
      deleteEntityFromCase(currentCase.id, entityId);
      // 同步从图谱删除
      removeNodeFromGraph(entityId);
    }
  };

  const handleDeleteRelation = (relationId) => {
    if (currentCase) {
      deleteRelationFromCase(currentCase.id, relationId);
      // 同步从图谱删除
      removeLinkFromGraph(relationId);
    }
  };

  // 切换案例时同步图谱数据
  const handlesetCurrentCase = (id) => {
    setCurrentCase(id);
    // 延迟同步以确保案例数据已加载
    setTimeout(() => syncCurrentCaseToGraph(), 0);
  };

  // 处理文本选择
  const handleTextSelection = () => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    if (selectedText) {
      setSelectedText(selectedText);
    }
  };

  // 添加标注到文本
  const handleAddHighlight = () => {
    if (selectedText && mappingEntityType) {
      const color = entityTypes.find(e => e.name === mappingEntityType)?.color || '#3b82f6';
      setTextHighlights([...textHighlights, {
        id: Date.now().toString(),
        text: selectedText,
        entityType: mappingEntityType,
        color
      }]);
      setSelectedText('');
      setMappingEntityType('');
    }
  };

  // 从标注创建实体
  const handleCreateEntityFromHighlight = (highlight) => {
    if (currentCase) {
      const entityId = Date.now().toString();
      addEntityToCase(currentCase.id, {
        id: entityId,
        name: highlight.text,
        entityType: highlight.entityType,
        properties: {}
      });
      addNodeToGraph({
        id: entityId,
        name: highlight.text,
        entityType: highlight.entityType,
        properties: {}
      });
      // 高亮新创建的节点
      setHighlightedNodes([entityId]);
    }
  };

  // 删除标注
  const handleDeleteHighlight = (highlightId) => {
    setTextHighlights(textHighlights.filter(h => h.id !== highlightId));
  };

  return (
    <div className="h-full bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col">
      {/* 顶部 */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">案例详情</h2>
              <p className="text-sm text-gray-500">结构化案例管理</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => syncCurrentCaseToGraph()}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors flex items-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              同步到图谱
            </button>
            <button
              onClick={() => setEditingCase(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              新建案例
            </button>
          </div>
        </div>

        {/* 案例选择器 */}
        <div className="flex gap-2 overflow-x-auto">
          {cases.map(caseItem => (
            <button
              key={caseItem.id}
              onClick={() => handlesetCurrentCase(caseItem.id)}
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

      {/* 内容区 */}
      {currentCase ? (
        <div className="flex-1 flex overflow-hidden">
          {/* 侧边标签 */}
          <div className="w-48 border-r border-gray-200 p-4">
            <nav className="space-y-2">
              {[
                { id: 'info', label: '基本信息', icon: FileText },
                { id: 'entities', label: '实体列表', icon: Building },
                { id: 'relations', label: '关系管理', icon: Link2 },
                { id: 'mapping', label: '映射编辑', icon: MapPin },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === item.id
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </nav>

            {/* 快速统计 */}
            <div className="mt-6 p-4 bg-indigo-50 rounded-xl">
              <div className="text-xs text-indigo-600 font-medium mb-2">案例统计</div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">实体</span>
                  <span className="font-semibold text-indigo-700">{currentCase.entities?.length || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">关系</span>
                  <span className="font-semibold text-indigo-700">{currentCase.relations?.length || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 主内容 */}
          <div className="flex-1 overflow-y-auto p-4">
            <AnimatePresence mode="wait">
              {activeTab === 'info' && (
                <motion.div
                  key="info"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-2xl font-bold mb-2">{currentCase.name}</h3>
                    <p className="text-gray-600">{currentCase.description || '暂无描述'}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-2 text-gray-500 mb-1">
                        <MapPin className="w-4 h-4" />
                        <span className="text-xs">位置</span>
                      </div>
                      <div className="font-medium">{currentCase.location || '未指定'}</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-2 text-gray-500 mb-1">
                        <Calendar className="w-4 h-4" />
                        <span className="text-xs">年份</span>
                      </div>
                      <div className="font-medium">{currentCase.year || '未指定'}</div>
                    </div>
                  </div>

                  {currentCase.tags && currentCase.tags.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 text-gray-500 mb-2">
                        <Tag className="w-4 h-4" />
                        <span className="text-xs">标签</span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {currentCase.tags.map((tag, i) => (
                          <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'entities' && (
                <motion.div
                  key="entities"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  <h3 className="text-sm font-semibold text-gray-700">实体列表</h3>

                  {/* 添加实体表单 */}
                  <div className="flex gap-2 p-3 bg-gray-50 rounded-xl">
                    <input
                      type="text"
                      placeholder="实体名称"
                      value={newEntity.name}
                      onChange={(e) => setNewEntity({ ...newEntity, name: e.target.value })}
                      className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <select
                      value={newEntity.entityType}
                      onChange={(e) => setNewEntity({ ...newEntity, entityType: e.target.value })}
                      className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">选择类型</option>
                      {entityTypes.map(e => (
                        <option key={e.id} value={e.name}>{e.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleAddEntity}
                      className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 实体列表 */}
                  <div className="space-y-2">
                    {currentCase.entities && currentCase.entities.length > 0 ? (
                      currentCase.entities.map(entity => (
                        <div
                          key={entity.id}
                          className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{
                                backgroundColor: entityTypes.find(e => e.name === entity.entityType)?.color || '#9ca3af'
                              }}
                            />
                            <span className="font-medium">{entity.name}</span>
                            <span className="text-xs text-gray-400 px-2 py-0.5 bg-gray-100 rounded">
                              {entity.entityType}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
                              <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                            </button>
                            <button
                              onClick={() => handleDeleteEntity(entity.id)}
                              className="p-1.5 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 text-gray-400">
                        <Building className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">暂无实体，点击上方添加</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'relations' && (
                <motion.div
                  key="relations"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  <h3 className="text-sm font-semibold text-gray-700">关系管理</h3>

                  {/* 添加关系表单 */}
                  <div className="flex gap-2 p-3 bg-gray-50 rounded-xl items-center">
                    <select
                      value={newRelation.sourceId}
                      onChange={(e) => setNewRelation({ ...newRelation, sourceId: e.target.value })}
                      className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">源实体</option>
                      {currentCase.entities.map(e => (
                        <option key={e.id} value={e.id}>{e.name} ({e.entityType})</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="关系名称"
                      value={newRelation.name}
                      onChange={(e) => setNewRelation({ ...newRelation, name: e.target.value })}
                      className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <select
                      value={newRelation.targetId}
                      onChange={(e) => setNewRelation({ ...newRelation, targetId: e.target.value })}
                      className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">目标实体</option>
                      {currentCase.entities.map(e => (
                        <option key={e.id} value={e.id}>{e.name} ({e.entityType})</option>
                      ))}
                    </select>
                    <button
                      onClick={handleAddRelation}
                      className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 关系列表 */}
                  <div className="space-y-2">
                    {currentCase.relations && currentCase.relations.length > 0 ? (
                      currentCase.relations.map(rel => {
                        const sourceEntity = currentCase.entities?.find(e => e.id === rel.sourceId);
                        const targetEntity = currentCase.entities?.find(e => e.id === rel.targetId);
                        return (
                          <div
                            key={rel.id}
                            className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-medium text-blue-600">{sourceEntity?.name || '未知'}</span>
                                <ArrowRight className="w-4 h-4 text-gray-400" />
                                <span className="font-medium text-purple-600">{targetEntity?.name || '未知'}</span>
                              </div>
                              <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium">
                                {rel.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
                                <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                              </button>
                              <button
                                onClick={() => handleDeleteRelation(rel.id)}
                                className="p-1.5 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-12 text-gray-400">
                        <Link2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">暂无关系，点击上方添加</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'mapping' && (
                <motion.div
                  key="mapping"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  <h3 className="text-sm font-semibold text-gray-700">映射编辑器</h3>

                  {/* 工具栏 */}
                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl">
                    <MousePointer2 className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-blue-700 font-medium">选中文本以创建标注</span>
                    {selectedText && (
                      <>
                        <span className="text-gray-400">→</span>
                        <span className="px-2 py-1 bg-white rounded text-xs text-blue-600 font-mono">
                          "{selectedText.length > 30 ? selectedText.substring(0, 30) + '...' : selectedText}"
                        </span>
                        <select
                          value={mappingEntityType}
                          onChange={(e) => setMappingEntityType(e.target.value)}
                          className="px-2 py-1.5 bg-white border border-blue-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">选择实体类型</option>
                          {entityTypes.map(e => (
                            <option key={e.id} value={e.name}>{e.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={handleAddHighlight}
                          disabled={!mappingEntityType}
                          className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          <Highlighter className="w-3 h-3" />
                          添加标注
                        </button>
                      </>
                    )}
                  </div>

                  {/* 文本输入区域 */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500">案例文本</span>
                      <span className="text-xs text-gray-400">{textHighlights.length} 个标注</span>
                    </div>
                    <textarea
                      ref={textRef}
                      value={mappingText}
                      onChange={(e) => setMappingText(e.target.value)}
                      onMouseUp={handleTextSelection}
                      onKeyUp={handleTextSelection}
                      placeholder="在此粘贴或输入案例文本，然后选中文字创建标注..."
                      rows={8}
                      className="w-full px-4 py-3 resize-none focus:outline-none text-sm leading-relaxed"
                    />
                  </div>

                  {/* 标注列表 */}
                  {textHighlights.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Highlighter className="w-4 h-4" />
                        已标注内容
                      </h4>
                      <div className="space-y-2">
                        {textHighlights.map((highlight) => (
                          <div
                            key={highlight.id}
                            className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: highlight.color }}
                              />
                              <div>
                                <span className="text-sm font-medium text-gray-700">{highlight.text}</span>
                                <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-500">
                                  {highlight.entityType}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleCreateEntityFromHighlight(highlight)}
                                className="px-2 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600 transition-colors flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                创建实体
                              </button>
                              <button
                                onClick={() => handleDeleteHighlight(highlight.id)}
                                className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 空状态提示 */}
                  {textHighlights.length === 0 && (
                    <div className="p-8 bg-gray-50 rounded-xl text-center">
                      <Highlighter className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-500 text-sm">
                        在上方文本框中输入内容，选中文字后选择实体类型进行标注
                      </p>
                      <p className="text-gray-400 text-xs mt-2">
                        标注完成后，点击"创建实体"可将标注转换为图谱节点
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>暂无案例，请点击上方"新建案例"创建</p>
          </div>
        </div>
      )}

      {/* 新建案例弹窗 */}
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
              className="bg-white rounded-2xl p-6 w-full max-w-md"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">新建案例</h3>
                <button onClick={() => setEditingCase(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">案例名称</label>
                  <input
                    type="text"
                    value={caseFormData.name}
                    onChange={(e) => setCaseFormData({ ...caseFormData, name: e.target.value })}
                    placeholder="例如：上海新天地改造项目"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">位置</label>
                  <input
                    type="text"
                    value={caseFormData.location}
                    onChange={(e) => setCaseFormData({ ...caseFormData, location: e.target.value })}
                    placeholder="例如：上海市黄浦区"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">年份</label>
                  <input
                    type="text"
                    value={caseFormData.year}
                    onChange={(e) => setCaseFormData({ ...caseFormData, year: e.target.value })}
                    placeholder="例如：2000"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                  <textarea
                    value={caseFormData.description}
                    onChange={(e) => setCaseFormData({ ...caseFormData, description: e.target.value })}
                    rows={4}
                    placeholder="案例详细描述..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
                <button
                  onClick={handleAddCase}
                  className="w-full py-2.5 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2"
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
