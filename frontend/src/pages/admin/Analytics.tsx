import { useEffect, useState } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js';
import { analytics, students as studentsApi } from '../../services/api';
import type { User } from '../../types';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler);

function isDk() { return document.documentElement.getAttribute('data-theme') === 'dark'; }

interface Overview {
  attempts: number; avgScore: number; completionRate: number; avgTime: number;
  passRate?: number; topicMastery?: number;
  improvementTrend?: { early: number; recent: number; direction: 'up' | 'down' | 'stable' };
  difficultyInsight?: Record<string, { correct: number; total: number; pct: number }>;
  engagementScore?: number;
}

interface StuReport {
  student: { name: string; grade: number; xp: number };
  totalQuizzes: number; avgScore: number; bestScore: number; passRate: number;
  topicBreakdown: { topic: string; avgScore: number; attempts: number }[];
  recentResults: { id: string; score: number; title: string; topic: string; completedAt: string }[];
  attemptStats?: { early: number; recent: number; direction: string };
}

export default function AdminAnalytics() {
  const [tab, setTab] = useState<'class' | 'student'>('class');
  const [overview, setOverview] = useState<Overview>({ attempts: 0, avgScore: 0, completionRate: 0, avgTime: 0 });
  const [topics, setTopics] = useState<{ topic: string; avgScore: string; attempts: number }[]>([]);
  const [diff, setDiff] = useState<Record<string, { correct: number; total: number }>>({});
  const [weekly, setWeekly] = useState<{ week: string; attempts: number; avgScore: number }[]>([]);
  const [allStudents, setAllStudents] = useState<User[]>([]);
  const [selId, setSelId] = useState('');
  const [stuReport, setStuReport] = useState<StuReport | null>(null);
  const [stuLoading, setStuLoading] = useState(false);
  const dk = isDk();

  useEffect(() => {
    analytics.overview().then((d) => setOverview(d as Overview));
    analytics.topicPerformance().then((d) => setTopics(d as { topic: string; avgScore: string; attempts: number }[]));
    analytics.difficultyBreakdown().then((d) => setDiff(d as Record<string, { correct: number; total: number }>));
    analytics.weeklyActivity().then((d) => setWeekly(d as { week: string; attempts: number; avgScore: number }[])).catch(() => {});
    studentsApi.list().then((d) => setAllStudents(d as User[]));
  }, []);

  useEffect(() => {
    if (!selId) { setStuReport(null); return; }
    setStuLoading(true);
    analytics.studentReport(selId)
      .then((d) => setStuReport(d as StuReport))
      .catch(() => setStuReport(null))
      .finally(() => setStuLoading(false));
  }, [selId]);

  const pal = topics.map((_, i) => dk ? `hsl(${170 + i * 12},60%,${44 + i * 2}%)` : `hsl(${165 + i * 10},55%,${32 + i * 2}%)`);

  const topicChart = {
    labels: topics.map((t) => t.topic.length > 16 ? t.topic.slice(0, 15) + '…' : t.topic),
    datasets: [{ data: topics.map((t) => Number(t.avgScore)), backgroundColor: pal, borderRadius: 8, barThickness: 18 }],
  };

  const hiAmt = (diff.EASY?.correct || 0) + (diff.MEDIUM?.correct || 0) + (diff.HARD?.correct || 0);
  const loAmt = ((diff.EASY?.total || 0) - (diff.EASY?.correct || 0)) + ((diff.MEDIUM?.total || 0) - (diff.MEDIUM?.correct || 0)) + ((diff.HARD?.total || 0) - (diff.HARD?.correct || 0));

  const doughnutData = (labels: string[], data: number[], colors?: string[]) => ({
    labels,
    datasets: [{ data, backgroundColor: colors || (dk ? ['rgba(45,212,191,.70)','rgba(52,211,153,.50)','rgba(248,113,113,.45)'] : ['rgba(13,148,136,.65)','rgba(16,185,129,.48)','rgba(220,38,38,.38)']), borderWidth: 0, hoverOffset: 8 }],
  });

  const chartOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'transparent' }, ticks: { color: dk ? '#7FCFBE' : '#2D5E4A', font: { size: 10 } } }, y: { grid: { color: dk ? 'rgba(45,212,191,.08)' : 'rgba(13,148,136,.08)' }, ticks: { color: dk ? '#7FCFBE' : '#2D5E4A', font: { size: 10 } }, beginAtZero: true, max: 100 } } };
  const doughnutOpts = { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { display: true, position: 'bottom' as const, labels: { color: dk ? '#7FCFBE' : '#2D5E4A', font: { size: 11 } } } } };

  const weakest = [...topics].sort((a, b) => Number(a.avgScore) - Number(b.avgScore)).slice(0, 5);
  const strongest = [...topics].sort((a, b) => Number(b.avgScore) - Number(a.avgScore)).slice(0, 3);

  const trend = overview.improvementTrend;
  const trendDir = trend?.direction === 'up' ? '📈' : trend?.direction === 'down' ? '📉' : '➡️';
  const trendCol = trend?.direction === 'up' ? 'var(--s)' : trend?.direction === 'down' ? 'var(--dr)' : 'var(--wr)';

  const diffInsight = overview.difficultyInsight;

  const kpis = [
    { ico: '📝', val: overview.attempts || 0, lbl: 'Total Attempts', sub: 'Questions answered', col: 'var(--p)' },
    { ico: '✅', val: `${overview.passRate ?? overview.completionRate ?? 0}%`, lbl: 'Pass Rate', sub: 'Scored ≥ 50%', col: (overview.passRate ?? 0) >= 60 ? 'var(--s)' : 'var(--wr)' },
    { ico: '🎯', val: overview.topicMastery ?? 0, lbl: 'Topics Mastered', sub: 'Avg ≥ 70%', col: 'var(--a)' },
    { ico: '🔥', val: `${overview.engagementScore?.toFixed(1) ?? 0}`, lbl: 'Engagement', sub: 'Quizzes per student', col: 'var(--wr)' },
    { ico: trendDir, val: trend ? `${trend.recent}%` : '—', lbl: 'Improvement Trend', sub: trend ? `From ${trend.early}% avg` : 'Need more data', col: trendCol },
  ];

  const lineData = weekly.length > 0 ? {
    labels: weekly.map((w) => w.week),
    datasets: [
      { label: 'Avg Score', data: weekly.map((w) => w.avgScore), borderColor: dk ? 'rgba(45,212,191,.80)' : 'rgba(13,148,136,.80)', backgroundColor: dk ? 'rgba(45,212,191,.10)' : 'rgba(13,148,136,.10)', tension: 0.4, fill: true, pointRadius: 4 },
      { label: 'Attempts', data: weekly.map((w) => w.attempts), borderColor: dk ? 'rgba(251,191,36,.70)' : 'rgba(217,119,6,.70)', backgroundColor: 'transparent', tension: 0.4, pointRadius: 3 },
    ],
  } : null;

  const lineOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'top' as const, labels: { color: dk ? '#7FCFBE' : '#2D5E4A', font: { size: 11 } } } }, scales: { x: { grid: { color: 'transparent' }, ticks: { color: dk ? '#7FCFBE' : '#2D5E4A', font: { size: 10 } } }, y: { grid: { color: dk ? 'rgba(45,212,191,.08)' : 'rgba(13,148,136,.08)' }, ticks: { color: dk ? '#7FCFBE' : '#2D5E4A', font: { size: 10 } } } } };

  // Per-student chart
  const stuTopicChart = stuReport ? {
    labels: stuReport.topicBreakdown.map((t) => t.topic.length > 16 ? t.topic.slice(0, 15) + '…' : t.topic),
    datasets: [{ data: stuReport.topicBreakdown.map((t) => t.avgScore), backgroundColor: stuReport.topicBreakdown.map((_, i) => dk ? `hsl(${170 + i * 14},60%,${44 + i * 2}%)` : `hsl(${165 + i * 12},55%,${32 + i * 2}%)`), borderRadius: 8, barThickness: 18 }],
  } : null;

  return (
    <div>
      <div className="ph"><h2>📈 Analytics</h2><p>5 smart performance metrics — powered by question &amp; mark data</p></div>

      {/* Tab toggle */}
      <div className="flex g1 mb2" style={{ background: 'rgba(20,184,166,.06)', borderRadius: 12, padding: 5, display: 'inline-flex' }}>
        <button onClick={() => setTab('class')} className={`btn btn-sm ${tab === 'class' ? 'bp' : 'bg-btn'}`} style={{ borderRadius: 9 }}>🏫 Class Overview</button>
        <button onClick={() => setTab('student')} className={`btn btn-sm ${tab === 'student' ? 'bp' : 'bg-btn'}`} style={{ borderRadius: 9 }}>👤 Per Student</button>
      </div>

      {tab === 'class' && (
        <>
          {/* 5 KPI Cards */}
          <div className="stats mb2">
            {kpis.map((k) => (
              <div key={k.lbl} className="scard glass-card">
                <div className="sico">{k.ico}</div>
                <div className="sv" style={{ color: k.col }}>{k.val}</div>
                <div className="sl">{k.lbl}</div>
                <div className="sch ct3" style={{ fontSize: 10.5, marginTop: 3 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Topic chart + Correct/Wrong doughnut */}
          <div className="grid2 mb2">
            <div className="cc">
              <div className="cc-h">📊 Score by Topic</div>
              <div className="cc-s">Average score per CAPS topic</div>
              <div style={{ height: 260, position: 'relative' }}>
                {topics.length > 0 ? (
                  <Bar data={topicChart} options={{ ...chartOpts, indexAxis: 'y' as const, scales: { x: { ...chartOpts.scales.x, beginAtZero: true, max: 100 }, y: chartOpts.scales.y } }} />
                ) : <div className="no-data">No quiz data yet</div>}
              </div>
            </div>
            <div className="cc">
              <div className="cc-h">🎯 Correct vs Incorrect</div>
              <div className="cc-s">Based on all question answers</div>
              <div style={{ height: 260, position: 'relative' }}>
                <Doughnut data={doughnutData(['Correct', 'Incorrect'], [Math.max(hiAmt, 1), Math.max(loAmt, 1)], dk ? ['rgba(45,212,191,.75)','rgba(248,113,113,.55)'] : ['rgba(13,148,136,.70)','rgba(220,38,38,.45)'])} options={doughnutOpts} />
              </div>
            </div>
          </div>

          {/* Difficulty insight + Trend line */}
          <div className="grid2 mb2">
            <div className="cc">
              <div className="cc-h">🔬 Difficulty Performance</div>
              <div className="cc-s">Pass rate per difficulty level</div>
              {(['EASY','MEDIUM','HARD'] as const).map((lvl) => {
                const ins = diffInsight?.[lvl] || diff[lvl];
                const pct = ins?.total ? Math.round(((ins.correct) / ins.total) * 100) : null;
                const col = pct === null ? 'var(--t3)' : pct >= 70 ? 'var(--s)' : pct >= 50 ? 'var(--wr)' : 'var(--dr)';
                const emoji = lvl === 'EASY' ? '🟢' : lvl === 'MEDIUM' ? '🟡' : '🔴';
                return (
                  <div key={lvl} style={{ marginBottom: 14 }}>
                    <div className="flex jb ia mb1" style={{ fontSize: 12.5 }}>
                      <span>{emoji} {lvl}</span>
                      <span className="bold" style={{ color: col }}>{pct !== null ? `${pct}%` : '—'}</span>
                    </div>
                    <div className="pb-w"><div className="pb-f" style={{ width: `${pct || 0}%`, background: col }} /></div>
                    {ins && <div className="xs ct3 mt1">{ins.correct}/{ins.total} correct answers</div>}
                  </div>
                );
              })}
            </div>
            <div className="cc">
              <div className="cc-h">📅 Weekly Activity Trend</div>
              <div className="cc-s">Score &amp; attempt volume over time</div>
              <div style={{ height: 220, position: 'relative', marginTop: 8 }}>
                {lineData ? <Line data={lineData} options={lineOpts} /> : <div className="no-data">Need more quiz data for trends</div>}
              </div>
            </div>
          </div>

          {/* Weakest + Strongest topics */}
          <div className="grid2 mb2">
            <div className="cc">
              <div className="cc-h">⚠️ Topics Needing Attention</div>
              <div className="cc-s">Lowest average scores</div>
              {weakest.length === 0 ? <div className="no-data">Complete quizzes to see data</div> :
                weakest.map((t, i) => {
                  const av = Number(t.avgScore);
                  const col = av < 50 ? 'var(--dr)' : av < 70 ? 'var(--wr)' : 'var(--s)';
                  return (
                    <div key={t.topic} style={{ marginBottom: 11 }}>
                      <div className="flex jb" style={{ marginBottom: 4, fontSize: 12.5 }}>
                        <span>{i + 1}. {t.topic}</span>
                        <div className="flex ia g1">
                          <span className="xs ct3">{t.attempts} attempts</span>
                          <span className="bold" style={{ color: col }}>{av}%</span>
                        </div>
                      </div>
                      <div className="pb-w"><div className="pb-f" style={{ width: `${av}%`, background: col }} /></div>
                    </div>
                  );
                })}
            </div>
            <div className="cc">
              <div className="cc-h">🏆 Top Performing Topics</div>
              <div className="cc-s">Students excelling here</div>
              {strongest.length === 0 ? <div className="no-data">No data yet</div> :
                strongest.map((t, i) => {
                  const av = Number(t.avgScore);
                  return (
                    <div key={t.topic} style={{ marginBottom: 14 }}>
                      <div className="flex jb" style={{ marginBottom: 4, fontSize: 12.5 }}>
                        <span>{['🥇','🥈','🥉'][i]} {t.topic}</span>
                        <span className="bold cs">{av}%</span>
                      </div>
                      <div className="pb-w"><div className="pb-f" style={{ width: `${av}%`, background: 'var(--s)' }} /></div>
                    </div>
                  );
                })}
              {trend && (
                <div style={{ marginTop: 18, padding: '12px 14px', background: trend.direction === 'up' ? 'rgba(16,185,129,.08)' : trend.direction === 'down' ? 'rgba(220,38,38,.06)' : 'rgba(217,119,6,.06)', borderRadius: 10, borderLeft: `3px solid ${trendCol}` }}>
                  <div className="xs bold" style={{ color: trendCol, marginBottom: 4 }}>{trendDir} Class Improvement Trend</div>
                  <div className="xs ct2">Early average: <strong>{trend.early}%</strong> → Recent average: <strong style={{ color: trendCol }}>{trend.recent}%</strong></div>
                  <div className="xs ct3 mt1">{trend.direction === 'up' ? 'Class is improving overall!' : trend.direction === 'down' ? 'Scores declining — review weaker topics' : 'Performance is stable'}</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {tab === 'student' && (
        <div>
          {/* Student selector */}
          <div className="cc mb2">
            <div className="cc-h">👤 Select a Student</div>
            <div className="cc-s">View individual performance breakdown</div>
            <select className="select mt1" value={selId} onChange={(e) => setSelId(e.target.value)} style={{ maxWidth: 340 }}>
              <option value="">— Choose student —</option>
              {allStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · Grade {s.grade}
                </option>
              ))}
            </select>
          </div>

          {stuLoading && <div className="no-data" style={{ padding: 40 }}>Loading student data…</div>}

          {!stuLoading && selId && !stuReport && (
            <div className="no-data" style={{ padding: 40 }}>No quiz data for this student yet.</div>
          )}

          {stuReport && !stuLoading && (
            <>
              {/* Student summary KPIs */}
              <div className="stats mb2">
                {[
                  { ico: '📝', val: stuReport.totalQuizzes, lbl: 'Quizzes Done', col: 'var(--p)' },
                  { ico: '🎯', val: `${stuReport.avgScore}%`, lbl: 'Avg Score', col: stuReport.avgScore >= 70 ? 'var(--s)' : stuReport.avgScore >= 50 ? 'var(--wr)' : 'var(--dr)' },
                  { ico: '🏆', val: `${stuReport.bestScore}%`, lbl: 'Best Score', col: 'var(--a)' },
                  { ico: '✅', val: `${stuReport.passRate}%`, lbl: 'Pass Rate', col: stuReport.passRate >= 60 ? 'var(--s)' : 'var(--wr)' },
                  { ico: '⚡', val: stuReport.student.xp ?? 0, lbl: 'XP Earned', col: 'var(--p)' },
                ].map((k) => (
                  <div key={k.lbl} className="scard glass-card">
                    <div className="sico">{k.ico}</div>
                    <div className="sv" style={{ color: k.col }}>{k.val}</div>
                    <div className="sl">{k.lbl}</div>
                  </div>
                ))}
              </div>

              <div className="grid2 mb2">
                {/* Topic breakdown for this student */}
                <div className="cc">
                  <div className="cc-h">📊 Topic Performance</div>
                  <div className="cc-s">{stuReport.student.name} · Grade {stuReport.student.grade}</div>
                  <div style={{ height: 260, position: 'relative' }}>
                    {stuTopicChart && stuReport.topicBreakdown.length > 0 ? (
                      <Bar data={stuTopicChart} options={{ ...chartOpts, indexAxis: 'y' as const, scales: { x: { ...chartOpts.scales.x, beginAtZero: true, max: 100 }, y: chartOpts.scales.y } }} />
                    ) : <div className="no-data">No topic data yet</div>}
                  </div>
                </div>

                {/* Score trend */}
                <div className="cc">
                  <div className="cc-h">📅 Recent Quiz Results</div>
                  <div className="cc-s">Last {stuReport.recentResults.length} quizzes</div>
                  {stuReport.recentResults.length === 0 ? <div className="no-data">No results yet</div> :
                    stuReport.recentResults.map((r) => {
                      const col = r.score >= 70 ? 'var(--s)' : r.score >= 50 ? 'var(--wr)' : 'var(--dr)';
                      return (
                        <div key={r.id} style={{ marginBottom: 10 }}>
                          <div className="flex jb ia" style={{ fontSize: 12.5, marginBottom: 3 }}>
                            <div>
                              <div className="bold" style={{ fontSize: 13 }}>{r.title}</div>
                              <div className="xs ct3">{r.topic} · {new Date(r.completedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</div>
                            </div>
                            <span className="bold" style={{ color: col, fontSize: 15 }}>{r.score}%</span>
                          </div>
                          <div className="pb-w"><div className="pb-f" style={{ width: `${r.score}%`, background: col }} /></div>
                        </div>
                      );
                    })
                  }
                </div>
              </div>

              {/* Topic table */}
              {stuReport.topicBreakdown.length > 0 && (
                <div className="cc mb2">
                  <div className="cc-h">📋 Full Topic Breakdown</div>
                  <div className="cc-s">All topics {stuReport.student.name} has attempted</div>
                  <div style={{ overflowX: 'auto', marginTop: 10 }}>
                    <table className="dt">
                      <thead><tr><th>Topic</th><th>Attempts</th><th>Avg Score</th><th>Status</th></tr></thead>
                      <tbody>
                        {[...stuReport.topicBreakdown].sort((a, b) => b.avgScore - a.avgScore).map((t) => {
                          const col = t.avgScore >= 70 ? 'var(--s)' : t.avgScore >= 50 ? 'var(--wr)' : 'var(--dr)';
                          const badge = t.avgScore >= 70 ? 'bok' : t.avgScore >= 50 ? 'bwa' : 'bng';
                          return (
                            <tr key={t.topic}>
                              <td className="bold">{t.topic}</td>
                              <td>{t.attempts}</td>
                              <td><span className="bold" style={{ color: col }}>{t.avgScore}%</span></td>
                              <td><span className={`badge ${badge}`}>{t.avgScore >= 70 ? '✅ Mastered' : t.avgScore >= 50 ? '⚠️ Developing' : '❌ Needs Work'}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
