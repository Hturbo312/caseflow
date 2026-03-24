import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
  CheckCircle
} from 'lucide-react';
import { useAIStore, useGraphStore, useCaseStore } from '../store';

const AICopilot = () => {
  const { messages, isThinking, sendToAI, clearMessages, currentContext, setContext, apiConfig, setApiConfig } = useAIStore();
  const { selectedNode } = useGraphStore();
  const { getCurrentCase } = useCaseStore();

  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const [showSettings, setShowSettings] = useState(false);

  // 本地配置状态
  const [localConfig, setLocalConfig] = useState({
    endpoint: apiConfig?.endpoint || '',
    apiKey: apiConfig?.apiKey || '',
    model: apiConfig?.model || 'gpt-3.5-turbo',
  });

  const currentCase = getCurrentCase();

  // 同步 store 中的配置到本地状态
  useEffect(() => {
    setLocalConfig({
      endpoint: apiConfig?.endpoint || '',
      apiKey: apiConfig?.apiKey || '',
      model: apiConfig?.model || 'gpt-3.5-turbo',
    });
  }, [apiConfig]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 设置上下文
  useEffect(() => {
    if (selectedNode) {
      setContext({ type: 'node', data: selectedNode });
    } else if (currentCase) {
      setContext({ type: 'case', data: currentCase });
    } else {
      setContext(null);
    }
  }, [selectedNode, currentCase, setContext]);

  // 保存配置
  const handleSaveConfig = () => {
    setApiConfig(localConfig);
    localStorage.setItem('ai-api-config', JSON.stringify(localConfig));
    setShowSettings(false);
  };

  // 打开设置时从 localStorage 读取配置
  const handleOpenSettings = () => {
    const savedConfig = localStorage.getItem('ai-api-config');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setLocalConfig({
          endpoint: parsed.endpoint || '',
          apiKey: parsed.apiKey || '',
          model: parsed.model || 'gpt-3.5-turbo',
        });
      } catch (e) {
        console.error('读取配置失败:', e);
      }
    }
    setShowSettings(true);
  };

  const handleSend = () => {
    if (inputValue.trim()) {
      sendToAI(inputValue);
      setInputValue('');
      setShowSuggestions(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestions = [
    "总结所有采用'工业遗产改造'模式的项目",
    "这个项目的资金来源与政策之间有什么逻辑关系？",
    "找出容积率超过 2.5 的所有案例",
    "比较政府主导和市场主导模式的差异",
  ];

  return (
    <div className="h-full bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col">
      {/* 顶部 */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-500 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">AI 智能助手</h2>
              <p className="text-sm text-gray-500">Graph-RAG 专业咨询</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenSettings}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="AI 配置"
            >
              <Settings className="w-5 h-5 text-gray-500" />
            </button>
            <button
              onClick={clearMessages}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              清空对话
            </button>
          </div>
        </div>

        {/* API 配置状态提示 */}
        {apiConfig?.endpoint && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg">
            <CheckCircle className="w-3.5 h-3.5 text-green-600" />
            <span className="text-xs text-green-700">
              已配置 AI API: {apiConfig.endpoint}
            </span>
          </div>
        )}

        {/* 上下文提示 */}
        {currentContext && currentContext.data && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-cyan-50 rounded-lg">
            <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
            <span className="text-xs text-cyan-700">
              当前上下文：{currentContext.type === 'node' ? `节点"${currentContext.data.name || '未知'}"` : `案例"${currentCase?.name || '未选择'}"`}
            </span>
          </div>
        )}
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-2xl flex items-center justify-center mb-4">
              <Bot className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-700 mb-2">你好，我是你的 AI 助手</h3>
            <p className="text-sm text-gray-500 max-w-xs mb-6">
              我可以帮你分析知识图谱中的案例关系，回答专业问题
            </p>

            {/* 推荐问题 */}
            {showSuggestions && (
              <div className="w-full max-w-md space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                  <Lightbulb className="w-4 h-4" />
                  推荐提问
                </div>
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setInputValue(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="w-full p-3 text-left text-sm bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-start gap-3 ${
                  message.role === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.role === 'user'
                      ? 'bg-blue-500'
                      : 'bg-gradient-to-br from-cyan-500 to-blue-500'
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
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {message.content}
                </div>
              </motion.div>
            ))}

            {isThinking && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                </div>
                <div className="bg-gray-100 p-3 rounded-2xl">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 输入区 */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入你的问题..."
              rows={1}
              className="w-full px-4 py-3 bg-gray-100 border border-transparent rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none max-h-32"
              style={{ minHeight: '44px' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isThinking}
            className="p-3 bg-cyan-500 text-white rounded-xl hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">
          AI 生成内容仅供参考，请结合专业知识判断
        </p>
      </div>

      {/* AI Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 w-full max-w-md"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">AI 配置</h3>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Endpoint</label>
                  <input
                    type="text"
                    value={localConfig.endpoint}
                    onChange={(e) => setLocalConfig({ ...localConfig, endpoint: e.target.value })}
                    placeholder="https://api.openai.com/v1/chat/completions"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                  <input
                    type="password"
                    value={localConfig.apiKey}
                    onChange={(e) => setLocalConfig({ ...localConfig, apiKey: e.target.value })}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <select
                    value={localConfig.model}
                    onChange={(e) => setLocalConfig({ ...localConfig, model: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                    <option value="gpt-4">GPT-4</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                  </select>
                </div>
                <button
                  onClick={handleSaveConfig}
                  className="w-full py-2.5 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-600 transition-colors"
                >
                  保存配置
                </button>
                <p className="text-xs text-gray-400 text-center">
                  配置将保存到本地存储
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AICopilot;
