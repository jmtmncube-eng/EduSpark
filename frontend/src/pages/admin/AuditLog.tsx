import { useCallback, useEffect, useMemo, useState } from 'react';
import { audit as auditApi } from '../../services/api';
import { showToast } from '../../components/Toast';

type Entry = Awaited<ReturnType<typeof auditApi.list>>['entries'][number];
type Summary = Awaited<ReturnType<typeof auditApi.summary>>;

const PAGE_SIZE = 100;

// Human-friendly labels per action code
const ACTION_META: Record<string, { icon: string; label: string; color: string }> = {
  'auth.login':                   { icon: '🔑', label: 'Signed in',                color: 'var(--t3)' },
  'auth.register':                { icon: '✨', label: 'New account',              color: '#0284c7' },
  'auth.recover.success':         { icon: '🔓', label: 'PIN recovered',            color: '#d97706' },
  'security.set-question':        { icon: '🛟', label: 'Recovery question set',    color: '#0284c7' },
  'user.assign-tutor':            { icon: '🤝', label: 'Tutor assigned',           color: 'var(--p)' },
  'user.update':                  { icon: '✏️', label: 'User updated',             color: 'var(--p)' },
  'user.deactivate':              { icon: '🚫', label: 'User deactivated',         color: '#dc2626' },
  'pack.create':                  { icon: '📦', label: 'Pack created',             color: 'var(--p)' },
  'pack.update':                  { icon: '✏️', label: 'Pack updated',             color: 'var(--p)' },
  'pack.delete':                  { icon: '🗑',  label: 'Pack deleted',             color: '#dc2626' },
  'pack.share':                   { icon: '📤', label: 'Pack shared',              color: 'var(--p)' },
  'pack.unshare':                 { icon: '↩️', label: 'Pack unshared',            color: '#d97706' },
  'pack.unlock':                  { icon: '🔓', label: 'Pack unlocked',            color: '#16a34a' },
  'pack.revoke':                  { icon: '🔒', label: 'Pack revoked',             color: '#d97706' },
  'document.upload':              { icon: '📄', label: 'PDF uploaded',             color: 'var(--p)' },
  'document.delete':              { icon: '🗑',  label: 'PDF deleted',              color: '#dc2626' },
  'assignment.create':            { icon: '📋', label: 'Assignment created',       color: 'var(--p)' },
  'assignment.update':            { icon: '✏️', label: 'Assignment updated',       color: 'var(--p)' },
  'assignment.delete':            { icon: '🗑',  label: 'Assignment deleted',       color: '#dc2626' },
  'calendar.note.create':         { icon: '📅', label: 'Calendar note created',    color: 'var(--p)' },
  'calendar.note.update':         { icon: '✏️', label: 'Calendar note updated',    color: 'var(--p)' },
  'calendar.note.delete':         { icon: '🗑',  label: 'Calendar note deleted',    color: '#dc2626' },
  'calendar.request.create':      { icon: '✋', label: 'Calendar change requested', color: '#d97706' },
  'calendar.request.approve':     { icon: '✅', label: 'Calendar request approved', color: '#16a34a' },
  'calendar.request.deny':        { icon: '❌', label: 'Calendar request denied',   color: '#dc2626' },
  'tutorRequest.create':          { icon: '🙋', label: 'Tutor request submitted',  color: '#d97706' },
  'tutorRequest.approve':         { icon: '✅', label: 'Tutor request approved',   color: '#16a34a' },
  'tutorRequest.deny':            { icon: '❌', label: 'Tutor request denied',     color: '#dc2626' },
  'questions.generate':           { icon: '⚡', label: 'Questions generated',      color: '#d97706' },
};
function meta(action: string) {
  return ACTION_META[action] || { icon: '•', label: action, color: 'var(--t2)' };
}

function rel(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-ZA');
}

