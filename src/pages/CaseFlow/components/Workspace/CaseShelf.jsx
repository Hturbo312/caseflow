import { useState } from 'react';
export default function CaseShelf({ cases, onOpen, onGraph }) {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const filtered = cases.filter(c => (!location || c.location === location) && `${c.name} ${c.description || ''} ${c.location || ''}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="academic-shelf"><header><div><small>CASEBOOK</small><h2>案例集</h2></div><button onClick={onGraph}>案例集图谱</button></header><label>搜索案例<input value={query} onChange={e => setQuery(e.target.value)} placeholder="名称、地点或内容" /></label><select aria-label="按地点筛选" value={location} onChange={e => setLocation(e.target.value)}><option value="">全部地点</option>{[...new Set(cases.map(c => c.location).filter(Boolean))].map(l => <option key={l}>{l}</option>)}</select><p>{filtered.length} / {cases.length} 个案例</p><div className="academic-shelf-list">{filtered.map((c, i) => <button key={c.id} onClick={() => onOpen(c)}><small>{String(i + 1).padStart(2, '0')} · {c.location || '地点未记录'} {c.year || ''}</small><strong>{c.name}</strong><span>{c.description || '打开案例阅读材料与证据'}</span></button>)}{!filtered.length && <p>没有符合条件的案例，试试调整筛选。</p>}</div></div>;
}
