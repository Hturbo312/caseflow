-- ============================================================
-- CaseFlow 知识四层模型迁移（L0原文层 / L1事实层 / L2知识层 / L3规则层）
-- 2026-09-04  全部使用 IF NOT EXISTS / ADD COLUMN IF NOT EXISTS，可重复执行
-- ============================================================

-- ============ L0 原文层 ============

-- 多源材料文档
CREATE TABLE IF NOT EXISTS documents (
  id            SERIAL PRIMARY KEY,
  case_id       INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  source_type   VARCHAR(20) NOT NULL DEFAULT 'manual',  -- pdf|web|report|manual|legacy
  title         VARCHAR(500),
  uri           TEXT,                                   -- URL 或文件路径
  authors       TEXT,
  pub_year      VARCHAR(10),
  content_hash  VARCHAR(64),                            -- 去重与完整性校验
  created_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_documents_case ON documents(case_id);

-- 原文分段：补充文档归属与精确定位锚点（页码 + 字符偏移）
ALTER TABLE text_segments ADD COLUMN IF NOT EXISTS document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL;
ALTER TABLE text_segments ADD COLUMN IF NOT EXISTS page INTEGER;
ALTER TABLE text_segments ADD COLUMN IF NOT EXISTS char_start INTEGER;
ALTER TABLE text_segments ADD COLUMN IF NOT EXISTS char_end INTEGER;
CREATE INDEX IF NOT EXISTS idx_segments_document ON text_segments(document_id);

-- ============ L1 事实层 ============

-- 原子事实：从原文段拆解的最小可追溯知识单元，独立于 Schema（Schema 调整无需重拆）
CREATE TABLE IF NOT EXISTS atomic_facts (
  id          SERIAL PRIMARY KEY,
  case_id     INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  segment_id  INTEGER REFERENCES text_segments(id) ON DELETE SET NULL,
  fact_text   TEXT NOT NULL,
  fact_type   VARCHAR(50),                              -- 预留：事实分类
  confidence  REAL,
  status      VARCHAR(20) NOT NULL DEFAULT 'draft',     -- draft|confirmed|rejected
  run_id      INTEGER,                                  -- 预留：抽取批次
  created_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_facts_case ON atomic_facts(case_id);
CREATE INDEX IF NOT EXISTS idx_facts_segment ON atomic_facts(segment_id);

-- ============ L2 知识层 ============

-- 证据快照：知识节点/关系 ↔ 原文。除 ID 链外冗余存储逐字引文（反幻觉校核 + 文档变更后仍可回溯）
CREATE TABLE IF NOT EXISTS evidence (
  id          SERIAL PRIMARY KEY,
  entity_id   INTEGER REFERENCES case_entities(id) ON DELETE CASCADE,
  relation_id INTEGER REFERENCES case_relations(id) ON DELETE CASCADE,
  segment_id  INTEGER REFERENCES text_segments(id) ON DELETE SET NULL,
  quote       TEXT NOT NULL,                            -- 逐字引文快照
  char_start  INTEGER,
  char_end    INTEGER,
  confidence  REAL,
  source      VARCHAR(20) NOT NULL DEFAULT 'extraction', -- extraction|manual|legacy
  created_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT evidence_target_check CHECK (
    (entity_id IS NOT NULL AND relation_id IS NULL) OR
    (entity_id IS NULL AND relation_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_evidence_entity ON evidence(entity_id);
CREATE INDEX IF NOT EXISTS idx_evidence_relation ON evidence(relation_id);

-- 人工校核状态机（存量数据默认已确认）
ALTER TABLE case_entities  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'confirmed';
ALTER TABLE case_relations ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'confirmed';

-- ============ L3 规则层（概念对齐） ============

-- 共享概念：跨案例比较坐标系中的规范节点
CREATE TABLE IF NOT EXISTS concepts (
  id         SERIAL PRIMARY KEY,
  schema_id  INTEGER REFERENCES schemas(id) ON DELETE CASCADE,
  key        VARCHAR(100) NOT NULL,                     -- 稳定标识，如 participation
  label      VARCHAR(200) NOT NULL,                     -- 展示名
  aliases    JSONB DEFAULT '[]',
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(schema_id, key)
);

-- 案例原生概念 → 共享概念映射（AI 建议 + 人工确认）
CREATE TABLE IF NOT EXISTS concept_mappings (
  id            SERIAL PRIMARY KEY,
  case_id       INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  native_term   VARCHAR(300) NOT NULL,
  concept_id    INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  mapping_type  VARCHAR(20) NOT NULL DEFAULT 'exact',   -- exact|synonym|broader|narrower
  confidence    REAL,
  verified      BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(case_id, native_term, concept_id)
);
CREATE INDEX IF NOT EXISTS idx_concept_mappings_concept ON concept_mappings(concept_id);
