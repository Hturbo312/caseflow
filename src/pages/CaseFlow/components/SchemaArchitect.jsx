import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
  Handle,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
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
import { useSchemaStore } from '../../../store';
import {
  PROPERTY_TYPES,
  RELATION_STYLES,
  RELATION_DIRECTIONS,
  PRESET_COLORS,
} from '../../../utils';

const SchemaArchitect = ({ isAuthenticated, onShowLogin }) => {
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
    deleteProperty,
    addRelation,
    updateRelation,
    deleteRelation,
    getCurrentSchema
  } = useSchemaStore();

  // UI 状态
  const [activeTab, setActiveTab] = useState('overview'); // overview, entities, relations, visualizer
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true); // 默认折叠
  const [searchQuery, setSearchQuery] = useState('');
  const [showMaximizedVisualizer, setShowMaximizedVisualizer] = useState(false);

  // Schema 编辑状态
  const [editingSchema, setEditingSchema] = useState(false);
  const [creatingSchema, setCreatingSchema] = useState(false);
  const [newSchemaName, setNewSchemaName] = useState('');

  // 实体编辑抽屉状态
  const [entityDrawerOpen, setEntityDrawerOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState(null); // null 表示新建
  const [entityForm, setEntityForm] = useState({ name: '', color: '#3b82f6', properties: [], isCore: false, showAsTag: false });

  // 关系编辑抽屉状态
  const [relationDrawerOpen, setRelationDrawerOpen] = useState(false);
  const [editingRelation, setEditingRelation] = useState(null); // null 表示新建
  const [relationForm, setRelationForm] = useState({
    name: '', description: '', from: '', to: '', direction: 'directed', color: '#9ca3af', style: 'solid', properties: []
  });

  // 关系属性编辑状态（复用实体属性编辑的状态变量）
  const [editingRelationProperty, setEditingRelationProperty] = useState(null);
  const [relationPropertyForm, setRelationPropertyForm] = useState({ name: '', type: 'text', options: [] });

  // 属性编辑状态
  const [editingProperty, setEditingProperty] = useState(null);
  const [propertyForm, setPropertyForm] = useState({ name: '', type: 'text', options: [] });

  // 导入文件输入
  const fileInputRef = useRef(null);

  // 认证检查辅助函数 - 必须在所有条件返回之前定义
  const requireAuth = useCallback(() => {
    if (!isAuthenticated) {
      onShowLogin?.();
      return false;
    }
    return true;
  }, [isAuthenticated, onShowLogin]);

  const currentSchema = getCurrentSchema();

  // 如果没有 schema，显示加载或空状态
  if (!currentSchema) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  // ========== Schema 管理 ==========

  const handleCreateSchema = () => {
    if (!requireAuth()) return;
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
        } catch {
          alert('导入失败：文件格式不正确');
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  // ========== 实体类型管理 ==========

  const openCreateEntityDrawer = () => {
    if (!requireAuth()) return;
    setEditingEntity(null);
    setEntityForm({ name: '', color: PRESET_COLORS[0], properties: [], isCore: false, showAsTag: false });
    setEntityDrawerOpen(true);
  };

  const openEditEntityDrawer = (entity) => {
    setEditingEntity(entity);
    setEntityForm({
      name: entity.name,
      color: entity.color,
      properties: entity.properties || [],
      isCore: entity.isCore || false,
      showAsTag: entity.showAsTag || false
    });
    setEntityDrawerOpen(true);
  };

  const handleSaveEntity = () => {
    if (!entityForm.name.trim()) {
      alert('请输入实体名称');
      return;
    }
    // 新建实体类型需要认证
    if (!editingEntity && !requireAuth()) return;
    const entityData = {
      name: entityForm.name,
      color: entityForm.color,
      properties: entityForm.properties,
      isCore: entityForm.isCore,
      showAsTag: entityForm.showAsTag
    };
    if (editingEntity) {
      updateEntityType(currentSchema.id, editingEntity.id, entityData);
    } else {
      addEntityType(currentSchema.id, entityData);
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
    setEditingProperty('new'); // 用 'new' 表示正在添加新属性
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
      // 编辑已存在的实体类型 - 调用API保存
      if (editingProperty && editingProperty !== 'new') {
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
        // 添加新属性
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
    } else {
      // 创建新实体类型 - 只更新本地状态，不调用API
      if (editingProperty && editingProperty !== 'new') {
        // 更新已存在的属性
        const updatedProps = entityForm.properties.map(p =>
          p.name === editingProperty.name ? { ...propertyForm } : p
        );
        setEntityForm({ ...entityForm, properties: updatedProps });
      } else {
        // 添加新属性到本地状态
        setEntityForm({
          ...entityForm,
          properties: [...entityForm.properties, { ...propertyForm }]
        });
      }
    }
    setEditingProperty(null);
    setPropertyForm({ name: '', type: 'text', options: [] });
  };

  const handleDeleteProperty = (propertyName) => {
    const entityTypeId = editingEntity?.id;
    if (entityTypeId) {
      // 编辑已存在的实体类型 - 调用API删除
      deleteProperty(currentSchema.id, entityTypeId, propertyName);
    }
    // 无论编辑还是创建，都更新本地状态
    setEntityForm({
      ...entityForm,
      properties: entityForm.properties.filter(p => p.name !== propertyName)
    });
    setEditingProperty(null);
    setPropertyForm({ name: '', type: 'text', options: [] });
  };

  // ========== 关系管理 ==========

  const openCreateRelationDrawer = () => {
    if (!requireAuth()) return;
    setEditingRelation(null);
    setRelationForm({
      name: '',
      description: '',
      from: currentSchema.entityTypes[0]?.name || '',
      to: currentSchema.entityTypes[0]?.name || '',
      direction: 'directed',
      color: '#9ca3af',
      style: 'solid',
      properties: []
    });
    setEditingRelationProperty(null);
    setRelationDrawerOpen(true);
  };

  const openEditRelationDrawer = (relation) => {
    setEditingRelation(relation);
    setRelationForm({
      name: relation.name,
      description: relation.description || '',
      from: relation.from,
      to: relation.to,
      direction: relation.direction || 'directed',
      color: relation.color || '#9ca3af',
      style: relation.style || 'solid',
      properties: relation.properties || []
    });
    setEditingRelationProperty(null);
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
    // 新建关系需要认证
    if (!editingRelation && !requireAuth()) return;
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
    <div className="h-full bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col relative">
      {/* ============ 顶部导航栏 ============ */}
      <div className="border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center px-3 py-2">
          {/* Schema 列表按钮 */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`p-1.5 rounded-lg transition-colors mr-2 ${sidebarCollapsed ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            title={sidebarCollapsed ? '展开 Schema 列表' : '收起 Schema 列表'}
          >
            <Database className="w-3.5 h-3.5" />
          </button>

          {/* 标签页 */}
          {[
            { id: 'overview', label: '概览', icon: LayoutGrid },
            { id: 'entities', label: '实体', icon: Tag },
            { id: 'relations', label: '关系', icon: Link2 },
            { id: 'visualizer', label: '可视化', icon: Network },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all relative ${
                activeTab === tab.id
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
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
      </div>

      {/* ============ 子工具栏（实体/关系） ============ */}
      {(activeTab === 'entities' || activeTab === 'relations') && (
        <div className="border-b border-gray-100 bg-gray-50/50 flex-shrink-0 px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索..."
                  aria-label={`搜索${activeTab === 'entities' ? '实体类型' : '关系定义'}`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-7 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:border-blue-400 focus:outline-none transition-all w-40"
                />
              </div>
            </div>
            <button
              onClick={activeTab === 'entities' ? openCreateEntityDrawer : openCreateRelationDrawer}
              disabled={activeTab === 'relations' && currentSchema.entityTypes.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" />
              新建{activeTab === 'entities' ? '实体' : '关系'}
            </button>
          </div>
        </div>
      )}

      {/* ============ 主内容区域 ============ */}
      <div className="flex-1 flex overflow-y-auto relative">
        {/* ============ 左侧 Schema 列表侧边栏 ============ */}
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '100%', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-gray-50/80 flex flex-col overflow-hidden absolute inset-0 z-20"
            >
              {/* 侧边栏头部 */}
              <div className="p-3 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center">
                      <Database className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-sm font-semibold text-gray-900">Schema 列表</span>
                  </div>
                  <button
                    onClick={() => setSidebarCollapsed(true)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    title="关闭列表"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Schema 列表 */}
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {schemas.map(schema => (
                  <motion.div
                    key={schema.id}
                    className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                      currentSchemaId === schema.id
                        ? 'bg-white shadow-sm border border-gray-200'
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      setCurrentSchema(schema.id);
                      setSidebarCollapsed(true);
                    }}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        currentSchemaId === schema.id
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      <FileJson className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{schema.name}</div>
                      <div className="text-[10px] text-gray-500 truncate">
                        {schema.entityTypes.length} 实体 · {schema.relations.length} 关系
                      </div>
                    </div>
                    {/* 删除按钮 */}
                    {canDeleteSchema && (
                      <button
                        onClick={(e) => handleDeleteSchema(schema.id, e)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    )}
                  </motion.div>
                ))}

                {/* 新建 Schema 按钮 */}
                <button
                  onClick={() => {
                    if (!requireAuth()) return;
                    setCreatingSchema(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors mt-2"
                >
                  <Plus className="w-4 h-4" />
                  新建 Schema
                </button>
              </div>

              {/* 侧边栏底部操作 */}
              <div className="p-3 border-t border-gray-200 bg-white space-y-1">
                <button
                  onClick={handleOpenEditSchema}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  编辑当前 Schema
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportSchema}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs text-gray-600 hover:bg-gray-100 transition-colors"
                    title="导出 Schema"
                  >
                    <Download className="w-4 h-4" />
                    导出
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs text-gray-600 hover:bg-gray-100 transition-colors"
                    title="导入 Schema"
                  >
                    <Upload className="w-4 h-4" />
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============ 右侧内容区 ============ */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <AnimatePresence mode="wait">
            {/* 概览标签页 */}
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 space-y-3"
              >
                {/* 统计卡片 */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-blue-500 rounded-xl p-3 text-white shadow">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xl font-bold">{stats.entities}</div>
                        <div className="text-blue-100 text-[10px] mt-0.5">实体类型</div>
                      </div>
                      <Box className="w-6 h-6 text-blue-200" />
                    </div>
                  </div>
                  <div className="bg-purple-500 rounded-xl p-3 text-white shadow">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xl font-bold">{stats.relations}</div>
                        <div className="text-purple-100 text-[10px] mt-0.5">关系定义</div>
                      </div>
                      <Network className="w-6 h-6 text-purple-200" />
                    </div>
                  </div>
                  <div className="bg-amber-500 rounded-xl p-3 text-white shadow">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xl font-bold">{stats.totalProperties}</div>
                        <div className="text-amber-100 text-[10px] mt-0.5">属性字段</div>
                      </div>
                      <FileText className="w-6 h-6 text-amber-200" />
                    </div>
                  </div>
                </div>

                {/* Schema 信息卡片 */}
                <div className="bg-white rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <FileJson className="w-4 h-4 text-blue-500" />
                    <h3 className="text-xs font-semibold text-gray-900">Schema 信息</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                      <span className="text-[10px] text-gray-500">名称</span>
                      <span className="text-xs font-medium text-gray-900">{currentSchema.name}</span>
                    </div>
                    <div className="py-1">
                      <span className="text-[10px] text-gray-500 block mb-1">描述</span>
                      <p className="text-[10px] text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-2">
                        {currentSchema.description || '暂无描述，点击编辑按钮添加'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 快速入门 */}
                {stats.entities === 0 && stats.relations === 0 && (
                  <div className="bg-blue-50 rounded-xl border border-blue-100 p-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Zap className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-gray-900 mb-1">快速开始</h4>
                        <p className="text-[10px] text-gray-600 mb-2">
                          开始构建你的知识图谱 Schema
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => setActiveTab('entities')}
                            className="flex items-center gap-1 px-2.5 py-1 bg-white rounded-md text-[10px] font-medium text-blue-600 border border-blue-200 hover:bg-blue-50 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            添加实体类型
                          </button>
                          <button
                            onClick={() => openCreateEntityDrawer()}
                            className="flex items-center gap-1 px-2.5 py-1 bg-blue-500 text-white rounded-md text-[10px] font-medium hover:bg-blue-600 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
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
                className="p-3"
              >
                {/* 空状态 */}
                {currentSchema.entityTypes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                      <Tag className="w-7 h-7 text-gray-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">暂无实体类型</h3>
                    <p className="text-[10px] text-gray-500 mb-4 text-center">
                      实体类型定义知识图谱的节点结构
                    </p>
                    <button
                      onClick={openCreateEntityDrawer}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      创建实体类型
                    </button>
                  </div>
                ) : filteredEntities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                      <Search className="w-7 h-7 text-gray-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">未找到匹配结果</h3>
                    <p className="text-[10px] text-gray-500">
                      没有找到包含"{searchQuery}"的实体类型
                    </p>
                  </div>
                ) : (
                  /* 实体网格列表 */
                  <div className="grid grid-cols-1 gap-2">
                    {filteredEntities.map(entity => (
                      <motion.div
                        key={entity.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white rounded-lg border border-gray-200 overflow-hidden"
                      >
                        {/* 实体头部 */}
                        <div
                          className="px-3 py-2 flex items-center justify-between"
                          style={{ backgroundColor: `${entity.color}10` }}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: entity.color }}
                            />
                            <span
                              className="font-medium text-xs"
                              style={{ color: entity.color }}
                            >
                              {entity.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => openEditEntityDrawer(entity)}
                              className="p-1 hover:bg-white/60 rounded transition-colors"
                            >
                              <Edit2 className="w-3 h-3" style={{ color: entity.color }} />
                            </button>
                            <button
                              onClick={() => handleDeleteEntity(entity.id)}
                              className="p-1 hover:bg-red-100 rounded transition-colors"
                            >
                              <Trash2 className="w-3 h-3 text-red-500" />
                            </button>
                          </div>
                        </div>

                        {/* 属性列表 */}
                        <div className="px-3 py-2">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-medium text-gray-500">属性字段</span>
                            <span className="text-[10px] text-gray-400">
                              {entity.properties?.length || 0} 个
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {(entity.properties || []).slice(0, 5).map((prop, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-600"
                              >
                                <span className="font-medium">{prop.name}</span>
                                <span className="text-gray-400 ml-0.5">
                                  ({PROPERTY_TYPES.find(t => t.value === prop.type)?.label || prop.type})
                                </span>
                              </span>
                            ))}
                            {(entity.properties?.length || 0) > 5 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-500">
                                +{entity.properties.length - 5}
                              </span>
                            )}
                            {(entity.properties?.length || 0) === 0 && (
                              <span className="text-[10px] text-gray-400 italic">暂无属性</span>
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
                className="p-3"
              >
                {/* 空状态 */}
                {currentSchema.relations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                      <Link2 className="w-7 h-7 text-gray-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">暂无关系定义</h3>
                    <p className="text-[10px] text-gray-500 mb-4 text-center">
                      关系用于连接不同实体类型
                    </p>
                    <button
                      onClick={openCreateRelationDrawer}
                      disabled={currentSchema.entityTypes.length === 0}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      创建关系
                    </button>
                    {currentSchema.entityTypes.length === 0 && (
                      <p className="text-[10px] text-amber-600 mt-2">
                        请先添加实体类型
                      </p>
                    )}
                  </div>
                ) : (
                  /* 关系列表 */
                  <div className="space-y-2">
                    {currentSchema.relations.map((rel, index) => (
                      <motion.div
                        key={rel.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-white rounded-lg border border-gray-200 p-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {/* 关系线条指示器 */}
                            <div
                              className="w-0.5 h-8 rounded-full flex-shrink-0"
                              style={{
                                backgroundColor: rel.color || '#9ca3af',
                              }}
                            />

                            {/* 关系信息 */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium text-xs text-gray-900">{rel.name}</span>
                                <span
                                  className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                  style={{
                                    backgroundColor: `${rel.color || '#9ca3af'}20`,
                                    color: rel.color || '#9ca3af'
                                  }}
                                >
                                  {rel.from}
                                </span>
                                <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                <span
                                  className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                  style={{
                                    backgroundColor: `${rel.color || '#9ca3af'}20`,
                                    color: rel.color || '#9ca3af'
                                  }}
                                >
                                  {rel.to}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 mt-1">
                                <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-600">
                                  {RELATION_DIRECTIONS.find(d => d.value === rel.direction)?.label || '有向'}
                                </span>
                                <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-600">
                                  {RELATION_STYLES.find(s => s.value === rel.style)?.label || '实线'}
                                </span>
                                {(rel.properties?.length || 0) > 0 && (
                                  <span className="px-1.5 py-0.5 bg-blue-50 rounded text-[10px] text-blue-600">
                                    {rel.properties?.length || 0} 个属性
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 操作按钮 */}
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button
                              onClick={() => openEditRelationDrawer(rel)}
                              className="p-1 hover:bg-blue-50 rounded transition-colors"
                            >
                              <Edit2 className="w-3 h-3 text-blue-500" />
                            </button>
                            <button
                              onClick={() => handleDeleteRelation(rel.id)}
                              className="p-1 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-3 h-3 text-red-500" />
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
                className="p-3 h-full"
              >
                <div className="bg-white rounded-lg border border-gray-200 h-full min-h-[300px] relative">
                  {/* 画布工具栏 */}
                  <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                    <button
                      onClick={() => setShowMaximizedVisualizer(true)}
                      className="p-1.5 bg-white/90 hover:bg-white border border-gray-200 rounded-lg shadow-sm transition-colors"
                      title="全屏查看"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-gray-600" />
                    </button>
                  </div>
                  <div className="h-full p-3 pt-10">
                    {currentSchema.entityTypes.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-2">
                          <Network className="w-6 h-6 text-gray-400" />
                        </div>
                        <h3 className="text-xs font-semibold text-gray-900 mb-1">暂无可视化数据</h3>
                        <p className="text-[10px] text-gray-500">添加实体类型和关系后查看结构图</p>
                      </div>
                    ) : (
                      <SchemaVisualization schema={currentSchema} />
                    )}
                  </div>
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
            onClose={() => {
              setRelationDrawerOpen(false);
              setEditingRelationProperty(null);
              setRelationPropertyForm({ name: '', type: 'text', options: [] });
            }}
            editingProperty={editingRelationProperty}
            setEditingProperty={setEditingRelationProperty}
            propertyForm={relationPropertyForm}
            setPropertyForm={setRelationPropertyForm}
            presetColors={PRESET_COLORS}
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

  // 预设函数列表
  const presetFunctions = [
    { id: 'entityCount', name: '实体数量', desc: '统计案例中的实体总数' },
    { id: 'relationCount', name: '关系数量', desc: '统计案例中的关系总数' },
    { id: 'avgDegree', name: '平均度', desc: '计算节点平均连接数' },
    { id: 'density', name: '网络密度', desc: '关系数/最大可能关系数' },
    { id: 'completeness', name: '完整度', desc: '图谱填充程度' },
    { id: 'entityTypes', name: '实体类型数', desc: '涉及的实体类型数量' },
    { id: 'coreEntities', name: '核心实体名', desc: '展示核心实体名称' },
    { id: 'year', name: '年份', desc: '案例发生年份' },
    { id: 'location', name: '地点', desc: '案例发生地点' },
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
          <h3 className="text-lg font-semibold">编辑 Schema</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 标签页 */}
        <div className="flex border-b border-gray-200 px-5">
          <button
            onClick={() => setActiveTab('basic')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'basic' ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            基本信息
          </button>
          <button
            onClick={() => setActiveTab('card')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
              activeTab === 'card' ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            案例名片
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'basic' && (
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
            </div>
          )}

          {activeTab === 'card' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">
                配置案例卡片展示的内容，让每个案例都能清晰呈现关键信息
              </p>

              {/* 基础展示项配置 */}
              <div>
                <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  基础展示项
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'showSummary', name: '逻辑摘要', desc: '显示案例描述或核心要素' },
                    { key: 'showMetrics', name: '拓扑指标', desc: '实体数、关系数、完整度' },
                    { key: 'showEntities', name: '核心实体', desc: '展示各类型代表实体' },
                    { key: 'showTags', name: '语义标签', desc: '显示案例标签和类型' },
                  ].map(item => (
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

              {/* 预设函数 */}
              <div>
                <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Box className="w-3 h-3" />
                  预设展示函数
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

              {/* 自定义展示行 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium text-gray-700 flex items-center gap-1">
                    <Settings className="w-3 h-3" />
                    已添加的展示项
                  </h4>
                  <button
                    onClick={() => {
                      const newField = {
                        id: `custom-${Date.now()}`,
                        type: 'custom',
                        name: '自定义字段',
                        label: '标签',
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
                    添加自定义
                  </button>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {(formData.cardConfig.customFields || []).map(field => (
                    <div key={field.id} className={`p-2 bg-gray-50 rounded-lg ${editingFieldId === field.id ? 'ring-2 ring-blue-300' : ''}`}>
                      {editingFieldId === field.id ? (
                        // 编辑模式
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingFieldData.name || ''}
                              onChange={(e) => setEditingFieldData({ ...editingFieldData, name: e.target.value })}
                              placeholder="字段名称"
                              className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400"
                            />
                            {field.type === 'custom' && (
                              <select
                                value={editingFieldData.source || 'entity'}
                                onChange={(e) => setEditingFieldData({ ...editingFieldData, source: e.target.value })}
                                className="px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400"
                              >
                                <option value="entity">实体属性</option>
                                <option value="case">案例属性</option>
                              </select>
                            )}
                          </div>
                          {field.type === 'custom' && (
                            <input
                              type="text"
                              value={editingFieldData.property || ''}
                              onChange={(e) => setEditingFieldData({ ...editingFieldData, property: e.target.value })}
                              placeholder="属性名（如: name, year, location）"
                              className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400"
                            />
                          )}
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={saveEditField}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors"
                            >
                              <Save className="w-3 h-3" />
                              保存
                            </button>
                            <button
                              onClick={cancelEditField}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                            >
                              <X className="w-3 h-3" />
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        // 显示模式
                        <div className="flex items-center gap-2">
                          <GripVertical className="w-3 h-3 text-gray-400 cursor-move" />
                          <span className="text-xs font-medium text-gray-700 flex-1 truncate">{field.name}</span>
                          {field.type === 'custom' && field.property && (
                            <span className="text-[10px] text-blue-500">{field.source}.{field.property}</span>
                          )}
                          <span className="text-[10px] text-gray-500 bg-white px-1.5 py-0.5 rounded border">
                            {field.type === 'preset' ? '预设' : '自定义'}
                          </span>
                          <button
                            onClick={() => startEditField(field)}
                            className="p-1 hover:bg-blue-50 rounded transition-colors"
                            title="编辑"
                          >
                            <Edit2 className="w-3 h-3 text-blue-500" />
                          </button>
                          <button
                            onClick={() => removeField(field.id)}
                            className="p-1 hover:bg-red-50 rounded transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {(formData.cardConfig.customFields || []).length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-3">
                      点击上方预设函数按钮添加展示项
                    </p>
                  )}
                </div>
              </div>

              {/* 预览 */}
              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="text-[11px] font-medium text-gray-500 mb-2 flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  名片预览
                </h4>
                <div className="bg-white rounded-lg border border-gray-200 p-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-gray-900">示例案例名称</span>
                    <span className="text-[10px] text-gray-500">{formData.name || 'Schema名'}</span>
                  </div>
                  {formData.cardConfig.showSummary && (
                    <div className="text-[10px] text-gray-600 bg-gray-50 rounded px-2 py-1 mb-1.5">
                      涉及核心实体A、核心实体B等关键要素...
                    </div>
                  )}
                  {formData.cardConfig.showEntities && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">实体A</span>
                      <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">实体B</span>
                    </div>
                  )}
                  {formData.cardConfig.showMetrics && (
                    <div className="flex gap-2 text-[9px] text-gray-500 border-t border-gray-100 pt-1.5">
                      <span>3 实体</span>
                      <span>2 关系</span>
                      <span>完整度 60%</span>
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
              onChange={(e) => onChange(e.target.value)}
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

            {/* 添加/编辑属性表单 - 紧跟在添加按钮下方 */}
            {editingProperty !== null && (
              <div className="mb-3 p-3 bg-green-50 rounded-lg border border-green-200 space-y-2">
                <div className="text-xs font-medium text-green-700 mb-2">
                  {editingProperty === 'new' ? '添加新属性' : '编辑属性'}
                </div>
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
                    确认添加
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
              {(form.properties?.length || 0) === 0 && editingProperty === null && (
                <p className="text-sm text-gray-500 text-center py-4">
                  暂无属性，点击上方"添加属性"按钮添加
                </p>
              )}
            </div>

            {/* 案例卡片展示配置 */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <div className="text-xs font-medium text-blue-700 mb-2 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                案例卡片展示配置
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isCore || false}
                    onChange={(e) => setForm({ ...form, isCore: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700">标记为核心实体（在卡片中优先展示）</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.showAsTag || false}
                    onChange={(e) => setForm({ ...form, showAsTag: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700">显示为语义标签</span>
                </label>
              </div>
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
  // 属性编辑操作
  const onAddProperty = () => {
    setEditingProperty('new');
    setPropertyForm({ name: '', type: 'text', options: [] });
  };

  const onEditProperty = (prop) => {
    setEditingProperty(prop);
    setPropertyForm({
      name: prop.name,
      type: prop.type,
      options: prop.options || []
    });
  };

  const onSaveProperty = () => {
    if (!propertyForm.name.trim()) return;

    const newProperty = {
      name: propertyForm.name,
      type: propertyForm.type,
      options: propertyForm.type === 'enum' ? propertyForm.options : undefined
    };

    if (editingProperty && editingProperty !== 'new') {
      // 更新现有属性
      const updatedProperties = form.properties.map(p =>
        p.name === editingProperty.name ? newProperty : p
      );
      setForm({ ...form, properties: updatedProperties });
    } else {
      // 添加新属性
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
    setForm({
      ...form,
      properties: (form.properties || []).filter(p => p.name !== propertyName)
    });
  };

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

          {/* 关系含义 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">关系含义</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="描述此关系的含义和用途..."
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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

          {/* 属性字段 */}
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
                    value={propertyForm.options?.join(',') || ''}
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
                    disabled={!propertyForm.name.trim()}
                    className="flex-1 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
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

// ============ Schema 可视化组件 (ReactFlow) ============

// 自定义实体节点
const EntityNode = ({ data }) => {
  return (
    <div
      style={{
        padding: '12px 20px',
        borderRadius: '12px',
        background: 'white',
        border: `2.5px solid ${data.color}`,
        boxShadow: `0 4px 12px ${data.color}25`,
        minWidth: '120px',
        textAlign: 'center',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: data.color, width: 8, height: 8 }}
      />
      <div style={{ fontWeight: 600, color: data.color, fontSize: 14 }}>
        {data.label}
      </div>
      {data.propertyCount > 0 && (
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
          {data.propertyCount} 属性
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: data.color, width: 8, height: 8 }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ background: data.color, width: 8, height: 8 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ background: data.color, width: 8, height: 8 }}
      />
    </div>
  );
};

const nodeTypes = { entity: EntityNode };

const SchemaVisualization = ({ schema }) => {
  const { entityTypes, relations } = schema;

  // 转换节点数据
  const initialNodes = useMemo(() => {
    if (entityTypes.length === 0) return [];

    // 圆形布局
    const centerX = 300;
    const centerY = 200;
    const radius = 150;

    return entityTypes.map((entity, index) => {
      const angle = (2 * Math.PI * index) / entityTypes.length - Math.PI / 2;
      return {
        id: entity.id?.toString() || `entity-${index}`,
        type: 'entity',
        position: {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle)
        },
        data: {
          label: entity.name,
          color: entity.color || '#3b82f6',
          propertyCount: entity.properties?.length || 0
        }
      };
    });
  }, [entityTypes]);

  // 转换边数据
  const initialEdges = useMemo(() => {
    if (relations.length === 0) return [];

    return relations.map((rel) => {
      const fromEntity = entityTypes.find(e => e.name === rel.from);
      const toEntity = entityTypes.find(e => e.name === rel.to);
      if (!fromEntity || !toEntity) return null;

      return {
        id: rel.id?.toString() || `rel-${rel.name}-${rel.from}-${rel.to}`,
        source: fromEntity.id?.toString(),
        target: toEntity.id?.toString(),
        label: rel.name,
        labelStyle: { fill: '#6b7280', fontWeight: 500, fontSize: 11 },
        labelBgStyle: { fill: 'white', fillOpacity: 0.9 },
        labelBgPadding: [4, 4],
        labelBgBorderRadius: 4,
        style: {
          stroke: rel.color || '#9ca3af',
          strokeWidth: 2,
          strokeDasharray: rel.style === 'dashed' ? '5,5' : rel.style === 'dotted' ? '2,2' : undefined,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: rel.color || '#9ca3af',
        },
        animated: false
      };
    }).filter(Boolean);
  }, [relations, entityTypes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // 更新节点和边
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  if (entityTypes.length === 0) {
    return null;
  }

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '300px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.5}
        maxZoom={2}
        attributionPosition="bottom-left"
      >
        <Background color="#e5e7eb" gap={16} />
        <Controls position="bottom-right" />
        <MiniMap
          nodeColor={(node) => node.data?.color || '#3b82f6'}
          maskColor="rgba(0,0,0,0.05)"
          style={{ background: '#f9fafb' }}
        />
      </ReactFlow>
    </div>
  );
};

export default SchemaArchitect;
