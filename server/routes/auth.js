import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { JWT_SECRET } from '../config.js';
import { authMiddleware, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// 注册
router.post('/register', async (req, res) => {
  const { username, password, email } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码是必需的' });
  }

  if (username.length < 3 || password.length < 6) {
    return res.status(400).json({ error: '用户名至少3位，密码至少6位' });
  }

  try {
    const existingUser = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3) RETURNING id, username, email, role, created_at',
      [username, passwordHash, email || null]
    );

    const user = result.rows[0];

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
      token
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ error: '注册失败: ' + error.message });
  }
});

// 登录
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }

  try {
    const result = await pool.query('SELECT id, username, password_hash, email, role, disabled, created_at FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const user = result.rows[0];

    if (user.disabled) {
      return res.status(403).json({ error: '账号已被禁用，请联系管理员', disabled: true });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
      token
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// 验证 token（查库返回最新角色/禁用状态，旧 token 中的角色快照不作数）
router.get('/verify', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, email, role, disabled, created_at FROM users WHERE id = $1', [req.user.id]);
    if (rows.length === 0) {
      return res.status(401).json({ valid: false, requireAuth: true });
    }
    res.json({ valid: true, user: rows[0] });
  } catch (error) {
    res.status(500).json({ error: '验证失败' });
  }
});

// ============================================================
// 管理员后台：用户管理（admin 可管理用户，普通用户 403）
// 自保护：管理员不能修改/禁用/删除自己的角色与状态，避免误锁
// ============================================================

// 用户列表
router.get('/users', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.username, u.email, u.role, u.disabled, u.created_at,
             (SELECT COUNT(*)::int FROM case_research_work w WHERE w.user_id = u.id) AS research_count,
             (SELECT COUNT(*)::int FROM chat_sessions cs WHERE cs.user_id = u.id) AS session_count
      FROM users u ORDER BY u.id`);
    res.json({ users: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建用户（管理员手动开户，绕开开放注册）
router.post('/users', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { username, password, email, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: '用户名和密码是必需的' });
    if (username.length < 3 || password.length < 6) {
      return res.status(400).json({ error: '用户名至少3位，密码至少6位' });
    }
    const dup = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (dup.rows.length > 0) return res.status(409).json({ error: '用户名已存在' });
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, email, role) VALUES ($1, $2, $3, $4)
       RETURNING id, username, email, role, disabled, created_at`,
      [username, passwordHash, email || null, role === 'admin' ? 'admin' : 'user']);
    res.json({ user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 修改用户（角色/禁用/重置密码）
router.patch('/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const { role, disabled, password } = req.body;
    if (targetId === req.user.id && (role !== undefined || disabled !== undefined)) {
      return res.status(400).json({ error: '不能修改自己的角色或禁用状态' });
    }
    if (role !== undefined && !['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'role 只能是 admin 或 user' });
    }
    const target = await pool.query('SELECT id FROM users WHERE id = $1', [targetId]);
    if (target.rows.length === 0) return res.status(404).json({ error: '用户不存在' });

    const sets = [];
    const params = [];
    let i = 0;
    if (role !== undefined) { i++; sets.push(`role = $${i}`); params.push(role); }
    if (disabled !== undefined) { i++; sets.push(`disabled = $${i}`); params.push(!!disabled); }
    if (password !== undefined) {
      if (password.length < 6) return res.status(400).json({ error: '密码至少6位' });
      i++; sets.push(`password_hash = $${i}`); params.push(await bcrypt.hash(password, 10));
    }
    if (sets.length === 0) return res.status(400).json({ error: '没有需要修改的字段' });
    i++; params.push(targetId);
    const result = await pool.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${i}
       RETURNING id, username, email, role, disabled, created_at`, params);
    res.json({ user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除用户（连带其会话/聊天/AI配置/研究工作；不可删除自己）
router.delete('/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (targetId === req.user.id) {
    return res.status(400).json({ error: '不能删除自己的账号' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const target = await client.query('SELECT id, username FROM users WHERE id = $1 FOR UPDATE', [targetId]);
    if (target.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '用户不存在' });
    }
    await client.query('DELETE FROM chat_history WHERE user_id = $1', [targetId]);
    await client.query('DELETE FROM chat_sessions WHERE user_id = $1', [targetId]);
    await client.query('DELETE FROM user_ai_configs WHERE user_id = $1', [targetId]);
    await client.query('DELETE FROM case_research_work WHERE user_id = $1', [targetId]);
    await client.query('DELETE FROM users WHERE id = $1', [targetId]);
    await client.query('COMMIT');
    res.json({ success: true, deleted: target.rows[0].username });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// 登出
router.post('/logout', (req, res) => {
  res.json({ success: true });
});

export default router;