function dayLabel(ts: string) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = (today.getTime() - d.getTime()) / 86_400_000;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function AdminAuditLog() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [actions, setActions] = useState<string[]>([]);
  const [entities, setEntities] = useState<string[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    auditApi.actions().then(setActions).catch(() => setActions([]));
    auditApi.entities().then(setEntities).catch(() => setEntities([]));
    auditApi.summary().then(setSummary).catch(() => setSummary(null));
  }, []);

  const queryParams = useMemo(() => {
    const params: Record<string, string> = { limit: String(PAGE_SIZE), offset: String(offset) };
    if (actionFilter) params.action = actionFilter;
    if (entityFilter) params.entityType = entityFilter;
    if (search.trim()) params.q = search.trim();
    if (fromDate) params.from = new Date(fromDate + 'T00:00:00').toISOString();
    if (toDate)   params.to   = new Date(toDate   + 'T23:59:59').toISOString();
    return params;
  }, [offset, actionFilter, entityFilter, search, fromDate, toDate]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await auditApi.list(queryParams);
      setEntries(data.entries);
      setTotal(data.total);
    } catch (e) {
      showToast(String((e as Error).message), 'err');
    } finally { setLoading(false); }
  }, [queryParams]);

  useEffect(() => { load(); }, [load]);

  // Reset offset whenever a filter changes
  useEffect(() => { setOffset(0); }, [actionFilter, entityFilter, search, fromDate, toDate]);

  function clearFilters() {
    setActionFilter(''); setEntityFilter(''); setSearch(''); setFromDate(''); setToDate('');
  }

  async function downloadCsv() {
    try {
      // Drop limit/offset from the CSV download — export all matching rows (capped at 1000 by server)
      const { limit: _l, offset: _o, ...rest } = queryParams;
      void _l; void _o;
      await auditApi.downloadCsv(rest);
      showToast('CSV downloaded', 'success');
    } catch (e) { showToast(String((e as Error).message), 'err'); }
  }

  const pageCount = Math.ceil(total / PAGE_SIZE) || 1;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const hasFilter = !!(actionFilter || entityFilter || search || fromDate || toDate);

  // Group entries by day for visual scanability
  const grouped = useMemo(() => {
    const map: Record<string, Entry[]> = {};
    for (const e of entries) {
      const k = dayLabel(e.createdAt);
      (map[k] ||= []).push(e);
    }
    return Object.entries(map);
  }, [entries]);

  return (
    <div>
      <div className="ph">
        <h2>🕵️ Audit Log</h2>
        <p>Every change in the system — who, what, when, from where.</p>
      </div>

      {/* Summary chips */}
      {summary && (
        <div className="flex g2 ia mb2" style={{ flexWrap: 'wrap', fontSize: 12 }}>
          <span className="ca" style={{ padding: '6px 12px', fontWeight: 700 }}>
            Total events <span style={{ color: 'var(--p)', marginLeft: 6 }}>{summary.total.toLocaleString()}</span>
          </span>
          <span className="ca" style={{ padding: '6px 12px' }}>
            Last 7d <span style={{ color: 'var(--p)', fontWeight: 700, marginLeft: 6 }}>{summary.last7d}</span>
          </span>
          <span className="ca" style={{ padding: '6px 12px' }}>
            Today <span style={{ color: 'var(--p)', fontWeight: 700, marginLeft: 6 }}>{summary.today}</span>
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="ca" style={{ padding: 12, marginBottom: 12 }}>
        <div className="flex g2" style={{ flexWrap: 'wrap' }}>
          <input
            className="input"
            placeholder="🔍 Search action / entity / ID / IP"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          <select className="select" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} style={{ width: 'auto', minWidth: 180 }}>
            <option value="">All actions</option>
            {actions.map((a) => <option key={a} value={a}>{ACTION_META[a]?.icon ?? '•'} {ACTION_META[a]?.label ?? a}</option>)}
          </select>
          <select className="select" value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} style={{ width: 'auto', minWidth: 150 }}>
            <option value="">All entities</option>
            {entities.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div className="flex g2 mt1" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="xs ct3">From:
            <input type="date" className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ marginLeft: 6, width: 'auto' }} />
          </label>
          <label className="xs ct3">To:
            <input type="date" className="input" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ marginLeft: 6, width: 'auto' }} />
          </label>
          {hasFilter && <button className="btn ba btn-sm" onClick={clearFilters}>✕ Clear filters</button>}
          <span style={{ flex: 1 }} />
          <button className="btn ba btn-sm" onClick={load} disabled={loading}>↻ Refresh</button>
          <button className="btn bg-btn btn-sm" onClick={downloadCsv} disabled={loading || entries.length === 0}>📥 Export CSV</button>
        </div>
      </div>

      {loading && entries.length === 0 ? (
        <div className="ct3" style={{ padding: 30, textAlign: 'center' }}>Loading…</div>
      ) : entries.length === 0 ? (
        <div className="ca" style={{ padding: 30, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>🕵️</div>
          <div className="sm ct2 mb1">No audit entries match these filters.</div>
          {hasFilter && <button className="btn ba btn-sm" onClick={clearFilters}>Clear filters</button>}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {grouped.map(([day, dayEntries]) => (
            <div key={day}>
              <div className="xs bold ct3" style={{ padding: '4px 4px 6px', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                {day} · {dayEntries.length} event{dayEntries.length === 1 ? '' : 's'}
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                {dayEntries.map((e) => {
                  const m = meta(e.action);
                  const open = expandedId === e.id;
                  return (
                    <div key={e.id} style={{ border: '1px solid var(--bd)', borderRadius: 10, background: 'var(--bg)' }}>
                      <button
                        onClick={() => setExpandedId(open ? null : e.id)}
                        style={{
                          width: '100%', textAlign: 'left',
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 12px', cursor: 'pointer',
                          background: 'transparent', border: 0, color: 'inherit',
                        }}
                      >
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{m.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="sm" style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                            <span className="bold" style={{ color: m.color }}>{m.label}</span>
                            <span className="xs ct3">{e.entityType}{e.entityId ? ` · ${e.entityId.slice(-6)}` : ''}</span>
                          </div>
                          <div className="xs ct3" style={{ marginTop: 1 }}>
                            {e.actor ? `${e.actor.name} (${e.actor.role.toLowerCase()})` : 'system'}
                            {' · '}<span title={new Date(e.createdAt).toLocaleString('en-ZA')}>{rel(e.createdAt)}</span>
                            {e.ip ? ` · ${e.ip}` : ''}
                          </div>
                        </div>
                        <span style={{ fontSize: 13, color: 'var(--t3)' }}>{open ? '▴' : '▾'}</span>
                      </button>
                      {open && (
                        <div style={{ padding: '0 14px 12px', fontSize: 12 }}>
                          <pre style={{
                            background: 'var(--bg2)', padding: 10, borderRadius: 8,
                            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                            margin: 0, fontFamily: 'monospace', fontSize: 11,
                          }}>{JSON.stringify({ action: e.action, entityType: e.entityType, entityId: e.entityId, meta: e.meta, ip: e.ip, at: e.createdAt, actor: e.actor }, null, 2)}</pre>
                          <div className="flex g1 mt1" style={{ justifyContent: 'flex-end' }}>
                            <button
                              className="btn ba btn-sm"
                              style={{ fontSize: 11 }}
                              onClick={() => {
                                navigator.clipboard.writeText(JSON.stringify(e, null, 2));
                                showToast('Entry copied', 'info');
                              }}
                            >📋 Copy JSON</button>
                            {e.entityType && e.entityId && (
                              <button
                                className="btn ba btn-sm"
                                style={{ fontSize: 11 }}
                                onClick={() => { setEntityFilter(e.entityType); setSearch(e.entityId || ''); }}
                              >🔎 Filter to this entity</button>
                            )}
                            {e.actor && (
                              <button
                                className="btn ba btn-sm"
                                style={{ fontSize: 11 }}
                                onClick={() => setSearch(e.actor!.id)}
                              >👤 Filter to this actor</button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex jb ia mt2" style={{ padding: '8px 0' }}>
          <button className="btn ba btn-sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>← Prev</button>
          <span className="xs ct3">Page {currentPage} of {pageCount} · {total.toLocaleString()} entries</span>
          <button className="btn ba btn-sm" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>Next →</button>
        </div>
      )}
    </div>
  );
}
