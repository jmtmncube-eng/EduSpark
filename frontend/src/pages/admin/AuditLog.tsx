import { useCallback, useEffect, useState } from 'react';
import { audit as auditApi } from '../../services/api';
import { showToast } from '../../components/Toast';

type Entry = Awaited<ReturnType<typeof auditApi.list>>['entries'][number];

const PAGE_SIZE = 50;

// Human-friendly labels for known action codes
const ACTION_META: Record<string, { icon: string; label: string; color: string }> = {
  'auth.login':                { icon: '🔑', label: 'Signed in',                 color: 'var(--t3)' },
  'auth.register':             { icon: '✨', label: 'New account',               color: '#0284c7' },
  'auth.recover.success':      { icon: '🔓', label: 'PIN recovered',             color: '#d97706' },
  'pack.create':               { icon: '📦', label: 'Pack created',              color: 'var(--p)' },
  'pack.update':               { icon: '✏️', label: 'Pack updated',              color: 'var(--p)' },
  'pack.delete':               { icon: '🗑',  label: 'Pack deleted',              color: '#dc2626' },
  'pack.share':                { icon: '📤', label: 'Pack shared with tutor',    color: 'var(--p)' },
  'pack.unlock':               { icon: '🔓', label: 'Pack unlocked for student', color: '#16a34a' },
  'tutorRequest.approve':      { icon: '✅', label: 'Tutor request approved',    color: '#16a34a' },
  'tutorRequest.deny':         { icon: '❌', label: 'Tutor request denied',      color: '#dc2626' },
  'questions.generate':        { icon: '⚡', label: 'Questions generated',       color: '#d97706' },
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

export default function AdminAuditLog() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [search, setSearch] = useState('');
  const [actions, setActions] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    auditApi.actions().then(setActions).catch(() => setActions([]));
  }, []);

  const load = useCallback(async (newOffset = 0) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: String(PAGE_SIZE), offset: String(newOffset) };
      if (actionFilter) params.action = actionFilter;
      if (search.trim()) params.q = search.trim();
      const data = await auditApi.list(params);
      setEntries(data.entries);
      setTotal(data.total);
      setOffset(newOffset);
    } catch (e) {
      showToast(String((e as Error).message), 'err');
    } finally { setLoading(false); }
  }, [actionFilter, search]);

  useEffect(() => { load(0); }, [load]);

  const pageCount = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div>
      <div className="ph">
        <h2>🕵️ Audit Log</h2>
        <p>Everything that has changed in the system — who, what, when.</p>
      </div>

      <div className="ca" style={{
        padding: '10px 12px', marginBottom: 12,
        display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <input
          className="input"
          placeholder="🔍 Search action or entity…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180 }}
        />
        <select className="select" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} style={{ width: 'auto', minWidth: 180 }}>
          <option value="">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{ACTION_META[a]?.icon ?? '•'} {ACTION_META[a]?.label ?? a}</option>)}
        </select>
        <button className="btn ba btn-sm" onClick={() => load(0)} disabled={loading}>↻ Refresh</button>
      </div>

      {loading ? (
        <div className="ct3" style={{ padding: 30, textAlign: 'center' }}>Loading…</div>
      ) : entries.length === 0 ? (
        <div className="ca" style={{ padding: 30, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>🕵️</div>
          <div className="sm ct3">No audit entries match these filters.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 4 }}>
          {entries.map((e) => {
            const m = meta(e.action);
            const open = expandedId === e.id;
            return (
              <div key={e.id} style={{
                border: '1px solid var(--bd)', borderRadius: 10,
                background: 'var(--bg)',
              }}>
                <button
                  onClick={() => setExpandedId(open ? null : e.id)}
                  style={{
                    width: '100%', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', cursor: 'pointer',
                    background: 'transparent', border: 0,
                    color: 'inherit',
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{m.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="sm" style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span className="bold" style={{ color: m.color }}>{m.label}</span>
                      <span className="xs ct3">{e.entityType}{e.entityId ? ` · ${e.entityId.slice(-6)}` : ''}</span>
                    </div>
                    <div className="xs ct3" style={{ marginTop: 1 }}>
                      {e.actor ? `${e.actor.name} (${e.actor.role.toLowerCase()})` : 'system'} · {rel(e.createdAt)}
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
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex jb ia mt2" style={{ padding: '8px 0' }}>
          <button className="btn ba btn-sm" disabled={offset === 0} onClick={() => load(Math.max(0, offset - PAGE_SIZE))}>← Prev</button>
          <span className="xs ct3">Page {currentPage} of {pageCount} · {total} entries</span>
          <button className="btn ba btn-sm" disabled={offset + PAGE_SIZE >= total} onClick={() => load(offset + PAGE_SIZE)}>Next →</button>
        </div>
      )}
    </div>
  );
}
