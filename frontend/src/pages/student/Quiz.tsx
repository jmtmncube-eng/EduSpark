import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { assignments as assignmentsApi, results as resultsApi } from '../../services/api';
import { showToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import type { Assignment, QuizResult } from '../../types';
import { fmtDate, launchConfetti } from '../../utils/helpers';

const TIME_PER_Q = 60;

export default function StudentQuiz() {
  const { assignmentId: id } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const [assign, setAssign] = useState<Assignment | null>(null);
  const [prevResults, setPrevResults] = useState<QuizResult[]>([]);
  const [phase, setPhase] = useState<'intro' | 'quiz'>('intro');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(TIME_PER_Q);
  const [showDocModal, setShowDocModal] = useState(false);
  const [flagged, setFlagged] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (id) {
      assignmentsApi.get(id).then((d) => setAssign(d as Assignment));
      resultsApi.byAssignment(id).then((d) => setPrevResults(d as QuizResult[])).catch(() => {});
    }
  }, [id]);

  const questions = assign?.questions?.map((q) => q.question) || [];
  const total = questions.length;
  const current = questions[qIdx];
  const maxAttempts = assign?.maxAttempts ?? 3;
  const attemptsDone = prevResults.length;
  const attemptsLeft = maxAttempts - attemptsDone;
  const thisAttempt = attemptsDone + 1;

  const nextQ = useCallback(() => {
    if (qIdx < total - 1) { setQIdx((i) => i + 1); setTimeLeft(TIME_PER_Q); }
  }, [qIdx, total]);

  useEffect(() => {
    if (phase !== 'quiz') return;
    const t = setInterval(() => {
      setTimeLeft((prev) => { if (prev <= 1) { nextQ(); return TIME_PER_Q; } return prev - 1; });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, nextQ]);

  async function submit() {
    if (!assign || isSubmitting) return;
    setIsSubmitting(true);
    const answersArr = questions.map((q) => ({ questionId: q.id, selectedAnswer: answers[q.id] || '' }));
    try {
      const res = await resultsApi.submit({ assignmentId: assign.id, answers: answersArr });
      const r = res as { id: string; score: number; xpEarned: number };
      if (r.score >= 80) launchConfetti();
      showToast(`Quiz complete! Score: ${r.score}% · +${r.xpEarned} XP`, 'success');
      navigate(`/app/results/${r.id}`);
    } catch (e: unknown) {
      showToast((e as Error).message, 'err');
      setIsSubmitting(false);
    }
  }

  function toggleFlag() {
    setFlagged((prev) => { const s = new Set(prev); s.has(qIdx) ? s.delete(qIdx) : s.add(qIdx); return s; });
  }

  if (!assign) return <div className="empty"><div className="eico">⏳</div><h3>Loading quiz…</h3></div>;
  if (isSubmitting) return <div className="empty"><div className="eico">⏳</div><h3>Submitting…</h3><p>Calculating your score</p></div>;

  const answered = Object.keys(answers).length;
  const pct = total ? Math.round((answered / total) * 100) : 0;
  const timerPct = (timeLeft / TIME_PER_Q) * 100;
  const timerCol = timeLeft <= 10 ? 'var(--dr)' : timeLeft <= 20 ? 'var(--wr)' : 'var(--p)';

  // Best previous score
  const bestPrev = prevResults.length ? Math.max(...prevResults.map((r) => r.score)) : null;
  const avgPrev = prevResults.length ? Math.round(prevResults.reduce((s, r) => s + r.score, 0) / prevResults.length) : null;

  if (phase !== 'quiz') {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div className="card glass-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <h2 className="fh" style={{ fontSize: 22, marginBottom: 6 }}>{assign.title}</h2>
          <div className="flex ia g2 wrap" style={{ justifyContent: 'center', marginBottom: 16 }}>
            <span className="badge btl">{assign.subject === 'MATHEMATICS' ? '📐' : '⚗️'} Gr{assign.grade}</span>
            <span className="badge bcy">{assign.topic}</span>
            <span className="badge bng">Due: {fmtDate(assign.dueDate)}</span>
          </div>

          {/* Attempt tracker */}
          {maxAttempts > 1 && (
            <div style={{ background: thisAttempt > 1 ? 'rgba(20,184,166,.08)' : 'rgba(20,184,166,.05)', border: '1.5px solid var(--bd)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, textAlign: 'left' }}>
              <div className="flex jb ia" style={{ marginBottom: 6 }}>
                <span className="sm bold cp">Attempt {thisAttempt} of {maxAttempts}</span>
                <div className="flex ia g1">
                  {Array.from({ length: maxAttempts }, (_, i) => (
                    <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: i < attemptsDone ? 'var(--s)' : i === attemptsDone ? 'var(--p)' : 'var(--bg2)', border: i === attemptsDone ? '2px solid var(--pl)' : 'none' }} />
                  ))}
                </div>
              </div>
              {prevResults.length > 0 && (
                <div className="flex ia g2">
                  {bestPrev !== null && <span className="xs ct2">Best: <strong className="cp">{bestPrev}%</strong></span>}
                  {avgPrev !== null && prevResults.length > 1 && <span className="xs ct2">Avg: <strong>{avgPrev}%</strong></span>}
                  <span className="xs ct3">{attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining</span>
                </div>
              )}
            </div>
          )}

          <div className="stats" style={{ marginBottom: 18 }}>
            {[{ ico: '❓', val: total, lbl: 'Questions' }, { ico: '⏱', val: `${TIME_PER_Q}s`, lbl: 'Per question' }, { ico: '⚡', val: `${total * 10}+`, lbl: 'XP Available' }].map((s) => (
              <div key={s.lbl} className="scard"><div className="sico">{s.ico}</div><div className="sv">{s.val}</div><div className="sl">{s.lbl}</div></div>
            ))}
          </div>

          {assign.documents.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <button className="btn ba" onClick={() => setShowDocModal(true)}>📄 View Study Documents ({assign.documents.length})</button>
            </div>
          )}

          {attemptsLeft <= 0 ? (
            <div style={{ background: 'rgba(220,38,38,.08)', border: '1.5px solid rgba(220,38,38,.25)', borderRadius: 11, padding: '12px 16px', marginBottom: 8 }}>
              <div className="bold cdr">Maximum attempts reached</div>
              <div className="sm ct2 mt1">You've used all {maxAttempts} attempts for this assignment.</div>
              {bestPrev !== null && <div className="sm ct2 mt1">Your best score: <strong className="cp">{bestPrev}%</strong></div>}
              <button className="btn bg-btn mt2 wf" style={{ justifyContent: 'center' }} onClick={() => navigate(-1)}>← Back</button>
            </div>
          ) : total === 0 ? (
            <p className="sm ct2">No questions attached to this assignment yet.</p>
          ) : (
            <button className="btn bp" style={{ fontSize: 16, padding: '12px 32px' }} onClick={() => { setPhase('quiz'); setTimeLeft(TIME_PER_Q); }}>
              🚀 {thisAttempt === 1 ? 'Start Quiz' : `Start Attempt ${thisAttempt}`}
            </button>
          )}
        </div>

        {showDocModal && (
          <Modal title={`📄 Study Documents — ${assign.title}`} onClose={() => setShowDocModal(false)} wide>
            {assign.documents.map((d) => (
              <div key={d.id} className="doc-vw">
                <div className="doc-title">📄 {d.title}</div>
                {d.content && <div className="doc-body">{d.content}</div>}
                {d.imageData && <img src={d.imageData} className="q-img mt1" alt="" />}
              </div>
            ))}
            <button className="btn bp mt2" onClick={() => setShowDocModal(false)}>Close</button>
          </Modal>
        )}
      </div>
    );
  }


  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div className="bold fh" style={{ fontSize: 15 }}>{assign.title}</div>
          <div className="xs ct3">
            {answered}/{total} answered · {pct}% complete
            {thisAttempt > 1 && <span style={{ color: 'var(--p)', marginLeft: 8, fontWeight: 700 }}>Attempt {thisAttempt}/{maxAttempts}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: timerCol, fontFamily: 'var(--fh)' }}>{timeLeft}s</div>
          <div className="xs ct3">time left</div>
        </div>
      </div>

      {/* Timer bar */}
      <div className="pb-w" style={{ height: 6, marginBottom: 14, borderRadius: 3 }}>
        <div style={{ height: '100%', borderRadius: 3, width: `${timerPct}%`, background: timerCol, transition: 'width 1s linear, background .3s' }} />
      </div>

      {/* Progress bar */}
      <div className="pb-w" style={{ marginBottom: 16 }}>
        <div className="pb-f" style={{ width: `${pct}%` }} />
      </div>

      {/* Question nav pills */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 16 }}>
        {questions.map((q, i) => {
          const ans = answers[q.id];
          const isFlag = flagged.has(i);
          const bg = i === qIdx ? 'var(--p)' : ans ? 'var(--s)' : isFlag ? 'var(--wr)' : 'var(--bd)';
          const col = i === qIdx || ans ? '#fff' : isFlag ? '#fff' : 'var(--t2)';
          return (
            <button key={i} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: bg, color: col, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
              onClick={() => { setQIdx(i); setTimeLeft(TIME_PER_Q); }}>
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* Question card */}
      {current && (
        <div className="card glass-card" style={{ marginBottom: 16 }}>
          <div className="flex jb ia mb2">
            <span className="sm ct2">Question {qIdx + 1} of {total}</span>
            <button className={`btn btn-sm ${flagged.has(qIdx) ? 'bng' : 'ba'}`} onClick={toggleFlag}>{flagged.has(qIdx) ? '🚩 Flagged' : '🏳 Flag'}</button>
          </div>
          {current.imageData && <img src={current.imageData} className="q-img mb1" alt="" />}
          <div className="qtxt mb2">{current.question}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {current.options.map((opt, i) => {
              const sel = answers[current.id] === opt;
              return (
                <button key={i} className={`opt-btn ${sel ? 'sel' : ''}`} onClick={() => setAnswers((prev) => ({ ...prev, [current.id]: opt }))}>
                  <span className="opt-ltr">{String.fromCharCode(65 + i)}</span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex jb ia">
        <button className="btn bg-btn" disabled={qIdx === 0} onClick={() => { setQIdx((i) => i - 1); setTimeLeft(TIME_PER_Q); }}>← Prev</button>
        <div className="flex g1">
          {qIdx < total - 1
            ? <button className="btn bp" onClick={nextQ}>{answers[current?.id || ''] ? 'Next →' : 'Skip →'}</button>
            : <button className="btn bp" onClick={submit} disabled={isSubmitting}>✅ Submit Quiz ({answered}/{total})</button>
          }
        </div>
      </div>
    </div>
  );
}
