import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { parent as parentApi } from '../services/api';

interface ParentData {
  student: { name: string; grade: number; xp: number };
  label: string | null; expiresAt: string; daysLeft: number;
  totalQuizzes: number; avgScore: number; bestScore: number; passRate: number;
  recentResults: { id: string; score: number; title: string; topic: string; completedAt: string }[];
  topicBreakdown: { topic: string; avgScore: number; attempts: number }[];
}

const scoreColor = (s: number) => s >= 70 ? '#10b981' : s >= 50 ? '#f59e0b' : '#ef4444';

export default function ParentSession() {
  const { user, logout } = useAuth();
  const [data, setData] = useState<ParentData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.pin) return;
    parentApi.view(user.pin)
      .then((d) => setData(d as ParentData))
      .catch((e) => setError((e as Error).message || 'Could not load progress data'))
      .finally(() => setLoading(false));
  }, [user?.pin]);

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(145deg,#F0FDF8,#D4F4EA)' }}>
      <div style={{ textAlign: 'center', color: '#0d9488', fontFamily: 'sans-serif' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔬</div>
        <div style={{ fontWeight: 700, fontSize: 18 }}>EduSpark</div>
        <div style={{ marginTop: 8, color: '#6b7280' }}>Loading progress report…</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(145deg,#FFF5F5,#FFE4E4)', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 360, padding: '0 24px' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ color: '#dc2626', marginBottom: 8 }}>Session Error</h2>
        <p style={{ color: '#6b7280', marginBottom: 20 }}>{error}</p>
        <button onClick={logout} style={{ background: '#0d9488', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 24px', cursor: 'pointer', fontWeight: 700 }}>Sign Out</button>
      </div>
    </div>
  );

  if (!data) return null;

  const expiryDate = new Date(data.expiresAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(145deg,#F0FDF8 0%,#E2F9F0 50%,#D4F4EA 100%)', fontFamily: 'system-ui, sans-serif', padding: '0 16px 40px' }}>

      {/* Top bar */}
      <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🔬</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#0f766e' }}>EduSpark</div>
            <div style={{ fontSize: 10, color: '#9ca3af' }}>Parent View · Read Only</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ textAlign: 'right', fontSize: 11, color: '#9ca3af' }}>
            <div>Access PIN: <strong style={{ color: '#0d9488', letterSpacing: '.1em' }}>{user?.pin}</strong></div>
            <div>Expires {expiryDate}</div>
          </div>
          <button
            onClick={logout}
            style={{ background: 'rgba(255,255,255,.65)', backdropFilter: 'blur(12px)', border: '1.5px solid rgba(255,255,255,.85)', borderRadius: 10, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#374151' }}
          >
            Sign Out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* Student header */}
        <div style={{ background: 'rgba(255,255,255,.65)', backdropFilter: 'blur(20px)', borderRadius: 16, padding: '20px 22px', border: '1.5px solid rgba(255,255,255,.85)', marginBottom: 18, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎓</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f766e', margin: '0 0 4px' }}>{data.student.name}</h1>
          <div style={{ fontSize: 14, color: '#6b7280' }}>
            Grade {data.student.grade}
            {data.label && <> · <span style={{ color: '#0d9488', fontWeight: 600 }}>{data.label}</span></>}
          </div>
          <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(20,184,166,.1)', borderRadius: 20, padding: '4px 12px', fontSize: 12, color: '#0d9488', fontWeight: 600 }}>
            ⚡ {data.student.xp} XP earned
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: '#9ca3af' }}>
            🔒 Expires in <strong style={{ color: data.daysLeft <= 2 ? '#ef4444' : '#6b7280' }}>{data.daysLeft} day{data.daysLeft !== 1 ? 's' : ''}</strong>
          </div>
        </div>

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 18 }}>
          {[
            { ico: '📝', val: data.totalQuizzes, lbl: 'Quizzes Done' },
            { ico: '🎯', val: `${data.avgScore}%`, lbl: 'Average Score', col: scoreColor(data.avgScore) },
            { ico: '🏆', val: `${data.bestScore}%`, lbl: 'Best Score', col: scoreColor(data.bestScore) },
            { ico: '✅', val: `${data.passRate}%`, lbl: 'Pass Rate', col: scoreColor(data.passRate) },
          ].map((k) => (
            <div key={k.lbl} style={{ background: 'rgba(255,255,255,.65)', backdropFilter: 'blur(16px)', borderRadius: 14, padding: '16px 18px', border: '1.5px solid rgba(255,255,255,.85)', textAlign: 'center' }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>{k.ico}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: k.col || '#0f766e' }}>{k.val}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{k.lbl}</div>
            </div>
          ))}
        </div>

        {/* Topic breakdown */}
        {data.topicBreakdown.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,.65)', backdropFilter: 'blur(16px)', borderRadius: 16, padding: '18px 20px', border: '1.5px solid rgba(255,255,255,.85)', marginBottom: 18 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f766e', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>📊 Performance by Topic</h3>
            {[...data.topicBreakdown].sort((a, b) => b.avgScore - a.avgScore).map((t) => {
              const col = scoreColor(t.avgScore);
              return (
                <div key={t.topic} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: '#374151' }}>{t.topic}</span>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{t.attempts} quiz{t.attempts !== 1 ? 'zes' : ''}</span>
                      <span style={{ fontWeight: 700, color: col }}>{t.avgScore}%</span>
                    </div>
                  </div>
                  <div style={{ height: 8, background: 'rgba(0,0,0,.07)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${t.avgScore}%`, background: col, borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recent results */}
        {data.recentResults.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,.65)', backdropFilter: 'blur(16px)', borderRadius: 16, padding: '18px 20px', border: '1.5px solid rgba(255,255,255,.85)', marginBottom: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f766e', marginBottom: 14 }}>📅 Recent Quizzes</h3>
            {data.recentResults.map((r) => {
              const col = scoreColor(r.score);
              return (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,.06)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>{r.title}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>
                      {r.topic} · {new Date(r.completedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: col }}>{r.score}%</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{r.score >= 80 ? 'Distinction' : r.score >= 70 ? 'Merit' : r.score >= 50 ? 'Pass' : 'Below pass'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {data.totalQuizzes === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontWeight: 600, fontSize: 16, color: '#374151', marginBottom: 6 }}>No quizzes completed yet</div>
            <div style={{ fontSize: 13 }}>Check back once {data.student.name} has completed some assignments.</div>
          </div>
        )}

        <div style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af' }}>
          🔬 EduSpark · Maths and Science Learning Platform · CAPS Aligned<br />
          <span style={{ display: 'block', marginTop: 4 }}>This is a read-only view. Access expires on {expiryDate}.</span>
        </div>
      </div>
    </div>
  );
}
