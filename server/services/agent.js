import pool from '../db.js';
import { aiConfigCache } from '../config.js';
import { graphRagSearch } from './graphRag.js';
import https from 'https';
import http from 'http';

/**
 * 从 API 错误响应中提取有意义的错误信息（DRY helper，供 callAI 和 callAIStream 共用）
 */
function extractApiErrorMessage(data, statusCode, isStream = false) {
  let errorMsg = isStream
    ? `AI 流式 API 错误: HTTP ${statusCode}`
    : `AI API 错误: HTTP ${statusCode}`;
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    if (parsed.error?.message) errorMsg += ` - ${parsed.error.message}`;
    else if (parsed.message) errorMsg += ` - ${parsed.message}`;
    else if (parsed.choices?.[0]?.message?.content) errorMsg += ` - ${parsed.choices[0].message.content.slice(0, 200)}`;
    else if (typeof data === 'string' && data.length < 500) errorMsg += ` - ${data}`;
  } catch {
    if (typeof data === 'string' && data.length < 500) errorMsg += ` - ${data}`;
  }
  return errorMsg;
}

/**
 * 解析 AI 配置：用户配置优先，回退到全局缓存（环境变量 / 管理员配置）
 */
function resolveAiConfig(userConfig) {
  // 用户有配置时使用用户配置
  if (userConfig && userConfig.api_key) {
    return {
      apiKey: userConfig.api_key || userConfig.apiKey,
      endpoint: userConfig.endpoint,
      model: userConfig.model || 'glm-4-flash',
      temperature: parseFloat(userConfig.temperature ?? 0.7),
      maxTokens: parseInt(userConfig.max_tokens ?? 16384),
      useTemperature: userConfig.use_temperature !== undefined ? userConfig.use_temperature : true,
      useMaxTokens: userConfig.use_max_tokens !== undefined ? userConfig.use_max_tokens : true,
    };
  }
  // 回退到全局缓存（环境变量或管理员通过 API 设置的全局配置）
  if (aiConfigCache && aiConfigCache.apiKey && aiConfigCache.endpoint) {
    return {
      apiKey: aiConfigCache.apiKey,
      endpoint: aiConfigCache.endpoint,
      model: aiConfigCache.model || 'glm-4-flash',
      temperature: aiConfigCache.temperature ?? 0.7,
      maxTokens: aiConfigCache.maxTokens ?? 16384,
      useTemperature: aiConfigCache.useTemperature !== undefined ? aiConfigCache.useTemperature : true,
      useMaxTokens: aiConfigCache.useMaxTokens !== undefined ? aiConfigCache.useMaxTokens : true,
    };
  }
  // 两者都没有，返回 null 配置
  return {
    apiKey: null,
    endpoint: null,
    model: 'glm-4-flash',
    temperature: 0.7,
    maxTokens: 16384,
    useTemperature: true,
    useMaxTokens: true,
  };
}

// 内存中的 Agent 会话存储（带 TTL 清理，防止内存泄漏）
export const agentSessions = new Map();
const SESSION_TTL = 15 * 60 * 1000; // 15 分钟超时

// 定期清理过期会话（每 5 分钟执行一次）
let sessionCleanupStarted = false;
export function startSessionCleanup() {
  if (sessionCleanupStarted) return;
  sessionCleanupStarted = true;
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, session] of agentSessions.entries()) {
      const lastActive = session.lastActive || session.createdAt?.getTime() || 0;
      if (now - lastActive > SESSION_TTL) {
        agentSessions.delete(id);
        cleaned++;
      }
    }
    if (cleaned > 0) console.log(`[agentSessions] 清理了 ${cleaned} 个过期会话`);
  }, 5 * 60 * 1000);
}

// 更新会话活跃时间
export function touchSession(sessionId) {
  const session = agentSessions.get(sessionId);
  if (session) session.lastActive = Date.now();
}

// Agent 元数据缓存
let agentMetaCache = new Map();
let agentMetaCacheTime = 0;
const CACHE_TTL = 60000; // 60秒缓存

// 获取 Agent 元数据（带缓存）
export async function getAgentMeta(name) {
  const now = Date.now();
  if (now - agentMetaCacheTime > CACHE_TTL) {
    agentMetaCache.clear();
  }

  if (agentMetaCache.has(name)) {
    return agentMetaCache.get(name);
  }

  const result = await pool.query('SELECT * FROM agent_meta WHERE name = $1', [name]);
  if (result.rows.length > 0) {
    agentMetaCache.set(name, result.rows[0]);
    agentMetaCacheTime = now;
    return result.rows[0];
  }
  return null;
}

