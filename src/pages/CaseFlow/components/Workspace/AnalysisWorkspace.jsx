import { useState, useEffect, useMemo, useRef } from 'react';
import { Download, GitCompare, Loader2, Info } from 'lucide-react';
import { useCaseStore } from '../../../../store';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { useCompareStore } from '../../../../store/compareStore';
import { analysisApi } from '../../../../services/api';
import { exportCSV, exportJSON, exportSVGAsPNG } from './exportUtils';

const STATE_LABEL = {
  planned: '计划', piloted: '试验', deployed: '部署', adopted: '采用', adjusted: '调整',
  scaled: '扩散', suspended: '暂停', withdrawn: '退出', unknown: '未知',
};
const EV_STATUS_COLOR = { confirmed: '#16a34a', limited: '#d97706', blocked: '#dc2626', not_evidenced: '#cbd5e1' };
const EV_STATUS_LABEL = { confirmed: '已确认', limited: '有限支持', blocked: '受阻', not_evidenced: '资料未说明' };

/**
 * Analysis 工作区（Spec §3.2/§7.3）
 * 过程状态矩阵 / 证据覆盖图 / 能力—任务热力图 / 技术作用链
 * 全部由确定性查询驱动（schema_version + 查询条件显示在图表上），AI 不参与计算
 */
export default function AnalysisWorkspace() {
  const { cases } = useCaseStore();
  const { caseDetailId } = useWorkspaceStore();
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
          <span>比较集：{compareIds.length} 个案例</span>
        ) : (
          <span>未选比较集 — 默认展示全部论文核心案例（{coreCases.length} 个）。在右侧案例库勾选 2–6 个可聚焦比较。</span>
        )}
      </div>
      <ProcessMatrix ids={ids} />
      <EvidenceCoverage ids={ids} />
      <CapabilityTaskHeatmap ids={ids} />
      <ActionChain caseId={caseDetailId ? Number(caseDetailId) : ids[0]} />
      <div className="ws-analysis-note">
        <Info size={12} /> 图表由确定性 SQL 聚合生成，可导出复现；AI 解释请见左侧 Copilot。
      </div>
    </div>
  );
}

// ============ 通用：图表卡片头 ============
function ChartHead({ title, sub, onPng, onCsv, onJson, data }) {
  return (
    <div className="ws-chart-head">
      <div>
        <h3>{title}</h3>
        {sub && <span className="ws-chart-sub">{sub}</span>}
      </div>
      <div className="ws-chart-actions">
        {onPng && <button onClick={onPng} title="导出 PNG"><Download size={12} /> PNG</button>}
        {onCsv && <button onClick={onCsv}><Download size={12} /> CSV</button>}
        {onJson && data && <button onClick={() => exportJSON(data, title)}><Download size={12} /> JSON</button>}
      </div>
    </div>
  );
}

