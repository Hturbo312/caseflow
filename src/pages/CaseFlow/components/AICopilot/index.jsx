import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  MessageSquare,
  Send,
  Sparkles,
  X,
  Bot,
  User,
  Loader2,
  Lightbulb,
  Settings,
  CheckCircle,
  FileText,
  Wand2,
  Database,
  Lock,
  History,
  MessageCirclePlus,
  RefreshCw,
  Upload,
  Eye,
  ChevronDown
} from 'lucide-react';
import { useAgentStore, useGraphStore, useCaseStore, useSchemaStore, useAuthStore, useExtractionStore } from '@store';
import { caseApi, schemaApi } from '@services/api';
import { API_BASE_URL, authHelper } from '../../../../utils';
import { useAIConfig, useSessionHistory } from './hooks';
import { useToastStore } from '@components/Toast/ToastStore.js';
import { parseDocument, extractFileExtension } from '@utils/documentParser';
import { useI18n } from '../../../../i18n';

// 子组件
import HistorySidebar from './HistorySidebar';
import ExtractResultPanel from './ExtractResultPanel';
import SettingsModal from './SettingsModal';
import ExtractionPipeline from './ExtractionPipeline';
import SchemaResultPanel from './SchemaResultPanel';
import AdjustmentModal from './panels/AdjustmentModal';

// Agent 配置
import { createAgentConfig } from './agents/config';

