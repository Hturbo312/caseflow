import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Download, GitCompare, Loader2, Info, Sparkles, Plus, Check, Link2 } from 'lucide-react';
import { useCaseStore } from '../../../../store';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { useCompareStore } from '../../../../store/compareStore';
import { analysisApi, conceptApi } from '../../../../services/api';
import { exportCSV, exportJSON, exportSVGAsPNG } from './exportUtils';
import { useI18n } from '../../../../i18n';

// 值为 i18n key，渲染处经 t() 转换（unknown 复用 detail.link.unknown）
const STATE_LABEL = {
  planned: 'analysis.state.planned', piloted: 'analysis.state.piloted', deployed: 'analysis.state.deployed',
  adopted: 'analysis.state.adopted', adjusted: 'analysis.state.adjusted', scaled: 'analysis.state.scaled',
  suspended: 'analysis.state.suspended', withdrawn: 'analysis.state.withdrawn', unknown: 'detail.link.unknown',
};
const EV_STATUS_COLOR = { confirmed: '#16a34a', limited: '#d97706', blocked: '#dc2626', not_evidenced: '#cbd5e1' };
// confirmed 复用 pipeline.approved
const EV_STATUS_LABEL = { confirmed: 'pipeline.approved', limited: 'analysis.ev.limited', blocked: 'analysis.ev.blocked', not_evidenced: 'analysis.ev.notEvidenced' };

// 「生成研究简报」：呼叫 Copilot 的提示词（按 locale），发送走 workspaceStore.askCopilot 种子
const BRIEF_PROMPTS = {
  zh: '请基于当前比较集与上图数据，生成一页研究简报：1) 比较对象与口径 2) 三条最有把握的发现 3) 证据缺口与下一步建议。',
  en: 'Based on the current comparison set and the charts above, draft a one-page research brief: 1) subjects and criteria 2) the three most confident findings 3) evidence gaps and next steps.',
};

/**
 * Analysis 工作区（Spec §3.2/§7.3）
 * 过程状态矩阵 / 证据覆盖图 / 能力—任务热力图 / 技术作用链
 * 全部由确定性查询驱动（schema_version + 查询条件显示在图表上），AI 不参与计算
 */
export default function AnalysisWorkspace() {
  const { t, locale } = useI18n();
  const { cases } = useCaseStore();
  const { caseDetailId, askCopilot } = useWorkspaceStore();
  const compareIds = useCompareStore((s) => s.ids);

  const coreCases = useMemo(() => cases.filter((c) => c.case_status === 'core'), [cases]);
  // 优先用比较集；否则默认全部论文核心案例
  const ids = useMemo(
    () => (compareIds.length >= 2 ? compareIds.map(Number) : coreCases.map((c) => Number(c.id))),
    [compareIds, coreCases]
  );

  return (
    <div className="ws-analysis">
      <div className="ws-analysis-bar">
        <GitCompare size={14} />
        {compareIds.length >= 2 ? (
          <span>{t('analysis.compareSet.count', { n: compareIds.length })}</span>
        ) : (
          <span>{t('analysis.noCompareSet', { n: coreCases.length })}</span>
        )}
        <button
          className="ws-act"
          style={{ marginLeft: 'auto' }}
          onClick={() => askCopilot(BRIEF_PROMPTS[locale === 'en' ? 'en' : 'zh'])}
          title={t('ux.analysis.brief')}
        >
          <Sparkles size={11} /> {t('ux.analysis.brief')}
        </button>
      </div>
      <ProcessMatrix ids={ids} />
      <EvidenceCoverage ids={ids} />
      <ConceptAlignment ids={ids} />
      <CapabilityTaskHeatmap ids={ids} />
      <ActionChain caseId={caseDetailId ? Number(caseDetailId) : ids[0]} />
      <div className="ws-analysis-note">
        <Info size={12} /> {t('analysis.deterministicNote')}
      </div>
    </div>
  );
}

