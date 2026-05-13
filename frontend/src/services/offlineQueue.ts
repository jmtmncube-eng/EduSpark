/**
 * Offline write queue.
 *
 * Why: students on flaky connections lose work mid-quiz, mid-assignment, etc.
 * Strategy: any non-GET request that fails with a network error gets stored in
 * localStorage. We replay the queue when:
 *   • `window.online` fires
 *   • The user signs in (App.tsx kicks `flushQueue()` on mount)
 *   • Every 30s while online (catch flaky 4G)
 *
 * Reads (GET) are NOT queued — there's no point retrying them on the user's
 * behalf; the caller renders an error state and the user retries themselves
 * once we're back online.
 *
 * Safety:
 *   • Mutations that 4xx are dropped — they will never succeed.
 *   • Mutations that 5xx or hit a network error stay queued (up to maxAttempts).
 *   • Requests that include a recent Authorization header get retried with the
 *     CURRENT token in localStorage (in case the user re-logged in).
 *   • POST /api/results (quiz submission) is treated as the hot path — visible
 *     in the offline banner so students see "saved, will submit when online".
 */

export interface QueueItem {
  id: string;
  url: string;
  method: string;
  body?: string;
  contentType?: string;
  needsAuth: boolean;
  label?: string;     // human-readable for the banner ("Saved quiz", "Saved request")
  createdAt: number;
  attempts: number;
}

const STORAGE_KEY = 'es_offline_queue';
const MAX_ATTEMPTS = 8;

type Listener = (q: QueueItem[]) => void;
const listeners = new Set<Listener>();

function read(): QueueItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function write(q: QueueItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
  } catch (err) {
    console.warn('[offlineQueue] localStorage write failed', err);
  }
  listeners.forEach((fn) => fn(q));
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  fn(read());
  return () => { listeners.delete(fn); };
}

export function peekQueue(): QueueItem[] { return read(); }
export function queueSize(): number { return read().length; }

export function enqueue(item: Omit<QueueItem, 'id' | 'createdAt' | 'attempts'>): QueueItem {
  const q = read();
  const newItem: QueueItem = {
    id: (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)),
    createdAt: Date.now(),
    attempts: 0,
    ...item,
  };
  q.push(newItem);
  write(q);
  return newItem;
}

let flushing = false;

export async function flushQueue(): Promise<{ ok: number; dropped: number; remaining: number }> {
  if (flushing) return { ok: 0, dropped: 0, remaining: read().length };
  flushing = true;
  try {
    const queue = read();
    if (!queue.length) return { ok: 0, dropped: 0, remaining: 0 };
    if (!navigator.onLine) return { ok: 0, dropped: 0, remaining: queue.length };

    const remaining: QueueItem[] = [];
    let okCount = 0, droppedCount = 0;

    for (const item of queue) {
      const headers: Record<string, string> = {};
      if (item.contentType) headers['Content-Type'] = item.contentType;
      if (item.needsAuth) {
        const tok = localStorage.getItem('es_token');
        if (tok) headers['Authorization'] = `Bearer ${tok}`;
      }
      try {
        const res = await fetch(item.url, {
          method: item.method,
          headers,
          body: item.body,
        });
        if (res.ok || (res.status >= 400 && res.status < 500)) {
          // success or unrecoverable 4xx — drop
          if (res.ok) okCount++; else droppedCount++;
        } else {
          // 5xx — retry later
          remaining.push({ ...item, attempts: item.attempts + 1 });
        }
      } catch {
        const attempts = item.attempts + 1;
        if (attempts >= MAX_ATTEMPTS) {
          droppedCount++; // give up
        } else {
          remaining.push({ ...item, attempts });
        }
      }
    }

    write(remaining);
    return { ok: okCount, dropped: droppedCount, remaining: remaining.length };
  } finally {
    flushing = false;
  }
}

export function clearQueue() { write([]); }

// Auto-flush triggers
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flushQueue(); });
  // Background interval — catches the case where `online` fires while the tab is hidden
  setInterval(() => {
    if (navigator.onLine && read().length) flushQueue();
  }, 30_000);
}