// Schema 上下文缓存（带 TTL，避免重复 DB 查询）
let schemaContextCache = new Map();
let schemaContextCacheTime = 0;
const SCHEMA_CONTEXT_CACHE_TTL = 60000; // 60秒缓存

/**
 * 加载 Schema 上下文（schema + entityTypes + relations），带缓存
 */
async function loadSchemaContext(schemaId) {
  if (!schemaId) return null;

  const now = Date.now();
  if (now - schemaContextCacheTime > SCHEMA_CONTEXT_CACHE_TTL) {
    schemaContextCache.clear();
    schemaContextCacheTime = now;
  }

  const cacheKey = `schema:${schemaId}`;
  if (schemaContextCache.has(cacheKey)) {
    return schemaContextCache.get(cacheKey);
  }

  const [schemaResult, entityTypesResult, relationsResult] = await Promise.all([
    pool.query('SELECT * FROM schemas WHERE id = $1', [schemaId]),
    pool.query('SELECT * FROM entity_types WHERE schema_id = $1', [schemaId]),
    pool.query('SELECT * FROM relations WHERE schema_id = $1', [schemaId])
  ]);
  if (schemaResult.rows.length === 0) return null;

  const context = {
    schema: {
      ...schemaResult.rows[0],
      entityTypes: entityTypesResult.rows,
      relations: relationsResult.rows
    }
  };
  schemaContextCache.set(cacheKey, context);
  return context;
}

// 构建 Agent 上下文（并行查询）
export async function buildAgentContext(agentName, context, userInput) {
  const result = {};

  switch (agentName) {
    case 'schema_builder':
      result.description = '用户正在构建新的知识图谱Schema结构';
      break;

    case 'case_extractor':
      const ceSchema = await loadSchemaContext(context?.schema_id);
      if (ceSchema) result.schema = ceSchema.schema;
      if (context?.case_id) {
        const caseResult = await pool.query('SELECT name, description FROM cases WHERE id = $1', [context.case_id]);
        result.case = caseResult.rows[0] || null;
      }
      if (context?.case_text) {
        result.case_text = context.case_text;
      }
      break;

    case 'analysis_assistant':
      result.chat_history = context?.chat_history || [];

      // 并行执行所有查询
      const queries = [];
      const queryKeys = [];

      // GraphRAG 混合检索（向量 + 全文 + 图扩展）
      queries.push(graphRagSearch(userInput, {
        schemaId: context?.schema_id,
        caseId: context?.case_id,
        limit: 15,
        depth: 2,
      }));
      queryKeys.push('rag_context');

      // 图谱统计
      queries.push(pool.query(`
        SELECT
          (SELECT COUNT(*) FROM cases WHERE schema_id = $1) as case_count,
          (SELECT COUNT(*) FROM case_entities ce JOIN cases c ON ce.case_id = c.id WHERE c.schema_id = $1) as entity_count,
          (SELECT COUNT(*) FROM case_relations cr JOIN cases c ON cr.case_id = c.id WHERE c.schema_id = $1) as relation_count
      `, [context?.schema_id || 0]));
      queryKeys.push('graph_stats');

      // 选中案例（如果有）
      if (context?.selected_case_id) {
        queries.push(Promise.all([
          pool.query('SELECT * FROM cases WHERE id = $1', [context.selected_case_id]),
          pool.query('SELECT * FROM case_entities WHERE case_id = $1', [context.selected_case_id])
        ]));
        queryKeys.push('selected_case');
      }

      // 选中节点（如果有）
      if (context?.selected_node_id) {
        queries.push(pool.query('SELECT * FROM case_entities WHERE id = $1', [context.selected_node_id]));
        queryKeys.push('selected_node');
      }

      // 并行执行并收集结果
      const queryResults = await Promise.all(queries);

      for (let i = 0; i < queryKeys.length; i++) {
        const key = queryKeys[i];
        const data = queryResults[i];

        if (key === 'rag_context') {
          // graphRagSearch 返回 { entities, cases, relations, subgraph }
          result[key] = {
            entities: data.entities || [],
            cases: data.cases || [],
            relations: data.relations || [],
            subgraph: data.subgraph || { nodes: [], edges: [] },
          };
        } else if (key === 'graph_stats') {
          result[key] = data.rows[0];
        } else if (key === 'selected_case') {
          const [caseRes, entitiesRes] = data;
          result[key] = {
            ...caseRes.rows[0],
            entities: entitiesRes.rows
          };
        } else if (key === 'selected_node') {
          result[key] = data.rows[0];
        }
      }
      break;

    case 'schema_analyzer':
      const saSchema = await loadSchemaContext(context?.schema_id);
      if (saSchema) result.schema = saSchema.schema;
      break;

    case 'text_parser':
      if (context?.case_text) result.case_text = context.case_text;
      if (context?.schema_id) {
        const tpSchema = await loadSchemaContext(context.schema_id);
        if (tpSchema) result.schema_entity_types = tpSchema.schema.entityTypes.map(e => e.name);
      }
      break;

    case 'extraction_planner':
      const epSchema = await loadSchemaContext(context?.schema_id);
      if (epSchema) result.schema = epSchema.schema;
      if (context?.case_id) {
        const segResult = await pool.query('SELECT * FROM text_segments WHERE case_id = $1 ORDER BY segment_index', [context.case_id]);
        result.text_segments = segResult.rows;
      }
      if (context?.schema_memory) result.schema_memory = context.schema_memory;
      break;

    case 'consistency_checker':
      if (context?.candidates) result.candidates = context.candidates;
      break;

    case 'relation_inferrer':
      if (context?.schema_id) {
        const riSchema = await loadSchemaContext(context.schema_id);
        if (riSchema) result.schema_relations = riSchema.schema.relations;
      }
      if (context?.case_id) {
        const caseResult = await pool.query('SELECT name, description FROM cases WHERE id = $1', [context.case_id]);
        result.case = caseResult.rows[0] || null;
      }
      if (context?.approved_entities) result.approved_entities = context.approved_entities;
      if (context?.text_segments) result.text_segments = context.text_segments;
      break;
  }

  return result;
}

