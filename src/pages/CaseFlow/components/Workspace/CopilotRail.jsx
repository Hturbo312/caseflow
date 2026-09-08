import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Settings, Send, Sparkles, AlertCircle, Paperclip, Shield } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuthStore, useSchemaStore, useCaseStore } from '../../../../store';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { useI18n } from '../../../../i18n';
import { aiApi } from '../../../../services/api';
import { useAIConfig } from '../CaseExtractor/hooks/useAIConfig';
import SettingsModal from '../CaseExtractor/SettingsModal';
import AdminPanel from './AdminPanel';
import { registerSourceFiles, runMaterialTask } from '../../../../services/materialTasks';
import { dispatchWorkbenchActions, parseAgentEnvelope } from '../../../../services/agentAdapter';

/**
 * 左栏统一 AI Copilot（Spec §3.1）
 * 唯一对话入口：讨论解释 + 研究材料整理（原「材料 Agent」已内化）。
 * 材料从附件按钮登记；整理/提取由 AI 动作信封或对话触发，审阅确认在中栏完成。
 * AI 只解释与建议，不改变当前案例/比较集/Schema 版本
 */

// AI 动作信封中由本组件执行的材料任务（其余动作交给工作台分发）
const MATERIAL_ACTIONS = {
  generate_draft: { kind: 'draft', labelKey: 'ux.mat.drafting' },
  extract_knowledge: { kind: 'extract', labelKey: 'ux.mat.extracting' },
};

const FILE_FAIL_KEYS = {
  FILE_TOO_BIG: 'ux.mat.fileTooBig',
  NO_TEXT: 'ux.mat.noText',
};

