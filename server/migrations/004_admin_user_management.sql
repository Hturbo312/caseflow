-- ============================================================
-- CaseFlow 2.0 迁移 004：管理员后台（用户管理）
-- 2026-09-06  可重复执行
-- 权限模型：admin 可管理用户（角色/禁用/删除/创建/重置密码），user 不可；
--           disabled 账号登录与所有 API 立即失效（中间件每请求查库）。
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT false;

-- 引导管理员：首个账号 + 研究常用账号（后续可在用户管理界面自行调整）
UPDATE users SET role = 'admin' WHERE id = 1 AND role IS DISTINCT FROM 'admin';
UPDATE users SET role = 'admin' WHERE username = 'test22' AND role IS DISTINCT FROM 'admin';
