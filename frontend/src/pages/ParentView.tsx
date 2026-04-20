import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { parent as parentApi } from '../services/api';

interface ParentData {
  student: { name: string; grade: number; xp: number };
  label: string | null; expiresAt: string; daysLeft: number;
  totalQuizzes: number; avgScore: number; bestScore: number; passRate: number;
  recentResults: { id: string; score: number; title: string; topic: string; completedAt: string }[];
  topicBreakdown: { topic: string; avgScore: number; attempts: number }[];
}

export default function ParentView() {
  const { pin } = useParams<{ pin: string }>();
  const [data, setData] = useState<ParentData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pin) return;
    parentApi.view(pin)
      .then((d) => setData(d as ParentData))
      .catch((e) => setError((e as Error).message || 'Invalid or expired PIN'))
      .finally(() => setLoading(false));
  }, [pin]);

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(145deg,#F0FDF8,#D4F4EA)' }}>
      <div style={{ textAlign: 'center', color: '#0d9488', fontFamily: 'sans-serif' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔬</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>EduSpark</div>
        <div style={{ marginTop: 8, color: '#6b7280' }}>Loading progress report…</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(145deg,#FFF5F5,#FFE4E4)', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 360, padding: '0 24px' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
        <h2 style={{ color: '#dc2626', marginBottom: 8 }}>Access Denied</h2>
        <p style={{ color: '#6b7280' }}>{error}</p>
        <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 16 }}>Contact the teacher to get a new access link.</p>
      </div>
    </div>
  );

  if (!data) return null;

  const scoreColor = (s: number) => s >= 70 ? '#10b981' : s >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(145deg,#F0FDF8 0%,#E2F9F0 50%,#D4F4EA 100%)', fontFamily: 'system-ui, sans-serif', padding: '24px 16px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,.70)', backdropFilter: 'blur(20px)', borderRadius: 18, padding: '12px 24px', border: '1.5px solid rgba(255,255,255,.90)', marginBottom: 18 }}>
            <span style={{ fontSize: 28 }}>🔬</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: '#0f766e' }}>EduSpark</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Parent Progress Report</div>
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,.65)', backdropFilter: 'blur(20px)', borderRadius: 16, padding: '18px 22px', border: '1.5px solid rgba(255,255,255,.85)' }}>
            <div style={{ fontSize: 32, marginBottom: 6 }}>🎓</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f766e', margin: '0 0 4px' }}>{data.student.name}</h1>
            <div style={{ fontSize: 14, color: '#6b7280' }}>Grade {data.student.grade} · {data.label || 'Parent View'}</div>
            <div style={{ marginTop: 10, fontSize: 12, color: '#9ca3af' }}>
              🔒 Access via PIN <strong style={{ color: '#0d9488', letterSpacing: '.1em' }}>{pin?.toUpperCase()}</strong> · Expires in {data.daysLeft} day{data.daysLeft !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
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
          <div style={{ background: 'rgba(255,255,255,.65)', backdropFilter: 'blur(16px)', borderRadius: 16, padding: '18px 20px', border: '1.5px solid rgba(255,255,255,.85)', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f766e', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>📊 Topic Performance</h3>
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
                    <div style={{ height: '100%', width: `${t.avgScore}%`, background: col, borderRadius: 4, transition: 'width .5s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recent results */}
        {data.recentResults.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,.65)', backdropFilter: 'blur(16px)', borderRadius: 16, padding: '18px 20px', border: '1.5px solid rgba(255,255,255,.85)', marginBottom: 28 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f766e', marginBottom: 14 }}>📅 Recent Quizzes</h3>
            {data.recentResults.map((r) => {
              const col = scoreColor(r.score);
              return (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,.06)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>{r.title}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>{r.topic} · {new Date(r.completedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: col }}>{r.score}%</div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>
          🔬 EduSpark · Maths and Science Learning Platform · CAPS Aligned<br />
          <span style={{ marginTop: 4, display: 'block' }}>This link expires on {new Date(data.expiresAt).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
      </div>
    </div>
  );
}
