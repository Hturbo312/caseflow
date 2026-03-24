import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Database,
  Tag,
  Link2,
  Download,
  Upload,
  FileJson,
  Eye,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Search,
  MoreVertical,
  Copy,
  Settings,
  Zap,
  Box,
  Network,
  FileText,
  GripVertical,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { useSchemaStore } from '../store';

// 属性类型定义
const PROPERTY_TYPES = [
  { value: 'text', label: '文本' },
  { value: 'number', label: '数字' },
  { value: 'date', label: '日期' },
  { value: 'boolean', label: '布尔值' },
  { value: 'enum', label: '枚举' },
];

// 关系线型定义
const RELATION_STYLES = [
  { value: 'solid', label: '实线' },
  { value: 'dashed', label: '虚线' },
  { value: 'dotted', label: '点线' },
];

// 关系方向定义
const RELATION_DIRECTIONS = [
  { value: 'directed', label: '有向' },
  { value: 'bidirectional', label: '双向' },
  { value: 'undirected', label: '无向' },
];

// 预设颜色选项
const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ef4444', '#06b6d4', '#84cc16', '#f97316',
  '#ec4899', '#6366f1', '#14b8a6', '#eab308'
];

const SchemaArchitect = () => {
  const {
    schemas,
    currentSchemaId,
    setCurrentSchema,
    addSchema,
    updateSchema,
    deleteSchema,
    exportSchema,
    importSchema,
    addEntityType,
    updateEntityType,
    deleteEntityType,
    addProperty,
    updateProperty,
    deleteProperty,
    addRelation,
    updateRelation,
    deleteRelation,
    getCurrentSchema
  } = useSchemaStore();

  // UI 状态
  const [activeTab, setActiveTab] = useState('overview'); // overview, entities, relations, visualizer
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMaximizedVisualizer, setShowMaximizedVisualizer] = useState(false);

  // Schema 编辑状态
  const [editingSchema, setEditingSchema] = useState(false);
  const [creatingSchema, setCreatingSchema] = useState(false);
  const [newSchemaName, setNewSchemaName] = useState('');

  // 实体编辑抽屉状态
  const [entityDrawerOpen, setEntityDrawerOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState(null); // null 表示新建
  const [entityForm, setEntityForm] = useState({ name: '', color: '#3b82f6', properties: [] });

  // 关系编辑抽屉状态
  const [relationDrawerOpen, setRelationDrawerOpen] = useState(false);
  const [editingRelation, setEditingRelation] = useState(null); // null 表示新建
  const [relationForm, setRelationForm] = useState({
    name: '', from: '', to: '', direction: 'directed', color: '#9ca3af', style: 'solid'
  });

  // 属性编辑状态
  const [editingProperty, setEditingProperty] = useState(null);
  const [propertyForm, setPropertyForm] = useState({ name: '', type: 'text', options: [] });

  // 导入文件输入
  const fileInputRef = useRef(null);

  const currentSchema = getCurrentSchema();

  // ========== Schema 管理 ==========

  const handleCreateSchema = () => {
    if (newSchemaName.trim()) {
      addSchema(newSchemaName.trim());
      setNewSchemaName('');
      setCreatingSchema(false);
    }
  };

  const handleDeleteSchema = (schemaId, e) => {
    e.stopPropagation();
    if (schemas.length > 1 && confirm('确定要删除此 Schema 吗？')) {
      deleteSchema(schemaId);
    } else if (schemas.length <= 1) {
      alert('至少需要保留一个 Schema');
    }
  };

  const handleOpenEditSchema = () => {
    setEditingSchema(true);
  };

  const handleSaveSchemaEdit = () => {
    updateSchema(currentSchema.id, {
      name: editFormData.name,
      description: editFormData.description
    });
    setEditingSchema(false);
  };

  // 导入导出
  const handleExportSchema = () => {
    exportSchema(currentSchema.id);
  };

  const handleImportSchema = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const jsonData = JSON.parse(event.target.result);
          importSchema(jsonData);
        } catch (err) {
          alert('导入失败：文件格式不正确');
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  // ========== 实体类型管理 ==========

  const openCreateEntityDrawer = () => {
    setEditingEntity(null);
    setEntityForm({ name: '', color: PRESET_COLORS[0], properties: [] });
    setEntityDrawerOpen(true);
  };

  const openEditEntityDrawer = (entity) => {
    setEditingEntity(entity);
    setEntityForm({
      name: entity.name,
      color: entity.color,
      properties: entity.properties || []
    });
    setEntityDrawerOpen(true);
  };

  const handleSaveEntity = () => {
    if (!entityForm.name.trim()) {
      alert('请输入实体名称');
      return;
    }
    if (editingEntity) {
      updateEntityType(currentSchema.id, editingEntity.id, {
        name: entityForm.name,
        color: entityForm.color
      });
    } else {
      addEntityType(currentSchema.id, {
        name: entityForm.name,
        color: entityForm.color,
        properties: entityForm.properties
      });
    }
    setEntityDrawerOpen(false);
  };

  const handleDeleteEntity = (entityId) => {
    if (confirm('确定要删除此实体类型吗？相关关系也会受影响。')) {
      deleteEntityType(currentSchema.id, entityId);
      setEntityDrawerOpen(false);
    }
  };

  // 属性管理
  const openAddProperty = () => {
    setEditingProperty(null);
    setPropertyForm({ name: '', type: 'text', options: [] });
  };

  const openEditProperty = (prop) => {
    setEditingProperty(prop);
    setPropertyForm({
      name: prop.name,
      type: prop.type,
      options: prop.options || []
    });
  };

  const handleSaveProperty = () => {
    if (!propertyForm.name.trim()) {
      alert('请输入属性名称');
      return;
    }
    const entityTypeId = editingEntity?.id;
    if (entityTypeId) {
      if (editingProperty) {
        // 更新属性 - 先删除再添加（简化处理）
        deleteProperty(currentSchema.id, entityTypeId, editingProperty.name);
        addProperty(currentSchema.id, entityTypeId, {
          name: propertyForm.name,
          type: propertyForm.type,
          options: propertyForm.type === 'enum' ? propertyForm.options : undefined
        });
        // 更新表单中的实体数据
        const updatedProps = entityForm.properties.map(p =>
          p.name === editingProperty.name ? { ...propertyForm } : p
        );
        setEntityForm({ ...entityForm, properties: updatedProps });
      } else {
        addProperty(currentSchema.id, entityTypeId, {
          name: propertyForm.name,
          type: propertyForm.type,
          options: propertyForm.type === 'enum' ? propertyForm.options : undefined
        });
        setEntityForm({
          ...entityForm,
          properties: [...entityForm.properties, { ...propertyForm }]
        });
      }
      setEditingProperty(null);
      setPropertyForm({ name: '', type: 'text', options: [] });
    }
  };

  const handleDeleteProperty = (propertyName) => {
    const entityTypeId = editingEntity?.id;
    if (entityTypeId) {
      deleteProperty(currentSchema.id, entityTypeId, propertyName);
      setEntityForm({
        ...entityForm,
        properties: entityForm.properties.filter(p => p.name !== propertyName)
      });
    }
    setEditingProperty(null);
    setPropertyForm({ name: '', type: 'text', options: [] });
  };

  // ========== 关系管理 ==========

  const openCreateRelationDrawer = () => {
    setEditingRelation(null);
    setRelationForm({
      name: '',
      from: currentSchema.entityTypes[0]?.name || '',
      to: currentSchema.entityTypes[0]?.name || '',
      direction: 'directed',
      color: '#9ca3af',
      style: 'solid'
    });
    setRelationDrawerOpen(true);
  };

  const openEditRelationDrawer = (relation) => {
    setEditingRelation(relation);
    setRelationForm({
      name: relation.name,
      from: relation.from,
      to: relation.to,
      direction: relation.direction || 'directed',
      color: relation.color || '#9ca3af',
      style: relation.style || 'solid'
    });
    setRelationDrawerOpen(true);
  };

  const handleSaveRelation = () => {
    if (!relationForm.name.trim()) {
      alert('请输入关系名称');
      return;
    }
    if (!relationForm.from || !relationForm.to) {
      alert('请选择源实体和目标实体');
      return;
    }
    if (editingRelation) {
      updateRelation(currentSchema.id, editingRelation.id, relationForm);
    } else {
      addRelation(currentSchema.id, relationForm);
    }
    setRelationDrawerOpen(false);
  };

  const handleDeleteRelation = (relationId) => {
    if (confirm('确定要删除此关系定义吗？')) {
      deleteRelation(currentSchema.id, relationId);
      setRelationDrawerOpen(false);
    }
  };

  // 筛选实体
  const filteredEntities = currentSchema.entityTypes.filter(e =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 删除 Schema 权限检查
  const canDeleteSchema = schemas.length > 1;

  // 统计信息
  const stats = {
    entities: currentSchema.entityTypes.length,
    relations: currentSchema.relations.length,
    totalProperties: currentSchema.entityTypes.reduce((sum, e) => sum + (e.properties?.length || 0), 0)
  };

  return (
    <div className="h-full bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex">
      {/* ============ 左侧 Schema 列表侧边栏 ============ */}
      <motion.div
        initial={false}
        animate={{ width: sidebarCollapsed ? 64 : 240 }}
        className="border-r border-gray-200 bg-gray-50/80 flex flex-col"
      >
        {/* 侧边栏头部 */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2"
              >
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shadow-sm">
                  <Database className="w-4 h-4 text-white" />
                </div>
              </motion.div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronLeft className="w-4 h-4 text-gray-500" />
              )}
            </button>
          </div>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-3"
            >
              <h2 className="text-base font-semibold text-gray-900">Schema 列表</h2>
              <p className="text-xs text-gray-500 mt-0.5">管理你的知识图谱结构</p>
            </motion.div>
          )}
        </div>

        {/* Schema 列表 */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {schemas.map(schema => (
            <motion.div
              key={schema.id}
              className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                currentSchemaId === schema.id
                  ? 'bg-white shadow-sm border border-gray-200'
                  : 'hover:bg-gray-100'
              }`}
              onClick={() => setCurrentSchema(schema.id)}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  currentSchemaId === schema.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                <FileJson className="w-4 h-4" />
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{schema.name}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {schema.entityTypes.length} 实体 · {schema.relations.length} 关系
                  </div>
                </div>
              )}
              {/* 删除按钮 */}
              {!sidebarCollapsed && canDeleteSchema && (
                <button
                  onClick={(e) => handleDeleteSchema(schema.id, e)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded-lg transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </button>
              )}
            </motion.div>
          ))}

          {/* 新建 Schema 按钮 */}
          <button
            onClick={() => setCreatingSchema(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {!sidebarCollapsed && '新建 Schema'}
          </button>
        </div>

        {/* 侧边栏底部操作 */}
        {!sidebarCollapsed && (
          <div className="p-3 border-t border-gray-200 space-y-1">
            <button
              onClick={handleOpenEditSchema}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <Settings className="w-4 h-4" />
              编辑当前 Schema
            </button>
            <div className="flex gap-1">
              <button
                onClick={handleExportSchema}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs text-gray-600 hover:bg-gray-100 transition-colors"
                title="导出 Schema"
              >
                <Download className="w-3.5 h-3.5" />
                导出
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs text-gray-600 hover:bg-gray-100 transition-colors"
                title="导入 Schema"
              >
                <Upload className="w-3.5 h-3.5" />
                导入
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportSchema}
              className="hidden"
            />
          </div>
        )}
      </motion.div>

      {/* ============ 右侧主内容区 ============ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶部标签页导航 */}
        <div className="border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between px-6">
            {/* 标签页 */}
            <div className="flex items-center gap-1">
              {[
                { id: 'overview', label: '概览', icon: LayoutGrid },
                { id: 'entities', label: '实体类型', icon: Tag },
                { id: 'relations', label: '关系定义', icon: Link2 },
                { id: 'visualizer', label: '可视化', icon: Network },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative ${
                    activeTab === tab.id
                      ? 'text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                    />
                  )}
                </button>
              ))}
            </div>

            {/* 快捷操作栏 */}
            <div className="flex items-center gap-2 py-2">
              {activeTab === 'entities' && (
                <button
                  onClick={openCreateEntityDrawer}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  新建实体
                </button>
              )}
              {activeTab === 'relations' && (
                <button
                  onClick={openCreateRelationDrawer}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  新建关系
                </button>
              )}
              {activeTab === 'visualizer' && (
                <button
                  onClick={() => setShowMaximizedVisualizer(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  <Maximize2 className="w-4 h-4" />
                  全屏查看
                </button>
              )}
              {/* 搜索框 */}
              {(activeTab === 'entities' || activeTab === 'relations') && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="搜索..."
                    aria-label="搜索实体类型或关系"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-gray-100 border border-transparent rounded-lg text-sm focus:bg-white focus:border-gray-300 focus:outline-none transition-all w-48"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto bg-gray-50/50">
          <AnimatePresence mode="wait">
            {/* 概览标签页 */}
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-6 space-y-6"
              >
                {/* 统计卡片 */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-500 rounded-2xl p-5 text-white shadow-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-4xl font-bold">{stats.entities}</div>
                        <div className="text-blue-100 text-sm mt-1 font-medium">实体类型</div>
                      </div>
                      <Box className="w-12 h-12 text-blue-200" />
                    </div>
                  </div>
                  <div className="bg-purple-500 rounded-2xl p-5 text-white shadow-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-4xl font-bold">{stats.relations}</div>
                        <div className="text-purple-100 text-sm mt-1 font-medium">关系定义</div>
                      </div>
                      <Network className="w-12 h-12 text-purple-200" />
                    </div>
                  </div>
                  <div className="bg-amber-500 rounded-2xl p-5 text-white shadow-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-4xl font-bold">{stats.totalProperties}</div>
                        <div className="text-amber-100 text-sm mt-1 font-medium">属性字段</div>
                      </div>
                      <FileText className="w-12 h-12 text-amber-200" />
                    </div>
                  </div>
                </div>

                {/* Schema 信息卡片 */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <FileJson className="w-5 h-5 text-blue-500" />
                    <h3 className="text-base font-semibold text-gray-900">Schema 信息</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-500">名称</span>
                      <span className="text-sm font-medium text-gray-900">{currentSchema.name}</span>
                    </div>
                    <div className="py-2">
                      <span className="text-sm text-gray-500 block mb-2">描述</span>
                      <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3">
                        {currentSchema.description || '暂无描述，点击右上角编辑按钮添加描述信息'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 快速入门 */}
                {stats.entities === 0 && stats.relations === 0 && (
                  <div className="bg-blue-50 rounded-2xl border border-blue-100 p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Zap className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 mb-2">快速开始</h4>
                        <p className="text-sm text-gray-600 mb-4">
                          开始构建你的知识图谱 Schema 吧！按照以下步骤操作：
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setActiveTab('entities')}
                            className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg text-sm font-medium text-blue-600 border border-blue-200 hover:bg-blue-50 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            添加实体类型
                          </button>
                          <button
                            onClick={() => openCreateEntityDrawer()}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            直接新建
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* 实体类型标签页 */}
            {activeTab === 'entities' && (
              <motion.div
                key="entities"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-6"
              >
                {/* 空状态 */}
                {currentSchema.entityTypes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <Tag className="w-10 h-10 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">暂无实体类型</h3>
                    <p className="text-sm text-gray-500 mb-6 text-center">
                      实体类型是知识图谱的基本组成单元，<br />用于定义不同类型节点的结构
                    </p>
                    <button
                      onClick={openCreateEntityDrawer}
                      className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors shadow-lg shadow-blue-200"
                    >
                      <Plus className="w-4 h-4" />
                      创建第一个实体类型
                    </button>
                  </div>
                ) : filteredEntities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <Search className="w-10 h-10 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">未找到匹配结果</h3>
                    <p className="text-sm text-gray-500">
                      没有找到包含"{searchQuery}"的实体类型
                    </p>
                  </div>
                ) : (
                  /* 实体网格列表 */
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filteredEntities.map(entity => (
                      <motion.div
                        key={entity.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                      >
                        {/* 实体头部 */}
                        <div
                          className="px-4 py-3 flex items-center justify-between"
                          style={{ backgroundColor: `${entity.color}10` }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: entity.color }}
                            />
                            <span
                              className="font-semibold text-sm"
                              style={{ color: entity.color }}
                            >
                              {entity.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditEntityDrawer(entity)}
                              className="p-1.5 hover:bg-white/60 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4" style={{ color: entity.color }} />
                            </button>
                            <button
                              onClick={() => handleDeleteEntity(entity.id)}
                              className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </div>

                        {/* 属性列表 */}
                        <div className="px-4 py-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-gray-500">属性字段</span>
                            <span className="text-xs text-gray-400">
                              {entity.properties?.length || 0} 个
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {(entity.properties || []).slice(0, 6).map((prop, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-1 bg-gray-100 rounded text-xs text-gray-600"
                              >
                                <span className="font-medium">{prop.name}</span>
                                <span className="text-gray-400 ml-1">
                                  ({PROPERTY_TYPES.find(t => t.value === prop.type)?.label || prop.type})
                                </span>
                              </span>
                            ))}
                            {(entity.properties?.length || 0) > 6 && (
                              <span className="inline-flex items-center px-2 py-1 bg-gray-100 rounded text-xs text-gray-500">
                                +{entity.properties.length - 6} 更多
                              </span>
                            )}
                            {(entity.properties?.length || 0) === 0 && (
                              <span className="text-xs text-gray-400 italic">暂无属性</span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* 关系定义标签页 */}
            {activeTab === 'relations' && (
              <motion.div
                key="relations"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-6"
              >
                {/* 空状态 */}
                {currentSchema.relations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <Link2 className="w-10 h-10 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">暂无关系定义</h3>
                    <p className="text-sm text-gray-500 mb-6 text-center">
                      关系用于连接不同的实体类型，<br />定义它们之间的关联方式
                    </p>
                    <button
                      onClick={openCreateRelationDrawer}
                      disabled={currentSchema.entityTypes.length === 0}
                      className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                      创建第一个关系
                    </button>
                    {currentSchema.entityTypes.length === 0 && (
                      <p className="text-xs text-amber-600 mt-3">
                        请先添加实体类型后再创建关系
                      </p>
                    )}
                  </div>
                ) : (
                  /* 关系列表 */
                  <div className="space-y-3">
                    {currentSchema.relations.map((rel, index) => (
                      <motion.div
                        key={rel.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            {/* 关系线条指示器 */}
                            <div
                              className="w-1 h-12 rounded-full flex-shrink-0"
                              style={{
                                backgroundColor: rel.color || '#9ca3af',
                                borderStyle: rel.style === 'dashed' ? 'dashed' : rel.style === 'dotted' ? 'dotted' : 'solid'
                              }}
                            />

                            {/* 关系信息 */}
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <span className="font-semibold text-gray-900">{rel.name}</span>
                                <div className="flex items-center gap-1">
                                  <span
                                    className="px-2 py-0.5 rounded text-xs font-medium"
                                    style={{
                                      backgroundColor: `${rel.color || '#9ca3af'}20`,
                                      color: rel.color || '#9ca3af'
                                    }}
                                  >
                                    {rel.from}
                                  </span>
                                  <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                                  <span
                                    className="px-2 py-0.5 rounded text-xs font-medium"
                                    style={{
                                      backgroundColor: `${rel.color || '#9ca3af'}20`,
                                      color: rel.color || '#9ca3af'
                                    }}
                                  >
                                    {rel.to}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                                  {RELATION_DIRECTIONS.find(d => d.value === rel.direction)?.label || '有向'}
                                </span>
                                <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                                  {RELATION_STYLES.find(s => s.value === rel.style)?.label || '实线'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* 操作按钮 */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditRelationDrawer(rel)}
                              className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4 text-blue-500" />
                            </button>
                            <button
                              onClick={() => handleDeleteRelation(rel.id)}
                              className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* 可视化标签页 */}
            {activeTab === 'visualizer' && (
              <motion.div
                key="visualizer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-6 h-full"
              >
                <div className="bg-white rounded-xl border border-gray-200 p-6 h-full min-h-[500px]">
                  {currentSchema.entityTypes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full">
                      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <Network className="w-10 h-10 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">暂无可视化数据</h3>
                      <p className="text-sm text-gray-500">添加实体类型和关系后查看结构图</p>
                    </div>
                  ) : (
                    <SchemaVisualization schema={currentSchema} />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ============ 编辑 Schema 弹窗 ============ */}
      <AnimatePresence>
        {editingSchema && (
          <EditSchemaModal
            schema={currentSchema}
            onSave={(data) => {
              updateSchema(currentSchema.id, data);
              setEditingSchema(false);
            }}
            onClose={() => setEditingSchema(false)}
          />
        )}
      </AnimatePresence>

      {/* ============ 新建 Schema 弹窗 ============ */}
      <AnimatePresence>
        {creatingSchema && (
          <CreateSchemaModal
            value={newSchemaName}
            onChange={setNewSchemaName}
            onCreate={handleCreateSchema}
            onClose={() => {
              setCreatingSchema(false);
              setNewSchemaName('');
            }}
          />
        )}
      </AnimatePresence>

      {/* ============ 实体编辑抽屉 ============ */}
      <AnimatePresence>
        {entityDrawerOpen && (
          <EntityDrawer
            isOpen={entityDrawerOpen}
            entity={editingEntity}
            form={entityForm}
            setForm={setEntityForm}
            onSave={handleSaveEntity}
            onDelete={() => handleDeleteEntity(editingEntity?.id)}
            onClose={() => setEntityDrawerOpen(false)}
            onAddProperty={openAddProperty}
            onEditProperty={openEditProperty}
            onDeleteProperty={handleDeleteProperty}
            editingProperty={editingProperty}
            propertyForm={propertyForm}
            setPropertyForm={setPropertyForm}
            onSaveProperty={handleSaveProperty}
            onCancelEditProperty={() => {
              setEditingProperty(null);
              setPropertyForm({ name: '', type: 'text', options: [] });
            }}
            presetColors={PRESET_COLORS}
          />
        )}
      </AnimatePresence>

      {/* ============ 关系编辑抽屉 ============ */}
      <AnimatePresence>
        {relationDrawerOpen && (
          <RelationDrawer
            isOpen={relationDrawerOpen}
            relation={editingRelation}
            form={relationForm}
            setForm={setRelationForm}
            entityTypes={currentSchema.entityTypes}
            onSave={handleSaveRelation}
            onDelete={() => handleDeleteRelation(editingRelation?.id)}
            onClose={() => setRelationDrawerOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ============ 全屏可视化弹窗 ============ */}
      <AnimatePresence>
        {showMaximizedVisualizer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-8"
            onClick={() => setShowMaximizedVisualizer(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 w-full max-w-6xl h-[80vh] shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  Schema 可视化 - {currentSchema.name}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowMaximizedVisualizer(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Minimize2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowMaximizedVisualizer(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-gray-50 rounded-xl overflow-auto">
                <SchemaVisualization schema={currentSchema} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============ 编辑 Schema 弹窗组件 ============
const EditSchemaModal = ({ schema, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: schema.name,
    description: schema.description || ''
  });

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
        className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">编辑 Schema</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">名称</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="描述此 Schema 的用途..."
            />
          </div>
          <button
            onClick={() => onSave(formData)}
            className="w-full py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            保存修改
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ============ 新建 Schema 弹窗组件 ============
const CreateSchemaModal = ({ value, onChange, onCreate, onClose }) => {
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
        className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">新建 Schema</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Schema 名称</label>
            <input
              type="text"
              value={value}
              onChange={onChange}
              placeholder="例如：法律案例 Schema"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <button
            onClick={onCreate}
            disabled={!value.trim()}
            className="w-full py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            创建 Schema
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ============ 实体编辑抽屉组件 ============
const EntityDrawer = ({
  isOpen,
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
  return (
    <>
      {/* 遮罩层 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      {/* 抽屉 */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
      >
        {/* 抽屉头部 */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {entity ? '编辑实体类型' : '新建实体类型'}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {entity ? `编辑 "${entity.name}"` : '定义新的实体类型结构'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 抽屉内容 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 基本信息 */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">实体名称</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="输入实体名称，如：用户、订单"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">颜色标识</label>
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

          {/* 属性列表 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">属性字段</label>
              <button
                onClick={onAddProperty}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                添加属性
              </button>
            </div>

            {/* 添加/编辑属性表单 */}
            {editingProperty !== null && (
              <div className="mb-3 p-3 bg-gray-50 rounded-lg space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={propertyForm.name}
                    onChange={(e) => setPropertyForm({ ...propertyForm, name: e.target.value })}
                    placeholder="属性名"
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
                    placeholder="选项，用逗号分隔"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
                <div className="flex gap-2">
                  <button
                    onClick={onSaveProperty}
                    className="flex-1 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    保存
                  </button>
                  <button
                    onClick={onCancelEditProperty}
                    className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors flex items-center justify-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    取消
                  </button>
                </div>
              </div>
            )}

            {/* 属性列表 */}
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
                      <span className="text-xs text-gray-400">
                        ({prop.options.join(', ')})
                      </span>
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
                <p className="text-sm text-gray-500 text-center py-4">
                  暂无属性，点击上方"添加属性"按钮添加
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 抽屉底部 */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          {entity && (
            <button
              onClick={onDelete}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              删除实体
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={onSave}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              保存
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
};

// ============ 关系编辑抽屉组件 ============
const RelationDrawer = ({
  isOpen,
  relation,
  form,
  setForm,
  entityTypes,
  onSave,
  onDelete,
  onClose
}) => {
  return (
    <>
      {/* 遮罩层 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      {/* 抽屉 */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
      >
        {/* 抽屉头部 */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {relation ? '编辑关系' : '新建关系'}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {relation ? `编辑 "${relation.name}"` : '定义实体间的关系'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 抽屉内容 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* 关系名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">关系名称</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="如：拥有、属于、关联"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 源实体和目标实体 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">源实体</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">目标实体</label>
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

          {/* 方向 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">关系方向</label>
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

          {/* 线型 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">线条样式</label>
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

          {/* 颜色 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">颜色</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-12 h-12 border border-gray-200 rounded-lg cursor-pointer"
              />
              <div className="flex-1 h-2 rounded" style={{ backgroundColor: form.color }} />
              <span className="text-sm text-gray-500 font-mono uppercase">
                {form.color}
              </span>
            </div>
          </div>
        </div>

        {/* 抽屉底部 */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          {relation && (
            <button
              onClick={onDelete}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              删除关系
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={onSave}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              保存
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
};

// ============ Schema 可视化组件 ============
const SchemaVisualization = ({ schema }) => {
  const { entityTypes, relations } = schema;

  // 圆形布局计算
  const centerX = 300;
  const centerY = 200;
  const radius = 120;

  const positions = entityTypes.map((entity, index) => {
    const angle = (2 * Math.PI * index) / entityTypes.length - Math.PI / 2;
    return {
      id: entity.id,
      name: entity.name,
      color: entity.color,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });

  if (entityTypes.length === 0) {
    return null;
  }

  return (
    <svg width="100%" viewBox="0 0 600 400" className="overflow-visible">
      <defs>
        {/* 箭头标记 */}
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" />
        </marker>
        {/* 彩色箭头标记 */}
        {entityTypes.map((entity, index) => (
          <marker
            key={`arrowhead-${entity.id}`}
            id={`arrowhead-${entity.id}`}
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill={entity.color} />
          </marker>
        ))}
      </defs>

      {/* 绘制关系连线 */}
      {relations.map((rel) => {
        const fromPos = positions.find(p => p.name === rel.from);
        const toPos = positions.find(p => p.name === rel.to);
        if (!fromPos || !toPos) return null;

        const strokeDasharray = rel.style === 'dashed' ? '5,5' : rel.style === 'dotted' ? '2,2' : 'none';
        const toEntity = entityTypes.find(e => e.name === rel.to);

        return (
          <g key={rel.id}>
            <line
              x1={fromPos.x}
              y1={fromPos.y}
              x2={toPos.x}
              y2={toPos.y}
              stroke={rel.color || '#9ca3af'}
              strokeWidth="2"
              strokeDasharray={strokeDasharray}
              markerEnd={rel.direction !== 'undirected' && toEntity ? `url(#arrowhead-${toEntity.id})` : null}
            />
            {/* 关系标签 */}
            <text
              x={(fromPos.x + toPos.x) / 2}
              y={(fromPos.y + toPos.y) / 2 - 8}
              textAnchor="middle"
              className="text-xs fill-gray-600"
              style={{ fontSize: '11px', fontWeight: '500' }}
            >
              {rel.name}
            </text>
          </g>
        );
      })}

      {/* 绘制实体节点 */}
      {positions.map(pos => (
        <g key={pos.id}>
          {/* 节点外发光 */}
          <circle
            cx={pos.x}
            cy={pos.y}
            r="44"
            fill={`${pos.color}15`}
          />
          {/* 节点背景 */}
          <circle
            cx={pos.x}
            cy={pos.y}
            r="40"
            fill="white"
            stroke={pos.color}
            strokeWidth="2.5"
          />
          {/* 节点名称 */}
          <text
            x={pos.x}
            y={pos.y - 5}
            textAnchor="middle"
            className="text-sm font-semibold"
            style={{ fontSize: '13px', fill: pos.color }}
          >
            {pos.name}
          </text>
          {/* 属性数量 */}
          {schema.entityTypes.find(e => e.id === pos.id)?.properties?.length > 0 && (
            <text
              x={pos.x}
              y={pos.y + 15}
              textAnchor="middle"
              className="text-xs fill-gray-400"
              style={{ fontSize: '10px' }}
            >
              {schema.entityTypes.find(e => e.id === pos.id).properties.length} 属性
            </text>
          )}
        </g>
      ))}
    </svg>
  );
};

export default SchemaArchitect;
