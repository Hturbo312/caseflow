import React, { useState, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Search,
  Settings,
  Zap,
  Box,
  Network,
  FileText,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { useSchemaStore } from '../../../../store';
import { useToastStore } from '@components/Toast/ToastStore';
import { useI18n } from '../../../../i18n';
import { PROPERTY_TYPES, RELATION_STYLES, RELATION_DIRECTIONS, PRESET_COLORS } from '../../../../utils';

// 子组件
import EditSchemaModal from './EditSchemaModal';
import CreateSchemaModal from './CreateSchemaModal';
import EntityDrawer from './EntityDrawer';
import RelationDrawer from './RelationDrawer';
import SchemaVisualization from './SchemaVisualization';

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

  const { t } = useI18n();

  // UI 状态
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMaximizedVisualizer, setShowMaximizedVisualizer] = useState(false);

  // Schema 编辑状态
  const [editingSchema, setEditingSchema] = useState(false);
  const [creatingSchema, setCreatingSchema] = useState(false);
  const [newSchemaName, setNewSchemaName] = useState('');

  // 实体编辑抽屉状态
  const [entityDrawerOpen, setEntityDrawerOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState(null);
  const [entityForm, setEntityForm] = useState({ name: '', color: '#3b82f6', properties: [], isCore: false, showAsTag: false });

  // 关系编辑抽屉状态
  const [relationDrawerOpen, setRelationDrawerOpen] = useState(false);
  const [editingRelation, setEditingRelation] = useState(null);
  const [relationForm, setRelationForm] = useState({
    name: '', description: '', from: '', to: '', direction: 'directed', color: '#9ca3af', style: 'solid', properties: []
  });

  // 关系属性编辑状态
  const [editingRelationProperty, setEditingRelationProperty] = useState(null);
  const [relationPropertyForm, setRelationPropertyForm] = useState({ name: '', type: 'text', options: [] });

  // 属性编辑状态
  const [editingProperty, setEditingProperty] = useState(null);
  const [propertyForm, setPropertyForm] = useState({ name: '', type: 'text', options: [] });

  const fileInputRef = useRef(null);

  const requireAuth = useCallback(() => {
    if (!isAuthenticated) {
      onShowLogin?.();
      return false;
    }
    return true;
  }, [isAuthenticated, onShowLogin]);

  const currentSchema = getCurrentSchema();

  if (!currentSchema) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">{t('app.loading')}</p>
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
    if (schemas.length > 1 && confirm(t('schema.confirmDeleteSchema'))) {
      deleteSchema(schemaId);
    } else if (schemas.length <= 1) {
      alert(t('schema.mustKeepOneSchema'));
    }
  };

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
          alert(t('schema.importFailed'));
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
      alert(t('schema.enterEntityName'));
      return;
    }
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
    if (confirm(t('schema.confirmDeleteEntityType'))) {
      deleteEntityType(currentSchema.id, entityId);
      setEntityDrawerOpen(false);
    }
  };

  // 属性管理
  const openAddProperty = () => {
    setEditingProperty('new');
    setPropertyForm({ name: '', type: 'text', options: [] });
  };

  const openEditProperty = (prop) => {
    setEditingProperty(prop);
    setPropertyForm({ name: prop.name, type: prop.type, options: prop.options || [] });
  };

  const handleSaveProperty = () => {
    if (!propertyForm.name.trim()) {
      alert(t('schema.enterPropertyName'));
      return;
    }
    const entityTypeId = editingEntity?.id;
    if (entityTypeId) {
      if (editingProperty && editingProperty !== 'new') {
        deleteProperty(currentSchema.id, entityTypeId, editingProperty.name);
        addProperty(currentSchema.id, entityTypeId, {
          name: propertyForm.name,
          type: propertyForm.type,
          options: propertyForm.type === 'enum' ? propertyForm.options : undefined
        });
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
    } else {
      if (editingProperty && editingProperty !== 'new') {
        const updatedProps = entityForm.properties.map(p =>
          p.name === editingProperty.name ? { ...propertyForm } : p
        );
        setEntityForm({ ...entityForm, properties: updatedProps });
      } else {
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
      deleteProperty(currentSchema.id, entityTypeId, propertyName);
    }
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
      name: '', description: '',
      from: currentSchema.entityTypes[0]?.name || '',
      to: currentSchema.entityTypes[0]?.name || '',
      direction: 'directed', color: '#9ca3af', style: 'solid', properties: []
    });
    setEditingRelationProperty(null);
    setRelationDrawerOpen(true);
  };

  const openEditRelationDrawer = (relation) => {
    setEditingRelation(relation);
    setRelationForm({
      name: relation.name,
      description: relation.description || '',
      from: relation.from, to: relation.to,
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
      alert(t('schema.enterRelationName'));
      return;
    }
    if (!relationForm.from || !relationForm.to) {
      alert(t('schema.selectSourceTarget'));
      return;
    }
    if (!editingRelation && !requireAuth()) return;
    if (editingRelation) {
      updateRelation(currentSchema.id, editingRelation.id, relationForm);
    } else {
      addRelation(currentSchema.id, relationForm);
    }
    setRelationDrawerOpen(false);
  };

  const handleDeleteRelation = (relationId) => {
    if (confirm(t('schema.confirmDeleteRelation'))) {
      deleteRelation(currentSchema.id, relationId);
      setRelationDrawerOpen(false);
    }
  };

  // 筛选实体
  const filteredEntities = currentSchema.entityTypes.filter(e =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const canDeleteSchema = schemas.length > 1;

  // 统计信息
  const stats = {
    entities: currentSchema.entityTypes.length,
    relations: currentSchema.relations.length,
    totalProperties: currentSchema.entityTypes.reduce((sum, e) => sum + (e.properties?.length || 0), 0)
  };

  const tabs = [
    { id: 'overview', label: t('schema.overview'), icon: LayoutGrid },
    { id: 'entities', label: t('schema.entities'), icon: Tag },
    { id: 'relations', label: t('schema.relations'), icon: Link2 },
    { id: 'visualizer', label: t('schema.visualization'), icon: Network },
  ];

  return (
    <div className="h-full bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col relative">
      {/* 顶部导航栏 */}
      <div className="border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${sidebarCollapsed ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            title={sidebarCollapsed ? t('schema.expandList') : t('schema.collapseList')}
          >
            <Database className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium transition-all relative whitespace-nowrap ${
                  activeTab === tab.id ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 子工具栏 */}
      {(activeTab === 'entities' || activeTab === 'relations') && (
        <div className="border-b border-gray-100 bg-gray-50/50 flex-shrink-0 px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('toolbar.searchPlaceholder')}
                  aria-label={`${t('schema.searchAriaLabel')}${activeTab === 'entities' ? t('schema.entities') : t('schema.relations')}`}
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
              {t(activeTab === 'entities' ? 'schema.createNew' : 'schema.confirmAdd')}
            </button>
          </div>
        </div>
      )}

      {/* 主内容区域 */}
      <div className="flex-1 flex overflow-y-auto overflow-x-hidden relative min-w-0">
        {/* Schema 列表侧边栏 */}
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '100%', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-gray-50/80 flex flex-col overflow-hidden absolute inset-0 z-20"
            >
              <div className="p-3 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center">
                      <Database className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{t('schema.listTitle')}</span>
                  </div>
                  <button onClick={() => setSidebarCollapsed(true)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title={t('schema.closeList')}>
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {schemas.map(schema => (
                  <motion.div
                    key={schema.id}
                    className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                      currentSchemaId === schema.id ? 'bg-white shadow-sm border border-gray-200' : 'hover:bg-gray-100'
                    }`}
                    onClick={() => { setCurrentSchema(schema.id); setSidebarCollapsed(true); }}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      currentSchemaId === schema.id ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
                    }`}>
                      <FileJson className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{schema.name}</div>
                      <div className="text-[10px] text-gray-500 truncate">
                        {schema.entityTypes.length} {t('schema.entityType')} · {schema.relations.length} {t('schema.relations')}
                      </div>
                    </div>
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

                <button
                  onClick={() => { if (!requireAuth()) return; setCreatingSchema(true); }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors mt-2"
                >
                  <Plus className="w-4 h-4" />
                  {t('schema.newSchemaTitle')}
                </button>
              </div>

              <div className="p-3 border-t border-gray-200 bg-white space-y-1">
                <button
                  onClick={() => setEditingSchema(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  {t('schema.editCurrentSchema')}
                </button>
                <div className="flex gap-2">
                  <button onClick={handleExportSchema} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs text-gray-600 hover:bg-gray-100 transition-colors" title={t('schema.exportSchema')}>
                    <Download className="w-4 h-4" />
                    {t('schema.export')}
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs text-gray-600 hover:bg-gray-100 transition-colors" title={t('schema.importSchema')}>
                    <Upload className="w-4 h-4" />
                    {t('schema.import')}
                  </button>
                </div>
                <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportSchema} className="hidden" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 右侧内容区 */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <AnimatePresence mode="wait">
            {/* 概览标签页 */}
            {activeTab === 'overview' && (
              <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-3 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-blue-500 rounded-xl p-3 text-white shadow">
                    <div className="flex items-center justify-between">
                      <div><div className="text-xl font-bold">{stats.entities}</div><div className="text-blue-100 text-[10px] mt-0.5">{t('schema.entityType')}</div></div>
                      <Box className="w-6 h-6 text-blue-200" />
                    </div>
                  </div>
                  <div className="bg-purple-500 rounded-xl p-3 text-white shadow">
                    <div className="flex items-center justify-between">
                      <div><div className="text-xl font-bold">{stats.relations}</div><div className="text-purple-100 text-[10px] mt-0.5">{t('schema.relationDef')}</div></div>
                      <Network className="w-6 h-6 text-purple-200" />
                    </div>
                  </div>
                  <div className="bg-amber-500 rounded-xl p-3 text-white shadow">
                    <div className="flex items-center justify-between">
                      <div><div className="text-xl font-bold">{stats.totalProperties}</div><div className="text-amber-100 text-[10px] mt-0.5">{t('schema.propertyFields')}</div></div>
                      <FileText className="w-6 h-6 text-amber-200" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center gap-2 mb-2"><FileJson className="w-4 h-4 text-blue-500" /><h3 className="text-xs font-semibold text-gray-900">{t('schema.name')}</h3></div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                      <span className="text-[10px] text-gray-500">{t('schema.name')}</span>
                      <span className="text-xs font-medium text-gray-900">{currentSchema.name}</span>
                    </div>
                    <div className="py-1">
                      <span className="text-[10px] text-gray-500 block mb-1">{t('schema.desc')}</span>
                      <p className="text-[10px] text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-2">{currentSchema.description || t('schema.noDescription')}</p>
                    </div>
                  </div>
                </div>

                {stats.entities === 0 && stats.relations === 0 && (
                  <div className="bg-blue-50 rounded-xl border border-blue-100 p-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0"><Zap className="w-4 h-4 text-white" /></div>
                      <div>
                        <h4 className="text-xs font-semibold text-gray-900 mb-1">{t('schema.quickStart')}</h4>
                        <p className="text-[10px] text-gray-600 mb-2">{t('schema.quickStartDesc')}</p>
                        <div className="flex flex-wrap gap-1.5">
                          <button onClick={() => setActiveTab('entities')} className="flex items-center gap-1 px-2.5 py-1 bg-white rounded-md text-[10px] font-medium text-blue-600 border border-blue-200 hover:bg-blue-50 transition-colors">
                            <Plus className="w-3 h-3" />{t('schema.addEntityType')}
                          </button>
                          <button onClick={openCreateEntityDrawer} className="flex items-center gap-1 px-2.5 py-1 bg-blue-500 text-white rounded-md text-[10px] font-medium hover:bg-blue-600 transition-colors">
                            <Plus className="w-3 h-3" />{t('schema.createNew')}
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
              <motion.div key="entities" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-3">
                {currentSchema.entityTypes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3"><Tag className="w-7 h-7 text-gray-400" /></div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('schema.noEntities')}</h3>
                    <p className="text-[10px] text-gray-500 mb-4 text-center">{t('schema.entityTypeDefine')}</p>
                    <button onClick={openCreateEntityDrawer} className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 transition-colors">
                      <Plus className="w-3.5 h-3.5" />{t('schema.createEntityType')}
                    </button>
                  </div>
                ) : filteredEntities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3"><Search className="w-7 h-7 text-gray-400" /></div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('schema.noResults')}</h3>
                    <p className="text-[10px] text-gray-500">{t('schema.searchNoResults').replace('{query}', searchQuery)}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {filteredEntities.map(entity => (
                      <motion.div key={entity.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="px-3 py-2 flex items-center justify-between" style={{ backgroundColor: `${entity.color}10` }}>
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entity.color }} />
                            <span className="font-medium text-xs" style={{ color: entity.color }}>{entity.name}</span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <button onClick={() => openEditEntityDrawer(entity)} className="p-1 hover:bg-white/60 rounded transition-colors"><Edit2 className="w-3 h-3" style={{ color: entity.color }} /></button>
                            <button onClick={() => handleDeleteEntity(entity.id)} className="p-1 hover:bg-red-100 rounded transition-colors"><Trash2 className="w-3 h-3 text-red-500" /></button>
                          </div>
                        </div>
                        <div className="px-3 py-2">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-medium text-gray-500">{t('schema.propertyFieldsLabel')}</span>
                            <span className="text-[10px] text-gray-400">{t('schema.propertyCount').replace('{count}', entity.properties?.length || 0)}</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {(entity.properties || []).slice(0, 5).map((prop, idx) => (
                              <span key={idx} className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-600">
                                <span className="font-medium">{prop.name}</span>
                                <span className="text-gray-400 ml-0.5">({PROPERTY_TYPES.find(t => t.value === prop.type)?.label || prop.type})</span>
                              </span>
                            ))}
                            {(entity.properties?.length || 0) > 5 && <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-500">+{entity.properties.length - 5}</span>}
                            {(entity.properties?.length || 0) === 0 && <span className="text-[10px] text-gray-400 italic">{t('schema.noProperties')}</span>}
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
              <motion.div key="relations" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-3">
                {currentSchema.relations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3"><Link2 className="w-7 h-7 text-gray-400" /></div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('schema.noRelations')}</h3>
                    <p className="text-[10px] text-gray-500 mb-4 text-center">{t('schema.relationConnect')}</p>
                    <button onClick={openCreateRelationDrawer} disabled={currentSchema.entityTypes.length === 0} className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      <Plus className="w-3.5 h-3.5" />{t('schema.createRelation')}
                    </button>
                    {currentSchema.entityTypes.length === 0 && <p className="text-[10px] text-amber-600 mt-2">{t('schema.addFirstEntity')}</p>}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {currentSchema.relations.map((rel, index) => (
                      <motion.div key={rel.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="bg-white rounded-lg border border-gray-200 p-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-0.5 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: rel.color || '#9ca3af' }} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium text-xs text-gray-900">{rel.name}</span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: `${rel.color || '#9ca3af'}20`, color: rel.color || '#9ca3af' }}>{rel.from}</span>
                                <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: `${rel.color || '#9ca3af'}20`, color: rel.color || '#9ca3af' }}>{rel.to}</span>
                              </div>
                              <div className="flex items-center gap-1 mt-1">
                                <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-600">{RELATION_DIRECTIONS.find(d => d.value === rel.direction)?.label || t('rel.directed')}</span>
                                <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-600">{RELATION_STYLES.find(s => s.value === rel.style)?.label || t('rel.solid')}</span>
                                {(rel.properties?.length || 0) > 0 && <span className="px-1.5 py-0.5 bg-blue-50 rounded text-[10px] text-blue-600">{rel.properties?.length || 0} {t('schema.properties')}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button onClick={() => openEditRelationDrawer(rel)} className="p-1 hover:bg-blue-50 rounded transition-colors"><Edit2 className="w-3 h-3 text-blue-500" /></button>
                            <button onClick={() => handleDeleteRelation(rel.id)} className="p-1 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-3 h-3 text-red-500" /></button>
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
              <motion.div key="visualizer" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-3 h-full w-full overflow-hidden">
                <div className="bg-white rounded-lg border border-gray-200 h-full min-h-[300px] relative w-full">
                  <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                    <button onClick={() => setShowMaximizedVisualizer(true)} className="p-1.5 bg-white/90 hover:bg-white border border-gray-200 rounded-lg shadow-sm transition-colors" title={t('schema.fullscreen')}>
                      <Maximize2 className="w-3.5 h-3.5 text-gray-600" />
                    </button>
                  </div>
                  <div className="h-full p-3 pt-10">
                    {currentSchema.entityTypes.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-2"><Network className="w-6 h-6 text-gray-400" /></div>
                        <h3 className="text-xs font-semibold text-gray-900 mb-1">{t('schema.noVisualData')}</h3>
                        <p className="text-[10px] text-gray-500">{t('schema.visualHint')}</p>
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

      {/* 弹窗和抽屉 */}
      <AnimatePresence>
        {editingSchema && (
          <EditSchemaModal
            schema={currentSchema}
            onSave={(data) => { updateSchema(currentSchema.id, data); setEditingSchema(false); }}
            onClose={() => setEditingSchema(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {creatingSchema && (
          <CreateSchemaModal
            value={newSchemaName}
            onChange={setNewSchemaName}
            onCreate={handleCreateSchema}
            onClose={() => { setCreatingSchema(false); setNewSchemaName(''); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {entityDrawerOpen && (
          <EntityDrawer
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
            onCancelEditProperty={() => { setEditingProperty(null); setPropertyForm({ name: '', type: 'text', options: [] }); }}
            presetColors={PRESET_COLORS}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {relationDrawerOpen && (
          <RelationDrawer
            relation={editingRelation}
            form={relationForm}
            setForm={setRelationForm}
            entityTypes={currentSchema.entityTypes}
            onSave={handleSaveRelation}
            onDelete={() => handleDeleteRelation(editingRelation?.id)}
            onClose={() => { setRelationDrawerOpen(false); setEditingRelationProperty(null); setRelationPropertyForm({ name: '', type: 'text', options: [] }); }}
            editingProperty={editingRelationProperty}
            setEditingProperty={setEditingRelationProperty}
            propertyForm={relationPropertyForm}
            setPropertyForm={setRelationPropertyForm}
            presetColors={PRESET_COLORS}
          />
        )}
      </AnimatePresence>

      {/* 全屏可视化弹窗 */}
      <AnimatePresence>
        {showMaximizedVisualizer && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-8"
            onClick={() => setShowMaximizedVisualizer(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 w-full max-w-6xl h-[80vh] shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Schema {t('schema.visualization')} - {currentSchema.name}</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowMaximizedVisualizer(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><Minimize2 className="w-4 h-4" /></button>
                  <button onClick={() => setShowMaximizedVisualizer(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
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

export default SchemaArchitect;
