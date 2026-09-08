-- CaseFlow 案例级访问控制
-- 存量案例默认迁移给管理员；新案例通过 created_by + case_access 归属创建者。
ALTER TABLE cases ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS case_access (
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (case_id, user_id),
  CONSTRAINT case_access_role_check CHECK (role IN ('owner', 'editor', 'viewer'))
);
CREATE INDEX IF NOT EXISTS idx_case_access_user ON case_access(user_id);
CREATE INDEX IF NOT EXISTS idx_case_access_case ON case_access(case_id);

-- 仅为尚未归属的存量案例建立管理员访问记录；不覆盖已有明确归属。
WITH admin_user AS (
  SELECT id FROM users WHERE role = 'admin' AND COALESCE(disabled, false) = false ORDER BY id LIMIT 1
), legacy_cases AS (
  SELECT c.id FROM cases c WHERE c.created_by IS NULL
)
INSERT INTO case_access(case_id, user_id, role)
SELECT legacy_cases.id, admin_user.id, 'owner'
FROM legacy_cases CROSS JOIN admin_user
ON CONFLICT (case_id, user_id) DO NOTHING;

UPDATE cases c SET created_by = ca.user_id
FROM case_access ca
WHERE ca.case_id = c.id AND ca.role = 'owner' AND c.created_by IS NULL;
