import { useEffect, useState, useRef, useCallback } from 'react';
import { questions as questionsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { Question } from '../../types';
import { subjectBadge, diffBadge } from '../../utils/helpers';

interface PracticeResult { questionId: string; correct: boolean; time: number; }

export default function StudentQuestions() {
  const { user } = useAuth();
  const [list, setList] = useState<Question[]>([]);
  const [filter, setFilter] = useState({ subject: '', difficulty: '' });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Practice mode
  const [practiceMode, setPracticeMode] = useState(false);
  const [practiceQs, setPracticeQs] = useState<Question[]>([]);
  const [pIdx, setPIdx] = useState(0);
  const [pSelected, setPSelected] = useState<string | null>(null);
  const [pRevealed, setPRevealed] = useState(false);
  const [pResults, setPResults] = useState<PracticeResult[]>([]);
  const [pDone, setPDone] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [qTime, setQTime] = useState(0); // time spent on current question
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    questionsApi.list(filter).then((d) => setList(d as Question[]));
  }, [filter]);

  function toggle(id: string) {
    setExpanded((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  const stopTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (qTimerRef.current) clearInterval(qTimerRef.current);
  }, []);

  const startTimers = useCallback(() => {
    stopTimers();
    setTimeLeft(30);
    setQTime(0);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { autoNext(); return 0; }
        return t - 1;
      });
    }, 1000);
    qTimerRef.current = setInterval(() => setQTime((t) => t + 1), 1000);
  }, [stopTimers]); // eslint-disable-line react-hooks/exhaustive-deps

  function startPractice() {
    const pool = [...list].sort(() => Math.random() - 0.5).slice(0, 10);
    if (pool.length === 0) return;
    setPracticeQs(pool);
    setPIdx(0); setPSelected(null); setPRevealed(false);
    setPResults([]); setPDone(false);
    setPracticeMode(true);
    setTimeout(startTimers, 50);
  }

  function autoNext() {
    stopTimers();
    setPResults((prev) => [...prev, { questionId: practiceQs[pIdx]?.id || '', correct: false, time: 30 }]);
    advance();
  }

  function handleSelect(opt: string) {
    if (pRevealed) return;
    stopTimers();
    const correct = opt === practiceQs[pIdx].answer;
    setPSelected(opt);
    setPRevealed(true);
    const elapsed = qTime;
    setTimeout(() => {
      setPResults((prev) => [...prev, { questionId: practiceQs[pIdx].id, correct, time: elapsed }]);
      advance();
    }, 1400);
  }

  function advance() {
    const next = pIdx + 1;
    if (next >= practiceQs.length) {
      setPDone(true);
    } else {
      setPIdx(next);
      setPSelected(null);
      setPRevealed(false);
      setTimeout(startTimers, 50);
    }
  }

  function exitPractice() {
    stopTimers();
    setPracticeMode(false);
    setPDone(false);
  }

  // Practice mode — results screen
  if (practiceMode && pDone) {
    const correct = pResults.filter((r) => r.correct).length;
    const score = Math.round((correct / practiceQs.length) * 100);
    const avgTime = pResults.length ? (pResults.reduce((s, r) => s + r.time, 0) / pResults.length).toFixed(1) : '—';
    const grade = score >= 80 ? { label: 'Excellent! 🏆', col: 'var(--s)' } : score >= 60 ? { label: 'Good Work! 💪', col: 'var(--p)' } : { label: 'Keep Practising! 📚', col: 'var(--wr)' };
    return (
      <div>
        <div className="ph"><h2>⏱ Practice Complete!</h2><p>Here's how you did</p></div>
        <div className="card glass-card" style={{ textAlign: 'center', padding: '36px 24px', marginBottom: 20 }}>
          <div style={{ fontSize: 68, fontWeight: 900, fontFamily: 'var(--fh)', color: grade.col, lineHeight: 1.1 }}>{score}%</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: grade.col, marginTop: 6 }}>{grade.label}</div>
          <div className="stats mt2" style={{ maxWidth: 400, margin: '16px auto 0' }}>
            {[{ ico: '✅', val: correct, lbl: 'Correct' }, { ico: '❌', val: practiceQs.length - correct, lbl: 'Wrong' }, { ico: '⏱', val: `${avgTime}s`, lbl: 'Avg Time' }].map((s) => (
              <div key={s.lbl} className="scard"><div className="sico">{s.ico}</div><div className="sv">{s.val}</div><div className="sl">{s.lbl}</div></div>
            ))}
          </div>
        </div>
        {practiceQs.map((q, i) => {
          const res = pResults[i];
          return (
            <div key={q.id} className="qcard" style={{ borderLeft: `4px solid ${res?.correct ? 'var(--s)' : 'var(--dr)'}`, marginBottom: 10 }}>
              <div className="flex jb ia mb1">
                <span className="sm bold">{i + 1}. {res?.correct ? '✅ Correct' : '❌ Incorrect'}</span>
                <span className="xs ct3">⏱ {res?.time ?? 30}s</span>
              </div>
              <div className="qtxt">{q.question}</div>
              <div style={{ fontSize: 13, color: 'var(--s)', fontWeight: 600, marginTop: 4 }}>✅ {q.answer}</div>
            </div>
          );
        })}
        <div className="flex g2 mt2">
          <button className="btn bp" onClick={startPractice}>🔁 Try Again</button>
          <button className="btn bg-btn" onClick={exitPractice}>← Back to Questions</button>
        </div>
      </div>
    );
  }

  // Practice mode — active question
  if (practiceMode && practiceQs.length > 0) {
    const q = practiceQs[pIdx];
    const pct = (timeLeft / 30) * 100;
    const timerColor = timeLeft <= 8 ? 'var(--dr)' : timeLeft <= 15 ? 'var(--wr)' : 'var(--p)';
    return (
      <div style={{ maxWidth: 660, margin: '0 auto' }}>
        <div className="flex jb ia mb2">
          <div className="flex ia g2">
            <button className="btn bg-btn btn-sm" onClick={exitPractice}>✕ Exit</button>
            <span className="sm ct2">Question {pIdx + 1} / {practiceQs.length}</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className={`tmr ${timeLeft <= 8 ? 'hot' : ''}`} style={{ borderColor: timerColor, color: timerColor, width: 54, height: 54, fontSize: 15 }}>{timeLeft}s</div>
          </div>
        </div>
        {/* Timer bar */}
        <div className="pb-w mb2" style={{ height: 6 }}>
          <div className="pb-f" style={{ width: `${pct}%`, background: timerColor, transition: 'width 1s linear, background .3s' }} />
        </div>
        {/* Progress dots */}
        <div className="flex ia g1 mb2" style={{ flexWrap: 'wrap' }}>
          {practiceQs.map((_, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: i < pIdx ? (pResults[i]?.correct ? 'var(--s)' : 'var(--dr)') : i === pIdx ? 'var(--p)' : 'var(--bg2)', border: i === pIdx ? '2px solid var(--pl)' : 'none', transition: 'background .3s' }} />
          ))}
        </div>
        <div className="card glass-card" style={{ marginBottom: 16 }}>
          <div className="flex ia g2 mb2 wrap">
            <span className={`badge ${subjectBadge(q.subject)}`}>{q.subject === 'MATHEMATICS' ? '📐' : '⚗️'}</span>
            <span className={`badge ${diffBadge(q.difficulty)}`}>{q.difficulty}</span>
            <span className="badge btl">{q.topic}</span>
          </div>
          {q.imageData && <img src={q.imageData} className="q-img mb2" alt="" />}
          <div className="qtxt" style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.7 }}>{q.question}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {q.options.map((opt, j) => {
            const isCorrect = opt === q.answer;
            const isSelected = opt === pSelected;
            let cls = 'opt-btn';
            if (pRevealed) cls += isCorrect ? ' ok' : isSelected ? ' bad' : '';
            else if (isSelected) cls += ' sel';
            return (
              <button key={j} className={cls} onClick={() => handleSelect(opt)} disabled={pRevealed}>
                <span className="opt-ltr">{String.fromCharCode(65 + j)}</span>
                <span style={{ flex: 1, textAlign: 'left' }}>{opt}</span>
                {pRevealed && isCorrect && <span style={{ color: 'var(--s)', fontSize: 13, fontWeight: 700 }}>✅ Correct</span>}
                {pRevealed && isSelected && !isCorrect && <span style={{ color: 'var(--dr)', fontSize: 13, fontWeight: 700 }}>❌ Wrong</span>}
              </button>
            );
          })}
        </div>
        {pRevealed && q.solution && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(20,184,166,.08)', borderRadius: 10, borderLeft: '3px solid var(--p)' }}>
            <div className="sm bold cp" style={{ marginBottom: 4 }}>💡 Quick Tip</div>
            <div className="sm ct2">{q.solution.split('\n')[0]}</div>
          </div>
        )}
      </div>
    );
  }

  const byTopic: Record<string, Question[]> = {};
  list.forEach((q) => { if (!byTopic[q.topic]) byTopic[q.topic] = []; byTopic[q.topic].push(q); });

  return (
    <div>
      <div className="ph"><h2>📚 Question Bank</h2><p>Study questions for Grade {user?.grade} — expand to see solutions</p></div>

      <div className="flex jb ia mb2 wrap" style={{ gap: 10 }}>
        <div className="flex g2 wrap">
          <select className="select" style={{ width: 'auto' }} value={filter.subject} onChange={(e) => setFilter({ ...filter, subject: e.target.value })}>
            <option value="">All Subjects</option>
            <option value="MATHEMATICS">Mathematics</option>
            <option value="PHYSICAL_SCIENCES">Physical Sciences</option>
          </select>
          <select className="select" style={{ width: 'auto' }} value={filter.difficulty} onChange={(e) => setFilter({ ...filter, difficulty: e.target.value })}>
            <option value="">All Difficulties</option>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
          <span className="sm ct2" style={{ alignSelf: 'center' }}>{list.length} question(s)</span>
        </div>
        {list.length > 0 && (
          <button className="btn bp" onClick={startPractice}>⏱ Timed Practice (10 Qs)</button>
        )}
      </div>

      {list.length === 0 ? (
        <div className="empty"><div className="eico">📭</div><h3>No questions available</h3><p>Questions will appear here once your teacher adds them.</p></div>
      ) : (
        Object.entries(byTopic).map(([topic, qs]) => (
          <div key={topic} style={{ marginBottom: 22 }}>
            <div className="sec-h">{topic} <span className="sm ct3">({qs.length})</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {qs.map((q) => {
                const open = expanded.has(q.id);
                return (
                  <div key={q.id} className="qcard" style={{ cursor: 'pointer' }} onClick={() => toggle(q.id)}>
                    <div className="flex jb ia" style={{ gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="flex ia g1 wrap" style={{ marginBottom: 5 }}>
                          <span className={`badge ${subjectBadge(q.subject)}`}>{q.subject === 'MATHEMATICS' ? '📐' : '⚗️'}</span>
                          <span className={`badge ${diffBadge(q.difficulty)}`}>{q.difficulty}</span>
                        </div>
                        {q.imageData && <img src={q.imageData} className="q-img" alt="" />}
                        <div className="qtxt">{q.question}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8 }}>
                          {q.options.map((opt, i) => (
                            <div key={i} style={{
                              padding: '5px 10px', borderRadius: 7, fontSize: 13,
                              background: open && opt === q.answer ? 'rgba(20,184,166,.18)' : 'rgba(20,184,166,.05)',
                              border: open && opt === q.answer ? '1.5px solid var(--p)' : '1.5px solid transparent',
                              color: open && opt === q.answer ? 'var(--p)' : 'var(--t)',
                              fontWeight: open && opt === q.answer ? 700 : 400,
                            }}>
                              {open && opt === q.answer ? '✅ ' : ''}{opt}
                            </div>
                          ))}
                        </div>
                      </div>
                      <span style={{ color: 'var(--t3)', fontSize: 18, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
                    </div>
                    {open && (q.solution || q.explanation) && (
                      <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(20,184,166,.07)', borderRadius: 9, borderLeft: '3px solid var(--p)' }}>
                        <div className="sm bold cp" style={{ marginBottom: 8 }}>💡 Step-by-Step Solution</div>
                        {(q.solution || q.explanation || '').split('\n').filter((l) => l.trim()).map((line, li) => {
                          const isFormula = line.startsWith('Formula:');
                          const isTherefore = line.startsWith('Therefore:');
                          const isStep = /^Step \d+:/.test(line);
                          return (
                            <div key={li} style={{ padding: '3px 0', fontSize: 12.5, color: 'var(--t2)', fontWeight: isTherefore || isFormula ? 700 : 400 }}>
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
            </div>
          </div>
        ))
      )}
    </div>
  );
}