/**
 * 格式化 Schema 上下文为可读文本（DRY helper）
 * @param {Object} schema - { entityTypes, relations }
 * @param {Object} options - { relationLabel } 关系部分标题
 * @returns {string} 格式化后的文本
 */
function formatSchemaContext(schema, options = {}) {
  const { relationLabel = '关系类型' } = options;
  const entityTypes = schema.entityTypes?.map(e => {
    const props = e.properties?.map(p => `${p.name}(${p.type})`).join(', ') || '无属性';
    return `- ${e.name}: [${props}]`;
  }).join('\n') || '';
  const relations = schema.relations?.map(r =>
    `- ${r.name}: ${r.from_entity_type} → ${r.to_entity_type}`
  ).join('\n') || '';
  return { entityTypes, relations, relationLabel };
}

// 构建系统提示
export function buildSystemPrompt(agent, context) {
  let prompt = agent.system_prompt || '';

  switch (agent.name) {
    case 'schema_builder':
      break;

    case 'case_extractor':
      if (context.schema) {
        const { entityTypes, relations } = formatSchemaContext(context.schema);
        prompt += `\n\n## 当前 Schema 结构\n\n### 实体类型\n${entityTypes}\n\n### 关系类型（实体之间的连接方式）\n${relations}`;
      }
      if (context.case) {
        prompt += `\n\n## 案例概述\n\n**名称**：${context.case.name}\n**描述**：${context.case.description || '暂无描述'}`;
      }
      if (context.case_text) {
        prompt += `\n\n## 待拆解的案例文本\n${context.case_text}`;
      }
      break;

    case 'schema_analyzer':
      if (context.schema) {
        const { entityTypes, relations } = formatSchemaContext(context.schema);
        prompt += `\n\n## Schema 定义\n\n实体类型：\n${entityTypes}\n\n关系类型：\n${relations}`;
      }
      break;

    case 'text_parser':
      if (context.case_text) {
        prompt += `\n\n## 待解析文本\n${context.case_text}`;
      }
      if (context.schema_entity_types) {
        prompt += `\n\n## 可能的实体类型\n${context.schema_entity_types.join('、')}`;
      }
      break;

    case 'extraction_planner':
      if (context.schema_memory) {
        prompt += `\n\n## Schema 记忆\n${context.schema_memory}`;
      }
      if (context.schema) {
        const entityTypes = context.schema.entityTypes?.map(e => e.name).join('、') || '';
        prompt += `\n\n## Schema 实体类型\n${entityTypes}`;
      }
      if (context.text_segments) {
        const totalHints = context.text_segments.reduce((sum, s) => sum + (s.entity_hints?.length || 0), 0);
        prompt += `\n\n## 文本概要\n共 ${context.text_segments.length} 个段落，${totalHints} 个实体线索`;
      }
      break;

    case 'consistency_checker':
      if (context.candidates) {
        prompt += `\n\n## 候选实体列表\n${context.candidates.map((c, i) => `${i}. ${c.name} (${c.entityType}): ${JSON.stringify(c.properties || {})}`).join('\n')}`;
      }
      break;

    case 'relation_inferrer':
      if (context.approved_entities) {
        prompt += `\n\n## 已确认实体\n${context.approved_entities.map(e => `- ${e.name} (${e.entityType}): ${JSON.stringify(e.properties || {})}`).join('\n')}`;
      }
      if (context.schema_relations) {
        const rels = context.schema_relations.map(r => `${r.name}: ${r.from_entity_type} → ${r.to_entity_type}`).join('\n');
        prompt += `\n\n## Schema 关系定义\n${rels}`;
      }
      if (context.case) {
        prompt += `\n\n## 案例概述\n**名称**：${context.case.name}\n**描述**：${context.case.description || '暂无描述'}`;
      }
      if (context.text_segments) {
        const text = context.text_segments.map(s => s.content).join('\n\n');
        prompt += `\n\n## 参考文本\n${text}`;
      }
      break;

    case 'analysis_assistant':
      if (context.graph_stats) {
        prompt += `\n\n## 当前图谱统计\n- 案例数：${context.graph_stats.case_count || 0}\n- 实体数：${context.graph_stats.entity_count || 0}\n- 关系数：${context.graph_stats.relation_count || 0}`;
      }
      if (context.rag_context) {
        const rag = context.rag_context;
        prompt += `\n\n## GraphRAG 检索结果（基于用户问题自动检索）\n`;
        if (rag.entities && rag.entities.length > 0) {
          prompt += `\n### 相关实体（${rag.entities.length} 个）\n`;
          rag.entities.slice(0, 10).forEach(e => {
            const props = e.properties ? Object.entries(e.properties).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', ') : '';
            prompt += `- 【${e.name}】(${e.entityType || ''}) — ${e.caseName ? `来自案例「${e.caseName}」` : ''}${props ? ` | ${props}` : ''}\n`;
          });
        }
        if (rag.relations && rag.relations.length > 0) {
          prompt += `\n### 图谱关系（${rag.relations.length} 条）\n`;
          rag.relations.slice(0, 15).forEach(r => {
            prompt += `- ${r.sourceName} --[${r.relationType}]--> ${r.targetName}\n`;
          });
        }
        if (rag.cases && rag.cases.length > 0) {
          prompt += `\n### 相关案例（${rag.cases.length} 个）\n`;
          rag.cases.slice(0, 5).forEach(c => {
            prompt += `- 【${c.name}】（相似度 ${(c.similarity || 0).toFixed(2)}）— ${(c.description || '').slice(0, 150)}\n`;
          });
        }
        if (rag.subgraph && rag.subgraph.nodes && rag.subgraph.nodes.length > 0) {
          prompt += `\n### 子图扩展\n`;
          prompt += `从检索结果扩展出 ${rag.subgraph.nodes.length} 个关联节点、${rag.subgraph.edges.length} 条关系边\n`;
        }
      }
      if (context.selected_case) {
        prompt += `\n\n## 当前选中案例\n名称：${context.selected_case.name}\n描述：${context.selected_case.description || '无'}\n实体数：${context.selected_case.entities?.length || 0}`;
      }
      if (context.selected_node) {
        prompt += `\n\n## 当前选中节点\n名称：${context.selected_node.name}\n类型：${context.selected_node.entity_type}\n属性：${JSON.stringify(context.selected_node.properties || {})}`;
      }
      break;
  }

  return prompt;
}

