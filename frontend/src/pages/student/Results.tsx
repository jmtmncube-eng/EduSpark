import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { results as resultsApi } from '../../services/api';
import type { QuizResult } from '../../types';
import { fmtDate, launchConfetti } from '../../utils/helpers';

ChartJS.register(ArcElement, Tooltip, Legend);

function isDk() { return document.documentElement.getAttribute('data-theme') === 'dark'; }

export default function StudentResults() {
  const { resultId: id } = useParams<{ resultId: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<QuizResult | null>(null);
  const [confettiFired, setConfettiFired] = useState(false);

  useEffect(() => {
    if (id) resultsApi.get(id).then((d) => setResult(d as QuizResult));
  }, [id]);

  useEffect(() => {
    if (result && result.score >= 80 && !confettiFired) {
      launchConfetti();
      setConfettiFired(true);
    }
  }, [result, confettiFired]);

  if (!result) return <div className="empty"><div className="eico">⏳</div><h3>Loading results…</h3></div>;

  const dk = isDk();
  const correct = result.correct;
  const wrong = result.total - correct;
  const grade = result.score >= 80 ? { label: 'Distinction', cl: 'cs', bg: 'rgba(16,185,129,.12)' }
    : result.score >= 70 ? { label: 'Merit', cl: 'cs', bg: 'rgba(16,185,129,.08)' }
    : result.score >= 50 ? { label: 'Pass', cl: 'cwr', bg: 'rgba(245,158,11,.09)' }
    : { label: 'Not Yet', cl: 'cdr', bg: 'rgba(220,38,38,.09)' };

  const doughnutData = {
    labels: ['Correct', 'Incorrect'],
    datasets: [{ data: [Math.max(correct, 0), Math.max(wrong, 0)], backgroundColor: dk ? ['rgba(45,212,191,.70)', 'rgba(248,113,113,.50)'] : ['rgba(13,148,136,.65)', 'rgba(220,38,38,.40)'], borderWidth: 0 }],
  };
  const doughnutOpts = { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { display: true, position: 'bottom' as const, labels: { color: dk ? '#7FCFBE' : '#2D5E4A', font: { size: 11 } } } } };

  const assign = result.assignment;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="ph"><h2>📊 Quiz Results</h2><p>{assign?.title || 'Your result'}</p></div>

      {/* Score hero */}
      <div className="card" style={{ textAlign: 'center', marginBottom: 20, background: grade.bg }}>
        <div style={{ fontSize: 64, fontWeight: 900, fontFamily: 'var(--fh)', color: result.score >= 70 ? 'var(--s)' : result.score >= 50 ? 'var(--wr)' : 'var(--dr)', lineHeight: 1.1 }}>{result.score}%</div>
        <div className={`bold ${grade.cl}`} style={{ fontSize: 18, marginTop: 4 }}>{grade.label}</div>
        <div className="sm ct2 mt1">{fmtDate(result.completedAt)}</div>
        <div className="badge bok" style={{ margin: '12px auto 0', display: 'inline-flex' }}>⚡ +{result.xpEarned} XP Earned</div>
      </div>

      <div className="grid2 mb2">
        <div className="cc">
          <div className="cc-h">Score Breakdown</div>
          <div style={{ height: 180, position: 'relative' }}>
            <Doughnut data={doughnutData} options={doughnutOpts} />
          </div>
        </div>
        <div className="cc">
          <div className="cc-h">Summary</div>
          {([['Total Questions', result.total], ['Correct', correct], ['Incorrect', wrong], ['Score', `${result.score}%`], ['XP Earned', `+${result.xpEarned}`]] as [string, string | number][]).map(([k, v]) => (
            <div key={k} className="flex jb" style={{ padding: '7px 0', borderBottom: '1px solid var(--bd)', fontSize: 13 }}>
              <span className="ct2">{k}</span><span className="bold">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Question-by-question review */}
      {result.details && result.details.length > 0 && (
        <>
          <div className="sec-h">📝 Question Review</div>
          {result.details.map((d, i) => {
            const opts = d.question?.options;
            return (
              <div key={d.id} className="qcard" style={{ marginBottom: 10, borderLeft: `4px solid ${d.isCorrect ? 'var(--s)' : 'var(--dr)'}` }}>
                <div className="flex jb ia mb1">
                  <span className="sm bold">{i + 1}. {d.isCorrect ? '✅ Correct' : '❌ Incorrect'}</span>
                  <span className="xs ct3">{d.difficulty}</span>
                </div>
                {d.imageData && <img src={d.imageData} className="q-img mb1" alt="" />}
                <div className="qtxt mb2">{d.questionText}</div>
                {opts ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {opts.map((opt, j) => {
                      const isCorrect = opt === d.correctAnswer;
                      const isSelected = opt === d.selectedAnswer;
                      const bg = isCorrect ? 'rgba(20,184,166,.18)' : isSelected && !isCorrect ? 'rgba(220,38,38,.13)' : 'rgba(20,184,166,.04)';
                      const border = isCorrect ? '1.5px solid var(--s)' : isSelected && !isCorrect ? '1.5px solid var(--dr)' : '1.5px solid transparent';
                      return (
                        <div key={j} style={{ padding: '6px 11px', borderRadius: 8, fontSize: 13, background: bg, border, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{opt}</span>
                          {isCorrect && <span style={{ color: 'var(--s)', fontSize: 11, fontWeight: 700 }}>ANSWER</span>}
                          {isSelected && !isCorrect && <span style={{ color: 'var(--dr)', fontSize: 11, fontWeight: 700 }}>YOUR ANSWER</span>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ padding: '6px 11px', borderRadius: 8, fontSize: 13, background: 'rgba(220,38,38,.10)', border: '1.5px solid var(--dr)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{d.selectedAnswer || '(no answer)'}</span>
                      <span style={{ color: 'var(--dr)', fontSize: 11, fontWeight: 700 }}>YOUR ANSWER</span>
                    </div>
                    <div style={{ padding: '6px 11px', borderRadius: 8, fontSize: 13, background: 'rgba(20,184,166,.18)', border: '1.5px solid var(--s)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{d.correctAnswer}</span>
                      <span style={{ color: 'var(--s)', fontSize: 11, fontWeight: 700 }}>CORRECT</span>
                    </div>
                  </div>
                )}
                {d.solution && (
                  <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(20,184,166,.07)', borderRadius: 9, borderLeft: '3px solid var(--p)' }}>
                    <div className="sm bold cp" style={{ marginBottom: 8 }}>💡 Step-by-Step Solution</div>
                    {d.solution.split('\n').filter((l) => l.trim()).map((line, li) => {
                      const isFormula = line.startsWith('Formula:');
                      const isTherefore = line.startsWith('Therefore:');
                      const isStep = /^Step \d+:/.test(line);
                      return (
                        <div key={li} style={{
                          padding: '4px 0',
                          fontSize: 12.5,
                          color: isTherefore ? 'var(--p)' : isFormula ? 'var(--t2)' : 'var(--t2)',
                          fontWeight: isTherefore || isFormula ? 700 : 400,
                          borderBottom: isTherefore ? '1px solid rgba(20,184,166,.2)' : 'none',
                          paddingBottom: isTherefore ? 6 : 4,
                          marginBottom: isTherefore ? 4 : 0,
                        }}>
                          {isStep && <span style={{ color: 'var(--p)', fontWeight: 700, marginRight: 4 }}>{line.match(/^Step \d+/)![0]}:</span>}
                          {isStep ? line.replace(/^Step \d+:/, '').trim() : line}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      <div className="flex g1 mt2">
        <button className="btn bp" onClick={() => navigate('/app/dashboard')}>🏠 Dashboard</button>
        <button className="btn bg-btn" onClick={() => navigate('/app/history')}>🕐 History</button>
      </div>
    </div>
  );
}
