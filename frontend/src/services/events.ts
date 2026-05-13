/**
 * Lightweight in-page event bus for cross-component refreshes.
 *
 * Why: when a student submits a quiz / a tutor creates a pack / an admin
 * approves a request, multiple unrelated components on screen (SmartCoach,
 * TutorSpotlight, MyWork, Notifications) should re-fetch. Instead of every
 * page wiring its own refresh interval, we fire a single `data-dirty` event
 * and any listener that cares pulls fresh data.
 *
 * Optional `scope` lets listeners be selective ("results" vs "packs" etc).
 */

export type DirtyScope =
  | 'results' | 'packs' | 'assignments' | 'calendar'
  | 'notifications' | 'tutors' | 'users' | 'audit' | 'all';

const EVENT_NAME = 'eduspark:data-dirty';

export function emitDirty(scope: DirtyScope = 'all', detail?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { scope, ...detail } }));
}

export function onDirty(
  scopes: DirtyScope | DirtyScope[],
  handler: (scope: DirtyScope, detail?: Record<string, unknown>) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const want = new Set(Array.isArray(scopes) ? scopes : [scopes]);
  const listener = (e: Event) => {
    const ce = e as CustomEvent<{ scope: DirtyScope } & Record<string, unknown>>;
    const scope = ce.detail?.scope ?? 'all';
    if (want.has('all') || want.has(scope) || scope === 'all') {
      handler(scope, ce.detail);
    }
  };
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