/**
 * 构建 AI 请求体（callAI 和 callAIStream 共享）
 */
function buildAiRequestBody(systemPrompt, messages, agent, cfg, extra = {}) {
  const requestBody = {
    model: cfg.model || 'glm-4-flash',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ],
    ...extra,
  };

  if (cfg.useTemperature) {
    requestBody.temperature = cfg.temperature || 0.7;
  }
  if (cfg.useMaxTokens) {
    requestBody.max_tokens = cfg.maxTokens || 4096;
  }

  // case_extractor 使用低温度以保证提取一致性
  if (agent.name === 'case_extractor') {
    requestBody.temperature = 0.3;
  }

  return requestBody;
}

// 调用 AI - 使用 node:https 而非 fetch（fetch 有 300s bodyTimeout 限制）
export async function callAI(systemPrompt, messages, agent, userConfig) {
  const cfg = resolveAiConfig(userConfig);
  if (!cfg.apiKey || !cfg.endpoint) {
    throw new Error('请先配置 AI API');
  }

  const requestBody = buildAiRequestBody(systemPrompt, messages, agent, cfg);

  const body = JSON.stringify(requestBody);
  const url = new URL(cfg.endpoint);
  const client = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 600000 // 10分钟超时
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(extractApiErrorMessage(data, res.statusCode)));
          return;
        }
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.choices?.[0]?.message?.content || '');
        } catch (e) {
          reject(new Error(`AI API JSON 解析失败: ${e.message}`));
        }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('AI API 调用超时，请稍后重试'));
    });
    req.write(body);
    req.end();
  });
}

