import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Settings, Send, Sparkles, AlertCircle } from 'lucide-react';
import { useAuthStore, useSchemaStore, useCaseStore } from '../../../../store';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { useI18n } from '../../../../i18n';
import { aiApi } from '../../../../services/api';
import { useAIConfig } from '../CaseExtractor/hooks/useAIConfig';
import SettingsModal from '../CaseExtractor/SettingsModal';

/**
 * 左栏 AI Copilot（Spec §3.1）
 * 顶部账户与 AI 配置区 → 上下文条 → 对话主体
 * AI 只解释与建议，不改变当前案例/比较集/Schema 版本
 */
export default function CopilotRail({ onShowLogin }) {
  const { t } = useI18n();
  const { isAuthenticated } = useAuthStore();
  const { schemas, currentSchemaId } = useSchemaStore();
  const { cases } = useCaseStore();
  const { caseDetailId, contextTask, copilotSeed } = useWorkspaceStore();
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
    [t('case.currentSchema'), currentSchema?.name || t('common.notSelected')],
    [t('v2.context.case'), currentCase ? `${currentCase.name}` : t('v2.context.noCase')],
    [t('v2.context.task'), t(contextTask)],
  ];

  const buildSystemPrompt = () => [
    '你是 CaseFlow 研究工作台的 AI Copilot，辅助研究者做城市更新案例知识研究。',
    '你必须遵守：',
    '1. 只解释、提出假设和提示证据缺口，不代替研究者做结论；',
    '2. 不声称因果关系，图谱相似不等于经验可迁移；',
    '3. 区分「资料未说明(not_evidenced)」和「明确受阻(blocked)」；',
    '4. 回答应基于研究者提供的上下文与查询结果，不编造证据。',
    `当前上下文：Schema=${currentSchema?.name || '未选择'}；案例=${currentCase?.name || '未打开'}；任务=${t(contextTask)}。`,
  ].join('\n');

  // 发送逻辑（参数化为文本）：登录 / AI 配置等分支都保留在这里，
  // 供输入框 handleSend 与「问AI」种子共用
  const sendText = useCallback(async (raw) => {
    const text = String(raw || '').trim();
    if (!text || sending) return;
    if (!isAuthenticated) return onShowLogin?.();

    if (!ai.configStatus.configured) {
      setMessages((m) => [...m,
        { role: 'user', content: text },
        { role: 'assistant', content: t('v2.ai.notConfiguredHint'), hint: true },
      ]);
      return;
    }

    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setSending(true);
    try {
      const payload = [
        { role: 'system', content: buildSystemPrompt() },
        ...next.slice(-12).map((m) => ({ role: m.role, content: m.content })),
      ];
      const data = await aiApi.proxy(payload);
      const reply = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || t('v2.ai.emptyResponse');
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: t('v2.ai.requestFailed', { msg: e.message }), hint: true }]);
    } finally {
      setSending(false);
    }
  }, [messages, sending, isAuthenticated, onShowLogin, ai.configStatus.configured, t,
    currentSchema?.name, currentCase?.name, contextTask]); // buildSystemPrompt 只读这些值

  const handleSend = () => {
    const text = input.trim();
    if (!text || sending) return;
    sendText(text);
    // 与原行为一致：已登录才清空输入（未登录时唤起登录框、保留草稿）
    if (isAuthenticated) setInput('');
  };

  // 「问AI」种子：任何视图 askCopilot() 后自动发送。
  // 用 ts 去重（ref 记录上次已处理的 ts），经 sendTextRef 调用最新 sendText 避免 stale closure
  const sendTextRef = useRef(sendText);
  useEffect(() => { sendTextRef.current = sendText; }, [sendText]);
  const lastSeedTsRef = useRef(0);
  const seedTs = copilotSeed?.ts;
  useEffect(() => {
    if (!seedTs || seedTs === lastSeedTsRef.current) return;
    lastSeedTsRef.current = seedTs;
    sendTextRef.current?.(copilotSeed.text);
  }, [seedTs, copilotSeed]);

  return (
    <div className="ws-copilot">
      {/* 顶部账户与 AI 配置区（账户信息移至顶栏左上角） */}
      <div className="ws-account-strip">
        {isAuthenticated ? (
          <>
            <span className="ws-account-dot" />
            <span className={`ws-ai-status ${ai.configStatus.configured ? 'ok' : 'off'}`}>
              {ai.configStatus.configured ? t('v2.ai.configured') : t('v2.ai.unconfigured')}
            </span>
            <button className="ws-account-btn" onClick={ai.handleOpenSettings} title={t('v2.ai.settingsTitle')}>
              <Settings size={14} /> {t('v2.ai.settings')}
            </button>
          </>
        ) : (
          <>
            <span className="ws-account-dot off" />
            <span className="ws-account-name">{t('v2.ai.guestNote')}</span>
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
            <p>{t('v2.ai.empty')}</p>
            <span>{t('v2.ai.emptyExample')}</span>
            <span className="ws-chat-note">{t('v2.ai.emptyNote')}</span>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`ws-msg ${m.role}${m.hint ? ' hint' : ''}`}>
            {m.role === 'assistant' && <div className="ws-msg-tag">Copilot</div>}
            <div className="ws-msg-bubble">{m.content}</div>
          </div>
        ))}
        {sending && <div className="ws-msg assistant"><div className="ws-msg-bubble typing">{t('v2.ai.thinking')}</div></div>}
      </div>

      <div className="ws-chat-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
          }}
          placeholder={isAuthenticated ? t('v2.ai.inputPlaceholder') : t('v2.ai.guestPlaceholder')}
          rows={2}
          disabled={sending}
        />
        <button className="ws-chat-send" onClick={handleSend} disabled={sending || !input.trim()} title={t('v2.ai.send')}>
          <Send size={15} />
        </button>
      </div>

      {messages.some((m) => m.hint) && !ai.configStatus.configured && isAuthenticated && (
        <div className="ws-config-hint" onClick={ai.handleOpenSettings}>
          <AlertCircle size={13} /> {t('v2.ai.configBanner')}
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
