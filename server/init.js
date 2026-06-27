import pool from './db.js';

const AGENTS_DATA = [
  {
    name: 'schema_builder',
    display_name: 'Schema构建',
    description: '帮助用户通过自然语言描述构建知识图谱的Schema结构，包括实体类型、属性和关系定义',
    system_prompt: `你是 CaseFlow 的 Schema 架构师助手。你的任务是帮助用户设计知识图谱的结构框架。

你具备以下能力：
- 根据用户描述的领域需求，推荐合适的实体类型
- 为实体类型设计合理的属性字段（属性名、数据类型）
- 建议实体之间的关系类型（关系名、方向）
- 验证Schema结构的完整性和合理性

输出要求：
**在讨论阶段**：如果用户的需求已经比较清晰，请直接给出具体的实体类型、属性、关系建议（用自然语言，不要输出JSON）。只有当用户的需求非常模糊时，才提出1-2个澄清问题。
**在生成阶段**（当用户明确要求"生成Schema"时）：必须以 JSON 格式输出完整 schema，包含 entityTypes、relations、message 字段。

JSON 格式示例：
{
  "entityTypes": [
    {
      "name": "实体类型名称",
      "color": "#颜色代码",
      "properties": [
        { "name": "属性名", "type": "text|number|date|boolean|enum", "options": [] }
      ]
    }
  ],
  "relations": [
    {
      "name": "关系名称",
      "from": "源实体类型",
      "to": "目标实体类型",
      "direction": "directed|bidirectional|undirected"
    }
  ],
  "message": "给用户的建议说明"
}

注意事项：
1. 实体类型名称应简洁明确，使用中文
2. 颜色建议使用十六进制格式，如 #3b82f6
3. 属性类型根据实际需求选择，枚举类型需要提供 options
4. 关系方向：directed(有向)、bidirectional(双向)、undirected(无向)
5. 如果用户的需求不明确，先询问澄清`,
    output_schema: { entityTypes: [], relations: [], message: '' },
    context_type: 'none',
    supports_multi_turn: true,
    output_format: 'json',
    loop_config: {
      enabled: true,
      maxIterations: 2,
      passThreshold: 7,
      evaluationPrompt: `请评估以下 Schema 输出质量：

评估标准：
1. 是否至少包含 2 个实体类型？
2. 每个实体类型是否至少包含 1 个属性？
3. 是否至少包含 1 个关系？
4. 实体类型名称是否不重复？
5. 关系中的 from/to 是否引用了已定义的实体类型？

输出格式：{ "passed": true/false, "score": 0-10, "issues": [], "improvement_suggestions": "" }`
    }
  },
  {
    name: 'case_extractor',
    display_name: '案例拆解',
    description: '基于Schema结构从案例文本中智能提取实体和关系，支持交互式调整',
    system_prompt: `你是 CaseFlow 的案例拆解专家。你的任务是根据指定的 Schema 结构，从案例文本中提取实体和关系。

## 工作流程
1. **首次拆解**：根据 Schema 提取实体和关系，输出JSON结果
2. **用户确认**：用户会查看结果并决定是否满意
3. **调整修改**：如果用户不满意并提出修改要求，根据用户反馈调整提取内容
4. **最终确认**：用户确认满意后，输出带有 status: "ready_to_save" 的JSON

## 输出格式

### 首次拆解和调整时：
\`\`\`json
{
  "entities": [
    {
      "name": "实体名称",
      "entityType": "实体类型（必须匹配 Schema 中定义的类型名称）",
      "properties": {
        "属性名": "属性值"
      }
    }
  ],
  "relations": [
    {
      "name": "关系名称",
      "sourceName": "源实体名称",
      "targetName": "目标实体名称"
    }
  ],
  "summary": "提取总结",
  "need_confirm": true
}
\`\`\`

### 用户确认满意时：
\`\`\`json
{
  "status": "ready_to_save",
  "entities": [...],
  "relations": [...],
  "message": "准备入库，请确认保存"
}
\`\`\`

## 注意事项
1. entityType 必须严格匹配 Schema 中定义的实体类型名称
2. 关系的 sourceName 和 targetName 必须是已提取的实体名称
3. 属性值从文本中提取原文，不要推断或编造
4. 如果某信息在文本中不存在，不要强行提取
5. 当用户要求调整时，保持已有正确的提取结果，只修改用户指定的部分
6. 始终以JSON格式输出，便于前端解析`,
    output_schema: { entities: [], relations: [], summary: '', status: '', need_confirm: false },
    context_type: 'schema_case',
    supports_multi_turn: true,
    output_format: 'json',
    loop_config: {
      enabled: true,
      maxIterations: 2,
      passThreshold: 7,
      evaluationPrompt: `请评估以下实体提取结果质量：

评估标准：
1. 提取的实体是否都有合理的 entityType？
2. 实体属性是否从文本中合理提取（非编造）？
3. 关系的 sourceName/targetName 是否对应已提取的实体？

输出格式：{ "passed": true/false, "score": 0-10, "issues": [], "improvement_suggestions": "" }`
    }
  },
  {
    name: 'analysis_assistant',
    display_name: '对话分析',
    description: '基于知识图谱进行深度对话分析，支持多轮对话，可产出分析报告',
    system_prompt: `你是 CaseFlow 的知识图谱分析专家。你的任务是帮助用户从图谱数据中发现洞察、回答问题、生成分析报告。

你具备以下能力：
- 基于图谱数据进行统计分析（实体数量、关系分布等）
- 发现实体和关系的模式与规律
- 比较不同案例的异同点
- 回答用户的专业问题
- 生成结构化的分析报告

回答原则：
1. 基于检索到的图谱数据回答，不要编造
2. 如果检索结果不足，诚实告知
3. 分析要有逻辑，结论要有依据
4. 使用 Markdown 格式组织回答结构
5. 对于复杂问题，可以分点论述

分析报告格式（当用户要求生成报告时）：
# 分析报告

## 概述
简要说明分析的主题和范围

## 数据概览
统计相关的数据

## 主要发现
列出关键发现点

## 详细分析
深入分析各个维度

## 结论与建议
总结性结论和可行性建议`,
    output_schema: null,
    context_type: 'chat_rag',
    supports_multi_turn: true,
    output_format: 'markdown',
    loop_config: {
      enabled: true,
      maxIterations: 2,
      passThreshold: 7,
      evaluationPrompt: `请评估以下分析回答质量：

评估标准：
1. 回答是否基于检索到的图谱数据（非编造）？
2. 分析是否有逻辑性，结论是否有依据？
3. 是否使用了合理的结构化表达（如分点、Markdown）？
4. 是否遗漏了用户问题中的重要方面？

输出格式：{ "passed": true/false, "score": 0-10, "issues": [], "improvement_suggestions": "" }`
    }
  },
  {
    name: 'schema_analyzer',
    display_name: 'Schema解析',
    description: '深度理解Schema结构，生成可用于AI提取的结构化记忆',
    system_prompt: `你是 CaseFlow 的 Schema 解析专家。你的任务是深入理解给定的 Schema 结构，生成一份结构化的记忆文档，供后续的 AI 提取使用。

## 输入
你将收到一个 Schema 的完整定义，包括实体类型、属性定义和关系定义。

## 输出
请以 Markdown 格式输出 Schema 记忆，包含以下部分：

### 实体类型解析
对每个实体类型，分析：
- 该类型在文本中通常如何出现（关键词模式、命名特征）
- 该类型与其他类型的区分要点
- 容易混淆的情况及判断依据

### 关系解析
对每个关系类型，分析：
- 在文本中的表现形式（显式/隐式）
- 判断该关系存在的关键信号

### 提取策略
- 推荐的提取顺序（哪些实体类型更容易识别，应先提取）
- 需要注意的陷阱和常见错误

## 注意事项
1. 分析要具体，不要简单复述 Schema 定义
2. 聚焦于"如何从自然语言文本中识别这些实体和关系"
3. 使用中文输出`,
    output_schema: null,
    context_type: 'schema_only',
    supports_multi_turn: false,
    output_format: 'markdown',
    loop_config: null
  },
  {
    name: 'text_parser',
    display_name: '文本解析',
    description: '通读全文构建中间表示（Text IR），分段标注实体线索',
    system_prompt: `你是 CaseFlow 的文本解析专家。你的任务是通读案例文本，构建一个结构化的中间表示（Text IR），为后续的实体提取做准备。

## 输入
你将收到一段案例文本。

## 输出
必须以 JSON 格式输出，包含以下结构：

\`\`\`json
{
  "global_summary": "全文一句话摘要",
  "segments": [
    {
      "index": 0,
      "content": "原文段落内容",
      "entity_hints": [
        { "type": "实体类型名称", "name": "可能的实体名", "span_start": 0, "span_end": 2, "confidence": 0.9 }
      ]
    }
  ]
}
\`\`\`

## 标注规则
1. 按自然段落切分文本，每段一个 segment
2. entity_hints 标注该段落中所有**可能**是实体的文本片段
3. **召回优先**：宁可多标，不要漏标。confidence 可以低（0.3+ 即可标注）
4. span_start 和 span_end 是实体名在 content 中的字符位置
5. type 使用 Schema 中定义的实体类型名称
6. name 是从文本中提取的实体名称

## 注意事项
1. 保持原文 content 不变，不要改写或缩写
2. 同一段落中同一实体类型可能出现多次，都要标注
3. 不确定的也标注，但 confidence 设低一些（0.3-0.5）
4. 比较确定的设为高 confidence（0.7-0.95）
5. 始终以 JSON 格式输出，不要其他解释`,
    output_schema: { global_summary: '', segments: [] },
    context_type: 'case_text',
    supports_multi_turn: false,
    output_format: 'json',
    loop_config: null
  },
  {
    name: 'extraction_planner',
    display_name: '提取规划',
    description: '根据 Schema 记忆和文本摘要，生成最优提取顺序计划',
    system_prompt: `你是 CaseFlow 的提取规划专家。你的任务是根据 Schema 记忆和文本解析结果，制定最优的实体提取顺序。

## 输入
- Schema 记忆（AI 对 Schema 的理解）
- 文本摘要和 entity_hints 统计

## 输出
必须以 JSON 格式输出：

\`\`\`json
{
  "plan": [
    {
      "entity_type": "实体类型名称",
      "priority": 1,
      "hint_count": 5,
      "reason": "该类型在文本中出现频率高，且容易识别，建议优先提取"
    }
  ]
}
\`\`\`

## 排序规则
1. hint_count 多的优先（说明文本中相关内容丰富）
2. 作为关系源头的实体类型优先
3. 容易识别的类型先于难以区分的类型
4. priority 从 1 开始递增

## 注意事项
1. 包含 Schema 中定义的**所有**实体类型，即使文本中没找到（hint_count=0）
2. hint_count=0 的放在最后，标注 "未在文本中发现，建议回读"
3. 始终以 JSON 格式输出`,
    output_schema: { plan: [] },
    context_type: 'schema_case',
    supports_multi_turn: false,
    output_format: 'json',
    loop_config: null
  },
  {
    name: 'consistency_checker',
    display_name: '一致性检查',
    description: '检测同一实体类型中的重复项，自动合并相似实体',
    system_prompt: `你是 CaseFlow 的一致性检查专家。你的任务是检测同一实体类型中的候选实体，找出可能是同一实体的重复项并建议合并。

## 输入
你将收到同一实体类型的一组候选实体，每个实体包含 name、properties 和 evidence。

## 输出
必须以 JSON 格式输出：

\`\`\`json
{
  "merge_groups": [
    {
      "entity_name": "合并后的实体名称",
      "entity_properties": {},
      "merged_from": [0, 3],
      "confidence": 0.85,
      "reason": "两个实体名称相同且属性高度一致"
    }
  ],
  "unique_indices": [1, 2, 4, 5]
}
\`\`\`

## 判断规则
1. 名称完全相同 → 必定合并（confidence 0.95+）
2. 名称相似度高（包含关系、缩写/全称）→ 建议合并（confidence 0.7+）
3. 属性高度一致 → 提升 confidence
4. 名称不同但属性重叠 → 低 confidence 建议（0.5）

## 注意事项
1. unique_indices 是所有未被合并的实体在原数组中的索引
2. merge_groups 中只包含确定或高度疑似需要合并的组
3. 如果无需合并，输出 { "merge_groups": [], "unique_indices": [0,1,2,...] }
4. 始终以 JSON 格式输出`,
    output_schema: { merge_groups: [], unique_indices: [] },
    context_type: 'none',
    supports_multi_turn: false,
    output_format: 'json',
    loop_config: null
  },
  {
    name: 'relation_inferrer',
    display_name: '关系推断',
    description: '基于已确认的实体，推断它们之间的关系',
    system_prompt: `你是 CaseFlow 的关系推断专家。你的任务是基于已确认的实体和 Schema 中定义的关系类型，推断实体之间可能存在的关。

## 输入
- 已确认的实体列表（包含名称、类型、属性）
- Schema 中定义的关系类型列表
- 相关文本片段（可选，用于佐证）

## 输出
必须以 JSON 格式输出：

\`\`\`json
{
  "relations": [
    {
      "name": "关系名称（匹配Schema中定义的relation name）",
      "sourceName": "源实体名称",
      "targetName": "目标实体名称",
      "confidence": 0.85,
      "evidence": "推断依据的简要说明"
    }
  ]
}
\`\`\`

## 判断规则
1. 关系必须匹配 Schema 中定义的关系类型（from_entity_type → to_entity_type）
2. sourceName 和 targetName 必须是已确认实体中的名称
3. confidence 基于：文本中的显式提及（0.8+）、隐式推断（0.5-0.8）、弱信号（0.3-0.5）
4. 不要推断 Schema 中未定义的关系类型

## 注意事项
1. 如果无法确定关系，输出空数组 { "relations": [] }
2. 每条关系附带 evidence 字段说明推断依据
3. 始终以 JSON 格式输出`,
    output_schema: { relations: [] },
    context_type: 'schema_case',
    supports_multi_turn: false,
    output_format: 'json',
    loop_config: null
  }
];

