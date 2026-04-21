import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { analytics } from '../../services/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface TopicStat { topic: string; subject: string; avgScore: number; attempts: number; trend: 'improving' | 'declining' | 'stable'; }
interface Rec { priority: 'urgent' | 'review' | 'maintain'; topic: string; avg: number; message: string; }
interface Report {
  student: { name: string; grade: number; xp: number };
  tutor: { id: string; name: string } | null;
  totalQuizzes: number; avgScore: number; bestScore: number; totalXp: number;
  examReadiness: number | null;
  topicBreakdown: TopicStat[];
  difficultyBreakdown: Record<string, { correct: number; total: number }>;
  recommendations: Rec[];
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

export default function AdminStudentReport() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [teacherComment, setTeacherComment] = useState('');
  const [editingComment, setEditingComment] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    analytics.studentReport(studentId)
      .then((d) => { setReport(d as Report); setLoading(false); })
      .catch(() => setLoading(false));
  }, [studentId]);

  const today = new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });

  if (loading) return <div className="empty"><div className="eico">⏳</div><h3>Loading report…</h3></div>;

  if (!report || report.totalQuizzes === 0) {
    return (
      <div>
        <div className="ph">
          <h2>📊 Student Report</h2>
          <button className="btn bg-btn btn-sm" onClick={() => navigate(-1)}>← Back</button>
        </div>
        <div className="empty">
          <div className="eico">📋</div>
          <h3>No quiz data yet</h3>
          <p>This student hasn't completed any quizzes yet.</p>
        </div>
      </div>
    );
  }

  const dk = isDk();
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

  return (
    <div>
      <div className="ph" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2>📊 Exam Readiness Report</h2>
          <p>{report.student.name} — Grade {report.student.grade} — {today}</p>
        </div>
        <div className="flex g1 no-print">
          <button className="btn ba btn-sm" onClick={() => window.print()}>🖨 Print / Download PDF</button>
          <button className="btn bg-btn btn-sm" onClick={() => navigate(-1)}>← Back</button>
        </div>
      </div>

      {/* Header card */}
      <div className="card glass-card mb2" style={{ background: report.examReadiness !== null && report.examReadiness >= 70 ? 'rgba(20,184,166,.07)' : report.examReadiness !== null && report.examReadiness >= 50 ? 'rgba(245,158,11,.06)' : 'rgba(220,38,38,.05)' }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <ReadinessMeter value={report.examReadiness} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="fh" style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{report.student.name}</div>
            <div className="flex ia g2 wrap mb2">
              <span className="badge btl">Grade {report.student.grade}</span>
              <span className="badge bcy">⚡ {report.student.xp} XP</span>
              {report.tutor && <span className="badge bok">📚 {report.tutor.name}</span>}
            </div>
            <div className="stats" style={{ gap: 8 }}>
              {[{ ico: '📋', val: report.totalQuizzes, lbl: 'Quizzes' }, { ico: '⭐', val: `${report.avgScore}%`, lbl: 'Avg Score' }, { ico: '🏆', val: `${report.bestScore}%`, lbl: 'Best' }].map((s) => (
                <div key={s.lbl} className="scard" style={{ padding: '10px 14px' }}><div className="sico">{s.ico}</div><div className="sv">{s.val}</div><div className="sl">{s.lbl}</div></div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Topic chart */}
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
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--dr)', marginBottom: 6 }}>🚨 Urgent — Focus Here First</div>
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

      {/* Tutor Comment */}
      <div className="card glass-card" style={{ marginBottom: 20, border: '2px solid var(--bd2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div className="sec-h" style={{ marginBottom: 2 }}>✏️ Tutor Comment</div>
            <div className="xs ct3">This comment will appear on the printed report</div>
          </div>
          <button className="btn ba btn-sm no-print" onClick={() => setEditingComment((v) => !v)}>
            {editingComment ? '✅ Done' : '✏️ Edit'}
          </button>
        </div>
        {editingComment ? (
          <textarea
            className="textarea"
            value={teacherComment}
            onChange={(e) => setTeacherComment(e.target.value)}
            placeholder="Add your professional comment about this student's progress, areas of strength, and specific recommendations for improvement…"
            style={{ minHeight: 100, width: '100%' }}
          />
        ) : (
          <div style={{ padding: '10px 14px', background: 'rgba(20,184,166,.06)', borderRadius: 9, minHeight: 60, fontSize: 13, color: teacherComment ? 'var(--t)' : 'var(--t3)', fontStyle: teacherComment ? 'normal' : 'italic', whiteSpace: 'pre-wrap' }}>
            {teacherComment || 'No comment added yet. Click Edit to add your comment.'}
          </div>
        )}
      </div>

      {/* Parent summary section */}
      <div className="parent-report" style={{ marginTop: 8 }}>
        <div style={{ border: '2px solid var(--bd)', borderRadius: 14, padding: '20px 22px', background: 'var(--bg)' }}>
          <div className="flex jb ia wrap" style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--bd)' }}>
            <div>
              <div className="fh" style={{ fontSize: 18, fontWeight: 700 }}>EduSpark Progress Report</div>
              <div className="xs ct3">SA CAPS — Mathematics &amp; Physical Sciences</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="xs ct3">Date: {today}</div>
              <div className="xs ct3">Grade: {report.student.grade} | Learner: {report.student.name}</div>
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

          {teacherComment && (
            <div style={{ background: 'rgba(20,184,166,.06)', border: '1px solid var(--bd)', borderRadius: 9, padding: '12px 14px', marginBottom: 10 }}>
              <div className="xs bold ct2" style={{ marginBottom: 6 }}>👩‍🏫 Tutor's Comment</div>
              <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', color: 'var(--t2)' }}>{teacherComment}</div>
            </div>
          )}

          <div className="xs ct3" style={{ marginTop: 10, fontStyle: 'italic' }}>
            This report was generated by EduSpark. For full details, contact the allocated tutor.
          </div>
        </div>
      </div>

      <div className="flex g1 mt2 no-print">
        <button className="btn bp" onClick={() => window.print()}>🖨 Print / Download PDF</button>
        <button className="btn bg-btn" onClick={() => navigate(-1)}>← Back to Students</button>
      </div>
    </div>
  );
}
