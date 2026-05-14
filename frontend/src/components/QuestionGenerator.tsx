import { useCallback, useEffect, useMemo, useState } from 'react';
import { questions as questionsApi } from '../services/api';
import { showToast } from './Toast';
import { useAuth } from '../context/AuthContext';
import { ALL_DIFFICULTIES, diffMeta } from '../utils/difficulty';
import type { Question } from '../types';
import Modal from './Modal';

/**
 * Guided generator panel.
 *
 *   1. Subject  (Maths or Physical Sciences) — big, visually distinct cards
 *   2. Grade    (10 / 11 / 12)
 *   3. Topic    (from the CAPS topic list for that grade + subject)
 *   4. Count    (3 / 5 / 10 / 20)
 *   5. Mix      (Warm-up only · Core only · Stretch only · Mixed)
 *   6. Generate
 *
 * Math is teal (📐), Physics is indigo (⚗️) — that palette is reused across
 * the rest of the app so tutors can scan content at a glance.
 */

const TOPICS: Record<'mathematics' | 'physical_sciences', Record<number, string[]>> = {
  mathematics: {
    10: ['Algebra', 'Functions & Graphs', 'Trigonometry', 'Statistics', 'Finance & Growth', 'Euclidean Geometry'],
    11: ['Quadratic Equations', 'Trigonometric Functions', 'Analytical Geometry', 'Finance', 'Counting & Probability', 'Inequalities'],
    12: ['Differential Calculus', 'Sequences & Series', 'Polynomials', 'Exponential & Logarithms', 'Regression Analysis', 'Trigonometry Advanced'],
  },
  physical_sciences: {
    10: ["Newton's Laws", 'Momentum', 'Energy & Power', 'Waves & Sound', 'Electricity & Magnetism', 'Chemistry: Matter'],
    11: ['Projectile Motion', 'Electrostatics', 'Electric Circuits', 'Intermolecular Forces', 'Chemical Equilibrium', 'Vectors & Scalars'],
    12: ['Momentum & Impulse', 'Vertical Projectile Motion', 'Electrodynamics', 'Organic Chemistry', 'Electrochemistry', 'Optical Phenomena'],
  },
};

// Subject visual identity reused everywhere
export const SUBJECT_THEME = {
  mathematics: {
    label: 'Mathematics',
    short: 'Maths',
    icon: '📐',
    fg: '#0D9488',
    bg: 'rgba(13,148,136,.10)',
    border: 'rgba(13,148,136,.35)',
    gradient: 'linear-gradient(135deg, rgba(13,148,136,.12), rgba(16,185,129,.08))',
  },
  physical_sciences: {
    label: 'Physical Sciences',
    short: 'Phys Sci',
    icon: '⚗️',
    fg: '#7c3aed',
    bg: 'rgba(124,58,237,.10)',
    border: 'rgba(124,58,237,.35)',
    gradient: 'linear-gradient(135deg, rgba(124,58,237,.12), rgba(168,85,247,.08))',
  },
} as const;

type Subject = keyof typeof SUBJECT_THEME;
type Mix = 'EASY' | 'MEDIUM' | 'HARD' | 'MIXED';

