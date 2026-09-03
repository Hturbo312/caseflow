// ============================================================
// v5_casebook.json → knowledge_graph 导入脚本（CaseFlow 2.0）
// 将论文第五章 17 例核心案例按 L0原文→L1事实→L2图谱+证据 导入。
// 规则式映射（确定性、可复现），不调用 LLM：
//   案例卡字段 → Schema 9 实体类型（Spec §4.4 主链）
//   关键事实—来源映射表 → atomic_facts（含 source_refs）
//   案例卡段落 → documents + text_segments + 证据快照
// 幂等：同名案例先删后建（级联清理）。
// 用法：node scripts/import_v5_casebook.mjs [casebook.json 路径]
// ============================================================
import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonPath = process.argv[2] || path.join(__dirname, '../../testdata/v5_casebook.json');

const SCHEMA_ID = 9; // 论文：数字与智能技术嵌入社区更新 Dynamic Schema v1.0
const SOURCE_DOC = '数字与智能技术嵌入社区更新_第五章实证案例库_V5_可追溯证据版.docx';

const pool = new pg.Pool({
  user: process.env.DB_USER || 'postgres',
  database: process.env.DB_NAME || 'knowledge_graph',
  host: process.env.DB_HOST || '/var/run/postgresql',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
});

// ---------- 工具 ----------
const trimTo = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

function inferProcessState(text) {
  const t = text || '';
  if (/退出|终止|撤除|取消|搁置废弃/.test(t)) return 'withdrawn';
  if (/暂停|中止/.test(t)) return 'suspended';
  if (/调整|改造|转用|补位|再推进|重构/.test(t)) return 'adjusted';
  if (/推广|扩散|规模化|复制/.test(t)) return 'scaled';
  if (/采用|使用|运行|常态化|投入使用/.test(t)) return 'adopted';
  if (/部署|安装|上线|建成/.test(t)) return 'deployed';
  if (/试点|试验|原型|测试/.test(t)) return 'piloted';
  if (/计划|拟|规划中|预期/.test(t)) return 'planned';
  return 'unknown';
}

function extractYear(text) {
  const m = String(text || '').match(/(19|20)\d{2}/);
  return m ? m[0] : null;
}

