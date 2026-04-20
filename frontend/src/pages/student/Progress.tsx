import { useEffect, useState } from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { results as resultsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { QuizResult } from '../../types';
import { getLvl, calcStreak } from '../../utils/helpers';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const ACHIEVEMENTS = [
  { id: 'first', ico: '🎯', name: 'First Quiz', desc: 'Complete your first quiz', check: (rs: QuizResult[]) => rs.length >= 1 },
  { id: 'five', ico: '📚', name: 'Scholar', desc: 'Complete 5 quizzes', check: (rs: QuizResult[]) => rs.length >= 5 },
  { id: 'ten', ico: '🏆', name: 'Dedicated', desc: 'Complete 10 quizzes', check: (rs: QuizResult[]) => rs.length >= 10 },
  { id: 'perfect', ico: '⭐', name: 'Perfect Score', desc: 'Score 100% on a quiz', check: (rs: QuizResult[]) => rs.some((r) => r.score === 100) },
  { id: 'streak3', ico: '🔥', name: 'On Fire', desc: '3-day study streak', check: (_: QuizResult[], streak: number) => streak >= 3 },
  { id: 'streak7', ico: '⚡', name: 'Unstoppable', desc: '7-day study streak', check: (_: QuizResult[], streak: number) => streak >= 7 },
  { id: 'xp500', ico: '💎', name: 'XP Hunter', desc: 'Earn 500 XP', check: (_: QuizResult[], __: number, xp: number) => xp >= 500 },
  { id: 'avg80', ico: '🌟', name: 'High Achiever', desc: 'Maintain 80%+ average', check: (rs: QuizResult[]) => rs.length >= 3 && rs.reduce((s, r) => s + r.score, 0) / rs.length >= 80 },
];

function isDk() { return document.documentElement.getAttribute('data-theme') === 'dark'; }

export default function StudentProgress() {
  const { user } = useAuth();
  const [results, setResults] = useState<QuizResult[]>([]);

  useEffect(() => {
    resultsApi.list().then((d) => setResults(d as QuizResult[]));
  }, []);

  const xp = user?.xp || 0;
  const lv = getLvl(xp);
  const streak = calcStreak(results);
  const xpPct = Math.min(((xp - lv.min) / (lv.next - lv.min)) * 100, 100);
  const avg = results.length ? results.reduce((s, r) => s + r.score, 0) / results.length : 0;
  const dk = isDk();

  const scoreRanges = results.reduce((acc, r) => {
    if (r.score >= 80) acc.hi++;
    else if (r.score >= 50) acc.mi++;
    else acc.lo++;
    return acc;
  }, { hi: 0, mi: 0, lo: 0 });

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const ds = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-ZA', { weekday: 'short' });
    const count = results.filter((r) => r.completedAt?.split('T')[0] === ds).length;
    return { label, count };
  });

  const barData = {
    labels: last7.map((d) => d.label),
    datasets: [{ data: last7.map((d) => d.count), backgroundColor: dk ? 'rgba(45,212,191,.65)' : 'rgba(13,148,136,.55)', borderRadius: 7 }],
  };
  const doughnutData = {
    labels: ['≥80%', '50–79%', '<50%'],
    datasets: [{ data: [Math.max(scoreRanges.hi, 0), Math.max(scoreRanges.mi, 0), Math.max(scoreRanges.lo, 0)], backgroundColor: dk ? ['rgba(45,212,191,.70)', 'rgba(251,191,36,.55)', 'rgba(248,113,113,.50)'] : ['rgba(13,148,136,.65)', 'rgba(245,158,11,.48)', 'rgba(220,38,38,.40)'], borderWidth: 0 }],
  };

  const chartOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: dk ? 'rgba(45,212,191,.09)' : 'rgba(13,148,136,.09)' }, ticks: { color: dk ? '#7FCFBE' : '#2D5E4A', font: { size: 11 } } }, y: { grid: { color: dk ? 'rgba(45,212,191,.09)' : 'rgba(13,148,136,.09)' }, ticks: { color: dk ? '#7FCFBE' : '#2D5E4A', font: { size: 11 }, stepSize: 1 }, beginAtZero: true } } };
  const doughnutOpts = { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { display: true, position: 'bottom' as const, labels: { color: dk ? '#7FCFBE' : '#2D5E4A', font: { size: 11 } } } } };

  const levels = [
    { name: 'Beginner', ic: '🌱', cl: 'lv-bg', min: 0, next: 200 },
    { name: 'Learner', ic: '📘', cl: 'lv-bl', min: 200, next: 500 },
    { name: 'Achiever', ic: '🏅', cl: 'lv-go', min: 500, next: 1000 },
    { name: 'Expert', ic: '🎓', cl: 'lv-pt', min: 1000, next: 9999 },
  ];

  return (
    <div>
      <div className="ph"><h2>📈 My Progress</h2><p>XP, streaks, achievements and performance trends</p></div>

      <div className="stats mb2">
        {[{ ico: '⚡', val: xp, lbl: 'Total XP' }, { ico: '📋', val: results.length, lbl: 'Quizzes Done' }, { ico: '⭐', val: `${avg.toFixed(1)}%`, lbl: 'Avg Score' }, { ico: '🔥', val: streak, lbl: 'Day Streak' }].map((s) => (
          <div key={s.lbl} className="scard"><div className="sico">{s.ico}</div><div className="sv">{s.val}</div><div className="sl">{s.lbl}</div></div>
        ))}
      </div>

      {/* Level progress */}
      <div className="card mb2">
        <div className="flex jb ia mb1">
          <div className="flex ia g2">
            <span className={`lvl ${lv.cl}`} style={{ fontSize: 15 }}>{lv.ic} {lv.name}</span>
            <span className="sm ct2">{xp} / {lv.next} XP</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--p)' }}>⚡ {xp} XP</span>
        </div>
        <div className="pb-w" style={{ height: 12, borderRadius: 6 }}><div className="pb-f" style={{ width: `${xpPct}%`, height: '100%' }} /></div>
        <div className="flex" style={{ gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
          {levels.map((l) => (
            <div key={l.name} className={`flex ia g1 ${lv.name === l.name ? '' : 'ct3'}`} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: lv.name === l.name ? 'rgba(20,184,166,.15)' : 'transparent', border: '1px solid var(--bd)' }}>
              {l.ic} {l.name} <span className="xs">({l.min}+ XP)</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid2 mb2">
        <div className="cc">
          <div className="cc-h">Weekly Activity</div><div className="cc-s">Quizzes per day (last 7 days)</div>
          <div style={{ height: 180, position: 'relative' }}>
            <Bar data={barData} options={chartOpts} />
          </div>
        </div>
        <div className="cc">
          <div className="cc-h">Score Distribution</div><div className="cc-s">How your scores are spread</div>
          <div style={{ height: 180, position: 'relative' }}>
            {results.length === 0 ? <div className="no-data">Complete quizzes to see chart</div> : <Doughnut data={doughnutData} options={doughnutOpts} />}
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div className="sec-h">🏆 Achievements</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
        {ACHIEVEMENTS.map((a) => {
          const earned = a.check(results, streak, xp);
          return (
            <div key={a.id} className="card card-sm" style={{ opacity: earned ? 1 : 0.45, position: 'relative', overflow: 'hidden' }}>
              {earned && <div style={{ position: 'absolute', top: 6, right: 8, fontSize: 10, fontWeight: 700, color: 'var(--s)', background: 'rgba(20,184,166,.15)', borderRadius: 10, padding: '2px 7px' }}>EARNED</div>}
              <div style={{ fontSize: 28, marginBottom: 6 }}>{a.ico}</div>
              <div className="bold" style={{ fontSize: 13 }}>{a.name}</div>
              <div className="xs ct3">{a.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