const AICopilot = ({ onShowLogin }) => {
  const { t, locale } = useI18n();
  const {
    currentAgentName,
    sessions,
    setCurrentAgent,
    clearCurrentSession,
    invokeAgent,
    loadAgents,
    setExtractResult,
    setSchemaMode,
    reflectionIteration,
    reflectionStatus,
  } = useAgentStore();

  const { selectedNode, addNodeToGraph, addLinkToGraph, loadAllCasesToGraph } = useGraphStore();
  const { cases, currentCaseId, setCurrentCase } = useCaseStore();
  const { getCurrentSchema, currentSchemaId } = useSchemaStore();
  const { isAuthenticated } = useAuthStore();
  const { reset: resetExtraction } = useExtractionStore();
  const toast = useToastStore();

  // Use extracted hooks
  const {
    configStatus,
    localConfig,
    isSavingConfig,
    showSettings,
    showApiKey,
    handleOpenSettings,
    handleSaveConfig,
    handleDeleteConfig,
    setShowSettings,
    setShowApiKey,
    setLocalConfig
  } = useAIConfig(onShowLogin);

  const {
    showHistory,
    sessionHistory,
    setShowHistory,
    handleLoadSession,
    handleNewSession,
    handleDeleteSession
  } = useSessionHistory(currentAgentName);

  const agentConfig = createAgentConfig(t);
  const currentSession = sessions[currentAgentName] || {};
  const currentConfig = agentConfig[currentAgentName] || agentConfig.schema_builder;

  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // 案例拆解模式状态
  const [caseText, setCaseText] = useState('');
  const [extractionPrompt, setExtractionPrompt] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [extractionMode, setExtractionMode] = useState('chat'); // 'chat' | 'pipeline'
  const [isCreatingSchema, setIsCreatingSchema] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const fileInputRef = useRef(null);

  // 展开的旧版本消息
  const [expandedOldMessages, setExpandedOldMessages] = useState(new Set());

  const currentSchema = getCurrentSchema();

  // 初始化
  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  // 自动滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);

  // Esc 键关闭弹窗
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        // 关闭调整弹窗
        if (inputValue && currentSession.extractResult) {
          setInputValue('');
        }
        // 关闭设置弹窗
        if (showSettings) {
          setShowSettings(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inputValue, currentSession?.extractResult, showSettings, setShowSettings]);

  // 构建上下文
  const buildContext = useCallback(() => {
    const context = {};

    if (currentAgentName === 'case_extractor') {
      context.schema_id = currentSchemaId;
      context.case_id = currentCaseId;
      context.case_text = caseText;
    } else if (currentAgentName === 'analysis_assistant') {
      context.schema_id = currentSchemaId;
      if (currentCaseId) context.selected_case_id = currentCaseId;
      if (selectedNode) context.selected_node_id = selectedNode.id;
    }

    return context;
  }, [currentAgentName, currentSchemaId, currentCaseId, caseText, selectedNode]);

  // 发送消息
  const handleSend = useCallback(async () => {
    if (!isAuthenticated) {
      onShowLogin?.();
      return;
    }
    if (!inputValue.trim() || currentSession?.isThinking) return;

    const context = buildContext();
    const extraParams = {};
    if (currentAgentName === 'schema_builder' && currentSession.schemaMode === 'generate') {
      extraParams.schema_mode = 'generate';
    }

    try {
      await invokeAgent(inputValue, context, Object.keys(extraParams).length > 0 ? extraParams : undefined);
      setInputValue('');
      // 发送后重置 schemaMode
      if (currentAgentName === 'schema_builder' && currentSession.schemaMode === 'generate') {
        setSchemaMode('discuss');
      }
    } catch (error) {
      console.error('invokeAgent 调用失败:', error);
      toast.error(t('common.sendFailed'));
    }
  }, [isAuthenticated, inputValue, currentSession?.isThinking, currentSession.schemaMode, buildContext, invokeAgent, onShowLogin, toast, setSchemaMode]);

  // 生成Schema
  const handleGenerateSchema = useCallback(() => {
    if (currentSession?.isThinking) return;
    setInputValue(t('ai.systemGenerateSchema'));
    setSchemaMode('generate');
    inputRef.current?.focus();
  }, [currentSession?.isThinking, setSchemaMode]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // 案例拆解：保存提取结果（优化：批量 API 代替 N 次独立调用）
  const handleConfirmSave = useCallback(async () => {
    const result = currentSession.extractResult;
    if (!result) return;

    setIsSaving(true);
    try {
      let targetCaseId = currentCaseId;

      // 如果没有选择案例，创建新案例
      if (!targetCaseId) {
        const response = await caseApi.create({
          name: caseText.substring(0, 30) || `${t('common.case')}-${Date.now()}`,
          description: caseText,
          schemaId: currentSchemaId
        });
        targetCaseId = response.case.id?.toString();
      }

      const token = authHelper.getToken();
      const authHeaders = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      };

      // 1. 批量保存实体（代替 N 次独立 addEntity 调用）
      const entitiesToSave = (result.entities || []).map(entity => ({
        name: entity.name,
        entityType: entity.entityType,
        properties: entity.properties || {},
      }));

      let addedEntities = [];
      if (entitiesToSave.length > 0) {
        const entRes = await fetch(`${API_BASE_URL}/extraction/${targetCaseId}/batch-save-entities`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ entities: entitiesToSave, autoEmbed: false }),
        });
        if (!entRes.ok) throw new Error(t('ai.entitySaveFailed', { status: entRes.status }));
        const entData = await entRes.json();
        addedEntities = entData.entities || [];
        if (entData.skipped?.length > 0) {
          console.error(`[handleConfirmSave] 跳过了 ${entData.skipped.length} 个重复实体`);
        }
      }

      // 将保存的实体添加到图谱
      for (const saved of addedEntities) {
        const graphNode = { ...saved, id: String(saved.id), entityType: saved.entity_type };
        addNodeToGraph(graphNode);
      }

      // 2. 批量保存关系（代替 N 次独立 addRelation 调用）
      // 优化：使用 (name, entityType) 复合键 + name-only 回退 Map，O(1) 查找
      const entityByKey = new Map(addedEntities.map(e => [`${e.name}::${e.entity_type}`, e]));
      const entityByName = new Map(addedEntities.map(e => [e.name, e]));
      const relationsToSave = (result.relations || [])
        .map(rel => {
          // 优先精确匹配 (name + type)，回退到仅 name 匹配（AI 可能猜错类型）
          const sourceEntity = entityByKey.get(`${rel.sourceName}::${rel.sourceType || ''}`)
            || entityByKey.get(`${rel.sourceName}::`)
            || entityByName.get(rel.sourceName);
          const targetEntity = entityByKey.get(`${rel.targetName}::${rel.targetType || ''}`)
            || entityByKey.get(`${rel.targetName}::`)
            || entityByName.get(rel.targetName);
          return sourceEntity && targetEntity
            ? {
                sourceName: rel.sourceName,
                sourceType: sourceEntity.entity_type,
                targetName: rel.targetName,
                targetType: targetEntity.entity_type,
                name: rel.name,
                status: 'approved',
              }
            : null;
        })
        .filter(Boolean);

      let relationsSaved = false;
      if (relationsToSave.length > 0) {
        const relRes = await fetch(`${API_BASE_URL}/extraction/${targetCaseId}/batch-save-relations`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ relations: relationsToSave, autoEmbed: false }),
        });
        if (relRes.ok) {
          const relData = await relRes.json();
          const savedRelations = relData.relations || [];
          // 将保存的关系添加到图谱（与实体保存保持一致）
          for (const saved of savedRelations) {
            const graphLink = {
              ...saved,
              id: String(saved.id),
              sourceId: String(saved.source_entity_id),
              targetId: String(saved.target_entity_id),
              name: saved.relation_type,
            };
            addLinkToGraph(graphLink);
          }
          relationsSaved = true;
        } else {
          console.error('[handleConfirmSave] relation save failed, HTTP ' + relRes.status);
          toast.warn(t('ai.relationSaveFailed'));
          // 关键修复：批量保存失败时不标记 preSaved，让 finalize 安全网尝试直接保存
        }
      }

      // 3. 触发一次嵌入生成（代替 N 次 autoEmbed 调用）
      // 优化：仅当实际保存了实体时才触发，避免无意义的空嵌入 API 调用
      // 关键修复：preSaved 仅在实际保存成功时为 true，失败时让 finalize 安全网接管
      const finalizeRes = await fetch(`${API_BASE_URL}/extraction/${targetCaseId}/finalize`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          relations: relationsToSave,
          autoEmbed: addedEntities.length > 0,
          preSaved: relationsSaved,
        }),
      });
      if (!finalizeRes.ok) {
        console.error(`[handleConfirmSave] finalize 失败: HTTP ${finalizeRes.status}`);
        toast.error(t('ai.finalizeFailed'));
        // 关键修复：finalize 失败时阻止后续的"成功"提示和状态清理
        return;
      }

      // 检查 finalize 返回的实际保存/跳过数量
      const finalizeData = await finalizeRes.json();
      const actualSavedRels = finalizeData.data?.saved_relations || 0;
      const skippedRels = finalizeData.data?.skipped_relations || [];

      // 刷新图谱
      loadAllCasesToGraph();

      // 清理状态
      setExtractResult(null);
      setCaseText('');
      setInputValue('');

      // 根据实际保存结果展示不同的提示
      if (skippedRels.length > 0) {
        console.warn(`[handleConfirmSave] ${skippedRels.length} 条关系被跳过:`, skippedRels);
        toast.warn(t('ai.relationSaveIncomplete', { approved: relationsToSave.length, saved: actualSavedRels }));
      } else {
        toast.success(t('ai.saveSuccess', { entities: addedEntities.length, relations: actualSavedRels }));
      }
    } catch (error) {
      console.error('保存失败:', error);
      toast.error(t('common.saveFailed') + ': ' + error.message);
    }
    setIsSaving(false);
  }, [currentSession.extractResult, currentCaseId, caseText, currentSchemaId, addNodeToGraph, addLinkToGraph, loadAllCasesToGraph, setExtractResult, toast, t]);

  // 案例拆解：开始调整
  const handleRequestAdjustment = useCallback(() => {
    setInputValue(t('ai.adjustTitle'));
    inputRef.current?.focus();
  }, [t]);


  // Schema 构建：确认创建
  const handleConfirmSchema = useCallback(async (selectedTypes, selectedRels) => {
    const result = currentSession.extractResult;
    if (!result) return;

    setIsCreatingSchema(true);
    try {
      const selectedEntityTypes = result.entityTypes.filter((_, i) => selectedTypes.has(i));
      const selectedRelations = result.relations.filter((_, i) => selectedRels.has(i));

      // 1. 创建 Schema
      const dateLocale = locale === 'en' ? 'en-US' : 'zh-CN';
      const schemaName = result.schemaName || `AI Schema - ${new Date().toLocaleString(dateLocale, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
      const schemaDesc = result.message || t('ai.aiGeneratedSchemaDesc');
      const schemaResponse = await schemaApi.create({ name: schemaName, description: schemaDesc });
      const schemaId = schemaResponse.schema.id?.toString();

      // 2. 批量添加实体类型
      for (const et of selectedEntityTypes) {
        try {
          await schemaApi.addEntityType(schemaId, {
            name: et.name,
            color: et.color || '#3b82f6',
            properties: (et.properties || []).map(p => ({
              name: p.name,
              type: p.type || 'text',
              options: p.options || []
            }))
          });
        } catch (e) {
          console.error(`添加实体类型 ${et.name} 失败:`, e);
        }
      }

      // 3. 批量添加关系
      for (const rel of selectedRelations) {
        try {
          await schemaApi.addRelation(schemaId, {
            name: rel.name,
            from: rel.from,
            to: rel.to,
            direction: rel.direction || 'directed',
            color: '#9ca3af',
            style: 'solid',
            properties: []
          });
        } catch (e) {
          console.error(`添加关系 ${rel.name} 失败:`, e);
        }
      }

      // 4. 重新加载 Schema 列表并切换到新 Schema
      await useSchemaStore.getState().loadSchemas();
      useSchemaStore.getState().setCurrentSchema(schemaId);

      // 5. 清理状态
      setExtractResult(null);
      toast.success(t('ai.schemaCreated', { entities: selectedEntityTypes.length, relations: selectedRelations.length }));
    } catch (error) {
      console.error('创建 Schema 失败:', error);
      toast.error(t('common.saveFailed') + ': ' + error.message);
    }
    setIsCreatingSchema(false);
  }, [currentSession.extractResult, setExtractResult, toast, t, locale]);
  // 上传文档文件（PDF / DOCX / TXT）
  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 文件大小限制：10MB
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('common.fileTooLarge'));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsParsingFile(true);
    try {
      const text = await parseDocument(file);
      setCaseText(text);
      const preview = file.name.length > 20 ? file.name.slice(0, 20) + '…' : file.name;
      toast.success(t('ai.fileParsed', { name: preview, count: text.length.toLocaleString() }));
    } catch (err) {
      toast.error(err.message || t('common.fileParseFailed'));
    } finally {
      setIsParsingFile(false);
      // 清空 input 以便重复选择同一文件
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [toast]);

  // 多轮提取：进入 Pipeline 模式
  const handleStartPipeline = useCallback(async () => {
    if (!caseText.trim() || !currentSchemaId) return;

    // 从 store 获取最新的 currentCaseId（避免闭包 stale）
    let targetCaseId = useCaseStore.getState().currentCaseId;
    if (!targetCaseId) {
      try {
        const response = await caseApi.create({
          name: caseText.substring(0, 30) || `${t('common.case')}-${Date.now()}`,
          description: caseText,
          schemaId: currentSchemaId
        });
        targetCaseId = response.case.id?.toString();
        // 设置当前案例
        setCurrentCase(targetCaseId);
        // 刷新案例列表
        useCaseStore.getState().loadCases();
      } catch (error) {
        toast.error(t('common.createCaseFailed') + ': ' + error.message);
        return;
      }
    }

    setExtractionMode('pipeline');
  }, [caseText, currentSchemaId, setCurrentCase, toast]);

  // 多轮提取：完成回调
  const handlePipelineComplete = useCallback(() => {
    loadAllCasesToGraph();
    setExtractionMode('chat');
    setCaseText('');
    resetExtraction();
    toast.success(t('ai.caseBreakdownComplete'));
  }, [loadAllCasesToGraph, resetExtraction, toast]);

  // 退出 Pipeline 模式
  const handleExitPipeline = useCallback(() => {
    setExtractionMode('chat');
    resetExtraction();
  }, [resetExtraction]);

  // 切换 Agent 时清空输入
  const handleAgentChange = useCallback((agentName) => {
    setCurrentAgent(agentName);
    setInputValue('');
    setCaseText('');
    setExtractionMode('chat');
    setShowHistory(false);
  }, [setCurrentAgent, setShowHistory]);

  const suggestions = {
    schema_builder: [
      t('ai.suggestionSchema1'),
      t('ai.suggestionSchema2'),
      t('ai.suggestionSchema3')
    ],
    case_extractor: [
      t('ai.suggestionExtract1')
    ],
    analysis_assistant: [
      t('ai.suggestionAnalysis1'),
      t('ai.suggestionAnalysis2'),
      t('ai.suggestionAnalysis3')
    ]
  };

  const IconComponent = currentConfig.icon;

  return (
    <div className="h-full bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col relative">
      {/* 历史侧边栏 */}
      <AnimatePresence>
        <HistorySidebar
          showHistory={showHistory}
          isAuthenticated={isAuthenticated}
          sessionHistory={sessionHistory}
          currentSessionId={currentSession.sessionId}
          onLoadSession={handleLoadSession}
          onDeleteSession={handleDeleteSession}
          onNewSession={handleNewSession}
          onClose={() => setShowHistory(false)}
        />
      </AnimatePresence>

      {/* 顶部 */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${currentConfig.color}`}>
              <IconComponent className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{currentConfig.title}</h2>
              <p className="text-sm text-gray-500">{currentConfig.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Agent 切换按钮 */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
              {Object.entries(agentConfig).map(([name, config]) => {
                const AgentIcon = config.icon;
                return (
                  <button
                    key={name}
                    onClick={() => handleAgentChange(name)}
                    className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      currentAgentName === name
                        ? 'bg-white text-gray-800 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    title={config.title}
                  >
                    <AgentIcon className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
            {/* 历史记录按钮：未登录也可见（展示 demo 数据） */}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded-lg transition-colors ${showHistory ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
              title={t('ai.history')}
            >
              <History className="w-5 h-5 text-gray-500" />
            </button>
            {isAuthenticated ? (
              <>
                <button
                  onClick={handleNewSession}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title={t('ai.newSession')}
                >
                  <MessageCirclePlus className="w-5 h-5 text-gray-500" />
                </button>
                <button
                  onClick={handleOpenSettings}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title={t('ai.aiConfig')}
                >
                  <Settings className="w-5 h-5 text-gray-500" />
                </button>
              </>
            ) : (
              <button
                onClick={() => onShowLogin?.()}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-cyan-50 text-cyan-600 rounded-lg hover:bg-cyan-100 transition-colors"
                title={t('ai.loginToConfigure')}
              >
                <Lock className="w-3 h-3" />
                {t('common.login')}
              </button>
            )}
            <button
              onClick={clearCurrentSession}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              {t('ai.clear')}
            </button>
          </div>
        </div>

        {/* 未登录提示 */}
        {!isAuthenticated && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg">
            <Lock className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs text-amber-700">
              {t('ai.authPrompt')}
            </span>
            <button
              onClick={() => onShowLogin?.()}
              className="ml-auto text-xs text-amber-700 hover:text-amber-800 font-medium"
            >
              {t('ai.loginNow')}
            </button>
          </div>
        )}

        {/* API 配置状态提示 */}
        {isAuthenticated && configStatus.configured && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg">
            <CheckCircle className="w-3.5 h-3.5 text-green-600" />
            <span className="text-xs text-green-700">
              {t('ai.configured')}: {configStatus.endpoint} ({configStatus.apiKeyMasked})
            </span>
          </div>
        )}
      </div>

      {/* 案例拆解模式：输入表单 + 对话区 */}
      {currentAgentName === 'case_extractor' && extractionMode === 'chat' && (
        <div className={`${
          (currentSession.messages || []).length === 0
            ? 'flex-1 flex flex-col p-6'
            : 'border-b border-gray-200 p-4'
        }`} style={{ gap: '12px' }}>
          {/* 输入 1：案例材料 */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-semibold text-gray-700">案例材料</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{caseText.length.toLocaleString()} 字</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isParsingFile}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isParsingFile}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-indigo-500 bg-indigo-50 rounded hover:bg-indigo-100 transition-colors disabled:opacity-50"
                  title={t('ai.upload')}
                >
                  {isParsingFile ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Upload className="w-3 h-3" />
                  )}
                  {t('ai.upload')}
                </button>
              </div>
            </div>
            <textarea
              value={caseText}
              onChange={(e) => setCaseText(e.target.value)}
              placeholder="粘贴案例文本，或上传 PDF / Word / TXT 文件..."
              className="w-full flex-1 min-h-0 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* 输入 2：提取要求 */}
          <div className="flex-shrink-0">
            <label className="text-sm font-semibold text-gray-700 mb-1 block">提取要求</label>
            <textarea
              value={extractionPrompt}
              onChange={(e) => setExtractionPrompt(e.target.value)}
              placeholder="告诉 AI 你想提取什么，例如：提取案例中的主体、事件、策略...（可选）"
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* 确认拆解按钮 */}
          <button
            onClick={async () => {
              if (caseText.trim() && currentSchemaId) {
                const userInput = extractionPrompt.trim()
                  ? `案例材料已提供。\n额外要求：${extractionPrompt}`
                  : '请帮我拆解这个案例，提取所有实体和关系。';
                try {
                  await invokeAgent(userInput, {
                    schema_id: currentSchemaId,
                    case_id: currentCaseId,
                    case_text: caseText
                  });
                  setExtractionPrompt('');
                } catch (error) {
                  console.error('invokeAgent 调用失败:', error);
                  toast.error(t('common.extractionFailed') + ': ' + (error.message || t('common.unknownError')));
                }
              }
            }}
            disabled={!caseText.trim() || !currentSchemaId || currentSession.isThinking}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-medium hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {currentSession.isThinking ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                AI 拆解中...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                确认拆解
              </>
            )}
          </button>
        </div>
      )}

      {/* 消息列表 / Pipeline 区域 */}
      <div className={`${
        currentAgentName === 'case_extractor' && extractionMode === 'chat' && (currentSession.messages || []).length === 0
          ? 'flex-none'
          : 'flex-1'
      } overflow-y-auto`}>
        {currentAgentName === 'case_extractor' && extractionMode === 'pipeline' && currentCaseId ? (
          /* Pipeline 模式：全屏提取流程 */
          <ExtractionPipeline
            caseId={currentCaseId}
            caseText={caseText}
            onComplete={handlePipelineComplete}
          />
        ) : (
          /* 聊天模式：消息列表 */
          <div className="p-4 space-y-4">
            {/* 空状态 */}
            {(currentSession.messages || []).length === 0 ? (
              currentAgentName === 'case_extractor' ? null : (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className={`w-16 h-16 bg-gradient-to-br ${currentConfig.color} rounded-2xl flex items-center justify-center mb-4`}>
                    <IconComponent className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-700 mb-2">{currentConfig.title}</h3>
                  <p className="text-sm text-gray-500 max-w-xs mb-4">{currentConfig.subtitle}</p>

                {/* 推荐问题 */}
                <div className="w-full max-w-md space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                    <Lightbulb className="w-4 h-4" />
                    {t('ai.suggestions')}
                  </div>
                  {suggestions[currentAgentName]?.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setInputValue(suggestion);
                        inputRef.current?.focus();
                      }}
                      className="w-full p-2.5 text-left text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
              )
            ) : (
              <>
                {/* 对话消息列表 */}
                {(currentSession.messages || []).map((message) => {
                  const isOldVersion = message.isLatest === false;
                  const isExpanded = expandedOldMessages.has(message.id);

                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-start gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''} ${isOldVersion ? 'opacity-50' : ''}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          message.role === 'user'
                            ? 'bg-blue-500'
                            : `bg-gradient-to-br ${currentConfig.color}`
                        }`}
                      >
                        {message.role === 'user' ? (
                          <User className="w-4 h-4 text-white" />
                        ) : (
                          <Bot className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <div
                        className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                          message.isError
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : message.role === 'user'
                              ? 'bg-blue-500 text-white'
                              : isOldVersion
                                ? 'bg-gray-50 text-gray-400 border border-dashed border-gray-200'
                                : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {isOldVersion && !isExpanded && (
                          <button
                            onClick={() => {
                              const next = new Set(expandedOldMessages);
                              if (next.has(message.id)) {
                                next.delete(message.id);
                              } else {
                                next.add(message.id);
                              }
                              setExpandedOldMessages(next);
                            }}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-500 mb-1"
                          >
                            <Eye className="w-3 h-3" />
                            {t('ai.oldVersionLabel').replace('{iteration}', message.iteration || '?')}
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        )}
                        {(!isOldVersion || isExpanded) && (
                          <>
                            {message.role === 'assistant' ? (
                              <div className="markdown-content prose prose-sm max-w-none">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  disallowedElements={['script', 'iframe', 'object', 'embed', 'form', 'input']}
                                  unwrapDisallowed={true}
                                >
                                  {message.content}
                                </ReactMarkdown>
                              </div>
                            ) : (
                              message.content
                            )}
                          </>
                        )}
                        {message.isStreaming && (
                          <span className="inline-block w-1.5 h-4 bg-gray-400 ml-0.5 animate-pulse" />
                        )}
                      </div>
                    </motion.div>
                  );
                })}

                {/* 案例拆解模式：提取结果面板（仅聊天模式） */}
                {currentAgentName === 'case_extractor' && extractionMode === 'chat' && (
                  <div className="pt-2">
                    <ExtractResultPanel
                      extractResult={currentSession.extractResult}
                      isThinking={currentSession.isThinking}
                      isSaving={isSaving}
                      selectedCaseId={currentCaseId}
                      onConfirmSave={handleConfirmSave}
                      onRequestAdjustment={handleRequestAdjustment}
                      onStartPipeline={currentSchemaId ? handleStartPipeline : null}
                    />
                  </div>
                )}

                {/* Schema 构建：AI 建议预览面板 */}
                {currentAgentName === 'schema_builder' && (
                  <div className="pt-2">
                    <SchemaResultPanel
                      schemaResult={currentSession.extractResult}
                      isThinking={currentSession.isThinking}
                      isSaving={isCreatingSchema}
                      onCreateSchema={handleConfirmSchema}
                      onRequestAdjustment={handleRequestAdjustment}
                    />
                  </div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        )}
      </div>

      {/* 输入区 - 案例拆解模式隐藏 */}
      {currentAgentName !== 'case_extractor' && (
        <div className="border-t border-gray-200 p-4">
          {/* Schema Builder 生成按钮 */}
          {currentAgentName === 'schema_builder' && currentSession.schemaMode !== 'generate' && (
            <div className="mb-3 flex items-center justify-between">
              <button
                onClick={handleGenerateSchema}
                disabled={currentSession.isThinking || (currentSession.messages || []).length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {t('ai.generateSchema')}
              </button>
              {(currentSession.messages || []).length > 0 && (
                <span className="text-xs text-gray-400">{t('ai.generateSchemaHint')}</span>
              )}
            </div>
          )}

          {/* 反思循环指示器 */}
          {currentSession?.isThinking && reflectionStatus && (
            <div className="mb-2 flex items-center gap-2 px-3 py-1.5 text-xs text-gray-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              {reflectionStatus === 'evaluating' && t('ai.selfEvaluating')}
              {reflectionStatus === 'refining' && t('ai.refiningOutput').replace('{iteration}', reflectionIteration).replace('{maxIterations}', '2')}
              {reflectionStatus === 'generating' && t('ai.generatingIteration').replace('{iteration}', reflectionIteration).replace('{maxIterations}', '2')}
            </div>
          )}

          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={currentConfig.placeholder}
                rows={1}
                className="w-full px-4 py-3 bg-gray-100 border border-transparent rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none max-h-32"
                style={{ minHeight: '44px' }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || currentSession.isThinking}
              className={`p-3 bg-gradient-to-br ${currentConfig.color} text-white rounded-xl hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* 案例拆解模式 - 调整输入弹窗（仅聊天模式） */}
      <AnimatePresence>
        {currentAgentName === 'case_extractor' && extractionMode === 'chat' && inputValue && currentSession.extractResult && (
          <AdjustmentModal
            inputValue={inputValue}
            setInputValue={setInputValue}
            isThinking={currentSession.isThinking}
            onSend={(value) => invokeAgent(value, {
              schema_id: currentSchemaId,
              case_id: currentCaseId,
              case_text: caseText
            })}
          />
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        <SettingsModal
          showSettings={showSettings}
          isAuthenticated={isAuthenticated}
          configStatus={configStatus}
          localConfig={localConfig}
          isSavingConfig={isSavingConfig}
          showApiKey={showApiKey}
          onSaveConfig={handleSaveConfig}
          onDeleteConfig={handleDeleteConfig}
          onClose={() => setShowSettings(false)}
          onSetLocalConfig={setLocalConfig}
          onToggleApiKey={() => setShowApiKey(!showApiKey)}
        />
      </AnimatePresence>
    </div>
  );
};

export default AICopilot;