// 事实文本与实体名的关键词重叠判断（取实体名 6 字滑窗任一命中即视为相关）
function factMentionsEntity(factText, entityName) {
  const f = clean(factText).replace(/[，。；：、"（）()【】\[\],.:;?"'—-]/g, '');
  const n = clean(entityName).replace(/[，。；：、"（）()【】\[\],.:;?"'—-]/g, '');
  if (!f || !n) return false;
  if (f.includes(n) || n.includes(f)) return true;
  const win = 6;
  if (n.length <= win) return f.includes(n);
  for (let i = 0; i + win <= n.length; i++) {
    if (f.includes(n.slice(i, i + win))) return true;
  }
  return false;
}

// ---------- 主流程 ----------
async function getTypeColors() {
  const { rows } = await pool.query('SELECT name, color FROM entity_types WHERE schema_id = $1', [SCHEMA_ID]);
  return Object.fromEntries(rows.map(r => [r.name, r.color]));
}

async function importCase(client, book, card, summaryRow, typeColors) {
  const code = card.code;
  const name = card.title;
  const s = summaryRow || {};

  // 幂等：先删同名案例（级联删实体/关系/分段/事实/证据）
  await client.query('DELETE FROM cases WHERE name = $1', [name]);

  // ---- 案例主记录 ----
  const caseRes = await client.query(
    `INSERT INTO cases (name, schema_id, location, year, description, tags, case_status, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,'core',$7) RETURNING id`,
    [name, SCHEMA_ID, card.location, card.year,
     `论文第五章核心案例（${code}）。第五章角色：${s.role || '未标注'}`,
     JSON.stringify(['论文核心案例', code]),
     JSON.stringify({ case_code: code, chapter5_role: s.role || '', summary: s })]
  );
  const caseId = caseRes.rows[0].id;

  // ---- L0：文档 + 分段 ----
  const docRes = await client.query(
    `INSERT INTO documents (case_id, source_type, title, uri, pub_year)
     VALUES ($1,'report',$2,$3,$4) RETURNING id`,
    [caseId, `案例卡 ${code} ${name}（${SOURCE_DOC}）`, SOURCE_DOC, card.year]
  );
  const documentId = docRes.rows[0].id;

  let charOffset = 0;
  const segmentIds = [];
  for (let i = 0; i < card.paragraphs.length; i++) {
    const content = card.paragraphs[i];
    const segRes = await client.query(
      `INSERT INTO text_segments (case_id, document_id, segment_index, content, page, char_start, char_end, entity_hints)
       VALUES ($1,$2,$3,$4,NULL,$5,$6,'[]'::jsonb) RETURNING id`,
      [caseId, documentId, i, content, charOffset, charOffset + content.length]
    );
    segmentIds.push(segRes.rows[0].id);
    charOffset += content.length + 1;
  }

  // 来源条目 [CXXX-SN] → case.metadata.sources
  const sources = card.sourceEntries.map(t => {
    const m = t.match(/^\[(C\d{3}-S\d+)\]\s*(.*)$/s);
    return m ? { id: m[1], text: clean(m[2]) } : { id: '', text: clean(t) };
  });
  await client.query('UPDATE cases SET metadata = jsonb_set(metadata, \'{sources}\', $1) WHERE id = $2',
    [JSON.stringify(sources), caseId]);

  // ---- L2：实体 ----
  // entity: {type, name, properties, segIdx, quote}
  const entities = []; // 已插入的 {id, type, name}
  async function addEntity(type, rawName, props, segIdx) {
    const nm = trimTo(clean(rawName), 60);
    if (!nm) return null;
    const dup = entities.find(e => e.type === type && e.name === nm);
    if (dup) return dup;
    const res = await client.query(
      `INSERT INTO case_entities (case_id, name, entity_type, properties, color, status)
       VALUES ($1,$2,$3,$4,$5,'confirmed') RETURNING id`,
      [caseId, nm, type, JSON.stringify(props || {}), typeColors[type] || null]
    );
    const ent = { id: res.rows[0].id, type, name: nm, segIdx };
    entities.push(ent);
    return ent;
  }

  // 证据快照：实体 → 其来源段落
  async function attachEvidence(ent, extra = {}) {
    if (!ent || ent.segIdx === undefined || ent.segIdx === null) return;
    const quote = trimTo(card.paragraphs[ent.segIdx], 300);
    await client.query(
      `INSERT INTO evidence (entity_id, segment_id, quote, source, status, metadata)
       VALUES ($1,$2,$3,'manual','confirmed',$4)`,
      [ent.id, segmentIds[ent.segIdx], quote,
       JSON.stringify({ source_refs: extra.sourceRefs || [], case_code: code })]
    );
  }

  // 1. 社区情境
  const ctxEnt = await addEntity('Community Context（社区情境）', s.context_short || trimTo(card.fields.context, 30),
    { native_label: s.context_short || '', description: card.fields.context || '' }, card.fieldSegIdx.context);
  await attachEvidence(ctxEnt);

  // 2. 问题与压力
  const problems = [];
  for (const clause of (card.fields.problem || '').split(/[；;]/).map(clean).filter(Boolean)) {
    const p = await addEntity('Problem / Pressure（问题与压力）', trimTo(clause, 40),
      { native_label: clause, description: clause }, card.fieldSegIdx.problem);
    if (p) { problems.push(p); await attachEvidence(p); }
  }

  // 3. 任务
  const taskEnt = await addEntity('Task（社区更新任务）', s.task_short || trimTo(card.fields.task || card.fields.problem, 30),
    { formal_status: 'unknown', native_label: s.task_short || '', description: card.fields.task || card.fields.problem || '' },
    card.fieldSegIdx.task ?? card.fieldSegIdx.problem);
  await attachEvidence(taskEnt);

  // 4. 技术与能力：技术名用总表短标签；能力实体取能力清单（冒号后内容或全字段）
  let techEnt = null, capEnt = null;
  const techRaw = clean(card.fields.tech || '');
  if (techRaw) {
    const colonIdx = techRaw.indexOf('：');
    const techName = clean(s.tech_short || (colonIdx > 0 ? techRaw.slice(0, colonIdx) : techRaw));
    const capDesc = colonIdx > 0 ? techRaw.slice(colonIdx + 1) : techRaw;
    techEnt = await addEntity('Technology（技术）', trimTo(techName, 40),
      { native_label: techName, technology_type: techName,
        deployment_state: inferProcessState((card.fields.limitation || '') + techRaw),
        description: techRaw }, card.fieldSegIdx.tech);
    await attachEvidence(techEnt);
    if (capDesc) {
      const capFirst = clean(capDesc.split(/[、；;]/)[0]);
      capEnt = await addEntity('Capability（技术能力）', trimTo(capFirst || capDesc, 40),
        { native_label: capFirst || capDesc, capability_domain: techName, description: capDesc },
        card.fieldSegIdx.tech);
      await attachEvidence(capEnt);
    }
  }

  // 5. 主体（顿号切分，超长子句截断保留）
  const actors = [];
  for (const a of (card.fields.actors || '').split(/[、，,]/).map(clean).filter(Boolean)) {
    const ent = await addEntity('Actor（主体）', trimTo(a, 40), { native_label: a }, card.fieldSegIdx.actors);
    if (ent) { actors.push(ent); await attachEvidence(ent); }
  }

  // 6. 行动与事件（时间过程逐条）
  const actions = [];
  for (let li = 0; li < card.processLines.length; li++) {
    const line = card.processLines[li];
    const t = clean(line);
    if (!t) continue;
    const ym = t.match(/^((?:19|20)\d{2}\s*年[^：:]*)[:：]\s*/);
    const startTime = ym ? clean(ym[1]) : null;
    const body = ym ? t.slice(ym[0].length) : t;
    const state = inferProcessState(body || t);
    const ent = await addEntity('Action / Event（行动与事件）', trimTo(body || t, 60),
      { native_label: body || t, start_time: startTime, process_state: state, description: t },
      card.processSegIdx[li]);
    if (ent) { actions.push(ent); await attachEvidence(ent); }
  }

  // 7. 组织响应
  let orgEnt = null;
  if (clean(card.fields.orgResponse)) {
    orgEnt = await addEntity('Organizational Response（组织响应）', trimTo(clean(card.fields.orgResponse), 40),
      { native_label: clean(card.fields.orgResponse).slice(0, 20), description: card.fields.orgResponse },
      card.fieldSegIdx.orgResponse);
    await attachEvidence(orgEnt);
  }

  // 8. 空间 / 行为响应：按子句关键词密度分类；行为类缺失但全文有行为语义时补一例
  let spaceEnt = null, behavEnt = null;
  const scoreClause = (clause) => {
    const bHits = (clause.match(/行为|参与|服务|可达性|使用|采纳|排斥|素养|信息获取|渠道|居民获/g) || []).length;
    const sHits = (clause.match(/空间|设施|建成|场地|车棚|建筑|入口|宗地|街道|广场|围护|体量|住宅/g) || []).length;
    return { bHits, sHits };
  };
  const respClauses = (card.fields.spaceBehavior || '').split(/[；;]/).map(clean).filter(Boolean);
  for (const clause of respClauses) {
    const { bHits, sHits } = scoreClause(clause);
    if (bHits > sHits) {
      behavEnt = behavEnt || await addEntity('Behavioral / Service Response（行为与服务响应）', trimTo(clause, 40),
        { native_label: clause, affected_group: '', description: clause }, card.fieldSegIdx.spaceBehavior);
      if (behavEnt && behavEnt.name === trimTo(clause, 40)) await attachEvidence(behavEnt);
    } else {
      spaceEnt = spaceEnt || await addEntity('Spatial Response（空间响应）', trimTo(clause, 40),
        { native_label: clause, physical_change: /建成|设施|场地|改造|车棚|建筑|入口|围护|宗地|街道|广场/.test(clause), description: clause },
        card.fieldSegIdx.spaceBehavior);
      if (spaceEnt && spaceEnt.name === trimTo(clause, 40)) await attachEvidence(spaceEnt);
    }
  }
  // 字段有行为语义但未产生行为实体时，从行为词最密的子句补一例（保证行为响应维度可见）
  if (!behavEnt && /可达性|参与|服务|行为|使用/.test(card.fields.spaceBehavior || '')) {
    const best = respClauses.slice().sort((a, b) => scoreClause(b).bHits - scoreClause(a).bHits)[0];
    if (best) {
      behavEnt = await addEntity('Behavioral / Service Response（行为与服务响应）', trimTo(best, 40),
        { native_label: best, affected_group: '', description: best }, card.fieldSegIdx.spaceBehavior);
      await attachEvidence(behavEnt);
    }
  }

  // 9. 约束与调整
  const constraints = [];
  for (const clause of (card.fields.limitation || '').split(/[；;]/).map(clean).filter(Boolean)) {
    const ent = await addEntity('Constraint / Adjustment（约束与调整）', trimTo(clause, 40),
      { native_label: clause, constraint_type: '', evidence_status: 'confirmed', description: clause },
      card.fieldSegIdx.limitation);
    if (ent) { constraints.push(ent); await attachEvidence(ent); }
  }

  // ---- L2：关系（Spec §4.4 主链） ----
  // relation: {type, src, dst, segIdx}
  const relations = [];
  async function addRelation(type, src, dst, segIdx) {
    if (!src || !dst || src.id === dst.id) return;
    const dup = relations.find(r => r.type === type && r.src.id === src.id && r.dst.id === dst.id);
    if (dup) return;
    const res = await client.query(
      `INSERT INTO case_relations (case_id, source_entity_id, target_entity_id, relation_type, status)
       VALUES ($1,$2,$3,$4,'confirmed') RETURNING id`,
      [caseId, src.id, dst.id, type]
    );
    relations.push({ id: res.rows[0].id, type, src, dst, segIdx });
  }

  for (const p of problems) {
    await addRelation('produces_pressure（形成压力）', ctxEnt, p, card.fieldSegIdx.problem);
    await addRelation('motivates_task（触发任务）', p, taskEnt, card.fieldSegIdx.problem);
  }
  await addRelation('shapes_task（塑造任务）', ctxEnt, taskEnt, card.fieldSegIdx.context);
  for (const a of actors) await addRelation('undertakes_task（承担任务）', a, taskEnt, card.fieldSegIdx.actors);
  if (techEnt) {
    for (const a of actors) await addRelation('uses_technology（使用技术）', a, techEnt, card.fieldSegIdx.tech);
    if (capEnt) {
      await addRelation('provides_capability（提供能力）', techEnt, capEnt, card.fieldSegIdx.tech);
      await addRelation('supports_task（支持任务）', capEnt, taskEnt, card.fieldSegIdx.tech);
    }
  }
  for (const act of actions) {
    // 行动主体：文本提到该主体则连，否则全部主体（案例过程通常为多主体协作）
    const mentioned = actors.filter(a => factMentionsEntity(act.name, a.name) || factMentionsEntity(a.name, act.name));
    for (const a of (mentioned.length ? mentioned : actors.slice(0, 1))) {
      await addRelation('performs_action（执行行动）', a, act, act.segIdx);
    }
    if (capEnt) await addRelation('enables_action（支持行动）', capEnt, act, act.segIdx);
  }
  // 响应类关系：从关键词命中的行动连出，兜底从最后一个行动连出
  const lastAction = actions[actions.length - 1] || null;
  const actionsFor = (text) => {
    const hits = actions.filter(a => text && (factMentionsEntity(text, a.name) || factMentionsEntity(a.name, text)));
    return hits.length ? hits : (lastAction ? [lastAction] : []);
  };
  if (orgEnt) for (const a of actionsFor(card.fields.orgResponse)) await addRelation('changes_organization（形成组织响应）', a, orgEnt, a.segIdx);
  if (spaceEnt) for (const a of actionsFor(card.fields.spaceBehavior)) await addRelation('changes_space（形成空间响应）', a, spaceEnt, a.segIdx);
  if (behavEnt) for (const a of actionsFor(card.fields.spaceBehavior)) await addRelation('changes_behavior_service（形成行为/服务响应）', a, behavEnt, a.segIdx);
  for (const c of constraints) {
    if (techEnt) await addRelation('constrains_technology（约束技术）', c, techEnt, card.fieldSegIdx.limitation);
    if (lastAction) await addRelation('constrains_action（约束行动）', c, lastAction, card.fieldSegIdx.limitation);
  }

  // ---- L1：关键事实—来源映射 → atomic_facts + 证据关联 ----
  let factCount = 0;
  for (const row of card.factRows) {
    const factText = clean(row.fact);
    if (!factText) continue;
    const sourceRefs = row.sourceIds.split(/[,，]/).map(clean).filter(Boolean);
    await client.query(
      `INSERT INTO atomic_facts (case_id, fact_text, fact_type, status, metadata)
       VALUES ($1,$2,$3,'confirmed',$4)`,
      [caseId, factText, clean(row.attribute) || 'case_fact',
       JSON.stringify({ source_refs: sourceRefs, boundary: clean(row.boundary), case_code: code })]
    );
    factCount++;

    // 事实 → 相关实体的证据行（关键词重叠；无命中则事实独立存在，不伪造关联）
    const matched = entities.filter(e => factMentionsEntity(factText, e.name) || factMentionsEntity(e.name, factText));
    for (const ent of matched.slice(0, 4)) {
      await client.query(
        `INSERT INTO evidence (entity_id, quote, source, status, metadata)
         VALUES ($1,$2,'manual','confirmed',$3)`,
        [ent.id, trimTo(factText, 300),
         JSON.stringify({ source_refs: sourceRefs, origin: 'fact_table', case_code: code })]
      );
    }
  }

  return {
    code, caseId,
    entities: entities.length, relations: relations.length,
    segments: segmentIds.length, facts: factCount, sources: sources.length,
  };
}

// ---------- 案例卡解析 ----------
function parseCards(paragraphs, tables) {
  // 总表（表1）：ID/案例/地点时期/社区情境/技术能力/主要任务/关键非线性局限/第五章角色
  const summary = new Map();
  for (const row of (tables[1] || []).slice(1)) {
    if (!row || !row[0]) continue;
    summary.set(clean(row[0]).split(/\s+/)[0], {
      context_short: clean(row[3]), tech_short: clean(row[4]),
      task_short: clean(row[5]), limitation_short: clean(row[6]), role: clean(row[7]),
    });
  }

  const cardStarts = [];
  paragraphs.forEach((p, i) => {
    const m = p.text.trim().match(/^(C\d{3})\s+(.+)$/);
    if (m && cardStarts.every(x => x.i !== i)) cardStarts.push({ i, code: m[1], title: clean(m[2]) });
  });
  // 只保留深度案例卡区间（前 17 个；后面还有论点矩阵区的引用行）
  const cards = cardStarts.slice(0, 17);

  const FIELD_PATTERNS = [
    ['location', /^地点\s*\/\s*时间[:：]/],
    ['context', /^社区情境[:：]/],
    ['problem', /^技术介入前的主要问题\s*\/\s*任务[:：]/],
    ['tech', /^技术及其能力[:：]/],
    ['actors', /^主要主体\s*\/\s*服务对象[:：]/],
    ['process', /^时间过程[:：]$/],
    ['orgResponse', /^组织响应[:：]/],
    ['spaceBehavior', /^空间\s*\/\s*行为响应[:：]/],
    ['limitation', /^局限、调整或证据边界[:：]/],
    ['usage', /^第五章用途[:：]/],
    ['factTable', /^关键事实—来源映射$/],
    ['coreSources', /^核心来源$/],
  ];

  return cards.map((c, idx) => {
    // 卡片终点：下一张卡起点，或其后第一个章节标题（如 "4. …"、"5.1 …"、"按案例列出…"）
    let end = idx + 1 < cards.length ? cards[idx + 1].i : paragraphs.length;
    for (let j = c.i + 1; j < end; j++) {
      const t = paragraphs[j].text.trim();
      if (/^[0-9]+[.、]/.test(t) || /^按案例列出/.test(t)) { end = j; break; }
    }
    const card = {
      code: c.code, title: c.title,
      location: null, year: null,
      fields: {}, fieldSegIdx: {}, processLines: [], processSegIdx: [],
      sourceEntries: [], factRows: [], paragraphs: [],
    };
    let inProcess = false, inSources = false, inFacts = false;

    for (let i = c.i; i < end; i++) {
      const raw = paragraphs[i].text.trim();
      if (!raw) continue;
      card.paragraphs.push(raw);

      if (/^\[C\d{3}-S\d+\]/.test(raw)) { card.sourceEntries.push(raw); inSources = true; continue; }

      const field = FIELD_PATTERNS.find(([, re]) => re.test(raw));
      if (field) {
        const [key, re] = field;
        if (key === 'process') { inProcess = true; inSources = false; inFacts = false; card.fields.process = ''; card.fieldSegIdx.process = i - c.i; continue; }
        if (key === 'coreSources') { inSources = true; inProcess = false; inFacts = false; continue; }
        if (key === 'factTable') { inFacts = true; inProcess = false; inSources = false; continue; }
        card.fields[key] = raw.replace(re, '').trim();
        card.fieldSegIdx[key] = card.paragraphs.length - 1;
        inProcess = false; inSources = false; inFacts = false;
        continue;
      }
      if (inProcess) { card.processLines.push(raw); card.processSegIdx.push(card.paragraphs.length - 1); }
    }

    // 地点/时间解析："英国西约克郡 Slaithwaite｜1998年前后"
    const locRaw = card.fields.location || '';
    const [loc, timePart] = locRaw.split('｜').map(s => clean(s));
    card.location = loc || null;
    card.year = extractYear(timePart || locRaw);

    // 事实映射表：找到该案例的 4 列表（第一个表头为 可写入的事实性表述 的表按顺序对应案例 2..18）
    card.summary = summary.get(c.code) || null;
    return card;
  });
}

// 事实表与案例的对应：tables[2..18] 依次为 17 个案例
function attachFactTables(cards, tables) {
  const factTables = tables.slice(2, 2 + cards.length);
  cards.forEach((card, i) => {
    const t = factTables[i];
    card.factRows = (t || []).slice(1).map(row => ({
      fact: row[0] || '', sourceIds: row[1] || '', attribute: row[2] || '', boundary: row[3] || '',
    })).filter(r => r.fact);
  });
}

// ---------- 入口 ----------
async function main() {
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const cards = parseCards(raw.paragraphs, raw.tables);
  attachFactTables(cards, raw.tables);
  console.log(`解析到 ${cards.length} 张案例卡`);

  const typeColors = await getTypeColors();
  const client = await pool.connect();
  const report = [];
  try {
    await client.query('BEGIN');
    for (const card of cards) {
      const r = await importCase(client, raw, card, card.summary, typeColors);
      report.push(r);
      console.log(`✓ ${r.code} ${card.title.slice(0, 24)}：实体 ${r.entities}，关系 ${r.relations}，分段 ${r.segments}，事实 ${r.facts}，来源 ${r.sources}`);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  const tot = report.reduce((a, r) => ({
    entities: a.entities + r.entities, relations: a.relations + r.relations,
    segments: a.segments + r.segments, facts: a.facts + r.facts,
  }), { entities: 0, relations: 0, segments: 0, facts: 0 });
  console.log(`\n导入完成：${report.length} 案例，实体 ${tot.entities}，关系 ${tot.relations}，分段 ${tot.segments}，原子事实 ${tot.facts}`);
  await pool.end();
}

main().catch(e => { console.error('导入失败:', e); process.exit(1); });
