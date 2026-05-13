import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notifications as notifApi } from '../services/api';
import { onDirty } from '../services/events';
import type { Notification } from '../types';

const POLL_MS = 30_000;

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function refresh() {
    try {
      const data = await notifApi.list();
      setList(data.list as Notification[]);
      setUnread(data.unread);
    } catch { /* silent */ }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, POLL_MS);
    // Refresh immediately when any other component triggers a result / pack /
    // tutor-request mutation — students see new notifications without polling.
    const off = onDirty(['notifications', 'results', 'packs', 'tutors', 'calendar', 'all'], () => refresh());
    return () => { clearInterval(t); off(); };
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function handleClick(n: Notification) {
    if (!n.readAt) {
      try { await notifApi.markRead(n.id); } catch { /* ignore */ }
      setList((cur) => cur.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      setUnread((u) => Math.max(0, u - 1));
    }
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  }

  async function markAll() {
    setLoading(true);
    try {
      await notifApi.markAllRead();
      setList((cur) => cur.map((x) => ({ ...x, readAt: x.readAt || new Date().toISOString() })));
      setUnread(0);
    } finally { setLoading(false); }
  }

  function rel(ts: string) {
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60_000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(ts).toLocaleDateString('en-ZA');
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: 'transparent', border: '1px solid var(--bd)', borderRadius: 10,
          padding: '6px 10px', cursor: 'pointer', position: 'relative', fontSize: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title="Notifications"
        aria-label="Notifications"
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 18, height: 18, padding: '0 5px',
            background: 'var(--wr)', color: '#fff', borderRadius: 99,
            fontSize: 10, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--bg)',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)',
          width: 360, maxWidth: '90vw',
          background: 'var(--bg)', border: '1px solid var(--bd)',
          borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,.18)',
          zIndex: 1000, overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', borderBottom: '1px solid var(--bd)',
          }}>
            <strong style={{ fontFamily: 'var(--fh)', fontSize: 14 }}>🔔 Notifications</strong>
            {unread > 0 && (
              <button
                className="btn btn-sm ba"
                disabled={loading}
                onClick={markAll}
                style={{ fontSize: 11 }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {list.length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>🎉</div>
                You're all caught up!
              </div>
            ) : (
              list.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  style={{
                    padding: '10px 14px', borderBottom: '1px solid var(--bd)',
                    cursor: n.link ? 'pointer' : 'default',
                    background: n.readAt ? 'transparent' : 'rgba(20,184,166,.05)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    {!n.readAt && (
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: 'var(--p)', marginTop: 6, flexShrink: 0,
                      }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{n.title}</div>
                      {n.body && <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.4 }}>{n.body}</div>}
                      <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>{rel(n.createdAt)}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