// ============ A. 过程状态矩阵 ============
function ProcessMatrix({ ids }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const svgRef = useRef(null);
  useEffect(() => {
    if (!ids.length) return;
    setData(null); setErr('');
    analysisApi.processStates(ids).then(setData).catch((e) => setErr(e.message));
  }, [ids]);

  if (err) return <ErrorCard title="过程状态矩阵" err={err} />;
  if (!data) return <LoadingCard title="过程状态矩阵" />;

  const cellMax = Math.max(1, ...data.cases.flatMap((c) => Object.values(c.states)));
  const COL_W = 64, ROW_H = 34, LBL_W = 210, HEAD_H = 46;
  const W = LBL_W + data.states.length * COL_W + 20;
  const H = HEAD_H + data.cases.length * ROW_H + 14;

  const csv = [
    ['案例', ...data.states.map((s) => STATE_LABEL[s])],
    ...data.cases.map((c) => [c.name, ...data.states.map((s) => c.states[s])]),
  ];

  return (
    <section className="ws-chart">
      <ChartHead
        title="过程状态矩阵" sub={`${data.schema_version} · 案例 × 过程状态（技术/行动实体计数）`}
        onPng={() => exportSVGAsPNG(svgRef.current, '过程状态矩阵')}
        onCsv={() => exportCSV(csv, '过程状态矩阵')}
        onJson={true} data={data}
      />
      <div className="ws-chart-scroll">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="ws-svg">
          {data.states.map((s, j) => (
            <text key={s} x={LBL_W + j * COL_W + COL_W / 2} y={HEAD_H - 24} textAnchor="middle"
              className="ws-svg-col" transform={`rotate(-18 ${LBL_W + j * COL_W + COL_W / 2} ${HEAD_H - 24})`}>
              {STATE_LABEL[s]}
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
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const svgRef = useRef(null);
  useEffect(() => {
    if (!ids.length) return;
    setData(null); setErr('');
    analysisApi.evidenceCoverage(ids).then(setData).catch((e) => setErr(e.message));
  }, [ids]);

  if (err) return <ErrorCard title="证据覆盖图" err={err} />;
  if (!data) return <LoadingCard title="证据覆盖图" />;

  const ROW_H = 30, LBL_W = 210, LEGEND_H = 26, HEAD_H = 8;
  const segW = 52;
  const W = LBL_W + data.dimensions.length * segW + 16;
  const H = HEAD_H + data.cases.length * ROW_H + LEGEND_H + 10;

  const csv = [
    ['案例', ...data.dimensions.flatMap((d) => data.statuses.map((s) => `${d.label}-${EV_STATUS_LABEL[s]}`))],
    ...data.cases.map((c) => [
      c.name,
      ...data.dimensions.flatMap((d) => data.statuses.map((s) => c.coverage[d.key]?.[s] ?? 0)),
    ]),
  ];

  return (
    <section className="ws-chart">
      <ChartHead
        title="证据覆盖图" sub={`${data.schema_version} · 实体数按证据状态分色（blocked 与 not_evidenced 分离）`}
        onPng={() => exportSVGAsPNG(svgRef.current, '证据覆盖图')}
        onCsv={() => exportCSV(csv, '证据覆盖图')}
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
              <text x={14} y={0} className="ws-svg-legend">{EV_STATUS_LABEL[s]}</text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

// ============ B. 能力—任务热力图 ============
function CapabilityTaskHeatmap({ ids }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const svgRef = useRef(null);
  useEffect(() => {
    if (!ids.length) return;
    setData(null); setErr('');
    analysisApi.capabilityTask(ids).then(setData).catch((e) => setErr(e.message));
  }, [ids]);

  if (err) return <ErrorCard title="能力—任务热力图" err={err} />;
  if (!data) return <LoadingCard title="能力—任务热力图" />;
  if (!data.links.length) {
    return (
      <section className="ws-chart">
        <ChartHead title="能力—任务热力图" sub="技术能力经 supports_task 关系进入任务" />
        <div className="ws-tab-hint">当前范围内暂无「能力 → 任务」关系数据。</div>
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
    ['能力 \\ 任务', ...data.tasks],
    ...data.capabilities.map((c) => [c, ...data.tasks.map((t) => val(c, t) || '')]),
  ];

  return (
    <section className="ws-chart">
      <ChartHead
        title="能力—任务热力图" sub={`${data.schema_version} · 真正进入共同任务的能力（supports_task）`}
        onPng={() => exportSVGAsPNG(svgRef.current, '能力任务热力图')}
        onCsv={() => exportCSV(csv, '能力任务热力图')}
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
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!caseId) { setData(null); return; }
    setData(null); setErr('');
    analysisApi.actionChain(caseId).then(setData).catch((e) => setErr(e.message));
  }, [caseId]);

  if (!caseId) return null;
  if (err) return <ErrorCard title="技术作用链" err={err} />;
  if (!data) return <LoadingCard title="技术作用链" />;

  const SHORT = {
    'Community Context（社区情境）': '情境', 'Problem / Pressure（问题与压力）': '问题',
    'Task（社区更新任务）': '任务', 'Technology（技术）': '技术', 'Capability（技术能力）': '能力',
    'Action / Event（行动与事件）': '行动', 'Organizational Response（组织响应）': '组织响应',
    'Spatial Response（空间响应）': '空间响应', 'Behavioral / Service Response（行为与服务响应）': '行为/服务响应',
    'Outcome（结果）': '结果', 'Constraint / Adjustment（约束与调整）': '约束',
  };
  const byType = new Map(data.chain_order.map((t) => [t, []]));
  for (const e of data.entities) {
    if (byType.has(e.entity_type)) byType.get(e.entity_type).push(e);
  }

  const exportRows = () => [
    ['链位', '实体', '证据状态'],
    ...data.entities.flatMap((e) => {
      const evs = Object.entries(e.evidence || {});
      return evs.length ? evs.map(([st, n]) => [SHORT[e.entity_type] || e.entity_type, e.name, `${EV_STATUS_LABEL[st] || st}×${n}`])
        : [[SHORT[e.entity_type] || e.entity_type, e.name, '无证据记录']];
    }),
  ];

  return (
    <section className="ws-chart">
      <ChartHead
        title="技术作用链" sub={`${data.schema_version} · 情境 → 问题 → 任务 → 技术 → 能力 → 行动 → 响应 → 结果`}
        onCsv={() => exportCSV(exportRows(), '技术作用链')}
        onJson={true} data={data}
      />
      <div className="ws-chain">
        {data.chain_order.map((t) => {
          const ents = byType.get(t) || [];
          if (!ents.length) return null;
          return (
            <div className="ws-chain-col" key={t}>
              <div className="ws-chain-head">{SHORT[t] || t}</div>
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
        <span>✓ 已确认</span><span>◐ 有限支持</span><span>✕ 受阻</span><span>∅ 无证据记录</span>
      </div>
    </section>
  );
}

function LoadingCard({ title }) {
  return (
    <section className="ws-chart">
      <ChartHead title={title} />
      <div className="ws-loading"><Loader2 size={16} className="spin" /> 查询中…</div>
    </section>
  );
}
function ErrorCard({ title, err }) {
  return (
    <section className="ws-chart">
      <ChartHead title={title} />
      <div className="ws-tab-error">加载失败：{err}</div>
    </section>
  );
}