export default function QuestionGenerator({ onDone }: { onDone?: (created: Question[]) => void }) {
  const { user } = useAuth();
  const isTutor = user?.role === 'TUTOR';

  // Step state
  const [subject, setSubject] = useState<Subject | null>(null);
  const tutorGrades = (user?.teachGrades?.length ? user.teachGrades : [10, 11, 12]) as number[];
  const [grade, setGrade] = useState<number>(tutorGrades[0] ?? 10);
  const [topic, setTopic] = useState<string>('');
  const [count, setCount] = useState(5);
  const [mix, setMix] = useState<Mix>('MIXED');
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<Question[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batches, setBatches] = useState<Awaited<ReturnType<typeof questionsApi.listBatches>>>([]);
  const [viewBatchId, setViewBatchId] = useState<string | null>(null);
  const [showAllBatches, setShowAllBatches] = useState(false);

  // Load recent batches on mount so the tutor can revisit past generations
  useEffect(() => {
    questionsApi.listBatches().then(setBatches).catch(() => setBatches([]));
  }, []);

  async function refreshBatches() {
    try { setBatches(await questionsApi.listBatches()); } catch { /* ignore */ }
  }

  const topics = useMemo(() => subject ? TOPICS[subject][grade] ?? [] : [], [subject, grade]);

  useEffect(() => {
    if (topics.length && !topics.includes(topic)) setTopic(topics[0]);
  }, [topics, topic]);

  async function generate() {
    if (!subject) { showToast('Pick a subject', 'warn'); return; }
    if (!topic) { showToast('Pick a topic', 'warn'); return; }
    setBusy(true);
    setRecent([]);
    setBatchId(null);
    try {
      const r = await questionsApi.generate(subject, grade, topic, count, mix);
      showToast(`Generated ${r.count} ${SUBJECT_THEME[subject].short} question(s)`, 'success');
      setRecent(r.created as Question[]);
      setBatchId(r.batchId);
      onDone?.(r.created as Question[]);
      refreshBatches();
    } catch (e) {
      showToast(String((e as Error).message), 'err');
    } finally { setBusy(false); }
  }

  const theme = subject ? SUBJECT_THEME[subject] : null;

  return (
    <div className="ca" style={{
      padding: 16, marginBottom: 14,
      background: theme ? theme.gradient : 'linear-gradient(135deg, rgba(20,184,166,.06), rgba(14,165,233,.04))',
      border: `1px solid ${theme ? theme.border : 'var(--bd)'}`,
      transition: 'background .3s, border-color .3s',
    }}>
      <div className="flex jb ia mb2" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontFamily: 'var(--fh)', fontWeight: 800, fontSize: 16 }}>⚡ Generate Questions</div>
          <div className="xs ct3">Pick subject → grade → topic → how many. Questions land in your Bank ready to bundle.</div>
        </div>
      </div>

      {/* Step 1 — Subject */}
      <div className="sm bold mb1">1. Subject</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        {(Object.keys(SUBJECT_THEME) as Subject[]).map((s) => {
          const t = SUBJECT_THEME[s];
          const active = subject === s;
          return (
            <button
              key={s}
              onClick={() => setSubject(s)}
              style={{
                cursor: 'pointer', textAlign: 'left',
                padding: '12px 14px', borderRadius: 12,
                background: active ? t.bg : 'var(--bg)',
                border: `2px solid ${active ? t.fg : 'var(--bd)'}`,
                display: 'flex', alignItems: 'center', gap: 12,
                transition: 'all .15s',
              }}
            >
              <span style={{ fontSize: 28 }}>{t.icon}</span>
              <div>
                <div className="bold" style={{ color: active ? t.fg : 'var(--t)' }}>{t.label}</div>
                <div className="xs ct3">{s === 'mathematics' ? 'Algebra · Calc · Trig · Stats' : 'Mechanics · Waves · Electricity · Chem'}</div>
              </div>
            </button>
          );
        })}
      </div>

      {subject && (
        <>
          {/* Step 2 — Grade */}
          <div className="sm bold mb1">2. Grade</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {tutorGrades.map((g) => (
              <button
                key={g}
                onClick={() => setGrade(g)}
                style={{
                  cursor: 'pointer',
                  flex: '1 1 80px',
                  padding: '10px 16px', borderRadius: 10,
                  background: grade === g ? theme!.bg : 'var(--bg)',
                  border: `2px solid ${grade === g ? theme!.fg : 'var(--bd)'}`,
                  fontWeight: 700, fontSize: 14,
                  color: grade === g ? theme!.fg : 'var(--t)',
                }}
              >
                Grade {g}
              </button>
            ))}
            {isTutor && tutorGrades.length === 1 && (
              <div className="xs ct3" style={{ alignSelf: 'center', flexBasis: '100%' }}>
                You only teach Grade {tutorGrades[0]} — admin can add more.
              </div>
            )}
          </div>

          {/* Step 3 — Topic */}
          <div className="sm bold mb1">3. Topic</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6, marginBottom: 14 }}>
            {topics.map((t) => (
              <button
                key={t}
                onClick={() => setTopic(t)}
                style={{
                  cursor: 'pointer', textAlign: 'left',
                  padding: '8px 10px', borderRadius: 8,
                  background: topic === t ? theme!.bg : 'var(--bg)',
                  border: `1.5px solid ${topic === t ? theme!.fg : 'var(--bd)'}`,
                  fontSize: 12.5, fontWeight: 600,
                  color: topic === t ? theme!.fg : 'var(--t)',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Step 4 — Count */}
          <div className="sm bold mb1">4. How many?</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {[3, 5, 10, 20].map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                style={{
                  cursor: 'pointer',
                  padding: '8px 14px', borderRadius: 8,
                  background: count === n ? theme!.bg : 'var(--bg)',
                  border: `1.5px solid ${count === n ? theme!.fg : 'var(--bd)'}`,
                  fontWeight: 700, fontSize: 13,
                  color: count === n ? theme!.fg : 'var(--t)',
                }}
              >
                {n} questions
              </button>
            ))}
          </div>

          {/* Step 5 — Mix */}
          <div className="sm bold mb1">
            5. Difficulty mix
            <span className="xs ct3" style={{ fontWeight: 400, marginLeft: 6 }}>
              (students see friendly names — see key below)
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 6, marginBottom: 6 }}>
            {(['MIXED', 'EASY', 'MEDIUM', 'HARD'] as Mix[]).map((m) => {
              const isMixed = m === 'MIXED';
              const meta = !isMixed ? diffMeta(m) : null;
              const active = mix === m;
              return (
                <button
                  key={m}
                  onClick={() => setMix(m)}
                  style={{
                    cursor: 'pointer', textAlign: 'left',
                    padding: '8px 12px', borderRadius: 10,
                    background: active ? (meta?.bg ?? 'rgba(20,184,166,.10)') : 'var(--bg)',
                    border: `1.5px solid ${active ? (meta?.fg ?? 'var(--p)') : 'var(--bd)'}`,
                    color: active ? (meta?.fg ?? 'var(--p)') : 'var(--t)',
                    fontSize: 13, fontWeight: 700,
                  }}
                >
                  {isMixed
                    ? <>🎲 Mixed <span className="xs" style={{ fontWeight: 400 }}>· spread across all</span></>
                    : <>{meta!.icon} {meta!.label}</>}
                </button>
              );
            })}
          </div>
          <div className="xs ct3 mb2">
            💡 The mix is a hint — the generator currently outputs whatever fits the topic; future versions will respect strict difficulty filters.
          </div>

          {/* Generate button */}
          <button
            className="btn bg-btn wf"
            onClick={generate}
            disabled={busy || !topic}
            style={{
              padding: '12px',
              background: theme!.fg,
              fontSize: 14, fontWeight: 700,
            }}
          >
            {busy
              ? `⚡ Generating ${count} questions…`
              : `⚡ Generate ${count} ${theme!.short} question${count === 1 ? '' : 's'} on ${topic}`}
          </button>

          {recent.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="flex jb ia mb1">
                <div className="sm bold">🔍 Just generated · {recent.length} <span className="xs ct3" style={{ fontWeight: 400 }}>· in review</span></div>
                {batchId && (
                  <a
                    href={`#batch-${batchId}`}
                    onClick={(e) => { e.preventDefault(); setViewBatchId(batchId); }}
                    className="xs bold"
                    style={{ color: theme!.fg, textDecoration: 'underline', cursor: 'pointer' }}
                  >
                    🔗 Review &amp; approve this batch →
                  </a>
                )}
              </div>
              <div className="xs ct3 mb1">
                These are in <b>review</b> — open the batch to approve them before they can be bundled into a Pack.
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--bd)', borderRadius: 10 }}>
                {recent.map((q, i) => {
                  const meta = diffMeta(q.difficulty);
                  return (
                    <div key={q.id} style={{ padding: '8px 12px', borderBottom: '1px solid var(--bd)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span className="xs bold" style={{ color: 'var(--t3)', minWidth: 22 }}>{i + 1}.</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="sm" style={{ fontWeight: 600 }}>{q.question}</div>
                      </div>
                      <span style={{
                        padding: '2px 8px', borderRadius: 99,
                        fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap',
                        background: meta.bg, color: meta.fg, border: `1px solid ${meta.borderColor}`,
                      }}>{meta.icon} {meta.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Past batches — generation history */}
      {batches.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--bd)' }}>
          <div className="flex jb ia mb1">
            <div className="sm bold">🗂 Recent generations · {batches.length}</div>
            <button
              type="button"
              className="xs ct3"
              onClick={() => setShowAllBatches((v) => !v)}
              style={{ background: 'transparent', border: 0, cursor: 'pointer', textDecoration: 'underline' }}
            >
              {showAllBatches ? 'Show recent' : 'Show all'}
            </button>
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {(showAllBatches ? batches : batches.slice(0, 5)).map((b) => {
              const subj = b.subject === 'MATHEMATICS' ? SUBJECT_THEME.mathematics : SUBJECT_THEME.physical_sciences;
              const ago = relTime(b.createdAt);
              return (
                <button
                  key={b.id}
                  onClick={() => setViewBatchId(b.id)}
                  style={{
                    background: 'var(--bg)', cursor: 'pointer',
                    border: '1px solid var(--bd)', borderRadius: 10,
                    padding: '8px 12px', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{subj.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="sm bold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.topic} · Gr {b.grade}
                    </div>
                    <div className="xs ct3">
                      {b.questionCount} question{b.questionCount === 1 ? '' : 's'} · {b.difficulty || 'MIXED'} · {ago}
                    </div>
                  </div>
                  {b.reviewCount > 0 ? (
                    <span style={{
                      padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                      background: 'rgba(180,83,9,.12)', color: '#b45309', whiteSpace: 'nowrap',
                    }} title="Questions still awaiting review">🔍 {b.reviewCount} to review</span>
                  ) : (
                    <span style={{
                      padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                      background: 'rgba(21,128,61,.12)', color: '#15803d', whiteSpace: 'nowrap',
                    }} title="All questions signed off">✅ Approved</span>
                  )}
                  <span className="xs ct3" style={{ whiteSpace: 'nowrap' }}>View →</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {viewBatchId && (
        <BatchViewer id={viewBatchId} onClose={() => setViewBatchId(null)} onDelete={() => { setViewBatchId(null); refreshBatches(); }} />
      )}
    </div>
  );
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-ZA');
}

// ─── Batch viewer modal — review, approve or discard a generation run ──
function BatchViewer({ id, onClose, onDelete }: { id: string; onClose: () => void; onDelete: () => void }) {
  const [batch, setBatch] = useState<Awaited<ReturnType<typeof questionsApi.getBatch>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const fetchBatch = useCallback(() => {
    setLoading(true);
    questionsApi.getBatch(id)
      .then(setBatch)
      .catch((e) => { showToast(String((e as Error).message), 'err'); onClose(); })
      .finally(() => setLoading(false));
  }, [id, onClose]);

  useEffect(() => { fetchBatch(); }, [fetchBatch]);

  async function approve() {
    if (!confirm('Approve this batch? Every question that passes validation is published and becomes eligible for Packs.')) return;
    setBusy(true);
    try {
      const r = await questionsApi.approveBatch(id);
      showToast(
        r.failed
          ? `Published ${r.approved} · ${r.failed} still need fixing`
          : `✅ Published all ${r.approved} question(s)`,
        r.failed ? 'warn' : 'success',
      );
      fetchBatch();
      onDelete(); // refreshes the parent list
    } catch (e) { showToast(String((e as Error).message), 'err'); }
    finally { setBusy(false); }
  }

  async function discard() {
    if (!confirm('Discard this whole batch? Every question in it is permanently deleted (except any already bundled into a Pack). This cannot be undone.')) return;
    setBusy(true);
    try {
      const r = await questionsApi.discardBatch(id);
      showToast(
        `🗑 Discarded ${r.deleted} question(s)` + (r.keptBecausePacked ? ` · kept ${r.keptBecausePacked} already in a Pack` : ''),
        'info',
      );
      onDelete();
    } catch (e) { showToast(String((e as Error).message), 'err'); }
    finally { setBusy(false); }
  }

  if (loading || !batch) {
    return <Modal title="Loading batch…" onClose={onClose}><div className="ct3" style={{ padding: 20, textAlign: 'center' }}>…</div></Modal>;
  }

  const theme = batch.subject === 'MATHEMATICS' ? SUBJECT_THEME.mathematics : SUBJECT_THEME.physical_sciences;
  const reviewCount = batch.questions.filter((q) => q.status === 'REVIEW' || q.status === 'DRAFT').length;
  const flaggedCount = batch.questions.filter((q) => (q.validationErrors?.length ?? 0) > 0).length;

  return (
    <Modal title={`🗂 Batch · ${batch.topic}`} onClose={onClose}>
      <div className="flex jb ia mb2" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="sm" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>{theme.icon}</span>
            <span className="bold">{theme.label} · Grade {batch.grade}</span>
          </div>
          <div className="xs ct3 mt1">
            By {batch.createdBy.name} ({batch.createdBy.role.toLowerCase()}) · {new Date(batch.createdAt).toLocaleString('en-ZA')}
          </div>
        </div>
      </div>

      {/* Review summary + actions */}
      <div style={{
        padding: '10px 12px', borderRadius: 10, marginBottom: 12,
        background: reviewCount ? 'rgba(180,83,9,.07)' : 'rgba(21,128,61,.07)',
        border: `1px solid ${reviewCount ? 'rgba(180,83,9,.3)' : 'rgba(21,128,61,.3)'}`,
      }}>
        <div className="sm" style={{ fontWeight: 700 }}>
          {reviewCount
            ? `🔍 ${reviewCount} of ${batch.questions.length} still awaiting review`
            : `✅ All ${batch.questions.length} question(s) signed off`}
        </div>
        {flaggedCount > 0 && (
          <div className="xs" style={{ color: '#b91c1c', marginTop: 2 }}>
            ⚠ {flaggedCount} have validation errors — approve will leave those in review until fixed.
          </div>
        )}
        <div className="xs ct2" style={{ marginTop: 4 }}>
          Approve to publish the clean ones (eligible for Packs), or discard to bin the whole run.
        </div>
        <div className="flex g1 mt1 wrap">
          <button className="btn btn-sm" onClick={approve} disabled={busy || reviewCount === 0}
            style={{ background: '#15803d', color: '#fff', border: 'none' }}>
            ✅ Approve batch
          </button>
          <button className="btn ba btn-sm" onClick={discard} disabled={busy}>🗑 Discard batch</button>
        </div>
      </div>

      <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid var(--bd)', borderRadius: 10 }}>
        {batch.questions.map((q, i) => {
          const meta = diffMeta(q.difficulty);
          const errs = q.validationErrors ?? [];
          const published = q.status === 'PUBLISHED';
          return (
            <div key={q.id} style={{ padding: 10, borderBottom: '1px solid var(--bd)' }}>
              <div className="flex jb ia" style={{ gap: 6, flexWrap: 'wrap' }}>
                <span className="xs ct3">Q{i + 1} · ~{q.expectedSeconds}s</span>
                <div className="flex ia g1" style={{ flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                    background: published ? 'rgba(21,128,61,.12)' : 'rgba(180,83,9,.12)',
                    color: published ? '#15803d' : '#b45309',
                  }}>{published ? '✅ Published' : '🔍 In review'}</span>
                  <span style={{
                    padding: '2px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 700,
                    background: meta.bg, color: meta.fg, border: `1px solid ${meta.borderColor}`,
                  }}>{meta.icon} {meta.label}</span>
                </div>
              </div>
              <div className="sm" style={{ fontWeight: 600, marginTop: 4 }}>{q.question}</div>
              <div className="xs ct2 mt1">Answer: <span style={{ fontWeight: 600 }}>{q.answer}</span></div>
              {errs.length > 0 && (
                <div className="xs" style={{ color: '#b91c1c', marginTop: 3 }}>
                  ⚠ {errs.join(' · ')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