export default function CopilotRail({ onShowLogin }) {
  const { t } = useI18n();
  const { isAuthenticated, user } = useAuthStore();
  const { schemas, currentSchemaId } = useSchemaStore();
  const { cases } = useCaseStore();
  const { caseDetailId, contextTask, copilotSeed } = useWorkspaceStore();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const listRef = useRef(null);
  const fileRef = useRef(null);

  const renderMessage = (message) => {
    if (message.role === 'user') return <span className="ws-msg-plain">{message.content}</span>;
    return <div className="ws-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
        a: ({node, ...props}) => <a {...props} target="_blank" rel="noreferrer" />,
        pre: ({children}) => <pre className="ws-code-block">{children}</pre>,
        code: ({node, className, children, ...props}) => <code className={className || 'ws-inline-code'} {...props}>{children}</code>,
      }}>{String(message.content || '')}</ReactMarkdown>
      {message.actions?.length > 0 && <div className="ws-action-summary">
        {message.actions.map((action, index) => <span key={`${action.type}-${index}`} className="ws-action-chip">{action.type}</span>)}
      </div>}
    </div>;
  };

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
    '你是 CaseFlow 研究工作台的统一 AI 助手，辅助研究者做城市更新案例知识研究，同时负责研究材料的整理与候选知识提取。',
    '你必须遵守：',
    '1. 只解释、提出假设和提示证据缺口，不代替研究者做结论；',
    '2. 不声称因果关系，图谱相似不等于经验可迁移；',
    '3. 区分「资料未说明(not_evidenced)」和「明确受阻(blocked)」；',
    '4. 回答应基于研究者提供的上下文与查询结果，不编造证据。',
    '你可以执行材料任务：当研究者要求整理材料时，只返回 JSON 信封 ```json {"message":"给研究者的说明","actions":[{"type":"generate_draft"}]}```；要求从已确认整理稿提取候选知识时，actions 用 [{"type":"extract_knowledge"}]。仅在被明确要求时使用信封，其余回答直接用 Markdown 文本（不要用信封）。',
    `当前上下文：Schema=${currentSchema?.name || '未选择'}；案例=${currentCase?.name || '未打开'}；任务=${t(contextTask)}。`,
  ].join('\n');

  // 材料任务结果 → 提示消息（结构化结果按 locale 渲染）
  const materialResultText = useCallback((r) => {
    if (r.ok) {
      return r.kind === 'draft'
        ? t('ux.mat.draftOk', { n: r.count })
        : t('ux.mat.extractOk', { n: r.count });
    }
    const reasonKeys = {
      'no-case': 'ux.mat.noCase', busy: 'ux.mat.busy', 'no-sources': 'ux.mat.noSources',
      'too-big': 'ux.mat.tooBig', 'not-confirmed': 'ux.mat.notConfirmed', 'ai-invalid': 'ux.mat.aiInvalid',
    };
    if (reasonKeys[r.reason]) return t(reasonKeys[r.reason]);
    return t('ux.mat.failed', { msg: r.message || '' });
  }, [t]);

  const pushHint = useCallback((content) => {
    setMessages((m) => [...m, { role: 'assistant', content, hint: true }]);
  }, []);

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
      const envelope = parseAgentEnvelope(reply);
      const actions = Array.isArray(envelope.actions) ? envelope.actions : [];
      dispatchWorkbenchActions(actions);
      setMessages((m) => [...m, {
        role: 'assistant',
        content: envelope.message || reply,
        actions: actions.filter((a) => !MATERIAL_ACTIONS[a.type]),
      }]);
      // 材料动作：逐一执行（各自独立调 AI），结果作为提示消息回填
      for (const action of actions.filter((a) => MATERIAL_ACTIONS[a.type])) {
        const def = MATERIAL_ACTIONS[action.type];
        setSending(true);
        const result = await runMaterialTask(def.kind, { schema: currentSchema, busyLabel: t(def.labelKey) });
        pushHint(materialResultText(result));
      }
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: t('v2.ai.requestFailed', { msg: e.message }), hint: true }]);
    } finally {
      setSending(false);
    }
  }, [messages, sending, isAuthenticated, onShowLogin, ai.configStatus.configured, t,
    currentSchema, currentCase?.name, contextTask, materialResultText, pushHint]); // buildSystemPrompt 只读这些值

  const handleSend = () => {
    const text = input.trim();
    if (!text || sending) return;
    sendText(text);
    // 与原行为一致：已登录才清空输入（未登录时唤起登录框、保留草稿）
    if (isAuthenticated) setInput('');
  };

  // 附件登记来源材料（PDF/DOCX/TXT → 文本快照），单份失败不中断其余
  const handleFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []);
    if (fileRef.current) fileRef.current.value = '';
    if (!files.length || sending) return;
    if (!isAuthenticated) return onShowLogin?.();
    if (!caseDetailId) return pushHint(t('ux.mat.noCase'));

    setSending(true);
    try {
      const result = await registerSourceFiles(files, t('ux.mat.registering'));
      if (result.reason === 'busy') return pushHint(t('ux.mat.busy'));
      if (result.reason === 'no-case') return pushHint(t('ux.mat.noCase'));
      const lines = [];
      if (result.added > 0) lines.push(t('ux.mat.registered', { n: result.added, total: result.total }));
      for (const f of result.failed) {
        const key = FILE_FAIL_KEYS[f.reason] || 'ux.mat.fileFail';
        lines.push(`· ${f.name}：${t(key, { msg: f.message || '' })}`);
      }
      if (lines.length) pushHint(lines.join('\n'));
    } finally {
      setSending(false);
    }
  }, [sending, isAuthenticated, caseDetailId, onShowLogin, pushHint, t]);

  // 中栏「从文档导入」等入口 → 唤起附件选择（未登录先登录）
  useEffect(() => {
    const openAttach = () => (isAuthenticated ? fileRef.current?.click() : onShowLogin?.());
    window.addEventListener('cf:chat-attach', openAttach);
    return () => window.removeEventListener('cf:chat-attach', openAttach);
  }, [isAuthenticated, onShowLogin]);

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
            <div className="ws-msg-bubble">{renderMessage(m)}</div>
          </div>
        ))}
        {sending && <div className="ws-msg assistant"><div className="ws-msg-bubble typing">{t('v2.ai.thinking')}</div></div>}
      </div>

      <div className="ws-chat-input">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.txt"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          className="ws-chat-attach"
          onClick={() => (isAuthenticated ? fileRef.current?.click() : onShowLogin?.())}
          disabled={sending}
          title={t('ux.mat.attach')}
        >
          <Paperclip size={15} />
        </button>
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

      <AdminPanel isOpen={adminOpen} onClose={() => setAdminOpen(false)} />
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