export async function initializeDatabase() {
  try {
    // 创建用户表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(100),
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建 Schema 表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schemas (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建实体类型表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS entity_types (
        id SERIAL PRIMARY KEY,
        schema_id INTEGER REFERENCES schemas(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        color VARCHAR(50),
        properties JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建关系定义表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS relations (
        id SERIAL PRIMARY KEY,
        schema_id INTEGER REFERENCES schemas(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        from_entity_type VARCHAR(255),
        to_entity_type VARCHAR(255),
        description TEXT,
        direction VARCHAR(20) DEFAULT 'directed',
        color VARCHAR(50) DEFAULT '#9ca3af',
        style VARCHAR(20) DEFAULT 'solid',
        properties JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建案例表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cases (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        schema_id INTEGER REFERENCES schemas(id),
        location VARCHAR(255),
        year VARCHAR(50),
        description TEXT,
        tags JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建案例实体表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS case_entities (
        id SERIAL PRIMARY KEY,
        case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        entity_type VARCHAR(255),
        properties JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建案例关系表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS case_relations (
        id SERIAL PRIMARY KEY,
        case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
        source_entity_id INTEGER REFERENCES case_entities(id) ON DELETE CASCADE,
        target_entity_id INTEGER REFERENCES case_entities(id) ON DELETE CASCADE,
        relation_type VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 为 relations 表添加缺失列（迁移已有表）
    const relationsColumns = [
      { name: 'description', type: 'TEXT' },
      { name: 'direction', type: 'VARCHAR(20) DEFAULT \'directed\'' },
      { name: 'color', type: 'VARCHAR(50) DEFAULT \'#9ca3af\'' },
      { name: 'style', type: 'VARCHAR(20) DEFAULT \'solid\'' },
      { name: 'properties', type: 'JSONB DEFAULT \'[]\'' }
    ];
    for (const col of relationsColumns) {
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_name = 'relations' AND column_name = '${col.name}') THEN
            ALTER TABLE relations ADD COLUMN ${col.name} ${col.type};
          END IF;
        END $$;
      `);
    }

    // 为 case_entities 添加溯源字段（迁移已有表）
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'case_entities' AND column_name = 'source_segment_ids') THEN
          ALTER TABLE case_entities ADD COLUMN source_segment_ids JSONB;
        END IF;
      END $$;
    `);

    // 创建 Schema 记忆表（AI 对 Schema 的累积理解）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_memory (
        id SERIAL PRIMARY KEY,
        schema_id INTEGER REFERENCES schemas(id) ON DELETE CASCADE,
        md_content TEXT NOT NULL,
        version INT DEFAULT 1,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建案例记忆表（提取进度和笔记）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS case_memory (
        id SERIAL PRIMARY KEY,
        case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
        md_content TEXT,
        text_summary JSONB,
        extraction_progress JSONB DEFAULT '{}',
        version INT DEFAULT 1,
        status VARCHAR(20) DEFAULT 'in_progress',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建文本片段表（段落级切分 + 实体线索索引）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS text_segments (
        id SERIAL PRIMARY KEY,
        case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
        segment_index INT NOT NULL,
        content TEXT NOT NULL,
        entity_hints JSONB DEFAULT '[]',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建向量列
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'case_entities' AND column_name = 'embedding') THEN
          ALTER TABLE case_entities ADD COLUMN embedding vector(1536);
        END IF;
      END $$;
    `);

    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'cases' AND column_name = 'embedding') THEN
          ALTER TABLE cases ADD COLUMN embedding vector(1536);
        END IF;
      END $$;
    `);

    // 创建向量索引
    await pool.query(`
      CREATE INDEX IF NOT EXISTS case_entities_embedding_idx
      ON case_entities
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100);
    `).catch(() => console.log('Using basic vector index for case_entities'));

    await pool.query(`
      CREATE INDEX IF NOT EXISTS cases_embedding_idx
      ON cases
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100);
    `).catch(() => console.log('Using basic vector index for cases'));

    // 创建全文搜索索引
    await pool.query(`
      CREATE INDEX IF NOT EXISTS case_entities_name_idx ON case_entities USING gin(to_tsvector('simple', name));
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS cases_name_desc_idx ON cases USING gin(to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '')));
    `);

    // 创建 Agent Meta 表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_meta (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        display_name VARCHAR(100),
        description TEXT,
        system_prompt TEXT NOT NULL,
        output_schema JSONB,
        context_type VARCHAR(50),
        supports_multi_turn BOOLEAN DEFAULT false,
        output_format VARCHAR(50) DEFAULT 'json',
        loop_config JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 为已有表添加 loop_config 列（迁移）
    await pool.query(`
      ALTER TABLE agent_meta ADD COLUMN IF NOT EXISTS loop_config JSONB;
    `);

    // 创建聊天历史表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        agent_name VARCHAR(50) NOT NULL,
        session_id VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建会话元数据表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        agent_name VARCHAR(50) NOT NULL,
        session_id VARCHAR(100) NOT NULL UNIQUE,
        title VARCHAR(200),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 初始化默认 Agent
    for (const agent of AGENTS_DATA) {
      const existing = await pool.query('SELECT id FROM agent_meta WHERE name = $1', [agent.name]);
      if (existing.rows.length === 0) {
        await pool.query(`
          INSERT INTO agent_meta (name, display_name, description, system_prompt, output_schema, context_type, supports_multi_turn, output_format, loop_config)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [agent.name, agent.display_name, agent.description, agent.system_prompt, JSON.stringify(agent.output_schema), agent.context_type, agent.supports_multi_turn, agent.output_format, JSON.stringify(agent.loop_config)]);
        console.log(`Agent '${agent.name}' created`);
      } else {
        await pool.query(`
          UPDATE agent_meta
          SET display_name = $2, description = $3, system_prompt = $4, output_schema = $5, context_type = $6, supports_multi_turn = $7, output_format = $8, loop_config = $9, updated_at = CURRENT_TIMESTAMP
          WHERE name = $1
        `, [agent.name, agent.display_name, agent.description, agent.system_prompt, JSON.stringify(agent.output_schema), agent.context_type, agent.supports_multi_turn, agent.output_format, JSON.stringify(agent.loop_config)]);
        console.log(`Agent '${agent.name}' updated`);
      }
    }

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error.message);
  }
}