// 流式调用 AI
export async function callAIStream(systemPrompt, messages, agent, onChunk, userConfig) {
  const cfg = resolveAiConfig(userConfig);
  if (!cfg.apiKey || !cfg.endpoint) {
    throw new Error('请先配置 AI API');
  }

  const requestBody = buildAiRequestBody(systemPrompt, messages, agent, cfg, { stream: true });

  const controller = new AbortController();
  const overallTimeout = setTimeout(() => controller.abort(), 600000); // 10分钟总超时
  const IDLE_TIMEOUT_MS = 120000; // 2分钟空闲超时（无数据到达时）
  let idleTimeout = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS);

  function resetIdleTimeout() {
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS);
  }

  const response = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify(requestBody),
    signal: controller.signal
  });

  clearTimeout(overallTimeout);
  clearTimeout(idleTimeout); // 清理空闲超时（避免响应错误时泄漏）

  if (!response.ok) {
    // 尝试从错误响应中提取有意义的错误信息
    const errorText = await response.text();
    throw new Error(extractApiErrorMessage(errorText, response.status, true));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let totalChunks = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      resetIdleTimeout(); // 收到数据则重置空闲超时
      totalChunks++;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留最后一行（可能跨 chunk 不完整）

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            // 检测 API 错误响应（流中可能返回 error 字段）
            if (parsed.error) {
              const errMsg = parsed.error.message || JSON.stringify(parsed.error);
              throw new Error(`AI 流式响应错误: ${errMsg}`);
            }
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              onChunk(content);
            }
          } catch (e) {
            // 如果是上述 throw 的 API 错误，重新抛出
            if (e.message && e.message.startsWith('AI 流式响应错误')) throw e;
            // 解析失败可能是 JSON 不完整，保留当前行到 buffer 供下次合并
            // 注意：需要保留 "data: " 前缀，否则下次迭代无法识别
            buffer = (buffer ? buffer + '\n' : '') + 'data: ' + line;
          }
        }
      }
    }
  } catch (err) {
    clearTimeout(idleTimeout); // 清理空闲超时
    if (err.name === 'AbortError') {
      throw new Error(`AI 流式调用超时（已接收 ${totalChunks} 个 chunk），请稍后重试`);
    }
    throw err;
  }
  clearTimeout(idleTimeout); // 流完成，清理空闲超时
}

// 解析 Agent 输出
export function parseAgentOutput(rawResponse, outputFormat) {
  if (outputFormat === 'json') {
    // 尝试多种方式提取 JSON
    let jsonStr = null;

    // 1. 从 markdown 代码块中提取
    const codeBlockMatch = rawResponse.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch (e) {
        console.warn('Code block JSON parse error:', e.message);
      }
    }

    // 2. 贪心正则匹配
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        // 3. 尝试找到平衡的 JSON 对象（处理嵌套大括号）
        const balancedJson = extractBalancedJson(jsonMatch[0]);
        if (balancedJson) {
          try {
            return JSON.parse(balancedJson);
          } catch (e2) {
            // 4. 尝试修复常见 JSON 问题（单引号、尾逗号）
            const fixedJson = balancedJson
              .replace(/'/g, '"')
              .replace(/,\s*([\]}])/g, '$1');
            try {
              return JSON.parse(fixedJson);
            } catch (e3) {
              console.error('All JSON parse attempts failed:', e3.message);
            }
          }
        }
      }
    }

    return { raw: rawResponse, parse_error: true };
  }
  return { content: rawResponse };
}

// 提取平衡的 JSON 对象（匹配成对的大括号）
function extractBalancedJson(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\' && inString) {
      escape = true;
      continue;
    }
    if (char === '"' && !escape) {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') depth++;
      if (char === '}') depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}