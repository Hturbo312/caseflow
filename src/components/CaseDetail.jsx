import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Sparkles,
  Wand2,
  Send,
  Loader2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useCaseStore, useSchemaStore, useGraphStore, useAIStore } from '../store';

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
    updateCase,
  } = useCaseStore();
  const {
    setFocusCase,
    addNodeToGraph,
    removeNodeFromGraph,
    addLinkToGraph,
    removeLinkFromGraph,
    setHighlightedNodes,
    loadAllCasesToGraph
  } = useGraphStore();
  const { sendToAI, isThinking, setContext, messages, addMessage } = useAIStore();

  const [activeTab, setActiveTab] = useState('extraction'); // extraction, results, manual
  const [editingCase, setEditingCase] = useState(false);
  const [caseText, setCaseText] = useState('');
  const [extractingCaseId, setExtractingCaseId] = useState(null);
  const [expandedEntities, setExpandedEntities] = useState({});

  // 手动添加实体/关系状态
  const [newEntity, setNewEntity] = useState({ name: '', entityType: '', properties: {} });
  const [newRelation, setNewRelation] = useState({ name: '', sourceId: '', targetId: '' });

  const currentSchema = getCurrentSchema();
  const currentCase = getCurrentCase();

  const [caseFormData, setCaseFormData] = useState({
    name: '',
    location: '',
    year: '',
    description: '',
    tags: [],
  });

  const entityTypes = currentSchema?.entityTypes || [];
  const entities = currentCase?.entities || [];
  const relations = currentCase?.relations || [];

  // 创建新案例
  const handleAddCase = () => {
    if (caseFormData.name) {
      const newCase = {
        ...caseFormData,
        schemaId: currentSchemaId,
        entities: [],
        relations: [],
      };
      addCase(newCase);
      setCaseFormData({ name: '', location: '', year: '', description: '', tags: [] });
      setEditingCase(false);
    }
  };

  // AI 案例拆解
  const handleAIExtraction = async () => {
    if (!caseText.trim() || !currentCase) {
      alert('请先选择案例并输入案例文本');
      return;
    }

    // 构建基于 Schema 的提示词
    const schemaPrompt = `
你是一个专业的城市更新案例拆解助手。请根据以下 Schema 结构，从案例文本中提取实体和关系。

## Schema 结构
实体类型：
${entityTypes.map(e => `- ${e.name} (属性: ${e.properties?.map(p => p.name).join(', ') || '无'})`).join('\n')}

关系类型：
${currentSchema?.relations?.map(r => `- ${r.name}: ${r.from} → ${r.to}`).join('\n') || '无预定义关系'}

## 案例文本
${caseText}

## 输出要求
请以 JSON 格式输出提取结果，格式如下：
{
  "entities": [
    { "name": "实体名称", "entityType": "实体类型", "properties": {} }
  ],
  "relations": [
    { "name": "关系名称", "sourceName": "源实体名称", "targetName": "目标实体名称" }
  ]
}

请只输出 JSON，不要有其他内容。
`;

    // 设置上下文为当前案例
    setContext({ type: 'case', data: currentCase });
    setExtractingCaseId(currentCase.id);

    // 发送到 AI
    addMessage({ role: 'user', content: `开始拆解案例：${currentCase.name}\n\n案例文本：\n${caseText.substring(0, 500)}...` });

    // 模拟 AI 响应（实际应该调用 AI API）
    setTimeout(() => {
      // 解析模拟的 AI 响应
      const mockResult = {
        entities: [
          { name: '开发主体', entityType: '项目主体', properties: { 类型: '企业', 角色: '开发商' } },
          { name: '改造模式', entityType: '改造方式', properties: { 模式: '综合改造', 周期: '3-5年' } },
          { name: '项目地块', entityType: '地块属性', properties: { 面积: '待提取', 用地性质: '混合' } },
        ],
        relations: [
          { name: '采用', sourceName: '开发主体', targetName: '改造模式' },
          { name: '位于', sourceName: '开发主体', targetName: '项目地块' },
        ]
      };

      // 保存提取结果到案例
      mockResult.entities.forEach(entity => {
        addEntityToCase(currentCase.id, {
          ...entity,
          id: `e-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        });
      });

      // 添加关系
      setTimeout(() => {
        mockResult.relations.forEach(rel => {
          const sourceEntity = currentCase.entities?.find(e => e.name === rel.sourceName);
          const targetEntity = currentCase.entities?.find(e => e.name === rel.targetName);
          if (sourceEntity && targetEntity) {
            addRelationToCase(currentCase.id, {
              ...rel,
              id: `r-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              sourceId: sourceEntity.id,
              targetId: targetEntity.id,
            });
          }
        });
      }, 100);

      addMessage({
        role: 'assistant',
        content: `拆解完成！已从案例文本中提取 ${mockResult.entities.length} 个实体和 ${mockResult.relations.length} 条关系。\n\n实体：\n${mockResult.entities.map(e => `- ${e.name} (${e.entityType})`).join('\n')}\n\n关系：\n${mockResult.relations.map(r => `- ${r.sourceName} --${r.name}--> ${r.targetName}`).join('\n')}`
      });

      setExtractingCaseId(null);
      setActiveTab('results');
      loadAllCasesToGraph();
    }, 2000);
  };

  // 手动添加实体
  const handleAddEntity = async () => {
    if (newEntity.name && newEntity.entityType && currentCase) {
      const savedEntity = await addEntityToCase(currentCase.id, {
        ...newEntity,
        id: `e-${Date.now()}`,
      });
      if (savedEntity) {
        addNodeToGraph(savedEntity);
      }
      setNewEntity({ name: '', entityType: '', properties: {} });
    }
  };

  // 手动添加关系
  const handleAddRelation = async () => {
    if (newRelation.name && newRelation.sourceId && newRelation.targetId && currentCase) {
      const savedRelation = await addRelationToCase(currentCase.id, {
        ...newRelation,
        id: `r-${Date.now()}`,
      });
      if (savedRelation) {
        addLinkToGraph(savedRelation);
      }
      setNewRelation({ name: '', sourceId: '', targetId: '' });
    }
  };

  // 删除实体
  const handleDeleteEntity = async (entityId) => {
    if (currentCase) {
      await deleteEntityFromCase(currentCase.id, entityId);
      removeNodeFromGraph(entityId);
    }
  };

  // 删除关系
  const handleDeleteRelation = async (relationId) => {
    if (currentCase) {
      await deleteRelationFromCase(currentCase.id, relationId);
      removeLinkFromGraph(relationId);
    }
  };

  // 切换案例
  const handleSelectCase = (id) => {
    setCurrentCase(id);
    setFocusCase(id);
    // 加载案例文本
    const selectedCase = cases.find(c => c.id === id);
    if (selectedCase?.description) {
      setCaseText(selectedCase.description);
    }
  };

  // 切换实体展开状态
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
              <h2 className="text-lg font-bold">案例拆解</h2>
              <p className="text-sm text-gray-500">基于 Schema 结构智能提取</p>
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

        {/* 案例选择器 */}
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

      {/* 内容区 */}
      {currentCase ? (
        <div className="flex-1 flex overflow-hidden">
          {/* 标签导航 */}
          <div className="w-44 border-r border-gray-200 p-3 flex flex-col gap-1">
            {[
              { id: 'extraction', label: '智能拆解', icon: Sparkles },
              { id: 'results', label: '拆解结果', icon: CheckCircle },
              { id: 'manual', label: '手动编辑', icon: Edit2 },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === item.id
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}

            {/* Schema 提示 */}
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

          {/* 主内容 */}
          <div className="flex-1 overflow-y-auto p-4">
            <AnimatePresence mode="wait">
              {/* 智能拆解标签 */}
              {activeTab === 'extraction' && (
                <motion.div
                  key="extraction"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700">输入案例文本</h3>
                    <span className="text-xs text-gray-400">{caseText.length} 字</span>
                  </div>

                  <textarea
                    value={caseText}
                    onChange={(e) => setCaseText(e.target.value)}
                    placeholder="在此粘贴或输入案例描述文本，AI 将根据 Schema 结构自动提取实体和关系..."
                    rows={12}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed"
                  />

                  {/* Schema 结构预览 */}
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="text-xs font-semibold text-gray-500 mb-3">将根据以下结构拆解：</div>
                    <div className="flex flex-wrap gap-2">
                      {entityTypes.map(type => (
                        <div
                          key={type.id}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200"
                        >
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: type.color }}
                          />
                          <span className="text-xs font-medium">{type.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI 拆解按钮 */}
                  <button
                    onClick={handleAIExtraction}
                    disabled={!caseText.trim() || isThinking}
                    className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-medium hover:from-indigo-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                  >
                    {isThinking || extractingCaseId === currentCase.id ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        正在拆解中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        开始 AI 拆解
                      </>
                    )}
                  </button>

                  <p className="text-xs text-gray-400 text-center">
                    拆解结果将同步到 AI 助手，可在右侧查看详细分析
                  </p>
                </motion.div>
              )}

              {/* 拆解结果标签 */}
              {activeTab === 'results' && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  {/* 实体列表 */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Building className="w-4 h-4" />
                      提取的实体 ({entities.length})
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
                              {expandedEntities[entity.id] ? (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                              )}
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
                          <p className="text-sm">暂无实体，请先进行智能拆解</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 关系列表 */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Link2 className="w-4 h-4" />
                      提取的关系 ({relations.length})
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

              {/* 手动编辑标签 */}
              {activeTab === 'manual' && (
                <motion.div
                  key="manual"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {/* 添加实体 */}
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

                  {/* 添加关系 */}
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

                  {/* 案例基本信息 */}
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
            <p className="text-xs text-gray-300">基于 Schema 结构进行智能拆解</p>
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