// ============ 通用：图表卡片头 ============
function ChartHead({ title, sub, onPng, onCsv, onJson, data }) {
  const { t } = useI18n();
  return (
    <div className="ws-chart-head">
      <div>
        <h3>{title}</h3>
        {sub && <span className="ws-chart-sub">{sub}</span>}
      </div>
      <div className="ws-chart-actions">
        {onPng && <button onClick={onPng} title={t('analysis.exportPng')}><Download size={12} /> PNG</button>}
        {onCsv && <button onClick={onCsv}><Download size={12} /> CSV</button>}
        {onJson && data && <button onClick={() => exportJSON(data, title)}><Download size={12} /> JSON</button>}
      </div>
    </div>
  );
}

// ============ A. 过程状态矩阵 ============
function ProcessMatrix({ ids }) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const svgRef = useRef(null);
  useEffect(() => {
    if (!ids.length) return;
    setData(null); setErr('');
    analysisApi.processStates(ids).then(setData).catch((e) => setErr(e.message));
  }, [ids]);

  if (err) return <ErrorCard title={t('analysis.processMatrix.title')} err={err} />;
  if (!data) return <LoadingCard title={t('analysis.processMatrix.title')} />;

  const cellMax = Math.max(1, ...data.cases.flatMap((c) => Object.values(c.states)));
  const COL_W = 64, ROW_H = 34, LBL_W = 210, HEAD_H = 46;
  const W = LBL_W + data.states.length * COL_W + 20;
  const H = HEAD_H + data.cases.length * ROW_H + 14;

  const csv = [
    [t('common.case'), ...data.states.map((s) => t(STATE_LABEL[s]))],
    ...data.cases.map((c) => [c.name, ...data.states.map((s) => c.states[s])]),
  ];

  return (
    <section className="ws-chart">
      <ChartHead
        title={t('analysis.processMatrix.title')} sub={t('analysis.processMatrix.sub', { v: data.schema_version })}
        onPng={() => exportSVGAsPNG(svgRef.current, t('analysis.processMatrix.title'))}
        onCsv={() => exportCSV(csv, t('analysis.processMatrix.title'))}
        onJson={true} data={data}
      />
      <div className="ws-chart-scroll">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="ws-svg">
          {data.states.map((s, j) => (
            <text key={s} x={LBL_W + j * COL_W + COL_W / 2} y={HEAD_H - 24} textAnchor="middle"
              className="ws-svg-col" transform={`rotate(-18 ${LBL_W + j * COL_W + COL_W / 2} ${HEAD_H - 24})`}>
              {t(STATE_LABEL[s])}
            </text>
          ))}
          {data.cases.map((c, i) => (
            <g key={c.id}>
              <text x={LBL_W - 8} y={HEAD_H + i * ROW_H + ROW_H / 2 + 4} textAnchor="end" className="ws-svg-row">
                {c.name.length > 22 ? c.name.slice(0, 21) + '…' : c.name}
              </text>
              {data.states.map((s, j) => {
                const v = c.states[s];
                if (v === 0) return (
                  <g key={s}>
                    <rect x={LBL_W + j * COL_W + 3} y={HEAD_H + i * ROW_H + 3} width={COL_W - 6} height={ROW_H - 6}
                      rx={4} fill="#f1f5f9" />
                  </g>
                );
                const alpha = 0.15 + 0.85 * (v / cellMax);
                return (
                  <g key={s}>
                    <rect x={LBL_W + j * COL_W + 3} y={HEAD_H + i * ROW_H + 3} width={COL_W - 6} height={ROW_H - 6}
                      rx={4} fill="#0e7490" opacity={alpha} />
                    <text x={LBL_W + j * COL_W + COL_W / 2} y={HEAD_H + i * ROW_H + ROW_H / 2 + 4}
                      textAnchor="middle" className="ws-svg-num" fill={alpha > 0.55 ? '#fff' : '#0e7490'}>{v}</text>
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

// ============ D. 证据覆盖图 ============
function EvidenceCoverage({ ids }) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const svgRef = useRef(null);
  useEffect(() => {
    if (!ids.length) return;
    setData(null); setErr('');
    analysisApi.evidenceCoverage(ids).then(setData).catch((e) => setErr(e.message));
  }, [ids]);

  if (err) return <ErrorCard title={t('analysis.evidenceCoverage.title')} err={err} />;
  if (!data) return <LoadingCard title={t('analysis.evidenceCoverage.title')} />;

  const ROW_H = 30, LBL_W = 210, LEGEND_H = 26, HEAD_H = 8;
  const segW = 52;
  const W = LBL_W + data.dimensions.length * segW + 16;
  const H = HEAD_H + data.cases.length * ROW_H + LEGEND_H + 10;

  const csv = [
    [t('common.case'), ...data.dimensions.flatMap((d) => data.statuses.map((s) => `${d.label}-${t(EV_STATUS_LABEL[s])}`))],
    ...data.cases.map((c) => [
      c.name,
      ...data.dimensions.flatMap((d) => data.statuses.map((s) => c.coverage[d.key]?.[s] ?? 0)),
    ]),
  ];

  return (
    <section className="ws-chart">
      <ChartHead
        title={t('analysis.evidenceCoverage.title')} sub={t('analysis.evidenceCoverage.sub', { v: data.schema_version })}
        onPng={() => exportSVGAsPNG(svgRef.current, t('analysis.evidenceCoverage.title'))}
        onCsv={() => exportCSV(csv, t('analysis.evidenceCoverage.title'))}
        onJson={true} data={data}
      />
      <div className="ws-chart-scroll">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="ws-svg">
          {data.dimensions.map((d, j) => (
            <text key={d.key} x={LBL_W + j * segW + segW / 2} y={HEAD_H + 12} textAnchor="middle" className="ws-svg-col">
              {d.label}
            </text>
          ))}
          {data.cases.map((c, i) => {
            const y = HEAD_H + 18 + i * ROW_H;
            return (
              <g key={c.id}>
                <text x={LBL_W - 8} y={y + 14} textAnchor="end" className="ws-svg-row">
                  {c.name.length > 22 ? c.name.slice(0, 21) + '…' : c.name}
                </text>
                {data.dimensions.map((d, j) => {
                  const cell = c.coverage[d.key] || {};
                  const total = data.statuses.reduce((a, s) => a + (cell[s] || 0), 0);
                  let x = LBL_W + j * segW + 2;
                  const w = segW - 4;
                  return (
                    <g key={d.key}>
                      <rect x={x} y={y} width={w} height={ROW_H - 8} rx={3} fill="#f8fafc" stroke="#e2e8f0" />
                      {total > 0 && data.statuses.map((s) => {
                        const v = cell[s] || 0;
                        if (!v) return null;
                        const sw = (v / total) * w;
                        const rect = (
                          <rect key={s} x={x} y={y} width={sw} height={ROW_H - 8}
                            fill={EV_STATUS_COLOR[s]} opacity={s === 'not_evidenced' ? 0.9 : 0.85} />
                        );
                        x += sw;
                        return rect;
                      })}
                      {total > 0 && (
                        <text x={LBL_W + j * segW + segW / 2} y={y + 15} textAnchor="middle" className="ws-svg-num" fill="#334155">
                          {total}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
          {data.statuses.map((s, j) => (
            <g key={s} transform={`translate(${LBL_W + j * 118}, ${H - 10})`}>
              <rect width={10} height={10} rx={2} fill={EV_STATUS_COLOR[s]} y={-9} />
              <text x={14} y={0} className="ws-svg-legend">{t(EV_STATUS_LABEL[s])}</text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

// ============ B. 能力—任务热力图 ============
function CapabilityTaskHeatmap({ ids }) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const svgRef = useRef(null);
  useEffect(() => {
    if (!ids.length) return;
    setData(null); setErr('');
    analysisApi.capabilityTask(ids).then(setData).catch((e) => setErr(e.message));
  }, [ids]);

  if (err) return <ErrorCard title={t('analysis.capabilityTask.title')} err={err} />;
  if (!data) return <LoadingCard title={t('analysis.capabilityTask.title')} />;
  if (!data.links.length) {
    return (
      <section className="ws-chart">
        <ChartHead title={t('analysis.capabilityTask.title')} sub={t('analysis.capabilityTask.subEmpty')} />
        <div className="ws-tab-hint">{t('analysis.capabilityTask.empty')}</div>
      </section>
    );
  }

  const cellMax = Math.max(...data.links.map((l) => l.link_count));
  const COL_W = 110, ROW_H = 30, LBL_W = 190, HEAD_H = 42;
  const W = LBL_W + data.tasks.length * COL_W + 16;
  const H = HEAD_H + data.capabilities.length * ROW_H + 12;

  const val = (cap, task) => data.links
    .filter((l) => l.capability === cap && l.task === task)
    .reduce((a, l) => a + l.link_count, 0);

  const csv = [
    [t('analysis.capabilityTask.csvCorner'), ...data.tasks],
    ...data.capabilities.map((c) => [c, ...data.tasks.map((tk) => val(c, tk) || '')]),
  ];

  return (
    <section className="ws-chart">
      <ChartHead
        title={t('analysis.capabilityTask.title')} sub={t('analysis.capabilityTask.sub', { v: data.schema_version })}
        onPng={() => exportSVGAsPNG(svgRef.current, t('analysis.capabilityTask.exportName'))}
        onCsv={() => exportCSV(csv, t('analysis.capabilityTask.exportName'))}
        onJson={true} data={data}
      />
      <div className="ws-chart-scroll">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="ws-svg">
          {data.tasks.map((t, j) => (
            <text key={t} x={LBL_W + j * COL_W + COL_W / 2} y={HEAD_H - 22} textAnchor="middle"
              className="ws-svg-col" transform={`rotate(-18 ${LBL_W + j * COL_W + COL_W / 2} ${HEAD_H - 22})`}>
              {t.length > 10 ? t.slice(0, 9) + '…' : t}
            </text>
          ))}
          {data.capabilities.map((cap, i) => (
            <g key={cap}>
              <text x={LBL_W - 8} y={HEAD_H + i * ROW_H + ROW_H / 2 + 4} textAnchor="end" className="ws-svg-row">
                {cap.length > 18 ? cap.slice(0, 17) + '…' : cap}
              </text>
              {data.tasks.map((t, j) => {
                const v = val(cap, t);
                const x = LBL_W + j * COL_W + 3, y = HEAD_H + i * ROW_H + 3;
                if (!v) return <rect key={t} x={x} y={y} width={COL_W - 6} height={ROW_H - 6} rx={4} fill="#f1f5f9" />;
                const alpha = 0.2 + 0.8 * (v / cellMax);
                return (
                  <g key={t}>
                    <rect x={x} y={y} width={COL_W - 6} height={ROW_H - 6} rx={4} fill="#0891b2" opacity={alpha} />
                    <text x={x + (COL_W - 6) / 2} y={y + (ROW_H - 6) / 2 + 4} textAnchor="middle"
                      className="ws-svg-num" fill={alpha > 0.55 ? '#fff' : '#0e7490'}>{v}</text>
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

// ============ C. 技术作用链 ============
function ActionChain({ caseId }) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!caseId) { setData(null); return; }
    setData(null); setErr('');
    analysisApi.actionChain(caseId).then(setData).catch((e) => setErr(e.message));
  }, [caseId]);

  if (!caseId) return null;
  if (err) return <ErrorCard title={t('analysis.actionChain.title')} err={err} />;
  if (!data) return <LoadingCard title={t('analysis.actionChain.title')} />;

  // 值为 i18n key，渲染处经 t() 转换
  const SHORT = {
    'Community Context（社区情境）': 'analysis.chain.context', 'Problem / Pressure（问题与压力）': 'analysis.chain.problem',
    'Task（社区更新任务）': 'analysis.chain.task', 'Technology（技术）': 'analysis.chain.technology', 'Capability（技术能力）': 'analysis.chain.capability',
    'Action / Event（行动与事件）': 'analysis.chain.action', 'Organizational Response（组织响应）': 'analysis.chain.orgResponse',
    'Spatial Response（空间响应）': 'analysis.chain.spatialResponse', 'Behavioral / Service Response（行为与服务响应）': 'analysis.chain.behaviorResponse',
    'Outcome（结果）': 'analysis.chain.outcome', 'Constraint / Adjustment（约束与调整）': 'analysis.chain.constraint',
  };
  const byType = new Map(data.chain_order.map((ty) => [ty, []]));
  for (const e of data.entities) {
    if (byType.has(e.entity_type)) byType.get(e.entity_type).push(e);
  }

  const exportRows = () => [
    [t('analysis.chain.pos'), t('toolbar.entity'), t('analysis.evidenceStatus')],
    ...data.entities.flatMap((e) => {
      const evs = Object.entries(e.evidence || {});
      return evs.length ? evs.map(([st, n]) => [t(SHORT[e.entity_type] || e.entity_type), e.name, `${t(EV_STATUS_LABEL[st] || st)}×${n}`])
        : [[t(SHORT[e.entity_type] || e.entity_type), e.name, t('analysis.noEvidenceRecord')]];
    }),
  ];

  return (
    <section className="ws-chart">
      <ChartHead
        title={t('analysis.actionChain.title')} sub={t('analysis.actionChain.sub', { v: data.schema_version })}
        onCsv={() => exportCSV(exportRows(), t('analysis.actionChain.title'))}
        onJson={true} data={data}
      />
      <div className="ws-chain">
        {data.chain_order.map((ty) => {
          const ents = byType.get(ty) || [];
          if (!ents.length) return null;
          return (
            <div className="ws-chain-col" key={ty}>
              <div className="ws-chain-head">{t(SHORT[ty] || ty)}</div>
              {ents.slice(0, 6).map((e) => (
                <div className="ws-chain-node" key={e.id} title={e.name}>
                  <span className="ws-chain-dot" style={{ background: e.color || '#94a3b8' }} />
                  <span className="ws-chain-name">{e.name.length > 26 ? e.name.slice(0, 25) + '…' : e.name}</span>
                  <span className="ws-chain-ev">
                    {e.evidence?.confirmed ? '✓' : e.evidence?.limited ? '◐' : e.evidence?.blocked ? '✕' : '∅'}
                  </span>
                </div>
              ))}
              {ents.length > 6 && <div className="ws-chain-more">+{ents.length - 6}</div>}
            </div>
          );
        })}
      </div>
      <div className="ws-chain-legend">
        <span>✓ {t(EV_STATUS_LABEL.confirmed)}</span><span>◐ {t(EV_STATUS_LABEL.limited)}</span><span>✕ {t(EV_STATUS_LABEL.blocked)}</span><span>∅ {t('analysis.noEvidenceRecord')}</span>
      </div>
    </section>
  );
}

function LoadingCard({ title }) {
  const { t } = useI18n();
  return (
    <section className="ws-chart">
      <ChartHead title={title} />
      <div className="ws-loading"><Loader2 size={16} className="spin" /> {t('analysis.querying')}</div>
    </section>
  );
}
function ErrorCard({ title, err }) {
  const { t } = useI18n();
  return (
    <section className="ws-chart">
      <ChartHead title={title} />
      <div className="ws-tab-error">{t('analysis.loadFailed', { err })}</div>
    </section>
  );
}

// ============ E. 概念对齐矩阵（L3：共享概念 × 案例，Spec §2.3/§7.2） ============
// 案例原生术语（=实体名）经 concept_mappings 映射到共享概念后进入统一比较坐标系；
// 未映射的缺口在面板里由研究者手动或按确定性建议补齐，AI 不参与计算。
function ConceptAlignment({ ids }) {
  const { t, locale } = useI18n();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [gapCaseId, setGapCaseId] = useState(null);

  const load = useCallback(async () => {
    if (!ids.length) return;
    setErr('');
    try {
      setData(await conceptApi.coverage(ids));
    } catch (e) {
      setErr(e.message);
    }
  }, [ids]);
  useEffect(() => { setData(null); load(); }, [load]);

  if (err) return <ErrorCard title={t('analysis.concept.title')} err={err} />;
  if (!data) return <LoadingCard title={t('analysis.concept.title')} />;

  const cases = data.cases || [];
  const concepts = data.concepts || [];
  const cell = (conceptId, caseId) => data.matrix[`${conceptId}:${caseId}`];
  const maxCell = Math.max(1, ...Object.values(data.matrix || {}).map((m) => m.entity_count));
  const shortName = (n) => (n.length > 9 ? n.slice(0, 8) + '…' : n);

  const csv = [
    [t('analysis.concept.csvCorner'), ...cases.map((c) => c.name)],
    ...concepts.map((c) => [c.label, ...cases.map((cas) => cell(c.id, cas.id)?.entity_count ?? 0)]),
  ];

  return (
    <section className="ws-chart">
      <ChartHead
        title={t('analysis.concept.title')} sub={t('analysis.concept.sub', { n: concepts.length })}
        onCsv={() => exportCSV(csv, t('analysis.concept.title'))}
        onJson={true} data={data}
      />
      {!concepts.length ? (
        <div className="ws-tab-hint">{t('analysis.concept.noConcepts')}</div>
      ) : !cases.length ? (
        <div className="ws-tab-hint">{t('analysis.concept.noCases')}</div>
      ) : (
        <div className="ws-chart-scroll">
          <table className="ws-concept-table">
            <thead>
              <tr>
                <th className="ws-ct-label">{t('analysis.concept.sharedConcept')}</th>
                {cases.map((c) => <th key={c.id} title={c.name}>{shortName(c.name)}</th>)}
              </tr>
            </thead>
            <tbody>
              {concepts.map((c) => (
                <tr key={c.id}>
                  <td className="ws-ct-label" title={c.label}>{c.label}</td>
                  {cases.map((cas) => {
                    const v = cell(c.id, cas.id);
                    const n = v?.entity_count || 0;
                    return (
                      <td key={cas.id}>
                        {n ? (
                          <span className="ws-ct-cell"
                            style={{ background: `rgba(8, 145, 178, ${0.15 + 0.75 * (n / maxCell)})` }}
                            title={t('analysis.concept.nativeTerms', { terms: (v.native_terms || []).join(locale === 'en' ? ', ' : '、') })}>
                            {n}
                          </span>
                        ) : (
                          <span className="ws-ct-empty">·</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="ws-ct-total">
                <td className="ws-ct-label">{t('analysis.concept.coverage')}</td>
                {cases.map((cas) => {
                  const tot = data.case_totals?.[String(cas.id)] || { entities: 0, mapped: 0, unmapped: 0 };
                  return (
                    <td key={cas.id}>
                      <button className={`ws-ct-total-btn${gapCaseId === cas.id ? ' open' : ''}`}
                        onClick={() => setGapCaseId(gapCaseId === cas.id ? null : cas.id)}
                        title={t('analysis.concept.manageGaps')}>
                        {tot.mapped}/{tot.entities}
                        {tot.unmapped > 0 && <em>+{tot.unmapped}</em>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {gapCaseId != null && cases.length > 0 && (
        <ConceptGapPanel
          caseId={gapCaseId}
          caseName={cases.find((c) => c.id === gapCaseId)?.name || t('analysis.concept.caseFallback', { id: gapCaseId })}
          concepts={concepts}
          gaps={(data.gaps || {})[String(gapCaseId)] || []}
          onRefresh={load}
        />
      )}
    </section>
  );
}

// 缺口面板：未映射原生术语 → 手动/建议映射 → 新建共享概念
function ConceptGapPanel({ caseId, caseName, concepts, gaps, onRefresh }) {
  const { t } = useI18n();
  const [sugs, setSugs] = useState(null); // 自动建议（确定性字符串匹配）
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [showNew, setShowNew] = useState(false);

  const sugByTerm = useMemo(() => new Map((sugs || []).map((s) => [s.native_term, s])), [sugs]);

  const autoSuggest = async () => {
    setBusy('sug'); setErr('');
    try {
      const d = await conceptApi.suggestions(caseId);
      setSugs(d.suggestions || []);
      if (!d.suggestions?.length) setErr(t('analysis.gap.noNewSuggestions'));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy('');
    }
  };

  const applyAll = async () => {
    setBusy('all'); setErr('');
    try {
      await conceptApi.bulkMappings(caseId, sugs.map((s) => ({
        native_term: s.native_term, concept_id: s.concept_id,
        confidence: s.confidence, mapping_type: 'suggested',
      })));
      setSugs(null);
      await onRefresh();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="ws-gap">
      <div className="ws-gap-head">
        <div>
          <b>{t('analysis.gap.title', { name: caseName })}</b>
          <span>{t('analysis.gap.count', { n: gaps.length })}</span>
        </div>
        <div className="ws-gap-actions">
          <button className="ws-act" onClick={autoSuggest} disabled={busy === 'sug'}>
            {busy === 'sug' ? <Loader2 size={11} className="spin" /> : <Sparkles size={11} />} {t('analysis.gap.autoSuggest')}
          </button>
          {sugs?.length > 0 && (
            <button className="ws-act ok" onClick={applyAll} disabled={busy === 'all'}>
              {busy === 'all' ? <Loader2 size={11} className="spin" /> : <Check size={11} />} {t('analysis.gap.applyAll', { n: sugs.length })}
            </button>
          )}
          <button className="ws-act" onClick={() => setShowNew(!showNew)}>
            <Plus size={11} /> {t('analysis.gap.newConcept')}
          </button>
        </div>
      </div>
      {err && <div className="ws-gap-err">{err}</div>}
      {showNew && <NewConceptForm onCreated={onRefresh} />}
      <div className="ws-gap-list">
        {gaps.length === 0 && <div className="ws-tab-hint">{t('analysis.gap.allMapped')}</div>}
        {gaps.map((g) => (
          <ConceptGapRow
            key={g.native_term}
            caseId={caseId}
            gap={g}
            suggestion={sugByTerm.get(g.native_term)}
            concepts={concepts}
            onDone={onRefresh}
          />
        ))}
      </div>
    </div>
  );
}

function ConceptGapRow({ caseId, gap, suggestion, concepts, onDone }) {
  const { t } = useI18n();
  const [sel, setSel] = useState(suggestion?.concept_id ? String(suggestion.concept_id) : '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { setSel(suggestion?.concept_id ? String(suggestion.concept_id) : ''); }, [suggestion?.concept_id]);

  const apply = async () => {
    if (!sel) return;
    setBusy(true); setErr('');
    try {
      await conceptApi.addMapping({
        case_id: caseId, native_term: gap.native_term, concept_id: Number(sel),
        confidence: suggestion?.confidence ?? 1,
        mapping_type: suggestion ? 'suggested_confirmed' : 'manual',
      });
      await onDone();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ws-gap-row">
      <span className="ws-gap-term" title={gap.native_term}>{gap.native_term}</span>
      <span className="ws-gap-cnt">×{gap.entity_count}</span>
      {suggestion && (
        <span className="ws-gap-sug" title={t('analysis.gap.matchBasis', { basis: suggestion.basis })}>
          {suggestion.concept_label} · {Math.round(suggestion.confidence * 100)}%
        </span>
      )}
      <select value={sel} onChange={(e) => setSel(e.target.value)}>
        <option value="">{t('analysis.gap.selectConcept')}</option>
        {concepts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <button className="ws-act ok" disabled={!sel || busy} onClick={apply}>
        {busy ? <Loader2 size={11} className="spin" /> : <Link2 size={11} />} {t('analysis.gap.map')}
      </button>
      {err && <span className="ws-gap-err-inline">{err}</span>}
    </div>
  );
}

function NewConceptForm({ onCreated }) {
  const { t } = useI18n();
  const [label, setLabel] = useState('');
  const [aliases, setAliases] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const create = async () => {
    if (!label.trim()) return;
    setBusy(true); setErr('');
    try {
      await conceptApi.create({
        label: label.trim(),
        aliases: aliases.split(/[,，、;；]/).map((s) => s.trim()).filter(Boolean),
      });
      setLabel(''); setAliases('');
      await onCreated();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ws-gap-new">
      <input placeholder={t('analysis.newConcept.namePlaceholder')} value={label} onChange={(e) => setLabel(e.target.value)} />
      <input placeholder={t('analysis.newConcept.aliasesPlaceholder')} value={aliases} onChange={(e) => setAliases(e.target.value)} />
      <button className="ws-act ok" disabled={!label.trim() || busy} onClick={create}>
        {busy ? <Loader2 size={11} className="spin" /> : <Plus size={11} />} {t('analysis.newConcept.create')}
      </button>
      {err && <span className="ws-gap-err-inline">{err}</span>}
    </div>
  );
}
