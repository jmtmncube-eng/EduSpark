import { useEffect, useState } from 'react';
import { assignments as assignmentsApi } from '../services/api';
import { onDirty } from '../services/events';

type LiveData = Awaited<ReturnType<typeof assignmentsApi.live>>;

/**
 * Floating live tray under each assignment row: submitted-count, avg score so far,
 * and the 5 latest submissions. Refreshes via the event bus the moment any quiz
 * result lands anywhere in the app — no polling.
 */
export default function AssignmentLiveTray({ assignmentId, onOpenHeatmap }: { assignmentId: string; onOpenHeatmap: () => void }) {
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      assignmentsApi.live(assignmentId)
        .then(setData)
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    };
    load();
    return onDirty(['results', 'assignments', 'all'], () => load());
  }, [assignmentId]);

  if (loading) return null;
  if (!data) return null;

  const pct = data.eligible ? Math.round((data.submitted / data.eligible) * 100) : 0;
  const avgTone = data.avgScore >= 70 ? '#16a34a' : data.avgScore >= 50 ? '#b45309' : '#b91c1c';

  return (
    <div style={{
      background: 'rgba(20,184,166,.06)',
      border: '1px solid rgba(20,184,166,.25)',
      borderRadius: 10,
      padding: '8px 12px',
      marginTop: 6,
    }}>
      <div className="flex jb ia" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="xs" style={{ color: 'var(--t2)' }}>
          <span style={{ fontWeight: 700, color: 'var(--t)' }}>
            {data.submitted} / {data.eligible}
          </span>{' '}
          submitted ({pct}%)
          {data.submitted > 0 && (
            <>
              {' · avg '}
              <span style={{ fontWeight: 700, color: avgTone }}>{data.avgScore}%</span>
            </>
          )}
        </div>
        {data.submitted > 0 && (
          <button
            onClick={onOpenHeatmap}
            className="btn ba btn-sm"
            style={{ fontSize: 11 }}
          >
            🔥 View heatmap
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, background: 'var(--bd)', borderRadius: 99, overflow: 'hidden', marginTop: 6 }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: 'linear-gradient(90deg, var(--p), #34D399)',
          transition: 'width .3s',
        }} />
      </div>

      {/* Last 5 submitters */}
      {data.latest.length > 0 && (
        <div className="xs" style={{ color: 'var(--t3)', marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <span>Latest:</span>
          {data.latest.map((r) => (
            <span key={r.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '1px 7px', borderRadius: 99,
              background: 'var(--bg)', border: '1px solid var(--bd)',
              color: 'var(--t2)',
            }}>
              {r.userName} · <b style={{ color: r.score >= 70 ? '#16a34a' : r.score >= 50 ? '#b45309' : '#b91c1c' }}>{r.score}%</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
