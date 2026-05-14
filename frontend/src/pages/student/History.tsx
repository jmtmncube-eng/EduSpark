import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { results as resultsApi } from '../../services/api';
import type { QuizResult } from '../../types';
import { fmtDate } from '../../utils/helpers';

export default function StudentHistory() {
  const [list, setList] = useState<QuizResult[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    resultsApi.list().then((d) => setList((d as QuizResult[]).sort((a, b) => new Date(b.completedAt || '').getTime() - new Date(a.completedAt || '').getTime())));
  }, []);

  const avg = list.length ? (list.reduce((s, r) => s + r.score, 0) / list.length).toFixed(1) : '—';
  const best = list.length ? Math.max(...list.map((r) => r.score)) : 0;

  return (
    <div>
      <div className="ph"><h2>🗂 Quiz History</h2><p>Every attempt you've made — assignments and practice — with scores and XP</p></div>

      {list.length > 0 && (
        <div className="stats mb2">
          {[{ ico: '📋', val: list.length, lbl: 'Total Attempts' }, { ico: '⭐', val: `${avg}%`, lbl: 'Average Score' }, { ico: '🏆', val: `${best}%`, lbl: 'Best Score' }].map((s) => (
            <div key={s.lbl} className="scard"><div className="sico">{s.ico}</div><div className="sv">{s.val}</div><div className="sl">{s.lbl}</div></div>
          ))}
        </div>
      )}

      {list.length === 0 ? (
        <div className="empty"><div className="eico">📭</div><h3>No history yet</h3><p>Finish a practice pack or an assignment to see it logged here.</p></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="dt">
            <thead>
              <tr><th>Attempt</th><th>Score</th><th>XP Earned</th><th>Date</th><th></th></tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const isPractice = r.resultType === 'PRACTICE';
                const title = isPractice
                  ? `Practice${r.practiceTopic ? ` · ${r.practiceTopic}` : ''}`
                  : (r.assignment?.title || 'Assignment quiz');
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="bold fh" style={{ fontSize: 13 }}>
                        <span style={{ marginRight: 4 }}>{isPractice ? '🎯' : '📋'}</span>{title}
                      </div>
                      <div className="xs ct3">
                        <span className="badge" style={{
                          background: isPractice ? 'rgba(14,165,233,.12)' : 'rgba(20,184,166,.12)',
                          color: isPractice ? '#0284c7' : 'var(--p)', fontSize: 9, marginRight: 6,
                        }}>{isPractice ? 'PRACTICE' : 'ASSIGNMENT'}</span>
                        {r.total} question(s)
                      </div>
                    </td>
                    <td>
                      <span className="bold" style={{ fontSize: 18, color: r.score >= 70 ? 'var(--s)' : r.score >= 50 ? 'var(--wr)' : 'var(--dr)' }}>{r.score}%</span>
                      <div className="xs ct3">{r.correct}/{r.total} correct</div>
                    </td>
                    <td><span className="badge bok">⚡ +{r.xpEarned || 0}</span></td>
                    <td className="sm ct2">{r.completedAt ? fmtDate(r.completedAt) : '—'}</td>
                    <td>
                      {isPractice
                        ? <span className="xs ct3">—</span>
                        : <button className="btn bg-btn btn-sm" onClick={() => navigate(`/app/results/${r.id}`)}>View →</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
