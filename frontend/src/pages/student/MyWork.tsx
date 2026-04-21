import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { assignments as assignmentsApi, results as resultsApi } from '../../services/api';
import { showToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import type { Assignment, QuizResult } from '../../types';
import { subjectBadge, fmtDate } from '../../utils/helpers';

type Filter = 'all' | 'pending' | 'done' | 'overdue';
type SortKey = 'due' | 'title' | 'score';

function daysLeft(due: string) {
  return Math.ceil((new Date(due).getTime() - Date.now()) / 86_400_000);
}

function urgencyColor(dl: number, done: boolean) {
  if (done) return 'var(--s)';
  if (dl < 0) return 'var(--dr)';
  if (dl <= 2) return 'var(--wr)';
  return 'var(--t3)';
}

export default function StudentMyWork() {
  const navigate = useNavigate();
  const [asgns, setAsgns] = useState<Assignment[]>([]);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<SortKey>('due');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [viewDocs, setViewDocs] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([assignmentsApi.list(), resultsApi.list()])
      .then(([a, r]) => {
        setAsgns(a as Assignment[]);
        setResults(r as QuizResult[]);
      })
      .catch(() => showToast('Failed to load assignments', 'err'))
      .finally(() => setLoading(false));
  }, []);

  // Build lookup maps
  const attemptMap = useMemo(() => {
    const m: Record<string, QuizResult[]> = {};
    results.forEach((r) => {
      if (!m[r.assignmentId]) m[r.assignmentId] = [];
      m[r.assignmentId].push(r);
    });
    return m;
  }, [results]);

  const bestResult = (aId: string): QuizResult | undefined => {
    const rs = attemptMap[aId];
    if (!rs?.length) return undefined;
    return rs.reduce((best, r) => (r.score > best.score ? r : best), rs[0]);
  };

  const isDone = (a: Assignment) => !!(attemptMap[a.id]?.length);
  const isOverdue = (a: Assignment) => !isDone(a) && daysLeft(a.dueDate) < 0;

  // Stats
  const total = asgns.length;
  const doneCount = asgns.filter(isDone).length;
  const overdueCount = asgns.filter(isOverdue).length;
  const pendingCount = asgns.filter((a) => !isDone(a) && !isOverdue(a)).length;
  const doneResults = results.filter((r) => r.score !== undefined);
  const avgScore = doneResults.length
    ? Math.round(doneResults.reduce((s, r) => s + r.score, 0) / doneResults.length)
    : null;

  const completionPct = total ? Math.round((doneCount / total) * 100) : 0;

  // Filter + sort
  const visible = useMemo(() => {
    let list = asgns;
    if (subjectFilter) list = list.filter((a) => a.subject === subjectFilter);
    if (filter === 'pending') list = list.filter((a) => !isDone(a) && !isOverdue(a));
    else if (filter === 'done') list = list.filter(isDone);
    else if (filter === 'overdue') list = list.filter(isOverdue);

    return [...list].sort((a, b) => {
      if (sort === 'due') return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (sort === 'title') return a.title.localeCompare(b.title);
      if (sort === 'score') {
        const sa = bestResult(a.id)?.score ?? -1;
        const sb = bestResult(b.id)?.score ?? -1;
        return sb - sa;
      }
      return 0;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asgns, filter, sort, subjectFilter, results]);

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: total },
    { key: 'pending', label: '⏳ Pending', count: pendingCount },
    { key: 'done', label: '✅ Done', count: doneCount },
    { key: 'overdue', label: '⚠️ Overdue', count: overdueCount },
  ];

  if (loading) return <div className="empty"><div className="eico">⏳</div><p>Loading…</p></div>;

  return (
    <div>
      <div className="ph">
        <h2>📋 My Work</h2>
        <p>All quizzes and assignments allocated to you — track your progress and stay on top of deadlines.</p>
      </div>

      {/* Completion progress */}
      {total > 0 && (
        <div className="cc mb2" style={{ padding: '16px 18px' }}>
          <div className="flex jb ia mb1">
            <div className="bold fh" style={{ fontSize: 14 }}>Overall Completion</div>
            <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--p)' }}>{completionPct}%</span>
          </div>
          <div className="pb-w" style={{ height: 10, borderRadius: 6 }}>
            <div className="pb-f" style={{ width: `${completionPct}%`, borderRadius: 6 }} />
          </div>
          <div className="flex g2 mt2 wrap" style={{ fontSize: 12 }}>
            <span style={{ color: 'var(--t3)' }}>📋 {total} total</span>
            <span style={{ color: 'var(--s)' }}>✅ {doneCount} done</span>
            <span style={{ color: 'var(--wr)' }}>⏳ {pendingCount} pending</span>
            {overdueCount > 0 && <span style={{ color: 'var(--dr)' }}>⚠️ {overdueCount} overdue</span>}
            {avgScore !== null && <span style={{ color: 'var(--p)', fontWeight: 700 }}>⭐ {avgScore}% avg</span>}
          </div>
        </div>
      )}

      {/* Filter + Sort bar */}
      <div className="flex jb ia mb2 wrap" style={{ gap: 10 }}>
        <div className="flex g1 wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`btn btn-sm ${filter === f.key ? 'bp' : 'ba'}`}
              style={{ gap: 4 }}
            >
              {f.label}
              <span style={{ marginLeft: 4, background: filter === f.key ? 'rgba(255,255,255,.25)' : 'var(--bd2)', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
        <div className="flex g1 ia">
          <select className="select" style={{ width: 'auto', fontSize: 12 }} value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
            <option value="">All Subjects</option>
            <option value="MATHEMATICS">📐 Maths</option>
            <option value="PHYSICAL_SCIENCES">⚗️ Phys Sci</option>
          </select>
          <select className="select" style={{ width: 'auto', fontSize: 12 }} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="due">Sort: Due Date</option>
            <option value="title">Sort: Title</option>
            <option value="score">Sort: Score</option>
          </select>
        </div>
      </div>

      {/* Assignment list */}
      {visible.length === 0 ? (
        <div className="empty">
          <div className="eico">{filter === 'done' ? '🎉' : filter === 'overdue' ? '✅' : '📭'}</div>
          <h3>{filter === 'done' ? 'Nothing completed yet' : filter === 'overdue' ? 'No overdue work!' : 'No assignments here'}</h3>
          <p>{filter === 'pending' ? 'All caught up — great work!' : filter === 'overdue' ? 'Keep it up.' : 'Your teacher will assign quizzes soon.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visible.map((a) => {
            const done = isDone(a);
            const overdue = isOverdue(a);
            const dl = daysLeft(a.dueDate);
            const best = bestResult(a.id);
            const attempts = attemptMap[a.id]?.length ?? 0;
            const maxAtt = a.maxAttempts ?? 3;
            const attLeft = maxAtt - attempts;
            const hasDocs = a.documents.length > 0;

            return (
              <div
                key={a.id}
                className="cc"
                style={{
                  padding: '16px 18px',
                  borderLeft: `4px solid ${done ? 'var(--s)' : overdue ? 'var(--dr)' : dl <= 2 ? 'var(--wr)' : 'var(--bd)'}`,
                  opacity: overdue ? 0.85 : 1,
                }}
              >
                {/* Header row */}
                <div className="flex jb ia wrap" style={{ gap: 8, marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="bold fh" style={{ fontSize: 15, marginBottom: 5 }}>{a.title}</div>
                    <div className="flex ia g1 wrap">
                      <span className={`badge ${subjectBadge(a.subject)}`}>
                        {a.subject === 'MATHEMATICS' ? '📐' : '⚗️'} Gr{a.grade}
                      </span>
                      <span className="badge btl">{a.topic}</span>
                      {hasDocs && (
                        <button
                          className="badge bcy"
                          style={{ cursor: 'pointer', background: 'none', border: '1px solid var(--bd)', borderRadius: 6 }}
                          onClick={() => setViewDocs(a)}
                        >
                          📄 {a.documents.length} doc{a.documents.length !== 1 ? 's' : ''}
                        </button>
                      )}
                    </div>
                  </div>
                  {done ? (
                    <span className="badge bok" style={{ fontSize: 11, fontWeight: 700 }}>✅ Done</span>
                  ) : overdue ? (
                    <span className="badge bng" style={{ fontSize: 11, fontWeight: 700 }}>⚠️ Overdue</span>
                  ) : dl <= 2 ? (
                    <span className="badge" style={{ background: 'rgba(245,158,11,.15)', color: 'var(--wr)', fontSize: 11, fontWeight: 700 }}>🔥 Due soon</span>
                  ) : (
                    <span className="badge ba" style={{ fontSize: 11 }}>📋 Pending</span>
                  )}
                </div>

                {/* Score bar if done */}
                {done && best && (
                  <div style={{
                    background: best.score >= 70 ? 'rgba(20,184,166,.07)' : best.score >= 50 ? 'rgba(251,191,36,.07)' : 'rgba(220,38,38,.06)',
                    border: `1px solid ${best.score >= 70 ? 'rgba(20,184,166,.2)' : best.score >= 50 ? 'rgba(251,191,36,.2)' : 'rgba(220,38,38,.15)'}`,
                    borderRadius: 10,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                  }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 2 }}>Best Score</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: best.score >= 70 ? 'var(--s)' : best.score >= 50 ? 'var(--wr)' : 'var(--dr)' }}>
                        {best.score >= 80 ? '🏆 Distinction' : best.score >= 70 ? '🌟 Merit' : best.score >= 50 ? '✅ Pass' : '📖 Study more'}
                      </div>
                      {attempts > 1 && (
                        <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>
                          {attempts} attempts · best of all
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: best.score >= 70 ? 'var(--s)' : best.score >= 50 ? 'var(--wr)' : 'var(--dr)', lineHeight: 1 }}>
                        {best.score}%
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--t3)' }}>{best.correct}/{best.total} correct</div>
                    </div>
                  </div>
                )}

                {/* Footer row */}
                <div className="flex jb ia wrap" style={{ gap: 8 }}>
                  <div className="flex g2 ia wrap" style={{ fontSize: 12 }}>
                    <span style={{ color: urgencyColor(dl, done) }}>
                      📅 {done ? `Due ${fmtDate(a.dueDate)}` : overdue ? `Overdue by ${Math.abs(dl)}d` : dl === 0 ? 'Due today!' : `${dl}d left`}
                    </span>
                    <span style={{ color: attLeft === 0 ? 'var(--dr)' : 'var(--t3)' }}>
                      🔁 {attempts}/{maxAtt} attempt{maxAtt !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex g1 wrap">
                    {hasDocs && (
                      <button className="btn ba btn-sm" onClick={() => setViewDocs(a)}>📄 Docs</button>
                    )}
                    {done ? (
                      <>
                        <button className="btn bg-btn btn-sm" onClick={() => best && navigate(`/app/results/${best.id}`)}>
                          📊 Results
                        </button>
                        {attLeft > 0 && (
                          <button className="btn ba btn-sm" onClick={() => navigate(`/app/quiz/${a.id}`)}>
                            🔁 Retake ({attLeft} left)
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        className={`btn btn-sm ${overdue ? 'bd-btn' : 'bp'}`}
                        onClick={() => navigate(`/app/quiz/${a.id}`)}
                        disabled={attLeft === 0}
                      >
                        {overdue ? '⚠️ Start (Late)' : '▶ Start Quiz'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Document viewer modal */}
      {viewDocs && (
        <Modal title={viewDocs.title} onClose={() => setViewDocs(null)} wide>
          <div className="flex ia g2 wrap mb2">
            <span className={`badge ${subjectBadge(viewDocs.subject)}`}>
              {viewDocs.subject === 'MATHEMATICS' ? '📐 Maths' : '⚗️ Phys Sci'}
            </span>
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
            <button className="btn bp" onClick={() => { setViewDocs(null); navigate(`/app/quiz/${viewDocs.id}`); }}>
              ▶ Start Quiz
            </button>
            <button className="btn bg-btn" onClick={() => setViewDocs(null)}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
