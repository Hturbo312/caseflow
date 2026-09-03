-- ============================================================
-- CaseFlow 2.0 迁移 002：审核工作流 + 案例状态 + 证据状态 + 分析支撑
-- 2026-09-04  全部 IF NOT EXISTS / ADD COLUMN IF NOT EXISTS，可重复执行
-- 对应 Spec：§4.6 证据状态、§6.4 Review Service、§11 P0
-- ============================================================

-- ============ 案例状态（CaseLibrary 徽标用） ============
-- candidate 候选 | core 核心 | boundary 边界 | experiment 实验
ALTER TABLE cases ADD COLUMN IF NOT EXISTS case_status VARCHAR(20) NOT NULL DEFAULT 'candidate';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- ============ 证据状态（Spec §4.6：blocked 与 not_evidenced 严格区分） ============
-- confirmed 已确认 | limited 有限或间接支持 | blocked 有证据表明受阻 | not_evidenced 资料未说明
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'confirmed';
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- ============ 审核元数据（实体/关系状态机列 001 已建 status，这里补审核人与时间） ============
ALTER TABLE case_entities  ADD COLUMN IF NOT EXISTS reviewed_by INTEGER;
ALTER TABLE case_entities  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE case_relations ADD COLUMN IF NOT EXISTS reviewed_by INTEGER;
ALTER TABLE case_relations ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITHOUT TIME ZONE;

-- 审核决策记录：所有审核操作落表，包含旧值/新值，可恢复可追踪（Spec §5.4/§6.4）
CREATE TABLE IF NOT EXISTS review_decisions (
  id           SERIAL PRIMARY KEY,
  target_type  VARCHAR(20) NOT NULL,                 -- entity | relation | fact
  target_id    INTEGER NOT NULL,
  case_id      INTEGER,
  action       VARCHAR(20) NOT NULL,                 -- approve|edit|merge|skip|reject|restore|create
  old_value    JSONB,
  new_value    JSONB,
  reason       TEXT,
  operator_id  INTEGER,
  created_at   TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_review_decisions_target ON review_decisions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_review_decisions_case ON review_decisions(case_id);

-- ============ 原子事实元数据（来源引用如 C003-S1、证据属性） ============
ALTER TABLE atomic_facts ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- ============ 分析图表支撑视图：过程状态矩阵（确定性聚合，Spec §7.3-A） ============
-- 案例 × 过程状态（planned/piloted/deployed/adopted/adjusted/scaled/suspended/withdrawn/unknown）
CREATE OR REPLACE VIEW v_process_state_matrix AS
SELECT c.id AS case_id,
       COALESCE(
         ce.properties->>'process_state',
         ce.properties->>'deployment_state',
         'unknown'
       ) AS process_state,
       COUNT(*)::int AS entity_count
FROM cases c
JOIN case_entities ce ON ce.case_id = c.id
WHERE ce.status <> 'rejected'
  AND ce.entity_type IN (
    'Technology（技术）', 'Action / Event（行动与事件）'
  )
GROUP BY c.id, 2;

-- ============ 分析图表支撑视图：证据覆盖（Spec §7.3-D） ============
-- 案例 × 知识维度 × 证据状态，维度按 Schema 9 对象归组
CREATE OR REPLACE VIEW v_evidence_coverage AS
SELECT ce.case_id,
       CASE ce.entity_type
         WHEN 'Community Context（社区情境）' THEN 'background'
         WHEN 'Problem / Pressure（问题与压力）' THEN 'background'
         WHEN 'Task（社区更新任务）' THEN 'background'
         WHEN 'Technology（技术）' THEN 'deployment'
         WHEN 'Capability（技术能力）' THEN 'deployment'
         WHEN 'Action / Event（行动与事件）' THEN 'deployment'
         WHEN 'Organizational Response（组织响应）' THEN 'org_response'
         WHEN 'Spatial Response（空间响应）' THEN 'space_response'
         WHEN 'Behavioral / Service Response（行为与服务响应）' THEN 'service_response'
         WHEN 'Outcome（结果）' THEN 'outcome'
         WHEN 'Constraint / Adjustment（约束与调整）' THEN 'outcome'
         ELSE 'other'
       END AS dimension,
       COALESCE(ev.status, 'not_evidenced') AS evidence_status,
       COUNT(DISTINCT ce.id)::int AS entity_count
FROM case_entities ce
LEFT JOIN evidence ev ON ev.entity_id = ce.id
WHERE ce.status <> 'rejected'
GROUP BY ce.case_id, ce.entity_type, ev.status;

-- 说明：'other' 维度（Actor、Object/Scale 等）不参与证据覆盖图展示，仅在审计时使用。
