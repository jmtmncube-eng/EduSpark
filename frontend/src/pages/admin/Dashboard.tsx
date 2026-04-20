import { useEffect, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler, Tooltip, Legend } from 'chart.js';
import { analytics } from '../../services/api';
import { useNavigate } from 'react-router-dom';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler, Tooltip, Legend);

function isDk() { return document.documentElement.getAttribute('data-theme') === 'dark'; }

export default function AdminDashboard() {
  const [overview, setOverview] = useState<Record<string, string | number>>({});
  const [subjData, setSubjData] = useState<{ subject: string; avgScore: string }[]>([]);
  const [weekData, setWeekData] = useState<{ date: string; count: number }[]>([]);
  const navigate = useNavigate();
  const dk = isDk();

  useEffect(() => {
    analytics.overview().then((d) => setOverview(d as Record<string, string | number>));
    analytics.subjectPerformance().then((d) => setSubjData(d as { subject: string; avgScore: string }[]));
    analytics.weeklyActivity().then((d) => setWeekData(d as { date: string; count: number }[]));
  }, []);

  const barData = {
    labels: subjData.map((s) => s.subject === 'MATHEMATICS' ? 'Mathematics' : 'Physical Sciences'),
    datasets: [{
      data: subjData.map((s) => Number(s.avgScore)),
      backgroundColor: dk ? ['rgba(45,212,191,.62)', 'rgba(52,211,153,.55)'] : ['rgba(13,148,136,.62)', 'rgba(16,185,129,.52)'],
      borderColor: dk ? ['#2DD4BF', '#34D399'] : ['#0D9488', '#10B981'],
      borderWidth: 2, borderRadius: 13,
    }],
  };

  const days = weekData.map((d) => new Date(d.date + 'T00:00').toLocaleDateString('en-ZA', { weekday: 'short' }));
  const lineData = {
    labels: days,
    datasets: [{
      data: weekData.map((d) => d.count),
      borderColor: dk ? '#2DD4BF' : '#0D9488',
      backgroundColor: dk ? 'rgba(45,212,191,.10)' : 'rgba(13,148,136,.10)',
      fill: true, tension: 0.45, pointBackgroundColor: dk ? '#2DD4BF' : '#0D9488', pointRadius: 5,
    }],
  };

  const chartOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { cornerRadius: 10 } }, scales: { x: { grid: { color: dk ? 'rgba(45,212,191,.09)' : 'rgba(13,148,136,.09)' }, ticks: { color: dk ? '#7FCFBE' : '#2D5E4A', font: { family: 'Plus Jakarta Sans', size: 11 } } }, y: { grid: { color: dk ? 'rgba(45,212,191,.09)' : 'rgba(13,148,136,.09)' }, ticks: { color: dk ? '#7FCFBE' : '#2D5E4A', font: { family: 'Plus Jakarta Sans', size: 11 } }, beginAtZero: true, max: 100 } } };

  const stats = [
    { ico: '📝', val: overview.questions || 0, lbl: 'Questions', ch: '↑ CAPS' },
    { ico: '👥', val: overview.students || 0, lbl: 'Students', ch: 'Active' },
    { ico: '📋', val: overview.assignments || 0, lbl: 'Assignments', ch: 'Live' },
    { ico: '🏆', val: `${overview.avgScore || 0}%`, lbl: 'Avg Score', ch: `${overview.attempts || 0} attempts` },
  ];

  return (
    <div>
      <div className="ph"><h2>📊 Dashboard</h2><p>Platform overview</p></div>
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
      <div className="grid2 mb2">
        <div className="cc">
          <div className="cc-h">Subject Performance</div>
          <div className="cc-s">Average scores</div>
          <div style={{ height: 200, position: 'relative' }}><Bar data={barData} options={{ ...chartOpts, scales: { ...chartOpts.scales, y: { ...chartOpts.scales.y, max: 100 } } }} /></div>
        </div>
        <div className="cc">
          <div className="cc-h">Weekly Activity</div>
          <div className="cc-s">Completions last 7 days</div>
          <div style={{ height: 200, position: 'relative' }}><Line data={lineData} options={{ ...chartOpts, scales: { ...chartOpts.scales, y: { ...chartOpts.scales.y, max: undefined, ticks: { ...chartOpts.scales.y.ticks, stepSize: 1 } } } }} /></div>
        </div>
      </div>
      <div className="grid3">
        {[
          { ico: '📝', label: 'Question Bank', sub: 'Manage & generate', path: '/app/questions' },
          { ico: '📋', label: 'Assignments', sub: 'Create & allocate', path: '/app/assignments' },
          { ico: '📈', label: 'Analytics', sub: 'Reports', path: '/app/analytics' },
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
