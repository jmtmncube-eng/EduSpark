import { useEffect, useState } from 'react';
import { analytics } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import TutorSpotlight from '../../components/TutorSpotlight';
import AStudentFactory from '../../components/AStudentFactory';
import ClockWeather from '../../components/ClockWeather';
import { useAuth } from '../../context/AuthContext';

/**
 * The Dashboard is the *launchpad* — at-a-glance health + quick navigation.
 * Deep charts and breakdowns live in Analytics; we deliberately don't
 * duplicate them here.
 */
export default function AdminDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [overview, setOverview] = useState<Record<string, string | number>>({});
  const navigate = useNavigate();

  useEffect(() => {
    analytics.overview().then((d) => setOverview(d as Record<string, string | number>)).catch(() => {});
  }, []);

  const stats = [
    { ico: '📝', val: overview.questions ?? 0, lbl: 'Questions', ch: 'In the bank' },
    { ico: '👥', val: overview.students ?? 0, lbl: isAdmin ? 'Students' : 'My students', ch: 'Active' },
    { ico: '📋', val: overview.assignments ?? 0, lbl: 'Assignments', ch: 'Live' },
    { ico: '🏆', val: `${overview.avgScore ?? 0}%`, lbl: 'Avg Score', ch: `${overview.attempts ?? 0} attempts` },
  ];

  // Content-health chips — admin-only governance signal, sourced from the
  // v2.9 quality pipeline. Keeps "what reaches students" visible without a
  // separate page.
  const reviewQueue = Number(overview.reviewQueue ?? 0);
  const flaggedQuestions = Number(overview.flaggedQuestions ?? 0);

  return (
    <div>
      <div className="ph" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ margin: 0 }}>📊 Dashboard</h2>
          <p style={{ margin: 0 }}>{isAdmin ? 'Platform overview & launchpad' : 'Your class at a glance'}</p>
        </div>
        <ClockWeather />
      </div>

      {isAdmin && <AStudentFactory />}
      <TutorSpotlight />

      <div className="stats">
        {stats.map((s) => (
          <div className="scard" key={s.lbl}>
            <div className="sico">{s.ico}</div>
            <div className="sv">{s.val}</div>
            <div className="sl">{s.lbl}</div>
            <div className="sch">{s.ch}</div>
          </div>
        ))}
      </div>

      {/* Content health — admin governance at a glance */}
      {isAdmin && (
        <div className="ca" style={{ padding: '11px 14px', margin: '12px 0' }}>
          <div className="flex ia g2 wrap">
            <span className="xs bold ct3" style={{ letterSpacing: .3 }}>CONTENT HEALTH</span>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => navigate('/app/questions')}
              title="Questions awaiting review before they can reach students"
              style={{
                background: reviewQueue > 0 ? 'rgba(180,83,9,.12)' : 'rgba(21,128,61,.10)',
                color: reviewQueue > 0 ? '#b45309' : '#15803d',
                border: `1px solid ${reviewQueue > 0 ? 'rgba(180,83,9,.3)' : 'rgba(21,128,61,.3)'}`,
              }}
            >
              🔍 {reviewQueue} in review
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => navigate('/app/questions')}
              title="Published questions auto-flagged as broken, trivial or low-discrimination"
              style={{
                background: flaggedQuestions > 0 ? 'rgba(185,28,28,.10)' : 'rgba(21,128,61,.10)',
                color: flaggedQuestions > 0 ? '#b91c1c' : '#15803d',
                border: `1px solid ${flaggedQuestions > 0 ? 'rgba(185,28,28,.3)' : 'rgba(21,128,61,.3)'}`,
              }}
            >
              🚩 {flaggedQuestions} quality-flagged
            </button>
            {reviewQueue === 0 && flaggedQuestions === 0 && (
              <span className="xs ct3">✅ Bank is clean — nothing waiting on you.</span>
            )}
          </div>
        </div>
      )}

      <div className="grid3">
        {[
          { ico: '📝', label: 'Question Bank', sub: 'Manage & generate', path: '/app/questions' },
          { ico: '📋', label: 'Assignments', sub: 'Create & allocate', path: '/app/assignments' },
          { ico: '📈', label: 'Analytics', sub: 'Charts & deep dive', path: '/app/analytics' },
        ].map((c) => (
          <div key={c.path} className="card" style={{ cursor: 'pointer', flexDirection: 'column', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'center' }} onClick={() => navigate(c.path)}>
            <span style={{ fontSize: 34 }}>{c.ico}</span>
            <strong className="fh" style={{ fontSize: 15 }}>{c.label}</strong>
            <span className="sm ct2">{c.sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
