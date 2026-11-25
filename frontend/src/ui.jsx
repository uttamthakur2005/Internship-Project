import { useEffect, useState } from 'react';
import { get, errMsg, toast } from './api';

const tone = { ok: 'bg-green-100 text-green-800', 'In stock': 'bg-green-100 text-green-800', low: 'bg-amber-100 text-amber-800', out: 'bg-red-100 text-red-800',
  inactive: 'bg-g200 text-g600', active: 'bg-green-100 text-green-800', draft: 'bg-g200 text-g600', ordered: 'bg-blue-100 text-blue-800',
  received: 'bg-green-100 text-green-800', confirmed: 'bg-green-100 text-green-800', cancelled: 'border border-dashed border-g600 text-g600' };
const label = { ok: 'In stock', low: 'Low stock', out: 'Out of stock' };
export const Badge = ({ s }) => <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tone[s] || 'bg-g200'}`}>{label[s] || (s ? s[0].toUpperCase() + s.slice(1) : '—')}</span>;
export const stockState = (p) => (p.status === 'inactive' ? 'inactive' : p.stockQty === 0 ? 'out' : p.stockQty <= p.minStockLevel ? 'low' : 'ok');
export const pick = (o, path) => path.split('.').reduce((a, k) => a?.[k], o);

export function useList(url, params = {}) {
  const [s, set] = useState({ rows: [], meta: {}, loading: true, err: '' });
  const [n, setN] = useState(0); const key = JSON.stringify(params);
  useEffect(() => {
    let live = true; set((x) => ({ ...x, loading: true }));
    get(url, params).then((r) => live && set({ rows: r.data, meta: r.meta || {}, loading: false, err: '' }))
      .catch((e) => live && set({ rows: [], meta: {}, loading: false, err: errMsg(e) }));
    return () => { live = false; };
  }, [url, key, n]);
  return { ...s, reload: () => setN((x) => x + 1) };
}
export function useCount(n, ms = 700) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setV(n);
    let s, id; const f = (t) => { s ??= t; const p = Math.min((t - s) / ms, 1); setV(Math.round(n * (1 - (1 - p) ** 3))); if (p < 1) id = requestAnimationFrame(f); };
    id = requestAnimationFrame(f); return () => cancelAnimationFrame(id);
  }, [n]);
  return v;
}

export function Table({ cols, rows, loading, err, onRetry }) {
  if (err) return <div className="table-state table-state-error"><span>!</span><div><b>We couldn't load these records.</b><p>{err}</p><button className="btn-s" onClick={onRetry}>Try again</button></div></div>;
  return (
    <div className="card overflow-x-auto"><table className="w-full text-left text-sm">
      <thead className="bg-g50 text-g600"><tr>{cols.map(([, l]) => <th key={l} className="whitespace-nowrap px-3 py-2 font-medium">{l}</th>)}</tr></thead>
      <tbody>
        {loading && <tr><td colSpan={cols.length} className="table-state-cell"><span className="table-spinner" /><b>Gathering your records…</b><small>This should only take a moment.</small></td></tr>}
        {!loading && !rows.length && <tr><td colSpan={cols.length} className="table-state-cell"><span className="table-empty-mark">✦</span><b>Nothing here just yet</b><small>Add a record or change the filters to see results.</small></td></tr>}
        {!loading && rows.map((r, i) => (
          <tr key={r._id || r.id || i} className="rise border-t border-g200" style={{ animationDelay: `${Math.min(i, 10) * 20}ms` }}>
            {cols.map(([k, l, fn]) => <td key={l} className="whitespace-nowrap px-3 py-2">{fn ? fn(pick(r, k), r) : pick(r, k) ?? '—'}</td>)}
          </tr>))}
      </tbody></table></div>
  );
}
export const Pager = ({ meta, page, setPage }) => meta.totalPages > 1 && (
  <div className="pagination-bar"><span className="pagination-summary">Page <b>{meta.page}</b> of <b>{meta.totalPages}</b><i />{meta.total} records</span>
    <button className="btn-s" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
    <button className="btn-s" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>Next</button></div>);

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);
  return (
    <div className="modal-backdrop fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-navy-900/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`modal-dialog pop card mt-10 w-full ${wide ? 'max-w-3xl' : 'max-w-md'} p-5`}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{title}</h2><button className="btn-s" onClick={onClose} aria-label="Close">✕</button></div>{children}</div></div>);
}
export const Field = ({ label: l, children }) => <label className="mb-3 block text-sm"><span className="mb-1 block text-g600">{l}</span>{children}</label>;

export function FormModal({ title, fields, initial = {}, onSubmit, onClose, submitLabel = 'Save', top }) {
  const [v, setV] = useState(initial); const [opts, setOpts] = useState({}); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { fields.forEach((f) => f.from && get(f.from, { limit: 100 }).then((r) => setOpts((o) => ({ ...o, [f.k]: r.data })))); }, []);
  const go = async (e) => { e.preventDefault(); setBusy(true); setErr('');
    try { const body = {}; fields.forEach((f) => { let x = v[f.k]; if (x === '' || x === undefined) return; if (f.t === 'money') x = Math.round(Number(x) * 100); if (f.t === 'number') x = Number(x); body[f.k] = x; }); await onSubmit(body); onClose(); }
    catch (e2) { setErr(errMsg(e2)); } finally { setBusy(false); } };
  return (
    <Modal title={title} onClose={onClose}><form onSubmit={go}>{top}
      {fields.map((f) => <Field key={f.k} label={f.l + (f.req ? ' *' : '')}>
        {f.from || f.opts ? <select className="inp" required={f.req} value={v[f.k] || ''} onChange={(e) => setV({ ...v, [f.k]: e.target.value })}><option value="">Select…</option>
          {(f.opts || opts[f.k] || []).map((o) => <option key={o._id || o} value={o._id || o}>{o.name || o}</option>)}</select>
          : <input className="inp" required={f.req} type={f.t === 'password' ? 'password' : f.t === 'money' || f.t === 'number' ? 'number' : 'text'} min={f.t ? 0 : undefined} step={f.t === 'money' ? '0.01' : undefined}
            value={v[f.k] ?? ''} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} />}</Field>)}
      {err && <p role="alert" className="mb-3 rounded-lg bg-red-100 p-2 text-sm text-red-800">{err}</p>}
      <button className="btn-p w-full" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button></form></Modal>);
}
