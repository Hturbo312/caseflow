import { useState, useRef, useEffect, useMemo } from 'react';
import { Settings, LogIn, LogOut, User, Send, Sparkles, AlertCircle } from 'lucide-react';
import { useAuthStore, useSchemaStore, useCaseStore } from '../../../../store';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { aiApi } from '../../../../services/api';
import { useAIConfig } from '../CaseExtractor/hooks/useAIConfig';
import SettingsModal from '../CaseExtractor/SettingsModal';

/**
 * 左栏 AI Copilot（Spec §3.1）
 * 顶部账户与 AI 配置区 → 上下文条 → 对话主体
 * AI 只解释与建议，不改变当前案例/比较集/Schema 版本
 */
export default function CopilotRail({ onShowLogin }) {
  const { isAuthenticated, user, logout } = useAuthStore();
  const { schemas, currentSchemaId } = useSchemaStore();
  const { cases } = useCaseStore();
  const { caseDetailId, contextTask } = useWorkspaceStore();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  // AI 配置（复用 CaseExtractor 的配置逻辑与设置弹窗）
  const ai = useAIConfig(onShowLogin);

  const currentCase = useMemo(
    () => cases.find((c) => String(c.id) === String(caseDetailId)),
    [cases, caseDetailId]
  );
  const currentSchema = useMemo(
    () => schemas.find((s) => s.id === currentSchemaId || String(s.id) === String(currentSchemaId)),
    [schemas, currentSchemaId]
  );

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const contextLines = [
    ['当前 Schema', currentSchema?.name || '未选择'],
    ['当前案例', currentCase ? `${currentCase.name}` : '未打开（在右侧案例库单击选择）'],
    ['当前任务', contextTask],
  ];

  const buildSystemPrompt = () => [
    '你是 CaseFlow 研究工作台的 AI Copilot，辅助研究者做城市更新案例知识研究。',
    '你必须遵守：',
    '1. 只解释、提出假设和提示证据缺口，不代替研究者做结论；',
    '2. 不声称因果关系，图谱相似不等于经验可迁移；',
    '3. 区分「资料未说明(not_evidenced)」和「明确受阻(blocked)」；',
    '4. 回答应基于研究者提供的上下文与查询结果，不编造证据。',
    `当前上下文：Schema=${currentSchema?.name || '未选择'}；案例=${currentCase?.name || '未打开'}；任务=${contextTask}。`,
  ].join('\n');

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    if (!isAuthenticated) return onShowLogin?.();

    if (!ai.configStatus.configured) {
      setMessages((m) => [...m,
        { role: 'user', content: text },
        { role: 'assistant', content: '尚未配置 AI 服务。请点击顶部「AI设置」配置 Endpoint 与 API Key 后再使用对话功能。', hint: true },
      ]);
      setInput('');
      return;
    }

    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      const payload = [
        { role: 'system', content: buildSystemPrompt() },
        ...next.slice(-12).map((m) => ({ role: m.role, content: m.content })),
      ];
      const data = await aiApi.proxy(payload);
      const reply = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '(空响应)';
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: `请求失败：${e.message}`, hint: true }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="ws-copilot">
      {/* 顶部账户与 AI 配置区（Spec §3.1.1） */}
      <div className="ws-account-strip">
        {isAuthenticated ? (
          <>
            <span className="ws-account-dot" />
            <User size={13} className="ws-account-user" />
            <span className="ws-account-name" title={user?.username}>{user?.username}</span>
            <span className={`ws-ai-status ${ai.configStatus.configured ? 'ok' : 'off'}`}>
              AI：{ai.configStatus.configured ? '已配置' : '未配置'}
            </span>
            <button className="ws-account-btn" onClick={ai.handleOpenSettings} title="AI 设置">
              <Settings size={14} /> AI设置
            </button>
            <button className="ws-account-btn" onClick={logout} title="退出登录">
              <LogOut size={13} />
            </button>
          </>
        ) : (
          <>
            <span className="ws-account-dot off" />
            <span className="ws-account-name">未登录（可浏览，AI 功能需登录）</span>
            <button className="ws-account-btn primary" onClick={onShowLogin}>
              <LogIn size={13} /> 登录 / 注册
            </button>
          </>
        )}
      </div>

      {/* 上下文条（Spec §3.1 必须显示） */}
      <div className="ws-context-bar">
        {contextLines.map(([k, v]) => (
          <div className="ws-context-line" key={k}>
            <span className="ws-context-key">{k}</span>
            <span className="ws-context-val" title={v}>{v}</span>
          </div>
        ))}
      </div>

      {/* 对话主体 */}
      <div className="ws-chat" ref={listRef}>
        {messages.length === 0 && (
          <div className="ws-chat-empty">
            <Sparkles size={22} />
            <p>向 AI Copilot 提问</p>
            <span>例如：对比 C003 与 C007 的组织响应差异；这个案例还有哪些证据缺口？</span>
            <span className="ws-chat-note">AI 建议不会自动修改 Schema、案例或比较集</span>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`ws-msg ${m.role}${m.hint ? ' hint' : ''}`}>
            {m.role === 'assistant' && <div className="ws-msg-tag">Copilot</div>}
            <div className="ws-msg-bubble">{m.content}</div>
          </div>
        ))}
        {sending && <div className="ws-msg assistant"><div className="ws-msg-bubble typing">正在思考…</div></div>}
      </div>

      <div className="ws-chat-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
          }}
          placeholder={isAuthenticated ? '输入问题，Enter 发送，Shift+Enter 换行' : '登录后可用 AI 对话'}
          rows={2}
          disabled={sending}
        />
        <button className="ws-chat-send" onClick={handleSend} disabled={sending || !input.trim()} title="发送">
          <Send size={15} />
        </button>
      </div>

      {messages.some((m) => m.hint) && !ai.configStatus.configured && isAuthenticated && (
        <div className="ws-config-hint" onClick={ai.handleOpenSettings}>
          <AlertCircle size={13} /> 未配置 AI 服务，点击配置
        </div>
      )}

      <SettingsModal
        showSettings={ai.showSettings}
        isAuthenticated={isAuthenticated}
        configStatus={ai.configStatus}
        localConfig={ai.localConfig}
        isSavingConfig={ai.isSavingConfig}
        showApiKey={ai.showApiKey}
        onSaveConfig={ai.handleSaveConfig}
        onDeleteConfig={ai.handleDeleteConfig}
        onClose={() => ai.setShowSettings(false)}
        onSetLocalConfig={ai.updateLocalConfig}
        onToggleApiKey={() => ai.setShowApiKey(!ai.showApiKey)}
      />
    </div>
  );
}
