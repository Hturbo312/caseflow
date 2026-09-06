import { useState, useEffect, useCallback } from 'react';
import { X, Shield, Loader2, Plus, Trash2, UserCheck, UserX, KeyRound, AlertTriangle } from 'lucide-react';
import { adminApi } from '../../../../services/api';
import { useAuthStore } from '../../../../store';

/**
 * 管理员后台：用户管理（Spec：管理员可管理用户，普通用户不可见此入口）
 * 操作全部有服务端 requireAdmin 守卫；管理员不能修改/禁用/删除自己。
 */
export default function AdminPanel({ isOpen, onClose }) {
  const me = useAuthStore((s) => s.user);
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', email: '', role: 'user' });

  const reload = useCallback(async () => {
    try {
      const d = await adminApi.users();
      setUsers(d.users || []);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    if (isOpen) { setUsers(null); setError(''); setNotice(''); reload(); }
  }, [isOpen, reload]);

  const act = async (id, label, fn) => {
    setBusyId(`${id}-${label}`);
    setError(''); setNotice('');
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const toggleRole = (u) => act(u.id, 'role', () =>
    adminApi.updateUser(u.id, { role: u.role === 'admin' ? 'user' : 'admin' }));

  const toggleDisabled = (u) => act(u.id, 'disabled', () =>
    adminApi.updateUser(u.id, { disabled: !u.disabled }));

  const resetPassword = (u) => {
    const pwd = window.prompt(`为用户「${u.username}」设置新密码（至少6位）：`);
    if (!pwd) return;
    act(u.id, 'pwd', () => adminApi.updateUser(u.id, { password: pwd }))
      .then(() => setNotice(`已重置 ${u.username} 的密码`));
  };

  const remove = (u) => {
    if (!window.confirm(`确定删除用户「${u.username}」？其会话、聊天与 AI 配置将一并删除。`)) return;
    act(u.id, 'del', () => adminApi.deleteUser(u.id))
      .then(() => setNotice(`已删除 ${u.username}`));
  };

  const createUser = async () => {
    setBusyId('new');
    setError('');
    try {
      await adminApi.createUser(form);
      setForm({ username: '', password: '', email: '', role: 'user' });
      setCreating(false);
      await reload();
      setNotice('用户已创建');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="ws-admin" onClick={(e) => e.stopPropagation()}>
        <div className="ws-admin-head">
          <Shield size={16} />
          <h2>用户管理</h2>
          <span className="ws-admin-sub">管理员后台 · 普通用户不可见</span>
          <button className="ws-admin-close" onClick={onClose} aria-label="关闭"><X size={16} /></button>
        </div>

        {error && <div className="ws-versionbar-error"><AlertTriangle size={11} /> {error}</div>}
        {notice && <div className="ws-admin-notice">{notice}</div>}

        <div className="ws-admin-toolbar">
          <button className="ws-act ok" onClick={() => setCreating(!creating)}>
            <Plus size={12} /> 新建用户
          </button>
          <span className="ws-admin-count">{users ? `${users.length} 个账号` : ''}</span>
        </div>

        {creating && (
          <div className="ws-admin-create">
            <input placeholder="用户名（≥3位）" value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <input placeholder="密码（≥6位）" type="password" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <input placeholder="邮箱（可选）" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="user">普通用户</option>
              <option value="admin">管理员</option>
            </select>
            <button className="ws-act ok" disabled={busyId === 'new' || !form.username || !form.password} onClick={createUser}>
              {busyId === 'new' ? <Loader2 size={12} className="spin" /> : <Plus size={12} />} 创建
            </button>
            <button className="ws-act" onClick={() => setCreating(false)}><X size={12} /> 取消</button>
          </div>
        )}

        {!users ? (
          <div className="ws-loading"><Loader2 size={16} className="spin" /> 加载中…</div>
        ) : (
          <div className="ws-admin-table">
            <div className="ws-admin-tr ws-admin-th">
              <span>用户</span><span>邮箱</span><span>角色</span><span>状态</span><span>注册时间</span><span>操作</span>
            </div>
            {users.map((u) => {
              const isSelf = me?.id === u.id;
              const busy = (a) => busyId === `${u.id}-${a}`;
              return (
                <div className={`ws-admin-tr${u.disabled ? ' disabled' : ''}`} key={u.id}>
                  <span className="ws-admin-user">
                    <b>{u.username}</b>
                    {isSelf && <span className="ws-badge code">我</span>}
                    {u.role === 'admin' && <span className="ws-badge warn">管理员</span>}
                  </span>
                  <span className="ws-admin-email">{u.email || '—'}</span>
                  <span>{u.role === 'admin' ? '管理员' : '用户'}</span>
                  <span>
                    <span className={`ws-badge ${u.disabled ? 'bad' : 'ok'}`}>{u.disabled ? '已禁用' : '正常'}</span>
                  </span>
                  <span className="ws-admin-date">{new Date(u.created_at).toLocaleDateString('zh-CN')}</span>
                  <span className="ws-admin-ops">
                    <button className="ws-act" disabled={isSelf || busy('role')} title={isSelf ? '不能修改自己' : ''}
                      onClick={() => toggleRole(u)}>
                      <UserCheck size={11} /> {u.role === 'admin' ? '降为用户' : '设为管理员'}
                    </button>
                    <button className={`ws-act ${u.disabled ? 'ok' : 'bad'}`} disabled={isSelf || busy('disabled')} title={isSelf ? '不能禁用自己' : ''}
                      onClick={() => toggleDisabled(u)}>
                      <UserX size={11} /> {u.disabled ? '启用' : '禁用'}
                    </button>
                    <button className="ws-act" disabled={busy('pwd')} onClick={() => resetPassword(u)}>
                      <KeyRound size={11} /> 重置密码
                    </button>
                    <button className="ws-act bad" disabled={isSelf || busy('del')} title={isSelf ? '不能删除自己' : ''}
                      onClick={() => remove(u)}>
                      <Trash2 size={11} /> 删除
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
