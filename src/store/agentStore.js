import { create } from 'zustand';
import { schemaApi, caseApi, authApi, agentApi, chatApi, extractionApi } from '../services/api';
import { authHelper, API_BASE_URL } from '../utils';

// ============ Agent Store ============
export const useAgentStore = create((set, get) => ({
  // Agent 列表
  agents: [],
  currentAgentName: 'schema_builder', // 'schema_builder' | 'case_extractor' | 'analysis_assistant'

  // 各 Agent 的会话状态
  sessions: {
    schema_builder: { sessionId: null, messages: [], isThinking: false, schemaMode: 'discuss', extractResult: null },
    case_extractor: { sessionId: null, messages: [], isThinking: false, extractResult: null },
    analysis_assistant: { sessionId: null, messages: [], isThinking: false, ragContext: [] },
  },

  // 会话历史列表
  sessionHistory: [],

  // 反思循环状态
  reflectionIteration: 0,
  reflectionStatus: null,

  // 加载 Agent 列表
  loadAgents: async () => {
    try {
      const data = await agentApi.getAll();
      set({ agents: data.agents || [] });
    } catch (error) {
      console.error('加载 Agent 列表失败:', error);
    }
  },

  // 加载会话历史列表
  loadSessionHistory: async (agentName) => {
    try {
      const data = await chatApi.getSessions(agentName);
      set({ sessionHistory: data.sessions || [] });
    } catch (error) {
      console.error('加载会话历史失败:', error);
    }
  },

  // 加载特定会话的聊天记录
  loadSessionMessages: async (sessionId) => {
    try {
      const data = await chatApi.getSessionHistory(sessionId);
      const { currentAgentName, sessions } = get();

      // 转换数据库格式为前端格式
      const messages = (data.messages || []).map(msg => ({
        role: msg.role,
        content: msg.content,
        id: msg.id
      }));

      set({
        sessions: {
          ...sessions,
          [currentAgentName]: {
            ...sessions[currentAgentName],
            sessionId,
            messages,
            isThinking: false
          }
        }
      });
    } catch (error) {
      console.error('加载聊天记录失败:', error);
    }
  },

  // 开始新会话
  startNewSession: () => {
    const { currentAgentName, sessions } = get();
    const agentDefaults = {
      schema_builder: { sessionId: null, messages: [], isThinking: false, schemaMode: 'discuss', extractResult: null },
      case_extractor: { sessionId: null, messages: [], isThinking: false, extractResult: null },
      analysis_assistant: { sessionId: null, messages: [], isThinking: false, ragContext: [] },
    };

    set({
      sessions: {
        ...sessions,
        [currentAgentName]: agentDefaults[currentAgentName]
      }
    });
  },

  // 删除会话
  deleteSession: async (sessionId) => {
    try {
      const { currentAgentName } = get();
      await chatApi.deleteSession(currentAgentName, sessionId);

      // 刷新历史列表
      get().loadSessionHistory(currentAgentName);

      // 如果删除的是当前会话，开始新会话
      const { sessions } = get();
      if (sessions[currentAgentName].sessionId === sessionId) {
        get().startNewSession();
      }
    } catch (error) {
      console.error('删除会话失败:', error);
    }
  },

  // 切换 Agent
  setCurrentAgent: (agentName) => set({ currentAgentName: agentName }),

  // 设置 Schema 生成模式
  setSchemaMode: (mode) => set((state) => {
    const session = state.sessions.schema_builder;
    return {
      sessions: {
        ...state.sessions,
        schema_builder: { ...session, schemaMode: mode }
      }
    };
  }),

  // 获取当前 Agent 会话
  getCurrentSession: () => {
    const { currentAgentName, sessions } = get();
    return sessions[currentAgentName] || { sessionId: null, messages: [], isThinking: false };
  },

  // 清空当前 Agent 会话
  clearCurrentSession: async () => {
    const { currentAgentName, sessions } = get();
    const session = sessions[currentAgentName];

    // 如果有服务端会话，清除它
    if (session.sessionId) {
      try {
        await fetch(`/api/agents/${currentAgentName}/sessions/${session.sessionId}`, {
          method: 'DELETE'
        });
      } catch (error) {
        console.error('清除会话失败:', error);
      }
    }

    set({
      sessions: {
        ...sessions,
        [currentAgentName]: {
          sessionId: null,
          messages: [],
          isThinking: false,
          extractResult: null,
          ragContext: []
        }
      }
    });
  },

  // 调用 Agent (流式)
  invokeAgent: async (userInput, context = {}, extraParams = {}) => {
    const { currentAgentName, sessions } = get();
    const session = sessions[currentAgentName];

    // 添加用户消息
    const userMessage = { role: 'user', content: userInput, id: Date.now() };
    const assistantMessageId = Date.now() + 1;

    // 添加一个空的助手消息用于流式更新
    const assistantMessage = {
      role: 'assistant',
      content: '',
      id: assistantMessageId,
      isStreaming: true
    };

    set({
      sessions: {
        ...sessions,
        [currentAgentName]: {
          ...session,
          messages: [...session.messages, userMessage, assistantMessage],
          isThinking: true
        }
      },
      reflectionIteration: 0,
      reflectionStatus: null,
    });

    // 追踪当前迭代的消息 ID
    let currentAssistantMessageId = assistantMessageId;

    // 流式更新助手消息
    const onChunk = (chunk, fullContent, iteration = 1) => {
      const currentSessions = get().sessions;
      const currentMessages = currentSessions[currentAgentName].messages;

      set({
        sessions: {
          ...currentSessions,
          [currentAgentName]: {
            ...currentSessions[currentAgentName],
            messages: currentMessages.map(msg =>
              msg.id === currentAssistantMessageId
                ? { ...msg, content: fullContent, isStreaming: true }
                : msg
            )
          }
        }
      });
    };

    const onDone = (fullResponse, sessionId, outputFromServer, iteration = 1, totalIterations = 1) => {
      const currentSessions = get().sessions;
      const currentMessages = currentSessions[currentAgentName].messages;

      // 优先使用服务端解析的输出，否则本地解析
      let output = outputFromServer || null;
      if (!output) {
        try {
          const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            output = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.error('JSON parse error:', e);
        }
      }
      // 只有当 output 是有效结果（非 parse_error）时才设为 extractResult
      const validExtract = output && !output.parse_error ? output : null;

      if (iteration > 1) {
        // 多版本：保留旧消息，创建新消息
        const newAssistantMessage = {
          role: 'assistant',
          content: fullResponse,
          id: Date.now(),
          iteration,
          isLatest: true,
          isStreaming: false,
          output,
        };
        const updatedMessages = currentMessages.map(msg =>
          msg.isLatest === false || (msg.id !== assistantMessageId && !msg.isLatest)
            ? msg
            : msg.isStreaming
              ? { ...msg, isStreaming: false, isLatest: false, replacedBy: newAssistantMessage.id, output }
              : msg
        );
        currentAssistantMessageId = newAssistantMessage.id;

        set({
          sessions: {
            ...currentSessions,
            [currentAgentName]: {
              sessionId,
              messages: [...updatedMessages, newAssistantMessage],
              isThinking: false,
              extractResult: (currentAgentName === 'case_extractor' || currentAgentName === 'schema_builder') ? validExtract : null
            }
          },
          reflectionIteration: 0,
          reflectionStatus: null,
        });
      } else {
        set({
          sessions: {
            ...currentSessions,
            [currentAgentName]: {
              sessionId,
              messages: currentMessages.map(msg =>
                msg.id === currentAssistantMessageId
                  ? { ...msg, content: fullResponse, isStreaming: false, output, iteration: 1, isLatest: true }
                  : msg
              ),
              isThinking: false,
              extractResult: (currentAgentName === 'case_extractor' || currentAgentName === 'schema_builder') ? validExtract : null
            }
          },
          reflectionIteration: 0,
          reflectionStatus: null,
        });
      }

      // 刷新历史列表
      get().loadSessionHistory(currentAgentName);
    };

    const onError = (error) => {
      const currentSessions = get().sessions;
      const currentMessages = currentSessions[currentAgentName].messages;

      set({
        sessions: {
          ...currentSessions,
          [currentAgentName]: {
            ...currentSessions[currentAgentName],
            messages: currentMessages.map(msg =>
              msg.id === currentAssistantMessageId
                ? { ...msg, content: `错误: ${error}`, isStreaming: false, isError: true }
                : msg
            ),
            isThinking: false
          }
        },
        reflectionIteration: 0,
        reflectionStatus: null,
      });
    };

    const onThinkingPhase = (data) => {
      set({
        reflectionIteration: data.iteration,
        reflectionStatus: data.status,
      });
    };

    const onIterationStart = (data) => {
      set({
        reflectionIteration: data.iteration,
        reflectionStatus: 'generating',
      });
    };

    await agentApi.invokeStream(
      currentAgentName,
      {
        session_id: session.sessionId,
        user_input: userInput,
        context,
        ...extraParams,
      },
      onChunk,
      onDone,
      onError,
      onThinkingPhase,
      onIterationStart,
    );
  },

  // Schema构建专用方法
  buildSchema: async (description) => {
    return get().invokeAgent(description);
  },

  // 案例拆解专用方法
  extractFromCase: async (schemaId, caseId, caseText) => {
    return get().invokeAgent(caseText, {
      schema_id: schemaId,
      case_id: caseId,
      case_text: caseText
    });
  },

  // 对话分析专用方法
  analyze: async (question, context = {}) => {
    return get().invokeAgent(question, context);
  },

  // 设置提取结果（用于前端直接设置）
  setExtractResult: (result) => {
    const { currentAgentName, sessions } = get();
    set({
      sessions: {
        ...sessions,
        [currentAgentName]: {
          ...sessions[currentAgentName],
          extractResult: result
        }
      }
    });
  }
}));
