import pool from '../db.js';
import { aiConfigCache } from '../config.js';
import { graphRagSearch } from './graphRag.js';
import https from 'https';
import http from 'http';

/**
 * 解析 AI 配置：用户配置优先，回退到全局缓存
 */
function resolveAiConfig(userConfig) {
  // 只使用用户自己的配置，不回退全局缓存
  if (!userConfig || !userConfig.api_key) {
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

// 内存中的 Agent 会话存储
export const agentSessions = new Map();

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

// 构建 Agent 上下文（并行查询）
export async function buildAgentContext(agentName, context, userInput) {
  const result = {};

  switch (agentName) {
    case 'schema_builder':
      result.description = '用户正在构建新的知识图谱Schema结构';
      break;

    case 'case_extractor':
      if (context?.schema_id) {
        // 并行查询 schema 相关数据
        const [schemaResult, entityTypesResult, relationsResult] = await Promise.all([
          pool.query('SELECT * FROM schemas WHERE id = $1', [context.schema_id]),
          pool.query('SELECT * FROM entity_types WHERE schema_id = $1', [context.schema_id]),
          pool.query('SELECT * FROM relations WHERE schema_id = $1', [context.schema_id])
        ]);

        result.schema = {
          ...schemaResult.rows[0],
          entityTypes: entityTypesResult.rows,
          relations: relationsResult.rows
        };
      }
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
      if (context?.schema_id) {
        const [schemaResult, entityTypesResult, relationsResult] = await Promise.all([
          pool.query('SELECT * FROM schemas WHERE id = $1', [context.schema_id]),
          pool.query('SELECT * FROM entity_types WHERE schema_id = $1', [context.schema_id]),
          pool.query('SELECT * FROM relations WHERE schema_id = $1', [context.schema_id])
        ]);
        result.schema = {
          ...schemaResult.rows[0],
          entityTypes: entityTypesResult.rows,
          relations: relationsResult.rows
        };
      }
      break;

    case 'text_parser':
      if (context?.case_text) result.case_text = context.case_text;
      if (context?.schema_id) {
        const etResult = await pool.query('SELECT * FROM entity_types WHERE schema_id = $1', [context.schema_id]);
        result.schema_entity_types = etResult.rows.map(e => e.name);
      }
      break;

    case 'extraction_planner':
      if (context?.schema_id) {
        const [schemaResult, entityTypesResult, relationsResult] = await Promise.all([
          pool.query('SELECT * FROM schemas WHERE id = $1', [context.schema_id]),
          pool.query('SELECT * FROM entity_types WHERE schema_id = $1', [context.schema_id]),
          pool.query('SELECT * FROM relations WHERE schema_id = $1', [context.schema_id])
        ]);
        result.schema = {
          ...schemaResult.rows[0],
          entityTypes: entityTypesResult.rows,
          relations: relationsResult.rows
        };
      }
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
        const relResult = await pool.query('SELECT * FROM relations WHERE schema_id = $1', [context.schema_id]);
        result.schema_relations = relResult.rows;
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

// 构建系统提示
export function buildSystemPrompt(agent, context) {
  let prompt = agent.system_prompt || '';

  switch (agent.name) {
    case 'schema_builder':
      break;

    case 'case_extractor':
      if (context.schema) {
        const entityTypes = context.schema.entityTypes?.map(e => {
          const props = e.properties?.map(p => `${p.name}(${p.type})`).join(', ') || '无属性';
          return `- ${e.name}: [${props}]`;
        }).join('\n') || '';
        const relations = context.schema.relations?.map(r =>
          `- ${r.name}: ${r.from_entity_type} → ${r.to_entity_type}`
        ).join('\n') || '';

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
        const entityTypes = context.schema.entityTypes?.map(e => {
          const props = e.properties?.map(p => `${p.name}(${p.type})`).join(', ') || '无属性';
          return `- ${e.name}: [${props}]`;
        }).join('\n') || '';
        const relations = context.schema.relations?.map(r =>
          `- ${r.name}: ${r.from_entity_type} → ${r.to_entity_type}`
        ).join('\n') || '';
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

// 调用 AI - 使用 node:https 而非 fetch（fetch 有 300s bodyTimeout 限制）
export async function callAI(systemPrompt, messages, agent, userConfig) {
  const cfg = resolveAiConfig(userConfig);
  if (!cfg.apiKey || !cfg.endpoint) {
    throw new Error('请先配置 AI API');
  }

  const requestBody = {
    model: cfg.model || 'glm-4-flash',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ]
  };

  if (cfg.useTemperature) {
    requestBody.temperature = cfg.temperature || 0.7;
  }
  if (cfg.useMaxTokens) {
    requestBody.max_tokens = cfg.maxTokens || 4096;
  }

  if (agent.name === 'case_extractor') {
    requestBody.temperature = 0.3;
  }

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
          reject(new Error(`AI API 错误: HTTP ${res.statusCode} - ${data}`));
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

  const requestBody = {
    model: cfg.model || 'glm-4-flash',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ],
    stream: true
  };

  if (cfg.useTemperature) {
    requestBody.temperature = cfg.temperature || 0.7;
  }
  if (cfg.useMaxTokens) {
    requestBody.max_tokens = cfg.maxTokens || 4096;
  }

  if (agent.name === 'case_extractor') {
    requestBody.temperature = 0.3;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 600000); // 10分钟超时

  const response = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify(requestBody),
    signal: controller.signal
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API 错误: ${errorText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              onChunk(content);
            }
          } catch (e) {
            buffer = line;
          }
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('AI 流式调用超时，请稍后重试');
    }
    throw err;
  }
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

// 提取关键词
function extractKeywords(text) {
  const stopWords = ['的', '是', '在', '有', '和', '与', '或', '了', '吗', '什么', '怎么', '如何', '请', '帮我', '分析'];
  const words = text.split(/\s+|，|。|？|！|、/).filter(w => w.length > 1 && !stopWords.includes(w));
  return words.slice(0, 10);
}

// 简单 RAG 搜索
async function simpleRAGSearch(keywords, schemaId, caseId) {
  const results = [];

  try {
    let entityQuery = `
      SELECT e.id, e.name, e.entity_type, e.properties, e.case_id, c.name as case_name
      FROM case_entities e
      JOIN cases c ON e.case_id = c.id
      WHERE 1=1
    `;
    const entityParams = [];
    let idx = 1;

    if (schemaId) {
      entityQuery += ` AND c.schema_id = $${idx}`;
      entityParams.push(schemaId);
      idx++;
    }
    if (caseId) {
      entityQuery += ` AND e.case_id = $${idx}`;
      entityParams.push(caseId);
      idx++;
    }

    if (keywords.length > 0) {
      const keywordConditions = keywords.map(k => `e.name ILIKE $${idx++}`);
      entityQuery += ` AND (${keywordConditions.join(' OR ')})`;
      keywords.forEach(k => entityParams.push(`%${k}%`));
    }

    entityQuery += ` LIMIT 10`;
    const entitiesResult = await pool.query(entityQuery, entityParams);

    entitiesResult.rows.forEach(e => {
      results.push({
        type: 'entity',
        id: e.id,
        name: e.name,
        entity_type: e.entity_type,
        properties: e.properties,
        case_id: e.case_id,
        case_name: e.case_name
      });
    });

    let caseQuery = `
      SELECT id, name, description
      FROM cases
      WHERE 1=1
    `;
    const caseParams = [];
    idx = 1;

    if (schemaId) {
      caseQuery += ` AND schema_id = $${idx}`;
      caseParams.push(schemaId);
      idx++;
    }
    if (caseId) {
      caseQuery += ` AND id = $${idx}`;
      caseParams.push(caseId);
      idx++;
    }

    if (keywords.length > 0) {
      const keywordConditions = keywords.map(k => `(name ILIKE $${idx} OR description ILIKE $${idx++})`);
      caseQuery += ` AND (${keywordConditions.join(' OR ')})`;
      keywords.forEach(k => caseParams.push(`%${k}%`));
    }

    caseQuery += ` LIMIT 5`;
    const casesResult = await pool.query(caseQuery, caseParams);

    casesResult.rows.forEach(c => {
      results.push({
        type: 'case',
        id: c.id,
        name: c.name,
        description: c.description
      });
    });

  } catch (error) {
    console.error('Simple RAG search error:', error);
  }

  return results;
}