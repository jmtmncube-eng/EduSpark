import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analytics } from '../services/api';

type Data = Awaited<ReturnType<typeof analytics.aStudentFactory>>;

const TIER_META = {
  a: { label: 'A (85+)', color: '#16a34a', bg: 'rgba(34,197,94,.14)' },
  b: { label: 'B (70-84)', color: 'var(--p)', bg: 'rgba(20,184,166,.14)' },
  c: { label: 'C (50-69)', color: '#d97706', bg: 'rgba(245,158,11,.16)' },
  d: { label: 'D (<50)', color: '#dc2626', bg: 'rgba(239,68,68,.14)' },
  none: { label: 'No attempts', color: 'var(--t3)', bg: 'rgba(120,120,120,.10)' },
};

/**
 * The "A-student factory" widget — leading indicators of who's becoming top of class.
 * Polls:
 *   • Mastery distribution by tier
 *   • Class velocity (improving / declining)
 *   • Recovery rate (re-attempts that improved)
 *   • 7-day practice + assignment activity
 *   • Risers / strugglers (top 5 by trend)
 *   • Grade-level segmentation
 */
export default function AStudentFactory() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    analytics.aStudentFactory()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!data || data.totals.students === 0) return null;

  const tierTotal = data.tiers.a + data.tiers.b + data.tiers.c + data.tiers.d + data.tiers.none;

  return (
    <div className="ca" style={{ padding: 16, marginBottom: 16 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', textAlign: 'left', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10, padding: 0,
          background: 'transparent', border: 0, color: 'inherit',
        }}
      >
        <span style={{ fontSize: 22 }}>🏗️</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--fh)', fontWeight: 800, fontSize: 16 }}>A-Student Factory</div>
          <div className="xs ct3">Leading indicators: who's on track to top of class.</div>
        </div>
        <span style={{ fontSize: 14, color: 'var(--t3)' }}>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 14, display: 'grid', gap: 14 }}>
          {/* Tier distribution */}
          <section>
            <div className="sm bold mb1">📊 Mastery distribution</div>
            <div style={{ display: 'flex', height: 28, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--bd)' }}>
              {(['a', 'b', 'c', 'd', 'none'] as const).map((t) => {
                const v = data.tiers[t]; if (!v) return null;
                const pct = (v / tierTotal) * 100;
                const m = TIER_META[t];
                return (
                  <div key={t} style={{ width: `${pct}%`, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid var(--bd)' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: m.color, whiteSpace: 'nowrap' }}>
                      {v > 0 && pct > 8 ? `${v}` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex g2" style={{ marginTop: 6, flexWrap: 'wrap' }}>
              {(['a', 'b', 'c', 'd', 'none'] as const).map((t) => {
                const v = data.tiers[t]; const m = TIER_META[t];
                return (
                  <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--t3)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: m.color }} />
                    {m.label} · <b style={{ color: m.color }}>{v}</b>
                  </span>
                );
              })}
            </div>
          </section>

          {/* Stats grid */}
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
            <Stat
              icon="📈" label="Class velocity"
              value={data.velocity.avgSlope > 0 ? `+${data.velocity.avgSlope}` : `${data.velocity.avgSlope}`}
              sub="avg score Δ per attempt"
              tone={data.velocity.avgSlope > 1 ? 'good' : data.velocity.avgSlope < -1 ? 'bad' : 'mute'}
            />
            <Stat
              icon="🔁" label="Recovery rate"
              value={`${data.recovery.rate}%`}
              sub={`${data.recovery.wins}/${data.recovery.total} retakes improved`}
              tone={data.recovery.rate >= 60 ? 'good' : data.recovery.rate >= 40 ? 'mid' : 'bad'}
            />
            <Stat
              icon="📚" label="Practice (7d)"
              value={`${data.activity.practiceLast7}`}
              sub="sessions this week"
              tone={data.activity.practiceLast7 > 0 ? 'good' : 'mute'}
            />
            <Stat
              icon="📋" label="Assignments (7d)"
              value={`${data.activity.assignmentsLast7}`}
              sub="submissions this week"
              tone="mute"
            />
          </section>

          {/* Risers + Strugglers */}
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            <RiserList
              title="🚀 Risers" empty="No clear risers in the last 5 attempts."
              students={data.velocity.risers}
              tone="good"
              onClick={(id) => navigate(`/app/report/${id}`)}
            />
            <RiserList
              title="📉 Strugglers" empty="No strugglers detected — great news."
              students={data.velocity.strugglers}
              tone="bad"
              onClick={(id) => navigate(`/app/report/${id}`)}
            />
          </section>

          {/* Grade segments */}
          <section>
            <div className="sm bold mb1">🎓 Grade segments</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
              {data.gradeSegments.map((g) => (
                <div key={g.grade} style={{
                  border: '1px solid var(--bd)', borderRadius: 10,
                  padding: 10, background: 'rgba(20,184,166,.04)',
                }}>
                  <div className="flex jb ia">
                    <span className="bold">Grade {g.grade}</span>
                    <span className="xs ct3">{g.students} learners</span>
                  </div>
                  <div className="xs ct2 mt1">Avg score: <b>{g.avgScore}%</b></div>
                  <div className="xs ct2">Active (7d): <b>{g.activeLast7}</b> · <span className="ct3">{g.activeRatio}%</span></div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, sub, tone }: { icon: string; label: string; value: string; sub: string; tone: 'good' | 'mid' | 'bad' | 'mute' }) {
  const colors = {
    good: { fg: '#16a34a', bg: 'rgba(34,197,94,.06)' },
    mid:  { fg: '#d97706', bg: 'rgba(245,158,11,.06)' },
    bad:  { fg: '#dc2626', bg: 'rgba(239,68,68,.06)' },
    mute: { fg: 'var(--t)', bg: 'transparent' },
  }[tone];
  return (
    <div style={{ padding: 10, borderRadius: 10, border: '1px solid var(--bd)', background: colors.bg }}>
      <div className="xs ct3">{icon} {label}</div>
      <div style={{ fontFamily: 'var(--fh)', fontWeight: 800, fontSize: 22, color: colors.fg, marginTop: 2 }}>{value}</div>
      <div className="xs ct3" style={{ lineHeight: 1.3 }}>{sub}</div>
    </div>
  );
}

function RiserList({ title, students, empty, tone, onClick }: {
  title: string;
  empty: string;
  students: { id: string; name: string; grade: number; avg: number; slope: number }[];
  tone: 'good' | 'bad';
  onClick: (id: string) => void;
}) {
  const accent = tone === 'good' ? '#16a34a' : '#dc2626';
  return (
    <div style={{ border: '1px solid var(--bd)', borderRadius: 10, padding: 10 }}>
      <div className="sm bold mb1" style={{ color: accent }}>{title}</div>
      {students.length === 0 ? (
        <div className="xs ct3">{empty}</div>
      ) : students.map((s) => (
        <button
          key={s.id}
          onClick={() => onClick(s.id)}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            width: '100%', padding: '6px 8px',
            borderRadius: 8, border: 0, cursor: 'pointer',
            background: 'transparent', textAlign: 'left',
            color: 'inherit', marginBottom: 2,
          }}
        >
          <div>
            <div className="sm bold" style={{ fontSize: 13 }}>{s.name}</div>
            <div className="xs ct3">Gr {s.grade} · avg {s.avg}%</div>
          </div>
          <div className="xs bold" style={{ color: accent, whiteSpace: 'nowrap' }}>
            {s.slope > 0 ? `+${s.slope}` : s.slope} /attempt
          </div>
        </button>
      ))}
    </div>
  );
}
