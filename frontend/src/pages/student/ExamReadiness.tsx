import { useEffect, useState, useRef } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { analytics } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getLvl } from '../../utils/helpers';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface TopicStat { topic: string; subject: string; avgScore: number; attempts: number; trend: 'improving' | 'declining' | 'stable'; }
interface Rec { priority: 'urgent' | 'review' | 'maintain'; topic: string; avg: number; message: string; }
interface TrendPoint { date: string; score: number; topic: string; }
interface Report {
  locked?: boolean;
  student: { name: string; grade: number; xp: number; photo?: string };
  totalQuizzes: number; avgScore: number; bestScore: number; totalXp: number;
  examReadiness: number | null;
  topicBreakdown: TopicStat[];
  difficultyBreakdown: Record<string, { correct: number; total: number }>;
  recommendations: Rec[];
  trend: TrendPoint[];
}

function isDk() { return document.documentElement.getAttribute('data-theme') === 'dark'; }

function ReadinessMeter({ value }: { value: number | null }) {
  const pct = value ?? 0;
  const color = pct >= 75 ? 'var(--s)' : pct >= 50 ? 'var(--wr)' : 'var(--dr)';
  const label = pct >= 80 ? 'Exam Ready! 🎓' : pct >= 65 ? 'Nearly There 💪' : pct >= 50 ? 'Keep Practising 📚' : 'Needs More Work 🔧';
  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="80" cy="80" r="64" fill="none" stroke="rgba(20,184,166,.12)" strokeWidth="16" />
        <circle cx="80" cy="80" r="64" fill="none" stroke={color} strokeWidth="16"
          strokeDasharray={`${2 * Math.PI * 64}`}
          strokeDashoffset={`${2 * Math.PI * 64 * (1 - pct / 100)}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <div style={{ marginTop: -120, paddingBottom: 80 }}>
        <div style={{ fontSize: 36, fontWeight: 900, fontFamily: 'var(--fh)', color }}>{value !== null ? `${pct}%` : '—'}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color }}>{value !== null ? label : 'No data yet'}</div>
      </div>
    </div>
  );
}

export default function ExamReadiness() {
  const { user } = useAuth();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    analytics.studentReport(user.id).then((d) => { setReport(d as Report); setLoading(false); }).catch(() => setLoading(false));
  }, [user]);

  function printReport() {
    window.print();
  }

  if (!user) return null;
  const lv = getLvl(user.xp || 0);
  const dk = isDk();

  if (loading) return <div className="empty"><div className="eico">⏳</div><h3>Loading your report…</h3></div>;

  if (report?.locked) {
    return (
      <div>
        <div className="ph"><h2>🎯 Exam Readiness</h2><p>Your personalised readiness report</p></div>
        <div className="empty">
          <div className="eico">🔒</div>
          <h3>Not yet available</h3>
          <p>Your tutor hasn't unlocked your exam readiness report yet. Keep completing quizzes — your tutor will unlock this once they're ready to review your progress with you.</p>
        </div>
      </div>
    );
  }

  if (!report || report.totalQuizzes === 0) {
    return (
      <div>
        <div className="ph"><h2>🎯 Exam Readiness</h2><p>Complete quizzes to unlock your personalised readiness report</p></div>
        <div className="empty">
          <div className="eico">📊</div>
          <h3>No data yet</h3>
          <p>Complete at least one quiz to see your exam readiness score, topic analysis, and personalised study recommendations.</p>
        </div>
      </div>
    );
  }

  const urgent = report.recommendations.filter((r) => r.priority === 'urgent');
  const review = report.recommendations.filter((r) => r.priority === 'review');
  const maintain = report.recommendations.filter((r) => r.priority === 'maintain');

  const barData = {
    labels: report.topicBreakdown.map((t) => t.topic.length > 14 ? t.topic.slice(0, 13) + '…' : t.topic),
    datasets: [{
      data: report.topicBreakdown.map((t) => t.avgScore),
      backgroundColor: report.topicBreakdown.map((t) =>
        t.avgScore >= 70 ? (dk ? 'rgba(45,212,191,.65)' : 'rgba(13,148,136,.60)')
          : t.avgScore >= 50 ? (dk ? 'rgba(251,191,36,.60)' : 'rgba(245,158,11,.55)')
          : (dk ? 'rgba(248,113,113,.60)' : 'rgba(220,38,38,.50)')
      ),
      borderRadius: 7,
    }],
  };
  const barOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: 'transparent' }, ticks: { color: dk ? '#7FCFBE' : '#2D5E4A', font: { size: 10 } } },
      y: { beginAtZero: true, max: 100, grid: { color: dk ? 'rgba(45,212,191,.08)' : 'rgba(13,148,136,.08)' }, ticks: { color: dk ? '#7FCFBE' : '#2D5E4A', font: { size: 10 } } },
    },
  };

  const today = new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="ph">
        <h2>🎯 Exam Readiness Report</h2>
        <p>Personalised analysis for {user.name} — {today}</p>
      </div>

      <div ref={printRef}>
        {/* Header card */}
        <div className="card glass-card mb2" style={{ background: report.examReadiness !== null && report.examReadiness >= 70 ? 'rgba(20,184,166,.07)' : report.examReadiness !== null && report.examReadiness >= 50 ? 'rgba(245,158,11,.06)' : 'rgba(220,38,38,.05)' }}>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <ReadinessMeter value={report.examReadiness} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div className="fh" style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{user.name}</div>
              <div className="flex ia g2 wrap mb2">
                <span className="badge btl">Grade {user.grade}</span>
                <span className={`lvl ${lv.cl}`}>{lv.ic} {lv.name}</span>
                <span className="badge bcy">⚡ {user.xp} XP</span>
              </div>
              <div className="stats" style={{ gap: 8 }}>
                {[{ ico: '📋', val: report.totalQuizzes, lbl: 'Quizzes' }, { ico: '⭐', val: `${report.avgScore}%`, lbl: 'Avg Score' }, { ico: '🏆', val: `${report.bestScore}%`, lbl: 'Best' }].map((s) => (
                  <div key={s.lbl} className="scard" style={{ padding: '10px 14px' }}><div className="sico">{s.ico}</div><div className="sv">{s.val}</div><div className="sl">{s.lbl}</div></div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Topic breakdown chart */}
        <div className="cc mb2">
          <div className="cc-h">📊 Performance by Topic</div>
          <div className="cc-s">Average score per CAPS topic — red below 50%, amber 50–70%, green above 70%</div>
          <div style={{ height: 220, position: 'relative', marginTop: 12 }}>
            <Bar data={barData} options={barOpts} />
          </div>
        </div>

        {/* Difficulty breakdown */}
        <div className="grid2 mb2">
          {(['EASY', 'MEDIUM', 'HARD'] as const).map((level) => {
            const d = report.difficultyBreakdown[level];
            const pct = d.total ? Math.round((d.correct / d.total) * 100) : null;
            const col = pct === null ? 'var(--t3)' : pct >= 70 ? 'var(--s)' : pct >= 50 ? 'var(--wr)' : 'var(--dr)';
            return (
              <div key={level} className="card glass-card" style={{ textAlign: 'center', padding: '18px 12px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', letterSpacing: '.08em', marginBottom: 6 }}>{level} QUESTIONS</div>
                <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'var(--fh)', color: col }}>{pct !== null ? `${pct}%` : '—'}</div>
                <div className="xs ct3 mt1">{d.total ? `${d.correct}/${d.total} correct` : 'No data'}</div>
                <div className="pb-w" style={{ marginTop: 8 }}><div className="pb-f" style={{ width: `${pct || 0}%`, background: col }} /></div>
              </div>
            );
          })}
        </div>

        {/* Recommendations */}
        <div className="sec-h mb1">🧭 Study Recommendations</div>

        {urgent.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--dr)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>🚨 Urgent — Focus Here First</div>
            {urgent.map((r) => (
              <div key={r.topic} className="rec-card rec-urgent">
                <div className="flex jb ia"><span className="bold">{r.topic}</span><span style={{ fontWeight: 800, color: 'var(--dr)', fontSize: 15 }}>{r.avg}%</span></div>
                <div className="xs ct2 mt1">{r.message}</div>
                <div className="pb-w mt1"><div className="pb-f" style={{ width: `${r.avg}%`, background: 'var(--dr)' }} /></div>
              </div>
            ))}
          </div>
        )}

        {review.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--wr)', marginBottom: 6 }}>⚡ Needs Revision</div>
            {review.map((r) => (
              <div key={r.topic} className="rec-card rec-review">
                <div className="flex jb ia"><span className="bold">{r.topic}</span><span style={{ fontWeight: 800, color: 'var(--wr)', fontSize: 15 }}>{r.avg}%</span></div>
                <div className="xs ct2 mt1">{r.message}</div>
                <div className="pb-w mt1"><div className="pb-f" style={{ width: `${r.avg}%`, background: 'var(--wr)' }} /></div>
              </div>
            ))}
          </div>
        )}

        {maintain.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--s)', marginBottom: 6 }}>✅ Keep It Up</div>
            {maintain.map((r) => (
              <div key={r.topic} className="rec-card rec-good">
                <div className="flex jb ia"><span className="bold">{r.topic}</span><span style={{ fontWeight: 800, color: 'var(--s)', fontSize: 15 }}>{r.avg}%</span></div>
                <div className="xs ct2 mt1">{r.message}</div>
                <div className="pb-w mt1"><div className="pb-f" style={{ width: `${r.avg}%`, background: 'var(--s)' }} /></div>
              </div>
            ))}
          </div>
        )}

        {/* Parent summary section */}
        <div className="parent-report" style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div className="sec-h" style={{ marginBottom: 2 }}>👨‍👩‍👧 Parent Progress Summary</div>
              <div className="xs ct3">Share this report with parents to show progress</div>
            </div>
            <button className="btn ba btn-sm no-print" onClick={printReport}>🖨 Print / Share</button>
          </div>
          <div style={{ border: '2px solid var(--bd)', borderRadius: 14, padding: '20px 22px', background: 'var(--bg)' }}>
            <div className="flex jb ia wrap" style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--bd)' }}>
              <div>
                <div className="fh" style={{ fontSize: 18, fontWeight: 700 }}>EduSpark Progress Report</div>
                <div className="xs ct3">SA CAPS — Mathematics &amp; Physical Sciences</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="xs ct3">Date: {today}</div>
                <div className="xs ct3">Grade: {user.grade} | Learner: {user.name}</div>
              </div>
            </div>

            <div className="grid2" style={{ gap: 12, marginBottom: 16 }}>
              {[['Overall Average', `${report.avgScore}%`], ['Best Score', `${report.bestScore}%`], ['Quizzes Completed', String(report.totalQuizzes)], ['Exam Readiness', report.examReadiness !== null ? `${report.examReadiness}%` : 'Incomplete']].map(([k, v]) => (
                <div key={k} style={{ background: 'rgba(20,184,166,.05)', borderRadius: 9, padding: '10px 14px' }}>
                  <div className="xs ct3">{k}</div>
                  <div className="bold" style={{ fontSize: 18, fontFamily: 'var(--fh)' }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 12 }}>
              <div className="xs ct3 bold" style={{ marginBottom: 8 }}>TOPIC PERFORMANCE SUMMARY</div>
              {report.topicBreakdown.map((t) => (
                <div key={t.topic} className="flex jb ia" style={{ padding: '5px 0', borderBottom: '1px solid var(--bd)', fontSize: 13 }}>
                  <span>{t.topic}</span>
                  <div className="flex ia g2">
                    <div className="pb-w" style={{ width: 80 }}><div className="pb-f" style={{ width: `${t.avgScore}%`, background: t.avgScore >= 70 ? 'var(--s)' : t.avgScore >= 50 ? 'var(--wr)' : 'var(--dr)' }} /></div>
                    <span className="bold" style={{ minWidth: 36, textAlign: 'right', color: t.avgScore >= 70 ? 'var(--s)' : t.avgScore >= 50 ? 'var(--wr)' : 'var(--dr)' }}>{t.avgScore}%</span>
                    <span style={{ fontSize: 11 }}>{t.trend === 'improving' ? '📈' : t.trend === 'declining' ? '📉' : '➡️'}</span>
                  </div>
                </div>
              ))}
            </div>

            {urgent.length > 0 && (
              <div style={{ background: 'rgba(220,38,38,.06)', border: '1px solid rgba(220,38,38,.2)', borderRadius: 9, padding: '10px 14px', marginBottom: 10 }}>
                <div className="xs bold" style={{ color: 'var(--dr)', marginBottom: 6 }}>🚨 Areas Requiring Immediate Attention</div>
                {urgent.map((r) => <div key={r.topic} className="xs ct2" style={{ marginBottom: 3 }}>• {r.topic} — {r.avg}%: {r.message}</div>)}
              </div>
            )}

            <div className="xs ct3" style={{ marginTop: 10, fontStyle: 'italic' }}>
              This report was automatically generated by EduSpark based on completed assessments. For full details, contact the class teacher.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
