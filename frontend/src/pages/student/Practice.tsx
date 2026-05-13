import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { packs as packsApi, documents as docsApi, results as resultsApi } from '../../services/api';
import type { Pack, Question } from '../../types';
import { showToast } from '../../components/Toast';
import { launchConfetti } from '../../utils/helpers';
import { diffMeta } from '../../utils/difficulty';
import DiagramViewer from '../../components/DiagramViewer';

export default function StudentPractice() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Pack | null>(null);

  useEffect(() => {
    packsApi.list()
      .then((d) => setPacks(d as Pack[]))
      .catch((e) => showToast(String((e as Error).message), 'err'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="ct3" style={{ padding: 40, textAlign: 'center' }}>Loading…</div>;

  if (active) return <PracticeSession pack={active} onExit={() => setActive(null)} />;

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--fh)', fontSize: 22 }}>📚 Practice</h2>
        <div className="xs ct3 mt1">
          Practice with packs your tutor has unlocked for you.
        </div>
      </div>

      {packs.length === 0 ? (
        <div className="ca" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <h3 style={{ margin: '0 0 6px', fontFamily: 'var(--fh)' }}>No practice unlocked yet</h3>
          <div className="sm ct3" style={{ maxWidth: 360, margin: '0 auto' }}>
            Your tutor unlocks practice packs for you. Once they do, you'll find them here.
            If you don't have a tutor yet, ask one of your teachers to connect with you.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {packs.map((p) => (
            <div key={p.id} className="ca" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="flex jb ia">
                <div style={{ fontSize: 30 }}>{p.coverEmoji}</div>
                <span className={`badge ${p.subject === 'MATHEMATICS' ? 'bma' : 'bph'}`}>
                  {p.subject === 'MATHEMATICS' ? 'Maths' : 'PhysSci'}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--fh)', fontWeight: 700, fontSize: 15 }}>{p.title}</div>
              {p.topic && <div className="xs ct3">{p.topic}</div>}
              {p.description && <div className="sm ct2" style={{ lineHeight: 1.4 }}>{p.description}</div>}

              <div className="flex g2 ia mt1" style={{ fontSize: 12, color: 'var(--t3)' }}>
                <span>📝 {p.questions.length} questions</span>
                <span>📄 {p.documents.length} PDFs</span>
              </div>

              <div className="flex g2 mt1">
                {p.documents.length > 0 && (
                  <a
                    href={docsApi.fileUrl(p.documents[0].documentId)}
                    target="_blank" rel="noreferrer"
                    className="btn ba btn-sm wf" style={{ textAlign: 'center' }}
                  >
                    📄 Open PDF
                  </a>
                )}
                <button
                  className="btn bg-btn btn-sm wf"
                  onClick={() => setActive(p)}
                  disabled={p.questions.length === 0}
                >
                  ▶️ Start
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Practice session ─────────────────────────────────────────────
function PracticeSession({ pack, onExit }: { pack: Pack; onExit: () => void }) {
  const navigate = useNavigate();
  const questions: Question[] = pack.questions.map((pq) => pq.question);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const q = questions[idx];

  function pick(opt: string) {
    setAnswers((cur) => ({ ...cur, [q.id]: opt }));
  }

  async function submit() {
    const correct = questions.filter((x) => answers[x.id] === x.answer).length;
    const pct = Math.round((correct / questions.length) * 100);
    setScore(pct);
    setSubmitted(true);
    if (pct >= 80) launchConfetti();

    try {
      await resultsApi.submitPractice({
        questionIds: questions.map((x) => x.id),
        answers: questions.map((x) => ({ questionId: x.id, selectedAnswer: answers[x.id] ?? null, timeSpent: 0 })),
        topic: pack.topic || pack.title,
        subject: pack.subject,
      });
    } catch (e) { showToast(String((e as Error).message), 'err'); }
  }

  if (submitted) {
    const correct = questions.filter((x) => answers[x.id] === x.answer).length;
    return (
      <div className="ca" style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 60, marginBottom: 8 }}>{score >= 80 ? '🏆' : score >= 60 ? '👍' : '💪'}</div>
        <h2 style={{ fontFamily: 'var(--fh)', margin: '0 0 8px' }}>
          {score}% · {correct}/{questions.length} correct
        </h2>
        <div className="sm ct2">{pack.title}</div>
        <div className="flex g2 mt2" style={{ justifyContent: 'center' }}>
          <button className="btn ba" onClick={onExit}>📚 Back to Practice</button>
          <button className="btn bg-btn" onClick={() => navigate('/app/progress')}>📈 View Progress</button>
        </div>

        <div style={{ marginTop: 24, textAlign: 'left' }}>
          {questions.map((qq, i) => {
            const sel = answers[qq.id];
            const ok = sel === qq.answer;
            return (
              <div key={qq.id} style={{
                padding: 12, marginBottom: 8, borderRadius: 10,
                border: `1px solid ${ok ? '#22c55e' : '#ef4444'}`,
                background: ok ? 'rgba(34,197,94,.05)' : 'rgba(239,68,68,.05)',
              }}>
                <div className="xs ct3">Q{i + 1} · {ok ? '✅ Correct' : '❌ Incorrect'}</div>
                {qq.imageData && <div className="mt1"><DiagramViewer src={qq.imageData} alt={`Question ${i + 1} diagram`} maxThumbHeight={200} /></div>}
                <div className="sm bold mt1">{qq.question}</div>
                <div className="xs mt1"><b>Your answer:</b> {sel || '—'}</div>
                {!ok && <div className="xs mt1"><b>Correct answer:</b> {qq.answer}</div>}
                {qq.solution && <div className="xs ct2 mt1"><b>Solution:</b> {qq.solution}</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (!q) {
    return (
      <div className="ca" style={{ padding: 30, textAlign: 'center' }}>
        <div className="ct3">No questions in this pack yet.</div>
        <button className="btn ba mt2" onClick={onExit}>Back</button>
      </div>
    );
  }

  const sel = answers[q.id];
  const total = questions.length;

  return (
    <div className="ca" style={{ padding: 20 }}>
      <div className="flex jb ia mb2">
        <button className="btn ba btn-sm" onClick={onExit}>← Exit</button>
        <div className="sm bold">{pack.coverEmoji} {pack.title}</div>
        <div className="xs ct3">{idx + 1} / {total}</div>
      </div>

      <div style={{ height: 6, background: 'var(--bd)', borderRadius: 99, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ width: `${((idx + 1) / total) * 100}%`, height: '100%', background: 'var(--p)', transition: 'width .2s' }} />
      </div>

      <div className="xs ct3">
        {q.topic} · {(() => { const m = diffMeta(q.difficulty); return <span style={{ color: m.fg, fontWeight: 600 }}>{m.icon} {m.label}</span>; })()}
      </div>
      {q.imageData && <div style={{ margin: '8px 0' }}><DiagramViewer src={q.imageData} alt={`Question ${idx + 1} diagram`} maxThumbHeight={300} /></div>}
      <div style={{ fontFamily: 'var(--fh)', fontSize: 17, fontWeight: 700, margin: '8px 0 14px' }}>{q.question}</div>

      <div style={{ display: 'grid', gap: 8 }}>
        {q.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => pick(opt)}
            style={{
              padding: '12px 14px', textAlign: 'left', cursor: 'pointer',
              borderRadius: 10, fontSize: 14,
              border: `2px solid ${sel === opt ? 'var(--p)' : 'var(--bd)'}`,
              background: sel === opt ? 'rgba(20,184,166,.1)' : 'transparent',
            }}
          >
            <span className="bold" style={{ marginRight: 8, color: 'var(--p)' }}>{String.fromCharCode(65 + i)}.</span>
            {opt}
          </button>
        ))}
      </div>

      <div className="flex g2 mt2">
        <button className="btn ba wf" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>← Previous</button>
        {idx < total - 1 ? (
          <button className="btn bg-btn wf" onClick={() => setIdx((i) => i + 1)}>Next →</button>
        ) : (
          <button className="btn bg-btn wf" onClick={submit} disabled={Object.keys(answers).length === 0}>✅ Submit</button>
        )}
      </div>
    </div>
  );
}
