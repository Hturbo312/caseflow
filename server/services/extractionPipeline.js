import pool from '../db.js';
import { getAgentMeta, buildAgentContext, buildSystemPrompt, callAI, parseAgentOutput } from './agent.js';

// ============================================================
// 多轮提取流水线服务
// 核心原则：全文只读一次构建 Text IR，后续按类型过滤片段提取
// ============================================================

// 辅助：计算文本 hash
function textHash(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

// 辅助：确保 case_memory 存在
async function ensureCaseMemory(caseId, textSummary = null) {
  const existing = await pool.query('SELECT id FROM case_memory WHERE case_id = $1', [caseId]);
  if (existing.rows.length === 0) {
    const mdContent = `# 案例记忆\n\n## 状态：初始化\n## 最后更新：${new Date().toISOString()}\n`;
    return await pool.query(
      'INSERT INTO case_memory (case_id, md_content, text_summary, extraction_progress, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [caseId, mdContent, textSummary ? JSON.stringify(textSummary) : null, '{}', 'in_progress']
    );
  }
  return await pool.query('SELECT * FROM case_memory WHERE case_id = $1', [caseId]);
}

// 辅助：更新进度
async function updateProgress(caseId, updater) {
  const result = await pool.query('SELECT extraction_progress FROM case_memory WHERE case_id = $1', [caseId]);
  const current = result.rows[0]?.extraction_progress || {};
  const updated = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
  await pool.query(
    'UPDATE case_memory SET extraction_progress = $1, updated_at = CURRENT_TIMESTAMP WHERE case_id = $2',
    [JSON.stringify(updated), caseId]
  );
  return updated;
}

// ============================================================
// Step 0: Schema 分析
// ============================================================
export async function runSchemaAnalysis(schemaId) {
  const agent = await getAgentMeta('schema_analyzer');
  if (!agent) throw new Error('Agent schema_analyzer not found');

  const context = { schema_id: schemaId };
  const fullContext = await buildAgentContext('schema_analyzer', context, '');
  const systemPrompt = buildSystemPrompt(agent, fullContext);

  const aiResponse = await callAI(systemPrompt, [{ role: 'user', content: '请分析这个 Schema 结构。' }], agent);
  const mdContent = aiResponse.trim();

  // 获取当前版本
  const versionResult = await pool.query('SELECT COALESCE(MAX(version), 0) as max_ver FROM schema_memory WHERE schema_id = $1', [schemaId]);
  const newVersion = (versionResult.rows[0]?.max_ver || 0) + 1;

  await pool.query(
    'INSERT INTO schema_memory (schema_id, md_content, version) VALUES ($1, $2, $3)',
    [schemaId, mdContent, newVersion]
  );

  return { version: newVersion, content: mdContent };
}

// ============================================================
// Step 1: 文本解析（规则切分，不调用LLM）
// 按段落拆分为 text_segments，entity_hints 留空 —— 后续 case_extractor
// 会通过 reread 路径直接搜索，无需预先线索。
// ============================================================
export async function parseCaseText(caseId, caseText, schemaId) {
  const hash = textHash(caseText);
  const existing = await pool.query('SELECT id FROM text_segments WHERE case_id = $1', [caseId]);
  if (existing.rows.length > 0) {
    await pool.query('DELETE FROM text_segments WHERE case_id = $1', [caseId]);
  }

  // 按段落切分，每段一个 segment，entity_hints 为空
  const paragraphs = caseText.split(/\n+/).filter(p => p.trim());
  const segments = paragraphs.map((content, i) => ({
    index: i,
    content: content.trim(),
    entity_hints: []
  }));

  // 优化：批量 INSERT 代替 N 次独立查询
  if (segments.length > 0) {
    const values = segments.map((s, i) => {
      const base = i * 3;
      return `($1, $${base + 2}, $${base + 3}, $${base + 4})`;
    }).join(', ');
    const params = [caseId];
    segments.forEach(s => {
      params.push(s.index, s.content, JSON.stringify(s.entity_hints));
    });

    await pool.query(
      `INSERT INTO text_segments (case_id, segment_index, content, entity_hints) VALUES ${values}`,
      params
    );
  }

  const summary = { global_summary: caseText.slice(0, 200), segment_count: segments.length, hash };
  await ensureCaseMemory(caseId, summary);
  await updateProgress(caseId, (p) => ({ ...p, text_parsed: true, text_hash: hash }));

  console.log(`[parseCaseText] 规则切分：${segments.length} 个段落，0 hints（由 case_extractor 后续回读提取）`);
  return { global_summary: summary.global_summary, segments, hint_count: 0, chunked: false };
}

// ============================================================
// Step 2: 提取规划
// ============================================================
export async function generateExtractionPlan(caseId, schemaId) {
  // 获取 schema 定义
  const [schemaResult, entityTypesResult, relationsResult] = await Promise.all([
    pool.query('SELECT * FROM schemas WHERE id = $1', [schemaId]),
    pool.query('SELECT * FROM entity_types WHERE schema_id = $1', [schemaId]),
    pool.query('SELECT * FROM relations WHERE schema_id = $1', [schemaId])
  ]);

  // 统计 hints
  const segResult = await pool.query('SELECT segment_index, entity_hints FROM text_segments WHERE case_id = $1 ORDER BY segment_index', [caseId]);
  const segments = segResult.rows;

  const hintCounts = {};
  let totalHints = 0;
  entityTypesResult.rows.forEach(et => {
    hintCounts[et.name] = segments.reduce((sum, s) =>
      sum + (s.entity_hints?.filter(h => h.type === et.name).length || 0), 0
    );
    totalHints += hintCounts[et.name];
  });

  // 没有 hints 时跳过 LLM 调用，直接生成确定性计划
  if (totalHints === 0) {
    console.log(`[generateExtractionPlan] 无 hints，跳过 LLM 直接生成计划`);
    const plan = entityTypesResult.rows
      .map(et => ({ entity_type: et.name, priority: 0, hint_count: 0, reason: '默认计划（无线索）' }))
      .sort((a, b) => a.entity_type.localeCompare(b.entity_type))
      .map((p, i) => ({ ...p, priority: i + 1 }));
    await updateProgress(caseId, (p) => ({ ...p, plan }));
    return { plan };
  }

  // 有 hints 时调用 LLM 生成计划
  const agent = await getAgentMeta('extraction_planner');
  if (!agent) throw new Error('Agent extraction_planner not found');

  const memResult = await pool.query('SELECT md_content FROM schema_memory WHERE schema_id = $1 ORDER BY version DESC LIMIT 1', [schemaId]);
  const schemaMemory = memResult.rows[0]?.md_content || null;

  const context = {
    schema_id: schemaId,
    case_id: caseId,
    schema_memory: schemaMemory,
    hint_summary: Object.entries(hintCounts).map(([k, v]) => `${k}: ${v}`).join(', ')
  };

  const fullContext = await buildAgentContext('extraction_planner', context, '');
  const systemPrompt = buildSystemPrompt(agent, fullContext);

  const aiResponse = await callAI(systemPrompt, [
    { role: 'user', content: `当前 Schema 有 ${entityTypesResult.rows.length} 个实体类型，各类型线索数：${context.hint_summary}。请生成提取计划。` }
  ], agent);

  const output = parseAgentOutput(aiResponse, agent.output_format);
  if (output.parse_error) {
    // fallback: 按 hint_count 排序
    const plan = entityTypesResult.rows
      .map(et => ({ entity_type: et.name, priority: 0, hint_count: hintCounts[et.name] || 0, reason: '自动生成' }))
      .sort((a, b) => b.hint_count - a.hint_count)
      .map((p, i) => ({ ...p, priority: i + 1 }));
    await updateProgress(caseId, (p) => ({ ...p, plan }));
    return { plan };
  }

  const plan = output.plan || [];
  // 补齐未包含的类型
  const plannedTypes = new Set(plan.map(p => p.entity_type));
  entityTypesResult.rows.forEach(et => {
    if (!plannedTypes.has(et.name)) {
      plan.push({ entity_type: et.name, priority: plan.length + 1, hint_count: hintCounts[et.name] || 0, reason: '补充' });
    }
  });

  await updateProgress(caseId, (p) => ({ ...p, plan }));
  return { plan };
}

// ============================================================
// Step 3: 按类型提取实体（只读相关片段，不重读全文）
// ============================================================
export async function extractEntities(caseId, entityType, schemaId) {
  // 获取该 case 的所有 text segments
  const segResult = await pool.query('SELECT * FROM text_segments WHERE case_id = $1 ORDER BY segment_index', [caseId]);
  const segments = segResult.rows;

  // 从 Text IR 中过滤该类型的 hints
  const hints = [];
  segments.forEach(s => {
    (s.entity_hints || []).forEach(h => {
      if (h.type === entityType) {
        hints.push({ ...h, segment_index: s.segment_index, segment_content: s.content });
      }
    });
  });

  // 如果 hints 太少，触发回读
  if (hints.length === 0) {
    return await rereadForEntity(caseId, entityType, schemaId, segments);
  }

  // 从相关片段中提取详细属性
  const agent = await getAgentMeta('case_extractor');
  if (!agent) throw new Error('Agent case_extractor not found');

  // 获取 schema 定义
  const entityTypesResult = await pool.query('SELECT * FROM entity_types WHERE schema_id = $1', [schemaId]);
  const etDef = entityTypesResult.rows.find(e => e.name === entityType);
  const props = etDef?.properties || [];

  // 获取该类型相关的关系类型描述
  const relationsResult = await pool.query('SELECT * FROM relations WHERE schema_id = $1', [schemaId]);
  const relatedRels = relationsResult.rows.filter(r =>
    r.from_entity_type === entityType || r.to_entity_type === entityType
  );
  const relContext = relatedRels.length > 0
    ? `\n\n注意：该类型在关系「${relatedRels.map(r => r.name).join('、')}」中与 ${relatedRels.map(r => r.from_entity_type === entityType ? r.to_entity_type : r.from_entity_type).join('、')} 类型相连。`
    : '';

  const relevantSegments = hints.slice(0, 10).map(h => h.segment_content).join('\n\n');

  const context = {
    schema_id: schemaId,
    case_id: caseId,
    case_text: `请从以下文本片段中提取「${entityType}」类型的实体（属性定义：${props.map(p => `${p.name}(${p.type})`).join(', ')}）：\n\n${relevantSegments}`
  };

  const fullContext = await buildAgentContext('case_extractor', context, `请提取所有${entityType}类型的实体，输出JSON格式。`);
  const systemPrompt = buildSystemPrompt(agent, fullContext) + `\n\n## 当前任务\n请专注于提取「${entityType}」类型的实体。只输出 entities 数组，每个实体包含 name、entityType="${entityType}"、properties。relations 输出为空数组。${relContext}`;

  const aiResponse = await callAI(systemPrompt, [
    { role: 'user', content: `请提取所有${entityType}类型的实体，只输出JSON。` }
  ], agent);

  const output = parseAgentOutput(aiResponse, agent.output_format);
  const entities = (output.entities || []).map((e, i) => ({
    id: `candidate-${entityType}-${i}`,
    name: e.name,
    entityType: entityType,
    properties: e.properties || {},
    evidence: hints.find(h => h.name === e.name)?.segment_content || '',
    status: 'pending'
  }));

  await updateProgress(caseId, (p) => {
    const types = p.types || {};
    types[entityType] = { status: 'extracted', count: entities.length, hints_from_ir: hints.length };
    return { ...p, types };
  });

  return { entities, hints_from_ir: hints.length };
}

// 辅助：将文本段落按大小分块（段落边界切分）
function chunkParagraphs(segments, maxChars = 4000) {
  const chunks = [];
  let current = [];
  let currentLen = 0;
  for (const s of segments) {
    const len = s.content.length + 2; // +2 for \n\n
    if (currentLen + len > maxChars && current.length > 0) {
      chunks.push(current);
      current = [s];
      currentLen = len;
    } else {
      current.push(s);
      currentLen += len;
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

// 回读：当 Text IR 中没有该类型线索时触发
// 优化：长文本分块并行处理，避免单次 LLM 调用过长
async function rereadForEntity(caseId, entityType, schemaId, segments) {
  const agent = await getAgentMeta('case_extractor');
  if (!agent) throw new Error('Agent case_extractor not found');

  const entityTypesResult = await pool.query('SELECT * FROM entity_types WHERE schema_id = $1', [schemaId]);
  const etDef = entityTypesResult.rows.find(e => e.name === entityType);
  const props = etDef?.properties || [];

  // 获取该类型相关的关系类型描述
  const relationsResult = await pool.query('SELECT * FROM relations WHERE schema_id = $1', [schemaId]);
  const relatedRels = relationsResult.rows.filter(r =>
    r.from_entity_type === entityType || r.to_entity_type === entityType
  );
  const relContext = relatedRels.length > 0
    ? `\n\n注意：该类型在关系「${relatedRels.map(r => r.name).join('、')}」中与 ${relatedRels.map(r => r.from_entity_type === entityType ? r.to_entity_type : r.from_entity_type).join('、')} 类型相连。`
    : '';

  // 长文本分块处理
  const chunks = chunkParagraphs(segments, 4000);
  const allEntities = [];

  if (chunks.length > 1) {
    console.log(`[rereadForEntity] ${entityType}: ${segments.length} 段落，分 ${chunks.length} 块并行处理`);

    const results = await Promise.allSettled(
      chunks.map(async (chunkSegments, idx) => {
        const textContent = chunkSegments.map(s => s.content).join('\n\n');
        const context = {
          schema_id: schemaId,
          case_id: caseId,
          case_text: `请从以下文本（第${idx + 1}/${chunks.length}块）中提取「${entityType}」类型的实体（属性定义：${props.map(p => `${p.name}(${p.type})`).join(', ')}）：\n\n${textContent}`
        };
        const fullContext = await buildAgentContext('case_extractor', context, `请搜索文本中可能包含的${entityType}实体。`);
        const systemPrompt = buildSystemPrompt(agent, fullContext) + `\n\n## 当前任务\n仔细搜索文本中所有可能的「${entityType}」类型实体。这是回读搜索，宁可多提取，不要漏掉。只输出JSON格式的entities数组。${relContext}`;
        const aiResponse = await callAI(systemPrompt, [
          { role: 'user', content: `请搜索文本中所有${entityType}类型的实体，只输出JSON。` }
        ], agent);
        const output = parseAgentOutput(aiResponse, agent.output_format);
        return (output.entities || []).map((e, i) => ({
          name: e.name,
          entityType: entityType,
          properties: e.properties || {},
        }));
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allEntities.push(...result.value);
      } else {
        console.error(`[rereadForEntity] 块处理失败: ${result.reason?.message}`);
      }
    }

    // 按名称去重
    const deduped = new Map();
    for (const e of allEntities) {
      const key = e.name.trim().toLowerCase();
      if (!deduped.has(key)) {
        deduped.set(key, e);
      } else {
        // 合并属性
        Object.assign(deduped.get(key).properties, e.properties || {});
      }
    }
    const entities = [...deduped.values()].map((e, i) => ({
      id: `candidate-${entityType}-${i}`,
      ...e,
      evidence: '',
      status: 'pending'
    }));

    console.log(`[rereadForEntity] ${entityType}: 合并后 ${entities.length} 个实体（来自 ${chunks.length} 块）`);

    await updateProgress(caseId, (p) => {
      const types = p.types || {};
      types[entityType] = { status: 'extracted_reread', count: entities.length, hints_from_ir: 0, chunked: true };
      return { ...p, types };
    });

    return { entities, hints_from_ir: 0, reread: true, chunked: true };
  }

  // 文本较短，单次处理
  const textContent = segments.map(s => s.content).join('\n\n');

  const context = {
    schema_id: schemaId,
    case_id: caseId,
    case_text: `请从以下文本中提取「${entityType}」类型的实体（属性定义：${props.map(p => `${p.name}(${p.type})`).join(', ')}）：\n\n${textContent}`
  };

  const fullContext = await buildAgentContext('case_extractor', context, `请搜索文本中可能包含的${entityType}实体。`);
  const systemPrompt = buildSystemPrompt(agent, fullContext) + `\n\n## 当前任务\n仔细搜索文本中所有可能的「${entityType}」类型实体。这是回读搜索，宁可多提取，不要漏掉。只输出JSON格式的entities数组。${relContext}`;

  const aiResponse = await callAI(systemPrompt, [
    { role: 'user', content: `请搜索文本中所有${entityType}类型的实体，只输出JSON。` }
  ], agent);

  const output = parseAgentOutput(aiResponse, agent.output_format);
  const entities = (output.entities || []).map((e, i) => ({
    id: `candidate-${entityType}-${i}`,
    name: e.name,
    entityType: entityType,
    properties: e.properties || {},
    evidence: '',
    status: 'pending'
  }));

  await updateProgress(caseId, (p) => {
    const types = p.types || {};
    types[entityType] = { status: 'extracted_reread', count: entities.length, hints_from_ir: 0 };
    return { ...p, types };
  });

  return { entities, hints_from_ir: 0, reread: true };
}

// ============================================================
// Step 3b: 并行提取所有类型实体
// ============================================================
export async function extractAllEntities(caseId, schemaId) {
  const entityTypesResult = await pool.query('SELECT name FROM entity_types WHERE schema_id = $1', [schemaId]);
  const entityTypes = entityTypesResult.rows.map(r => r.name);

  console.log(`[extractAllEntities] 开始并行提取 ${entityTypes.length} 个类型`);

  // 更新进度
  await updateProgress(caseId, (p) => ({ ...p, types: {}, extraction_mode: 'parallel' }));

  const results = await Promise.allSettled(
    entityTypes.map(async (entityType) => {
      const result = await extractEntities(caseId, entityType, schemaId);
      return { entityType, success: true, entities: result.entities || [], count: result.entities?.length || 0 };
    })
  );

  const allCandidates = {};
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allCandidates[result.value.entityType] = result.value.entities;
    } else {
      console.error(`[extractAllEntities] ${result.reason?.message || result.reason}`);
    }
  }

  console.log(`[extractAllEntities] 完成:`, Object.fromEntries(Object.entries(allCandidates).map(([k, v]) => [k, v.length])));
  return { candidates: allCandidates, total: Object.values(allCandidates).flat().length };
}

// ============================================================
// Step 4: 一致性检查（去重合并）
// ============================================================
export async function checkConsistency(caseId, entityType, candidates) {
  if (!candidates || candidates.length < 2) {
    return { candidates, merge_groups: [], deduplicated: candidates };
  }

  // 先做简单的基于名称的去重
  const byName = {};
  candidates.forEach(c => {
    const key = c.name.trim().toLowerCase();
    if (!byName[key]) byName[key] = [];
    byName[key].push(c);
  });

  const mergeGroups = [];
  const uniqueEntities = [];

  for (const [key, group] of Object.entries(byName)) {
    if (group.length > 1) {
      // 合并：取第一个的属性，补充后续的属性
      const merged = { ...group[0] };
      const mergedProps = { ...merged.properties };
      group.forEach(c => {
        Object.assign(mergedProps, c.properties || {});
      });
      merged.properties = mergedProps;
      merged.merged_from = group.map(c => c.id);
      merged.status = 'pending';
      mergeGroups.push(merged);
    } else {
      uniqueEntities.push(group[0]);
    }
  }

  // 如果还有较多候选，调用 AI 做深度相似度检查
  if (candidates.length > 5) {
    try {
      const agent = await getAgentMeta('consistency_checker');
      if (agent) {
        const context = { candidates: candidates.map(c => ({ name: c.name, entityType: c.entityType, properties: c.properties })) };
        const fullContext = await buildAgentContext('consistency_checker', context, '');
        const systemPrompt = buildSystemPrompt(agent, fullContext);
        const aiResponse = await callAI(systemPrompt, [
          { role: 'user', content: '请检查这些实体中是否有重复项需要合并。' }
        ], agent);

        const output = parseAgentOutput(aiResponse, agent.output_format);
        if (!output.parse_error && output.merge_groups?.length > 0) {
          // AI 建议的合并
          output.merge_groups.forEach(g => {
            const mergedEntities = g.merged_from.map(i => candidates[i]).filter(Boolean);
            if (mergedEntities.length > 1) {
              const merged = { ...mergedEntities[0], merged_from: mergedEntities.map(e => e.id), status: 'pending' };
              Object.assign(merged.properties, ...mergedEntities.map(e => e.properties || {}));
              mergeGroups.push(merged);
              mergedEntities.forEach(e => {
                const idx = uniqueEntities.findIndex(u => u.id === e.id);
                if (idx >= 0) uniqueEntities.splice(idx, 1);
              });
            }
          });
        }
      }
    } catch (e) {
      console.error('AI 一致性检查失败:', e);
    }
  }

  const deduplicated = [...uniqueEntities, ...mergeGroups];

  await updateProgress(caseId, (p) => {
    const types = p.types || {};
    if (types[entityType]) {
      types[entityType] = { ...types[entityType], consistency_checked: true, deduplicated_count: deduplicated.length };
    }
    return { ...p, types };
  });

  return { candidates: deduplicated, merge_groups: mergeGroups };
}

// ============================================================
// Step 5: 关系推断
// 支持传入候选实体（前端审核前推断）或从 DB 读取（已保存实体）
// ============================================================
export async function inferRelations(caseId, schemaId, candidates) {
  const agent = await getAgentMeta('relation_inferrer');
  if (!agent) throw new Error('Agent relation_inferrer not found');

  // 获取已确认实体：优先使用传入的候选实体，否则从 DB 查询
  let approvedEntities;
  if (candidates && Array.isArray(candidates) && candidates.length > 0) {
    approvedEntities = candidates;
  } else {
    const entityResult = await pool.query('SELECT * FROM case_entities WHERE case_id = $1', [caseId]);
    approvedEntities = entityResult.rows;
  }

  if (approvedEntities.length < 2) {
    return { relations: [], reason: '至少需要2个实体才能推断关系' };
  }

  // 获取相关文本片段
  const segResult = await pool.query('SELECT * FROM text_segments WHERE case_id = $1 ORDER BY segment_index', [caseId]);
  const segments = segResult.rows;

  const context = {
    schema_id: schemaId,
    case_id: caseId,
    approved_entities: approvedEntities,
    text_segments: segments.slice(0, 10) // 最多传递10个片段，避免过长
  };

  const fullContext = await buildAgentContext('relation_inferrer', context, '');
  const systemPrompt = buildSystemPrompt(agent, fullContext);

  const aiResponse = await callAI(systemPrompt, [
    { role: 'user', content: '请基于已确认的实体推断它们之间的关系。' }
  ], agent);

  const output = parseAgentOutput(aiResponse, agent.output_format);
  if (output.parse_error) {
    return { relations: [], parse_error: true, raw: output.raw };
  }

  const relations = (output.relations || []).map((r, i) => ({
    id: `relation-candidate-${i}`,
    name: r.name,
    sourceName: r.sourceName,
    targetName: r.targetName,
    confidence: r.confidence || 0.5,
    evidence: r.evidence || '',
    status: 'pending'
  }));

  await updateProgress(caseId, (p) => ({
    ...p, relations_extracted: true, relation_count: relations.length
  }));

  return { relations };
}

// ============================================================
// Step 6: 保存入库
// ============================================================
export async function finalizeCase(caseId, options = {}) {
  const { relations = [], autoEmbed = false } = options;

  // 获取 case_memory
  const memResult = await pool.query('SELECT extraction_progress FROM case_memory WHERE case_id = $1', [caseId]);
  const progress = memResult.rows[0]?.extraction_progress || {};

  // 获取 schema_id
  const caseResult = await pool.query('SELECT schema_id FROM cases WHERE id = $1', [caseId]);
  const schemaId = caseResult.rows[0]?.schema_id;

  // 保存审核通过的关系候选
  let savedRelations = 0;
  if (relations.length > 0) {
    const approvedRelations = relations.filter(r => r.status === 'approved');
    if (approvedRelations.length > 0) {
      // 优化：一次性查询所有涉及的实体名称，避免 N+1 查询
      const entityNames = [...new Set(approvedRelations.flatMap(r => [r.sourceName, r.targetName]))];
      const entitiesResult = await pool.query(
        'SELECT id, name FROM case_entities WHERE case_id = $1 AND name = ANY($2)',
        [caseId, entityNames]
      );
      const nameToId = new Map(entitiesResult.rows.map(r => [r.name, r.id]));

      for (const rel of approvedRelations) {
        const sourceId = nameToId.get(rel.sourceName);
        const targetId = nameToId.get(rel.targetName);

        if (sourceId && targetId) {
          await pool.query(
            'INSERT INTO case_relations (case_id, source_entity_id, target_entity_id, relation_type) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
            [caseId, sourceId, targetId, rel.name]
          );
          savedRelations++;
        } else {
          console.warn(`[finalizeCase] 关系实体未找到: ${rel.sourceName} -> ${rel.targetName}`);
        }
      }
    }
  }

  // 更新 case_memory
  await pool.query(
    'UPDATE case_memory SET status = $1, md_content = $2, updated_at = CURRENT_TIMESTAMP WHERE case_id = $3',
    [
      'completed',
      `# 案例记忆\n\n## 状态：已完成\n## 完成时间：${new Date().toISOString()}\n## 提取进度：${JSON.stringify(progress, null, 2)}\n`,
      caseId
    ]
  );

  // 自动为本案实体生成嵌入（异步，不阻塞响应）
  if (autoEmbed) {
    triggerAutoEmbed(caseId, 'finalizeCase').catch(e => console.error('[finalizeCase] 自动嵌入失败:', e));
  }

  return { success: true, schema_id: schemaId, saved_relations: savedRelations };
}

// 异步触发嵌入生成（统一函数，供 extraction.js 和 finalizeCase 共用）
export async function triggerAutoEmbed(caseId, source = 'auto') {
  const { PORT } = await import('../config.js');
  try {
    const response = await fetch(`http://localhost:${PORT}/api/rag/embed-entities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId, force: false }),
    });
    if (response.ok) {
      const data = await response.json();
      console.log(`[${source}] 自动嵌入完成: ${data.count || 0} 个实体`);
    }
  } catch (e) {
    console.error(`[${source}] 嵌入触发异常:`, e.message);
  }
}

// ============================================================
// 辅助：获取提取进度
// ============================================================
export async function getExtractionProgress(caseId) {
  const memResult = await pool.query('SELECT * FROM case_memory WHERE case_id = $1', [caseId]);
  const segResult = await pool.query('SELECT COUNT(*) as count FROM text_segments WHERE case_id = $1', [caseId]);

  return {
    memory: memResult.rows[0] || null,
    segment_count: segResult.rows[0]?.count || 0
  };
}
