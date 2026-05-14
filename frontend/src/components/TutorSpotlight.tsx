import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { recommendations as recApi } from '../services/api';
import { onDirty } from '../services/events';

type Student = Awaited<ReturnType<typeof recApi.spotlight>>[number];

const STATUS_META: Record<Student['status'], { icon: string; label: string; bg: string; fg: string; bd: string; weight: number }> = {
  at_risk:  { icon: '🚨', label: 'At risk',  bg: 'rgba(239,68,68,.10)', fg: '#dc2626', bd: 'rgba(239,68,68,.3)',  weight: 0 },
  inactive: { icon: '💤', label: 'Inactive', bg: 'rgba(120,120,120,.10)', fg: 'var(--t3)', bd: 'var(--bd)',         weight: 1 },
  new:      { icon: '🌱', label: 'New',      bg: 'rgba(14,165,233,.10)', fg: '#0284c7', bd: 'rgba(14,165,233,.3)', weight: 2 },
  on_track: { icon: '👍', label: 'On track', bg: 'rgba(20,184,166,.10)', fg: 'var(--p)', bd: 'rgba(20,184,166,.3)', weight: 3 },
  thriving: { icon: '🏆', label: 'Thriving', bg: 'rgba(34,197,94,.10)',  fg: '#16a34a', bd: 'rgba(34,197,94,.3)',  weight: 4 },
};

