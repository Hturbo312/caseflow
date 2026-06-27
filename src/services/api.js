// API 服务层 - 封装所有后端API调用
import { API_BASE_URL, TOKEN_KEY, authHelper } from '../utils';

// 通用请求函数
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = authHelper.getToken();

  console.log(`API请求: ${options.method || 'GET'} ${url}`, { hasToken: !!token });

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    const contentType = response.headers.get('content-type') || '';

    // 非 JSON 响应（如 502、nginx 错误页等）
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      const preview = text.substring(0, 100).replace(/<[^>]*>/g, '').trim();
      throw new Error(`服务器返回非 JSON 响应 (HTTP ${response.status})：${preview || '未知错误'}`);
    }

    const data = await response.json();

    if (!response.ok) {
      // 如果是认证错误，清除token
      if (response.status === 401 && data.requireAuth) {
        console.log('认证失败，清除token');
        authHelper.removeToken();
      }
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
    if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
      console.error(`API Error [${endpoint}]: 响应不是有效的 JSON 格式`);
      throw new Error('API 响应格式异常，请检查后端服务是否正常运行');
    }
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

// ============================================
// Schema API
// ============================================
export const schemaApi = {
  // 获取所有 Schema
  getAll: () => request('/schemas'),

  // 获取单个 Schema 详情
  getById: (id) => request(`/schemas/${id}`),

  // 创建 Schema
  create: (data) => request('/schemas', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // 删除 Schema
  delete: (id) => request(`/schemas/${id}`, {
    method: 'DELETE',
  }),

  // 更新 Schema
  update: (id, data) => request(`/schemas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // 添加实体类型
  addEntityType: (schemaId, data) => request(`/schemas/${schemaId}/entity-types`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // 更新实体类型
  updateEntityType: (schemaId, entityTypeId, data) => request(`/schemas/${schemaId}/entity-types/${entityTypeId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // 删除实体类型
  deleteEntityType: (schemaId, entityTypeId) => request(`/schemas/${schemaId}/entity-types/${entityTypeId}`, {
    method: 'DELETE',
  }),

  // 添加关系定义
  addRelation: (schemaId, data) => request(`/schemas/${schemaId}/relations`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // 更新关系定义
  updateRelation: (schemaId, relationId, data) => request(`/schemas/${schemaId}/relations/${relationId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // 删除关系定义
  deleteRelation: (schemaId, relationId) => request(`/schemas/${schemaId}/relations/${relationId}`, {
    method: 'DELETE',
  }),
};

// ============================================
// Case API
// ============================================
export const caseApi = {
  // 获取所有案例
  getAll: () => request('/cases'),

  // 获取单个案例详情（包含实体和关系）
  getById: (id) => request(`/cases/${id}`),

  // 创建案例
  create: (data) => request('/cases', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // 删除案例
  delete: (id) => request(`/cases/${id}`, {
    method: 'DELETE',
  }),

  // 添加实体
  addEntity: (caseId, data) => request(`/cases/${caseId}/entities`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // 删除实体
  deleteEntity: (caseId, entityId) => request(`/cases/${caseId}/entities/${entityId}`, {
    method: 'DELETE',
  }),

  // 添加关系
  addRelation: (caseId, data) => request(`/cases/${caseId}/relations`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // 删除关系
  deleteRelation: (caseId, relationId) => request(`/cases/${caseId}/relations/${relationId}`, {
    method: 'DELETE',
  }),
};

// ============================================
// Graph API (AGE)
// ============================================
export const graphApi = {
  // 获取所有图
  getAll: () => request('/graphs'),

  // 创建图
  create: (name) => request('/graphs', {
    method: 'POST',
    body: JSON.stringify({ name }),
  }),

  // 创建节点
  createNode: (graphName, data) => request(`/graphs/${graphName}/nodes`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // 获取节点
  getNodes: (graphName, label) => request(`/graphs/${graphName}/nodes?label=${label || ''}`),

  // 创建边
  createEdge: (graphName, data) => request(`/graphs/${graphName}/edges`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // 获取边
  getEdges: (graphName) => request(`/graphs/${graphName}/edges`),

  // 删除图
  delete: (graphName) => request(`/graphs/${graphName}`, {
    method: 'DELETE',
  }),
};

// ============================================
// AI API
// ============================================
export const aiApi = {
  // 发送消息
  chat: (message, context) => request('/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message, context }),
  }),

  // 获取配置状态
  getConfig: () => request('/ai/config'),

  // 保存配置
  saveConfig: (config) => request('/ai/config', {
    method: 'POST',
    body: JSON.stringify(config),
  }),

  // 删除配置
  deleteConfig: () => request('/ai/config', {
    method: 'DELETE',
  }),

  // AI 代理请求
  proxy: (messages, options = {}) => request('/ai/proxy', {
    method: 'POST',
    body: JSON.stringify({ messages, ...options }),
  }),
};

// ============================================
// Agent API
// ============================================
export const agentApi = {
  // 获取所有 Agent
  getAll: () => request('/agents'),

  // 获取单个 Agent 详情
  getByName: (name) => request(`/agents/${name}`),

  // 调用 Agent
  invoke: (agentName, params) => request(`/agents/${agentName}/invoke`, {
    method: 'POST',
    body: JSON.stringify(params),
  }),

  // 流式调用 Agent (SSE)
  invokeStream: async (agentName, params, onChunk, onDone, onError, onThinkingPhase, onIterationStart) => {
    const token = authHelper.getToken();
    const url = `${API_BASE_URL}/agents/${agentName}/invoke/stream`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        onError(error.error || '请求失败');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let sessionId = null;
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        // 保留最后一个不完整的片段
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);

              if (parsed.type === 'session_id') {
                sessionId = parsed.session_id;
              } else if (parsed.type === 'chunk') {
                fullResponse += parsed.content;
                onChunk(parsed.content, fullResponse, parsed.iteration);
              } else if (parsed.type === 'done') {
                onDone(parsed.full_response, sessionId, parsed.output, parsed.iteration, parsed.totalIterations);
              } else if (parsed.type === 'error') {
                onError(parsed.error);
              } else if (parsed.type === 'thinking_phase') {
                if (onThinkingPhase) onThinkingPhase(parsed);
              } else if (parsed.type === 'iteration_start') {
                if (onIterationStart) onIterationStart(parsed);
              }
            } catch (e) {
              // 不完整的JSON，丢弃该行
            }
          }
        }
      }
    } catch (error) {
      onError(error.message);
    }
  },

  // 清除 Agent 会话
  clearSession: (agentName, sessionId) => request(`/agents/${agentName}/sessions/${sessionId}`, {
    method: 'DELETE',
  }),
};

// ============================================
// RAG API
// ============================================
export const ragApi = {
  // 获取嵌入统计
  getStats: () => request('/rag/stats'),

  // 为实体生成嵌入
  embedEntities: (caseId, force = false) => request('/rag/embed-entities', {
    method: 'POST',
    body: JSON.stringify({ caseId, force }),
  }),

  // 混合检索
  search: (query, options = {}) => request('/rag/search', {
    method: 'POST',
    body: JSON.stringify({ query, ...options }),
  }),

  // GraphRAG 问答
  ask: (question, options = {}) => request('/rag/ask', {
    method: 'POST',
    body: JSON.stringify({ question, ...options }),
  }),
};

// ============================================
// Extraction Pipeline API
// ============================================
export const extractionApi = {
  // 进度
  getProgress: (caseId) => request(`/extraction/${caseId}/progress`),
  getPlan: (caseId) => request(`/extraction/${caseId}/plan`),

  // 流水线步骤
  schemaAnalyze: (caseId, schemaId) => request(`/extraction/${caseId}/schema-analyze`, {
    method: 'POST', body: JSON.stringify({ schemaId }),
  }),
  parseText: (caseId, caseText, schemaId) => request(`/extraction/${caseId}/parse-text`, {
    method: 'POST', body: JSON.stringify({ caseText, schemaId }),
  }),
  generatePlan: (caseId, schemaId) => request(`/extraction/${caseId}/plan`, {
    method: 'POST', body: JSON.stringify({ schemaId }),
  }),
  extractEntities: (caseId, entityType, schemaId) => request(`/extraction/${caseId}/extract/${entityType}`, {
    method: 'POST', body: JSON.stringify({ schemaId }),
  }),
  extractAllEntities: (caseId, schemaId) => request(`/extraction/${caseId}/extract-all`, {
    method: 'POST', body: JSON.stringify({ schemaId }),
  }),
  checkConsistency: (caseId, entityType, candidates) => request(`/extraction/${caseId}/check-consistency/${entityType}`, {
    method: 'POST', body: JSON.stringify({ candidates }),
  }),
  inferRelations: (caseId, schemaId, candidates) => request(`/extraction/${caseId}/infer-relations`, {
    method: 'POST', body: JSON.stringify({ schemaId, candidates }),
  }),

  // 保存
  saveEntity: (caseId, entity) => request(`/extraction/${caseId}/save-entity`, {
    method: 'POST', body: JSON.stringify(entity),
  }),
  batchSaveEntities: (caseId, entities) => request(`/extraction/${caseId}/batch-save-entities`, {
    method: 'POST', body: JSON.stringify({ entities }),
  }),
  saveRelation: (caseId, relation) => request(`/extraction/${caseId}/save-relation`, {
    method: 'POST', body: JSON.stringify(relation),
  }),
  finalize: (caseId) => request(`/extraction/${caseId}/finalize`, {
    method: 'POST',
  }),

  // 查看
  getSegments: (caseId) => request(`/extraction/${caseId}/segments`),
  getCaseMemory: (caseId) => request(`/extraction/${caseId}/memory`),
  getSchemaMemory: (schemaId) => request(`/extraction/schema/${schemaId}/memory`),
};

// ============================================
// Health Check
// ============================================
export const healthCheck = () => request('/health');

// ============================================
// Auth API
// ============================================
export const authApi = {
  // 注册
  register: async (username, password, email) => {
    const data = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, email }),
    });
    if (data.token) {
      authHelper.setToken(data.token);
    }
    return data;
  },

  // 登录
  login: async (username, password) => {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (data.token) {
      authHelper.setToken(data.token);
    }
    return data;
  },

  // 登出
  logout: () => {
    authHelper.removeToken();
    return Promise.resolve({ success: true });
  },

  // 验证 token
  verify: () => request('/auth/verify'),
};

// ============================================
// Chat History API
// ============================================
export const chatApi = {
  // 获取会话列表
  getSessions: (agentName) => request(`/chat/sessions?agent_name=${agentName || ''}`),

  // 获取特定会话的聊天历史
  getSessionHistory: (sessionId) => request(`/chat/sessions/${sessionId}/history`),

  // 更新会话标题
  updateSessionTitle: (sessionId, title) => request(`/chat/sessions/${sessionId}/title`, {
    method: 'PUT',
    body: JSON.stringify({ title }),
  }),

  // 删除会话
  deleteSession: (agentName, sessionId) => request(`/agents/${agentName}/sessions/${sessionId}`, {
    method: 'DELETE',
  }),
};