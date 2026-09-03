-- ============================================================
-- CaseFlow 2.0 迁移 003：Dynamic Schema 版本控制 + 稳定键 + 原子事实断言
-- 2026-09-04  全部 IF NOT EXISTS，可重复执行
-- 对应 Spec：§4.2 版本表、§4.3 稳定键、§4.5 断言表、§11 P1
-- 设计说明：schemas 表保留为兼容层；schema_versions.legacy_schema_id 指向它，
--           draft 版本克隆父版本的类型到新 legacy schema 行，发布后激活。
-- ============================================================

-- ============ Schema 家族与版本 ============
CREATE TABLE IF NOT EXISTS schema_families (
  id          SERIAL PRIMARY KEY,
  key         VARCHAR(100) UNIQUE,
  name        VARCHAR(300) NOT NULL,
  description TEXT,
  created_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schema_versions (
  id                SERIAL PRIMARY KEY,
  family_id         INTEGER NOT NULL REFERENCES schema_families(id),
  version_key       VARCHAR(50) NOT NULL,               -- v1.0 / v1.1 …
  legacy_schema_id  INTEGER REFERENCES schemas(id),     -- 兼容层指针
  parent_version_id INTEGER REFERENCES schema_versions(id),
  status            VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft|active|frozen|archived
  research_question TEXT,
  change_reason     TEXT,
  created_by        INTEGER,
  approved_by       INTEGER,
  created_at        TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  approved_at       TIMESTAMP WITHOUT TIME ZONE,
  frozen_at         TIMESTAMP WITHOUT TIME ZONE,
  UNIQUE(family_id, version_key)
);
CREATE INDEX IF NOT EXISTS idx_schema_versions_family ON schema_versions(family_id);

-- 版本内变更日志（每次类型/关系修改追加一条）
CREATE TABLE IF NOT EXISTS schema_changes (
  id                SERIAL PRIMARY KEY,
  schema_version_id INTEGER NOT NULL REFERENCES schema_versions(id) ON DELETE CASCADE,
  change_type       VARCHAR(40) NOT NULL,               -- add_entity_type|deprecate_entity_type|add_relation|change_relation_direction|edit_property…
  target_key        VARCHAR(100),
  payload           JSONB,
  created_by        INTEGER,
  created_at        TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_schema_changes_version ON schema_changes(schema_version_id);

-- 版本迁移运行（改版后的重映射 / 局部重抽取批次）
CREATE TABLE IF NOT EXISTS schema_migration_runs (
  id             SERIAL PRIMARY KEY,
  from_version_id INTEGER REFERENCES schema_versions(id),
  to_version_id  INTEGER NOT NULL REFERENCES schema_versions(id),
  run_type       VARCHAR(20) NOT NULL DEFAULT 'remap',  -- remap|reextract
  status         VARCHAR(20) NOT NULL DEFAULT 'pending',-- pending|running|done|failed
  stats          JSONB,
  created_at     TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  finished_at    TIMESTAMP WITHOUT TIME ZONE
);

-- ============ 稳定键（不可变；名称与颜色可改） ============
ALTER TABLE entity_types ADD COLUMN IF NOT EXISTS stable_key VARCHAR(100);
ALTER TABLE relations    ADD COLUMN IF NOT EXISTS stable_key VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS uq_entity_types_schema_stablekey
  ON entity_types(schema_id, stable_key) WHERE stable_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_relations_schema_stablekey
  ON relations(schema_id, stable_key) WHERE stable_key IS NOT NULL;

-- Schema 9 回填：'Community Context（社区情境）' → community_context；'shapes_task（塑造任务）' → shapes_task
UPDATE entity_types
SET stable_key = LOWER(REPLACE(REPLACE(REPLACE(SPLIT_PART(name, '（', 1), ' / ', '_'), ' ', '_'), '-', '_'))
WHERE schema_id = 9 AND stable_key IS NULL;

UPDATE relations
SET stable_key = LOWER(REPLACE(REPLACE(REPLACE(SPLIT_PART(name, '（', 1), ' / ', '_'), ' ', '_'), '-', '_'))
WHERE schema_id = 9 AND stable_key IS NULL;

-- ============ 案例实体/关系 → 类型表外键化（逐步替代自由字符串） ============
ALTER TABLE case_entities  ADD COLUMN IF NOT EXISTS entity_type_id INTEGER REFERENCES entity_types(id) ON DELETE SET NULL;
ALTER TABLE case_entities  ADD COLUMN IF NOT EXISTS schema_version_id INTEGER;
ALTER TABLE case_relations ADD COLUMN IF NOT EXISTS relation_type_id INTEGER REFERENCES relations(id) ON DELETE SET NULL;
ALTER TABLE case_relations ADD COLUMN IF NOT EXISTS schema_version_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_case_entities_type_id  ON case_entities(entity_type_id);
CREATE INDEX IF NOT EXISTS idx_case_relations_type_id ON case_relations(relation_type_id);

-- ============ 原子事实断言（L1 与 L2 的版本化关联，Spec §4.5） ============
CREATE TABLE IF NOT EXISTS fact_entity_assertions (
  id                SERIAL PRIMARY KEY,
  fact_id           INTEGER NOT NULL REFERENCES atomic_facts(id) ON DELETE CASCADE,
  entity_id         INTEGER NOT NULL REFERENCES case_entities(id) ON DELETE CASCADE,
  schema_version_id INTEGER,
  assertion_status  VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending|confirmed|rejected
  created_at        TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(fact_id, entity_id)
);
CREATE TABLE IF NOT EXISTS fact_relation_assertions (
  id                SERIAL PRIMARY KEY,
  fact_id           INTEGER NOT NULL REFERENCES atomic_facts(id) ON DELETE CASCADE,
  relation_id       INTEGER NOT NULL REFERENCES case_relations(id) ON DELETE CASCADE,
  schema_version_id INTEGER,
  assertion_status  VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at        TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(fact_id, relation_id)
);
CREATE INDEX IF NOT EXISTS idx_fea_entity ON fact_entity_assertions(entity_id);
CREATE INDEX IF NOT EXISTS idx_fra_relation ON fact_relation_assertions(relation_id);

-- ============ 注册论文 Schema 家族与 v1.0 版本 ============
INSERT INTO schema_families (key, name, description)
VALUES ('thesis_dynamic_schema', 'Urban CaseFlow 论文 Dynamic Schema',
        '研究者主导、AI 辅助、证据约束、版本可追踪的 Schema 演化机制（Spec §12）')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_versions (family_id, version_key, legacy_schema_id, status, research_question, change_reason, approved_at)
SELECT f.id, 'v1.0', 9, 'active',
       '数字与智能技术如何嵌入社区更新：技术能力如何进入社区任务、引发何种组织/空间/行为响应、证据边界在哪里',
       '论文第一个研究配置版本（自 schemas 表升级注册）',
       CURRENT_TIMESTAMP
FROM schema_families f
WHERE f.key = 'thesis_dynamic_schema'
  AND NOT EXISTS (SELECT 1 FROM schema_versions v WHERE v.family_id = f.id AND v.version_key = 'v1.0');

-- ============ 回填案例实体/关系的类型外键（仅 Schema 9 案例） ============
UPDATE case_entities ce
SET entity_type_id = et.id,
    schema_version_id = v.id
FROM entity_types et
JOIN schema_versions v ON v.legacy_schema_id = et.schema_id AND v.status = 'active'
WHERE et.schema_id = 9
  AND ce.entity_type = et.name
  AND ce.entity_type_id IS NULL;

UPDATE case_relations cr
SET relation_type_id = r.id,
    schema_version_id = v.id
FROM relations r
JOIN schema_versions v ON v.legacy_schema_id = r.schema_id AND v.status = 'active'
WHERE r.schema_id = 9
  AND cr.relation_type = r.name
  AND cr.relation_type_id IS NULL;

-- ============ 回填证据断言：evidence ↔ atomic_facts（管线生成的记录带 metadata.evidence_id） ============
INSERT INTO fact_entity_assertions (fact_id, entity_id, schema_version_id, assertion_status)
SELECT af.id, (af.metadata->>'target_id')::int, v.id, 'confirmed'
FROM atomic_facts af
JOIN schema_versions v ON v.legacy_schema_id = 9 AND v.status = 'active'
WHERE af.fact_type = 'entity_evidence'
  AND af.metadata->>'target_type' = 'entity'
  AND af.metadata->>'target_id' IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO fact_relation_assertions (fact_id, relation_id, schema_version_id, assertion_status)
SELECT af.id, (af.metadata->>'target_id')::int, v.id, 'confirmed'
FROM atomic_facts af
JOIN schema_versions v ON v.legacy_schema_id = 9 AND v.status = 'active'
WHERE af.fact_type = 'relation_evidence'
  AND af.metadata->>'target_type' = 'relation'
  AND af.metadata->>'target_id' IS NOT NULL
ON CONFLICT DO NOTHING;
