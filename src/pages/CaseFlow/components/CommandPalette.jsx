import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Share2, Database, FolderOpen, BarChart3, FileUp,
  ClipboardCheck, Languages, CornerDownLeft,
} from 'lucide-react';
import { useI18n } from '../../../i18n';
import { useCaseStore, useGraphStore } from '../../../store';
import { useWorkspaceStore } from '../../../store/workspaceStore';

/**
 * 全局命令面板（Ctrl/Cmd+K）
 * 跨案例 / 实体搜索 + 高频动作直达，解决「先找对 tab 再找列表」的导航负担
 */
const CommandPalette = ({ open, onClose, switchTab, onImport, isAuthenticated, onShowLogin }) => {
  const { t, locale, setLocale } = useI18n();
  const { cases } = useCaseStore();
  const { nodes } = useGraphStore();
  const {
    setMainTab, setCaseSubTab, openCaseDetail, setExtractorOpen,
    setContextTask, askCopilot,
  } = useWorkspaceStore();

  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const commands = useMemo(() => {
    const cmds = [];

    // 动作
    cmds.push(
      { kind: 'action', icon: Share2, label: t('ux.cmd.gotoGraph'), run: () => { switchTab('graph'); } },
      { kind: 'action', icon: Database, label: t('ux.cmd.gotoSchema'), run: () => { switchTab('schema'); setContextTask('v2.task.schema'); } },
      { kind: 'action', icon: FolderOpen, label: t('ux.cmd.gotoCase'), run: () => { switchTab('case'); setContextTask('v2.task.case'); } },
      { kind: 'action', icon: BarChart3, label: t('ux.cmd.gotoAnalysis'), run: () => { switchTab('analysis'); setContextTask('v2.task.analysis'); } },
      { kind: 'action', icon: FileUp, label: t('ux.cmd.import'), run: () => { if (isAuthenticated) setExtractorOpen(true); else onShowLogin?.(); } },
      { kind: 'action', icon: ClipboardCheck, label: t('ux.cmd.review'), run: () => { switchTab('case'); setCaseSubTab('review'); setContextTask('v2.task.case'); } },
      { kind: 'action', icon: Languages, label: locale === 'zh' ? 'Switch to English' : '切换到中文', run: () => setLocale(locale === 'zh' ? 'en' : 'zh') },
    );

    // 案例
    cases.slice(0, 50).forEach((c) => {
      cmds.push({
        kind: 'case',
        icon: FolderOpen,
        label: c.name,
        hint: [c.location, ...(c.tags || [])].filter(Boolean).join(' · '),
        keywords: `${c.name || ''} ${c.location || ''} ${(c.tags || []).join(' ')}`,
        run: () => openCaseDetail(c.id),
      });
    });

    // 实体（图谱节点）
    nodes.slice(0, 200).forEach((n) => {
      cmds.push({
        kind: 'entity',
        icon: Share2,
        label: n.name,
        hint: `${n.type || ''}${n.caseName ? ` · ${n.caseName}` : ''}`,
        keywords: `${n.name || ''} ${n.type || ''}`,
        run: () => {
          if (n.caseId) openCaseDetail(n.caseId, 'evidence');
          else askCopilot(`${t('ux.cmd.entityAskPrefix')}${n.name || ''}`);
        },
      });
    });

    return cmds;
  }, [cases, nodes, t, locale, isAuthenticated, switchTab, setMainTab, setCaseSubTab, openCaseDetail, setExtractorOpen, onShowLogin, setLocale, setContextTask, askCopilot]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.slice(0, 12);
    return commands
      .filter((c) => (c.keywords || c.label).toLowerCase().includes(q))
      .slice(0, 20);
  }, [commands, query]);

  useEffect(() => { setCursor((c) => Math.min(c, Math.max(0, filtered.length - 1))); }, [filtered.length]);

  if (!open) return null;

  const runAt = (i) => {
    const cmd = filtered[i];
    if (!cmd) return;
    onClose();
    cmd.run();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); runAt(cursor); }
    else if (e.key === 'Escape') { onClose(); }
  };

  return (
    <div className="v2-cmdk-overlay" onMouseDown={onClose} role="dialog" aria-label={t('ux.cmd.aria')}>
      <div className="v2-cmdk" onMouseDown={(e) => e.stopPropagation()}>
        <div className="v2-cmdk-input-row">
          <Search size={15} className="v2-cmdk-search-icon" />
          <input
            ref={inputRef}
            className="v2-cmdk-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('ux.cmd.placeholder')}
            aria-label={t('ux.cmd.aria')}
          />
        </div>
        <div className="v2-cmdk-list" ref={listRef}>
          {filtered.length === 0 && (
            <div className="v2-cmdk-empty">{t('ux.cmd.empty')}</div>
          )}
          {filtered.map((cmd, i) => {
            const Icon = cmd.icon;
            return (
              <button
                key={`${cmd.kind}-${i}-${cmd.label}`}
                className={`v2-cmdk-item ${i === cursor ? 'active' : ''}`}
                onMouseEnter={() => setCursor(i)}
                onClick={() => runAt(i)}
              >
                <Icon size={14} />
                <span className="v2-cmdk-label">{cmd.label}</span>
                {cmd.hint && <span className="v2-cmdk-hint">{cmd.hint}</span>}
                {i === cursor && <CornerDownLeft size={12} className="v2-cmdk-enter" />}
              </button>
            );
          })}
        </div>
        <div className="v2-cmdk-foot">
          <span>↑↓ {t('ux.cmd.navigate')}</span>
          <span>⏎ {t('ux.cmd.run')}</span>
          <span>Esc {t('ux.cmd.close')}</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
