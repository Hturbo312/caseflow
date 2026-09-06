import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';
import pool from '../db.js';

// 认证中间件：JWT 校验后每请求查库取最新 role/disabled——
// 管理员的禁用/降级操作立即生效，不依赖旧 token 里的角色快照
export const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: '未登录', requireAuth: true });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ error: '登录已过期，请重新登录', requireAuth: true });
  }

  try {
    const { rows } = await pool.query('SELECT role, disabled FROM users WHERE id = $1', [decoded.id]);
    if (rows.length === 0) {
      return res.status(401).json({ error: '用户不存在', requireAuth: true });
    }
    if (rows[0].disabled) {
      return res.status(403).json({ error: '账号已被禁用，请联系管理员', requireAuth: true, disabled: true });
    }
    req.user = { ...decoded, role: rows[0].role };
    next();
  } catch (error) {
    console.error('[auth] 用户状态查询失败:', error.message);
    return res.status(500).json({ error: '认证查询失败' });
  }
};

// 管理员守卫：非 admin 一律 403
export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
};