export default function TutorSpotlight() {
  const navigate = useNavigate();
  const [list, setList] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'flagged' | 'all' | Student['status']>('flagged');

  useEffect(() => {
    const load = () => {
      recApi.spotlight()
        .then(setList)
        .catch(() => setList([]))
        .finally(() => setLoading(false));
    };
    load();
    return onDirty(['results', 'users', 'tutors', 'packs', 'all'], () => load());
  }, []);

  const counts = useMemo(() => list.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {} as Record<Student['status'], number>), [list]);

  const flaggedCount = (counts.at_risk || 0) + (counts.inactive || 0);
  const newCount     = counts.new || 0;

  const filtered = useMemo(() => {
    if (filter === 'flagged') return list.filter((s) => s.status === 'at_risk' || s.status === 'inactive');
    if (filter === 'all') return list;
    return list.filter((s) => s.status === filter);
  }, [list, filter]);

  if (loading) return null;
  if (list.length === 0) {
    return (
      <div className="ca" style={{ padding: 14, marginBottom: 16 }}>
        <div className="flex ia g2">
          <span style={{ fontSize: 20 }}>🔭</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--fh)', fontWeight: 800, fontSize: 14 }}>Class Spotlight</div>
            <div className="xs ct3">No students yet — request your first one in Students.</div>
          </div>
          <button className="btn bg-btn btn-sm" onClick={() => navigate('/app/students')}>+ Add students</button>
        </div>
      </div>
    );
  }

  // Sort by status weight
  const sorted = [...filtered].sort((a, b) => STATUS_META[a.status].weight - STATUS_META[b.status].weight);

  return (
    <div className="ca" style={{ padding: 14, marginBottom: 16, overflow: 'hidden' }}>
      {/* Collapsed header — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: 0, background: 'transparent', border: 0, cursor: 'pointer',
          color: 'inherit', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 20 }}>🔭</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--fh)', fontWeight: 800, fontSize: 15 }}>
            Class Spotlight · {list.length} student{list.length === 1 ? '' : 's'}
          </div>
          <div className="xs ct3" style={{ marginTop: 2 }}>
            {flaggedCount > 0
              ? <>🚨 <b style={{ color: '#dc2626' }}>{flaggedCount} need attention</b>{newCount > 0 ? ` · 🌱 ${newCount} new` : ''}</>
              : <>✅ Everyone is on track or better{newCount > 0 ? ` · 🌱 ${newCount} new` : ''}</>
            }
          </div>
        </div>

        {/* Status sparkline */}
        <div className="flex ia g1" style={{ flexWrap: 'wrap' }}>
          {(['at_risk', 'inactive', 'new', 'on_track', 'thriving'] as const).map((s) => {
            const c = counts[s] || 0;
            if (c === 0) return null;
            const meta = STATUS_META[s];
            return (
              <span key={s} style={{
                fontSize: 11, fontWeight: 700,
                padding: '2px 8px', borderRadius: 99,
                background: meta.bg, color: meta.fg, border: `1px solid ${meta.bd}`,
                whiteSpace: 'nowrap',
              }}>
                {meta.icon} {c}
              </span>
            );
          })}
        </div>

        <span aria-hidden style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28, borderRadius: 8,
          background: 'rgba(20,184,166,.14)', color: 'var(--p)',
          fontSize: 16, fontWeight: 800, lineHeight: 1, marginLeft: 4,
        }}>{open ? '▴' : '▾'}</span>
      </button>

      {/* Expanded body */}
      {open && (
        <div style={{ marginTop: 12 }}>
          {/* Filter pills */}
          <div className="flex g2" style={{ flexWrap: 'wrap', marginBottom: 10 }}>
            <FilterPill active={filter === 'flagged'} onClick={() => setFilter('flagged')}>
              🚨 Need attention · {flaggedCount}
            </FilterPill>
            <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
              All · {list.length}
            </FilterPill>
            {(['at_risk', 'inactive', 'new', 'on_track', 'thriving'] as const).map((s) => {
              const c = counts[s] || 0;
              if (c === 0) return null;
              const meta = STATUS_META[s];
              return (
                <FilterPill key={s} active={filter === s} onClick={() => setFilter(s)}>
                  {meta.icon} {meta.label} · {c}
                </FilterPill>
              );
            })}
          </div>

          {sorted.length === 0 ? (
            <div className="ct3 sm" style={{ padding: 14, textAlign: 'center' }}>
              {filter === 'flagged'
                ? '🎉 No students currently flagged — your class is healthy.'
                : 'No students in this filter.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {sorted.map((s) => (
                <StudentRow
                  key={s.id}
                  student={s}
                  onReport={() => navigate(`/app/report/${s.id}`)}
                  onAssign={() => navigate('/app/assignments', {
                    state: { prefill: { studentId: s.id, studentName: s.name, grade: s.grade, topic: s.weakestTopic || undefined } },
                  })}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`btn btn-sm ${active ? 'bg-btn' : 'ba'}`}
      style={{ fontSize: 11 }}
    >
      {children}
    </button>
  );
}

function StudentRow({ student, onReport, onAssign }: {
  student: Student; onReport: () => void; onAssign: () => void;
}) {
  const meta = STATUS_META[student.status];
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 12px', borderRadius: 10,
        background: meta.bg, border: `1px solid ${meta.bd}`,
      }}
    >
      {/* Status icon */}
      <span style={{ fontSize: 16, flexShrink: 0 }}>{meta.icon}</span>

      {/* Name + sub-info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span className="bold" style={{ fontSize: 13 }}>{student.name}</span>
          <span className="xs ct3">Gr {student.grade} · ⚡ {student.xp} XP</span>
        </div>
        <div className="xs" style={{ color: meta.fg, fontWeight: 600, marginTop: 1 }}>
          {meta.label} · {student.reason}
          {student.weakestTopic && student.status !== 'thriving' && student.status !== 'new' && (
            <span className="ct3" style={{ fontWeight: 400 }}> · 📉 weakest: {student.weakestTopic}</span>
          )}
        </div>
      </div>

      {/* Inline actions — spot → act in one tap */}
      <div className="flex ia g1" style={{ flexShrink: 0 }}>
        <button className="btn ba btn-sm" style={{ fontSize: 11 }} onClick={onAssign} title="Create a targeted assignment for this student">
          📋 Assign
        </button>
        <button className="btn bg-btn btn-sm" style={{ fontSize: 11 }} onClick={onReport}>
          📊 Report
        </button>
      </div>
    </div>
  );
}
