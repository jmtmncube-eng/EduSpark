import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { assignments as assignmentsApi, results as resultsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { showToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import type { Assignment, QuizResult } from '../../types';
import { getLvl, calcStreak, fmtDate, subjectBadge } from '../../utils/helpers';

const MOTIVATIONS = [
  { msg: 'Keep going! Every quiz builds your knowledge. 💡', ico: '🔥' },
  { msg: 'You\'re one step closer to your dream score! 🚀', ico: '🎯' },
  { msg: 'Hard work beats talent when talent doesn\'t work hard. 💪', ico: '⭐' },
  { msg: 'Every expert was once a beginner. Keep learning! 📚', ico: '🏆' },
  { msg: 'Your future self will thank you for studying today. ✨', ico: '🌟' },
  { msg: 'Maths and Science are your superpowers! 🔬', ico: '⚡' },
];

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [asgns, setAsgns] = useState<Assignment[]>([]);
  const [myResults, setMyResults] = useState<QuizResult[]>([]);
  const [viewDocs, setViewDocs] = useState<Assignment | null>(null);
  const [motivation] = useState(() => MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)]);

  useEffect(() => {
    assignmentsApi.list().then((d) => setAsgns(d as Assignment[]));
    resultsApi.list().then((d) => setMyResults(d as QuizResult[]));
  }, []);

  if (!user) return null;
  const xp = user.xp || 0;
  const lv = getLvl(xp);
  const now = new Date();
  const doneIds = myResults.map((r) => r.assignmentId);
  const avg = myResults.length ? (myResults.reduce((s, r) => s + r.score, 0) / myResults.length).toFixed(1) : 0;
  const streak = calcStreak(myResults);
  const xpPct = Math.min(((xp - lv.min) / (lv.next - lv.min)) * 100, 100);
  const pending = asgns.filter((a) => !doneIds.includes(a.id) && new Date(a.dueDate) >= now);

  return (
    <div>
      <div className="ph">
        <h2>👋 Welcome back, {user.name}!</h2>
        <p>Your learning hub — quizzes, progress and schedule</p>
      </div>

      {/* Motivational banner */}
      <div className="motivational-banner mb2">
        <span style={{ fontSize: 22 }}>{motivation.ico}</span>
        <span>{motivation.msg}</span>
      </div>

      {/* XP Level card */}
      <div className="card card-sm glass-card mb2">
        <div className="flex jb ia mb1">
          <div className="flex ia g2">
            <span className={`lvl ${lv.cl}`}>{lv.ic} {lv.name}</span>
            <span className="sm ct2">{xp} / {lv.next} XP</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--p)' }}>⚡ {xp} XP</span>
        </div>
        <div className="pb-w"><div className="pb-f" style={{ width: `${xpPct}%` }} /></div>
        {pending.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--t3)' }}>
            📋 <strong style={{ color: 'var(--p)' }}>{pending.length}</strong> quiz{pending.length > 1 ? 'zes' : ''} waiting for you
          </div>
        )}
      </div>

      <div className="stats mb2">
        {[
          { ico: '⚡', val: xp, lbl: 'Total XP' },
          { ico: '📋', val: myResults.length, lbl: 'Quizzes Done' },
          { ico: '⭐', val: `${avg}%`, lbl: 'Avg Score' },
          { ico: '🔥', val: streak, lbl: 'Day Streak' },
        ].map((s) => (
          <div key={s.lbl} className="scard glass-card">
            <div className="sico">{s.ico}</div>
            <div className="sv">{s.val}</div>
            <div className="sl">{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex g2 mb2 wrap">
        <button className="btn bp" onClick={() => navigate('/app/exam-readiness')}>🎯 View Exam Readiness</button>
        <button className="btn ba" onClick={() => navigate('/app/progress')}>📈 My Progress</button>
      </div>

      <div className="sec-h">📋 My Assigned Quizzes</div>
      {asgns.length === 0 ? (
        <div className="empty"><div className="eico">📭</div><h3>No quizzes yet</h3><p>Your teacher will assign quizzes soon. Check back later!</p></div>
      ) : (
        <div className="gauto">
          {asgns.length > 0 && asgns.every((a) => doneIds.includes(a.id)) ? (
            <div className="empty" style={{ padding: '20px 0' }}>
              <div className="eico">🎉</div>
              <h3>All done!</h3>
              <p>You've completed all assigned quizzes. <button className="btn bp btn-sm" style={{ marginTop: 6 }} onClick={() => navigate('/app/my-work')}>View My Work →</button></p>
            </div>
          ) : null}
          {[...asgns].reverse().filter((a) => !doneIds.includes(a.id)).map((a) => {
            const dd = new Date(a.dueDate), ov = dd < now;
            const dl = Math.ceil((dd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const hasDocs = a.documents.length > 0;
            return (
              <div key={a.id} className={`acard glass-card ${ov ? 'overdue' : ''}`}>
                <div className="flex jb">
                  <div>
                    <div className="ac-t">{a.title}</div>
                    <div className="flex ia g1 wrap" style={{ marginTop: 5 }}>
                      <span className={`badge ${subjectBadge(a.subject)}`}>{a.subject === 'MATHEMATICS' ? '📐' : '⚗️'} Gr{a.grade}</span>
                      <span className="badge btl">{a.topic}</span>
                      {hasDocs && <span className="badge bcy">📄 {a.documents.length}</span>}
                    </div>
                  </div>
                  {ov ? <span className="badge bng">Overdue</span> : <div className="ring" />}
                </div>
                <div className="flex jb ia">
                  <span className={`sm ${ov ? 'cdr' : dl <= 3 ? 'cwr' : 'ct3'}`}>📅 {ov ? 'Overdue' : dl <= 0 ? 'Due today!' : `${dl}d left`}</span>
                  <div className="flex g1">
                    {hasDocs && <button className="btn ba btn-sm" onClick={() => setViewDocs(a)}>📄 Docs</button>}
                    <button className="btn bp btn-sm" onClick={() => navigate(`/app/quiz/${a.id}`)}>Start Quiz →</button>
                  </div>
                </div>
                {!ov && dl <= 3 && (
                  <div style={{ fontSize: 11, color: 'var(--wr)', background: 'rgba(245,158,11,.08)', borderRadius: 7, padding: '4px 8px', marginTop: 4 }}>
                    ⚡ Due soon! Start now to earn your XP
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {viewDocs && (
        <Modal title={viewDocs.title} onClose={() => setViewDocs(null)} wide>
          <div className="flex ia g2 wrap mb2">
            <span className={`badge ${subjectBadge(viewDocs.subject)}`}>{viewDocs.subject === 'MATHEMATICS' ? '📐 Maths' : '⚗️ Physics'}</span>
            <span className="badge btl">Gr{viewDocs.grade} · {viewDocs.topic}</span>
            <span className="badge bcy">Due: {fmtDate(viewDocs.dueDate)}</span>
          </div>
          {viewDocs.documents.map((d) => (
            <div key={d.id} className="doc-vw">
              <div className="doc-title">📄 {d.title}</div>
              {d.content && <div className="doc-body">{d.content}</div>}
              {d.imageData && <img src={d.imageData} className="q-img mt1" alt="" />}
            </div>
          ))}
          <div className="flex g1 mt2">
            <button className="btn bp" onClick={() => { setViewDocs(null); navigate(`/app/quiz/${viewDocs.id}`); }}>Start Quiz →</button>
            <button className="btn bg-btn" onClick={() => setViewDocs(null)}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
