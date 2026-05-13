import { useEffect, useState } from 'react';
import { subscribe, flushQueue, type QueueItem } from '../services/offlineQueue';

/**
 * Top-of-screen banner that appears when:
 *   • The browser is offline, OR
 *   • There are queued mutations waiting to sync
 *
 * Shows a count of pending items and lets the user trigger a manual retry.
 */
export default function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const onOn = () => setOnline(true);
    const onOff = () => setOnline(false);
    window.addEventListener('online', onOn);
    window.addEventListener('offline', onOff);
    return () => {
      window.removeEventListener('online', onOn);
      window.removeEventListener('offline', onOff);
    };
  }, []);

  useEffect(() => subscribe(setQueue), []);

  const visible = !online || queue.length > 0;
  if (!visible) return null;

  async function retry() {
    setSyncing(true);
    try { await flushQueue(); } finally { setSyncing(false); }
  }

  const tone = !online ? 'offline' : 'pending';
  const colors = tone === 'offline'
    ? { bg: 'rgba(239,68,68,.92)', fg: '#fff', accent: '#fee2e2' }
    : { bg: 'rgba(245,158,11,.95)', fg: '#fff', accent: '#fef3c7' };

  const grouped: Record<string, number> = {};
  queue.forEach((q) => { const key = q.label || 'Pending change'; grouped[key] = (grouped[key] ?? 0) + 1; });

  return (
    <div
      role="status"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        zIndex: 9999,
        background: colors.bg, color: colors.fg,
        boxShadow: '0 2px 8px rgba(0,0,0,.18)',
        fontSize: 12.5, fontWeight: 600,
      }}
    >
      <div
        style={{
          maxWidth: 1100, margin: '0 auto',
          padding: '8px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 220 }}>
          <span style={{ fontSize: 16 }}>{!online ? '📡' : '⏳'}</span>
          <div>
            <div>
              {!online
                ? "You're offline."
                : `${queue.length} change${queue.length === 1 ? '' : 's'} waiting to sync…`}
              {' '}
              {!online && queue.length > 0 && (
                <span style={{ opacity: 0.95 }}>
                  We saved your last {queue.length} action{queue.length === 1 ? '' : 's'} — they'll sync when you reconnect.
                </span>
              )}
              {online && queue.length > 0 && <span style={{ opacity: 0.95 }}>Reconnected — syncing now.</span>}
            </div>
            {queue.length > 0 && (
              <div style={{ marginTop: 2, fontSize: 11, opacity: 0.92 }}>
                {Object.entries(grouped).slice(0, 3).map(([k, n]) => `${k} ×${n}`).join(' · ')}
              </div>
            )}
          </div>
        </div>

        {online && queue.length > 0 && (
          <button
            onClick={retry}
            disabled={syncing}
            style={{
              padding: '6px 14px', borderRadius: 8,
              background: colors.accent, color: '#7c2d12',
              border: 0, cursor: 'pointer', fontWeight: 700, fontSize: 12,
              whiteSpace: 'nowrap',
            }}
          >
            {syncing ? '⏳ Syncing…' : '↻ Sync now'}
          </button>
        )}
      </div>
    </div>
  );
}
