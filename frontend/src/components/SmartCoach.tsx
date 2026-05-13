import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { recommendations as recApi } from '../services/api';

type Rec = Awaited<ReturnType<typeof recApi.me>>;

const COLLAPSED_KEY = 'es_sc_collapsed';

export default function SmartCoach() {
  const navigate = useNavigate();
  const [rec, setRec] = useState<Rec | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    typeof window !== 'undefined' && localStorage.getItem(COLLAPSED_KEY) === '1'
  );

  function toggle() {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }

  // Live refresh: any time the app fires `eduspark:data-dirty` we re-fetch
  useEffect(() => {
    const load = () => {
      recApi.me()
        .then(setRec)
        .catch(() => setRec(null))
        .finally(() => setLoading(false));
    };
    load();
    const handler = () => load();
    window.addEventListener('eduspark:data-dirty', handler);
    return () => window.removeEventListener('eduspark:data-dirty', handler);
  }, []);

  if (loading) return null;
  if (!rec) return null;

  const { weakTopics, strongTopics, dailyGoal, streak, nextPack, totalAttempts, avgScore } = rec;

  // First-time student — show motivational empty state
  if (totalAttempts === 0) {
    return (
      <div className="ca" style={{
        padding: 20, marginBottom: 18,
        background: 'linear-gradient(135deg, rgba(20,184,166,.10), rgba(14,165,233,.06))',
        border: '1px solid rgba(20,184,166,.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 38 }}>🚀</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--fh)', fontWeight: 800, fontSize: 16 }}>Ready to grow?</div>
            <div className="sm ct2" style={{ marginTop: 2 }}>
              Take your first quiz to unlock SmartCoach — personalised practice tailored to your weak spots.
            </div>
          </div>
          {nextPack ? (
            <button className="btn bg-btn" onClick={() => navigate('/app/practice')}>
              Start →
            </button>
          ) : (
            <button className="btn bg-btn" onClick={() => navigate('/app/my-work')}>
              My Work →
            </button>
          )}
        </div>
      </div>
    );
  }

  const goalPct = Math.min(100, Math.round((dailyGoal.done / dailyGoal.target) * 100));

  return (
    <div className="ca" style={{
      padding: collapsed ? 14 : 18, marginBottom: 16,
      background: 'linear-gradient(135deg, rgba(20,184,166,.08), rgba(255,255,255,.0))',
      border: '1px solid rgba(20,184,166,.25)',
      transition: 'padding .2s',
    }}>
      {/* Header — full row is clickable to collapse */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        style={{
          display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
          gap: 8, flexWrap: 'wrap',
          background: 'transparent', border: 0, cursor: 'pointer',
          color: 'inherit', padding: 0,
          marginBottom: collapsed ? 0 : 14,
          textAlign: 'left',
        }}
      >
        <div className="flex ia" style={{ gap: 10 }}>
          <span style={{ fontSize: 26 }}>🧠</span>
          <div>
            <div style={{ fontFamily: 'var(--fh)', fontWeight: 800, fontSize: 16 }}>SmartCoach</div>
            <div className="xs ct3">Your personal study plan · updated after every quiz</div>
          </div>
        </div>
        <div className="flex ia g2" style={{ flexWrap: 'wrap' }}>
          <Pill icon="🔥" label={`${streak}-day streak`} tone={streak > 0 ? 'hot' : 'mute'} />
          <Pill icon="🎯" label={`${avgScore}% avg`} tone={avgScore >= 80 ? 'good' : avgScore >= 60 ? 'mid' : 'low'} />
          <span aria-hidden style={{ fontSize: 14, color: 'var(--t3)', marginLeft: 4 }}>{collapsed ? '▾' : '▴'}</span>
        </div>
      </button>

      {collapsed && null}

      {!collapsed && (<>


      {/* Daily goal */}
      <div style={{
        background: 'var(--bg)', borderRadius: 12, padding: 12,
        border: '1px solid var(--bd)', marginBottom: 12,
      }}>
        <div className="flex jb ia">
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {dailyGoal.complete ? '✅ Daily goal smashed!' : `🎯 Daily goal: ${dailyGoal.done}/${dailyGoal.target} questions`}
          </div>
          <div className="xs ct3">{dailyGoal.minutesToday} min today</div>
        </div>
        <div style={{ height: 8, background: 'var(--bd)', borderRadius: 99, overflow: 'hidden', marginTop: 8 }}>
          <div style={{
            width: `${goalPct}%`, height: '100%',
            background: dailyGoal.complete
              ? 'linear-gradient(90deg, #22c55e, #34D399)'
              : 'linear-gradient(90deg, var(--p), #34D399)',
            transition: 'width .3s',
          }} />
        </div>
        {!dailyGoal.complete && (
          <button
            className="btn bg-btn btn-sm mt1"
            onClick={() => navigate(nextPack ? '/app/practice' : '/app/my-work')}
          >
            ▶ Practice now ({dailyGoal.target - dailyGoal.done} to go)
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        {/* Focus areas */}
        <div style={{
          background: 'rgba(239,68,68,.06)',
          border: '1px solid rgba(239,68,68,.2)',
          borderRadius: 12, padding: 12,
        }}>
          <div className="sm bold" style={{ marginBottom: 6 }}>🎯 Focus next</div>
          {weakTopics.length === 0 ? (
            <div className="xs ct3">Solid across the board — keep it up!</div>
          ) : (
            weakTopics.map((t) => (
              <div key={t.topic} style={{ padding: '6px 0', borderTop: '1px solid var(--bd)' }}>
                <div className="xs bold">{t.topic}</div>
                <div className="xs ct3 mt1">
                  Avg {t.avgScore}% {t.trend === 'up' ? ' · improving 📈' : t.trend === 'down' ? ' · slipping 📉' : ''}
                </div>
                {t.suggestedPack && (
                  <button
                    className="btn ba btn-sm mt1"
                    style={{ fontSize: 11 }}
                    onClick={() => navigate('/app/practice')}
                  >
                    {t.suggestedPack.coverEmoji} {t.suggestedPack.title} →
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Strengths */}
        <div style={{
          background: 'rgba(34,197,94,.06)',
          border: '1px solid rgba(34,197,94,.2)',
          borderRadius: 12, padding: 12,
        }}>
          <div className="sm bold" style={{ marginBottom: 6 }}>🏆 Strengths</div>
          {strongTopics.length === 0 ? (
            <div className="xs ct3">Keep practicing to build mastery (≥85% on any topic).</div>
          ) : (
            strongTopics.map((t) => (
              <div key={t.topic} style={{ padding: '6px 0', borderTop: '1px solid var(--bd)' }}>
                <div className="xs bold">{t.topic}</div>
                <div className="xs ct3">Avg {t.avgScore}% — mastered ✨</div>
              </div>
            ))
          )}
        </div>
      </div>
      </>)}
    </div>
  );
}

function Pill({ icon, label, tone }: { icon: string; label: string; tone: 'hot' | 'good' | 'mid' | 'low' | 'mute' }) {
  const colors = {
    hot:  { bg: 'rgba(249,115,22,.14)', fg: '#f97316', bd: 'rgba(249,115,22,.3)' },
    good: { bg: 'rgba(34,197,94,.14)',  fg: '#16a34a', bd: 'rgba(34,197,94,.3)' },
    mid:  { bg: 'rgba(245,158,11,.14)', fg: '#d97706', bd: 'rgba(245,158,11,.3)' },
    low:  { bg: 'rgba(239,68,68,.14)',  fg: '#dc2626', bd: 'rgba(239,68,68,.3)' },
    mute: { bg: 'rgba(120,120,120,.10)', fg: 'var(--t3)', bd: 'var(--bd)' },
  }[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 10px', borderRadius: 99,
      background: colors.bg, color: colors.fg, border: `1px solid ${colors.bd}`,
      fontSize: 12, fontWeight: 700,
    }}>
      <span>{icon}</span>{label}
    </span>
  );
}
