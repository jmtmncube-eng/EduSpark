import { useCallback, useEffect, useMemo, useState } from 'react';
import { questions as questionsApi } from '../services/api';
import { showToast } from './Toast';
import { diffMeta } from '../utils/difficulty';
import type { Question } from '../types';
import Modal from './Modal';

/**
 * One-button guided generator.
 *
 * The Question Bank shows a single "⚡ Generate Questions" button. Pressing it
 * opens a step-by-step wizard that prompts for every detail it needs —
 * curriculum → subject → grade → topic → count → difficulty — then generates.
 * No big always-open form; just one button and a guided flow.
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
    label: 'Mathematics', short: 'Maths', icon: '📐',
    fg: '#0D9488', bg: 'rgba(13,148,136,.10)', border: 'rgba(13,148,136,.35)',
    gradient: 'linear-gradient(135deg, rgba(13,148,136,.12), rgba(16,185,129,.08))',
  },
  physical_sciences: {
    label: 'Physical Sciences', short: 'Phys Sci', icon: '⚗️',
    fg: '#7c3aed', bg: 'rgba(124,58,237,.10)', border: 'rgba(124,58,237,.35)',
    gradient: 'linear-gradient(135deg, rgba(124,58,237,.12), rgba(168,85,247,.08))',
  },
} as const;

type Subject = keyof typeof SUBJECT_THEME;
type Mix = 'EASY' | 'MEDIUM' | 'HARD' | 'MIXED';

const STEP_LABELS = ['Curriculum', 'Subject', 'Grade', 'Topic', 'How many', 'Difficulty'];

// Both subjects run Grades 10–12 across CAPS and IEB — always offer the full set.
const GRADES = [10, 11, 12];

export default function QuestionGenerator({ onDone }: { onDone?: (created: Question[]) => void }) {
  // Wizard state
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  // Choices
  const [curriculum, setCurriculum] = useState<'CAPS' | 'IEB'>('CAPS');
  const [subject, setSubject] = useState<Subject>('mathematics');
  const [grade, setGrade] = useState<number>(10);
  const [topic, setTopic] = useState<string>('');
  const [count, setCount] = useState(5);
  const [mix, setMix] = useState<Mix>('MIXED');

  // Results
  const [recent, setRecent] = useState<Question[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);

  // History
  const [batches, setBatches] = useState<Awaited<ReturnType<typeof questionsApi.listBatches>>>([]);
  const [viewBatchId, setViewBatchId] = useState<string | null>(null);
  const [showAllBatches, setShowAllBatches] = useState(false);

  useEffect(() => {
    questionsApi.listBatches().then(setBatches).catch(() => setBatches([]));
  }, []);
  async function refreshBatches() {
    try { setBatches(await questionsApi.listBatches()); } catch { /* ignore */ }
  }

  const theme = SUBJECT_THEME[subject];
  const topics = useMemo(() => TOPICS[subject][grade] ?? [], [subject, grade]);
  useEffect(() => {
    if (topics.length && !topics.includes(topic)) setTopic(topics[0]);
  }, [topics, topic]);

  function openWizard() {
    setStep(0);
    setDone(false);
    setRecent([]);
    setBatchId(null);
    setOpen(true);
  }

  async function generate() {
    if (!topic) { showToast('Pick a topic', 'warn'); return; }
    setBusy(true);
    try {
      const r = await questionsApi.generate(subject, grade, topic, count, mix, curriculum);
      showToast(`Generated ${r.count} ${curriculum} ${theme.short} question(s)`, 'success');
      setRecent(r.created as Question[]);
      setBatchId(r.batchId);
      setDone(true);
      onDone?.(r.created as Question[]);
      refreshBatches();
    } catch (e) {
      showToast(String((e as Error).message), 'err');
    } finally { setBusy(false); }
  }

  // ─── One step of the wizard ───────────────────────────────────────
  function renderStep() {
    switch (step) {
      case 0:
        return (
          <Choices>
            {(['CAPS', 'IEB'] as const).map((c) => (
              <PickCard key={c} active={curriculum === c} onClick={() => setCurriculum(c)}>
                <span style={{ fontSize: 22 }}>{c === 'CAPS' ? '🇿🇦' : '📘'}</span>
                <div>
                  <div className="bold">{c}</div>
                  <div className="xs ct3">{c === 'CAPS' ? 'National curriculum' : 'Independent Examinations Board'}</div>
                </div>
              </PickCard>
            ))}
          </Choices>
        );
      case 1:
        return (
          <Choices>
            {(Object.keys(SUBJECT_THEME) as Subject[]).map((s) => {
              const t = SUBJECT_THEME[s];
              return (
                <PickCard key={s} active={subject === s} accent={t.fg} onClick={() => setSubject(s)}>
                  <span style={{ fontSize: 26 }}>{t.icon}</span>
                  <div>
                    <div className="bold">{t.label}</div>
                    <div className="xs ct3">{s === 'mathematics' ? 'Algebra · Calc · Trig · Stats' : 'Mechanics · Waves · Electricity · Chem'}</div>
                  </div>
                </PickCard>
              );
            })}
          </Choices>
        );
      case 2:
        return (
          <>
            <div className="flex g1 wrap">
              {GRADES.map((g) => (
                <Pill key={g} active={grade === g} onClick={() => setGrade(g)}>Grade {g}</Pill>
              ))}
            </div>
            <div className="xs ct3 mt1">Both Mathematics and Physical Sciences run Grades 10–12.</div>
          </>
        );
      case 3:
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 7 }}>
            {topics.map((t) => (
              <Pill key={t} active={topic === t} onClick={() => setTopic(t)} block>{t}</Pill>
            ))}
          </div>
        );
      case 4:
        return (
          <div className="flex g1 wrap">
            {[3, 5, 10, 20].map((n) => (
              <Pill key={n} active={count === n} onClick={() => setCount(n)}>{n} questions</Pill>
            ))}
          </div>
        );
      case 5:
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 7 }}>
              {(['MIXED', 'EASY', 'MEDIUM', 'HARD'] as Mix[]).map((m) => {
                const meta = m !== 'MIXED' ? diffMeta(m) : null;
                return (
                  <Pill key={m} active={mix === m} onClick={() => setMix(m)} block>
                    {m === 'MIXED' ? '🎲 Mixed · spread' : `${meta!.icon} ${meta!.label}`}
                  </Pill>
                );
              })}
            </div>
            <div className="xs ct3 mt1">
              💡 The mix is honoured — a single band makes them all that difficulty; Mixed gives a realistic ≈30/40/30 spread, with the numbers and steps scaled to match.
            </div>
          </>
        );
      default:
        return null;
    }
  }

  return (
    <div>
      {/* ─── One button + history ─── */}
      <div className="ca" style={{
        padding: 16, marginBottom: 14,
        background: 'linear-gradient(135deg, rgba(20,184,166,.07), rgba(14,165,233,.04))',
        border: '1px solid rgba(20,184,166,.25)',
      }}>
        <div className="flex jb ia wrap g2">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--fh)', fontWeight: 800, fontSize: 16 }}>⚡ Generate Questions</div>
            <div className="xs ct3">One button — we’ll prompt you for everything: curriculum, subject, grade, topic, count, difficulty.</div>
          </div>
          <button
            className="btn bg-btn"
            onClick={openWizard}
            style={{ background: 'var(--p)', color: '#fff', fontSize: 14, fontWeight: 700, padding: '11px 20px' }}
          >
            ⚡ Generate Questions
          </button>
        </div>

        {/* Past batches — generation history */}
        {batches.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--bd)' }}>
            <div className="flex jb ia mb1">
              <div className="sm bold">🗂 Recent generations · {batches.length}</div>
              <button
                type="button" className="xs ct3"
                onClick={() => setShowAllBatches((v) => !v)}
                style={{ background: 'transparent', border: 0, cursor: 'pointer', textDecoration: 'underline' }}
              >
                {showAllBatches ? 'Show recent' : 'Show all'}
              </button>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {(showAllBatches ? batches : batches.slice(0, 5)).map((b) => {
                const subj = b.subject === 'MATHEMATICS' ? SUBJECT_THEME.mathematics : SUBJECT_THEME.physical_sciences;
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
                        {b.questionCount} question{b.questionCount === 1 ? '' : 's'} · {b.difficulty || 'MIXED'} · {relTime(b.createdAt)}
                      </div>
                    </div>
                    {b.reviewCount > 0 ? (
                      <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: 'rgba(180,83,9,.12)', color: '#b45309', whiteSpace: 'nowrap' }} title="Questions still awaiting review">🔍 {b.reviewCount} to review</span>
                    ) : (
                      <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: 'rgba(21,128,61,.12)', color: '#15803d', whiteSpace: 'nowrap' }} title="All questions signed off">✅ Approved</span>
                    )}
                    <span className="xs ct3" style={{ whiteSpace: 'nowrap' }}>View →</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── The guided wizard modal ─── */}
      {open && (
        <Modal
          title={done ? '✅ Questions generated' : `⚡ Generate Questions · Step ${step + 1} of 6`}
          onClose={() => setOpen(false)}
          wide
        >
          {done ? (
            // ── Results view ──────────────────────────────────────
            <div>
              <div style={{
                padding: '12px 14px', borderRadius: 10, marginBottom: 12,
                background: 'rgba(180,83,9,.07)', border: '1px solid rgba(180,83,9,.3)',
              }}>
                <div className="sm bold">🔍 {recent.length} {curriculum} {theme.short} question(s) generated — in review</div>
                <div className="xs ct2" style={{ marginTop: 2 }}>
                  They’re in your bank as <b>In review</b>. Approve the batch before they can be bundled into a Pack.
                </div>
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--bd)', borderRadius: 10, marginBottom: 12 }}>
                {recent.map((q, i) => {
                  const meta = diffMeta(q.difficulty);
                  return (
                    <div key={q.id} style={{ padding: '8px 12px', borderBottom: '1px solid var(--bd)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span className="xs bold" style={{ color: 'var(--t3)', minWidth: 22 }}>{i + 1}.</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="sm" style={{ fontWeight: 600 }}>{q.question}</div>
                      </div>
                      {q.imageData && <span className="badge bcy" style={{ flexShrink: 0 }}>🖼</span>}
                      <span style={{
                        padding: '2px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap',
                        background: meta.bg, color: meta.fg, border: `1px solid ${meta.borderColor}`,
                      }}>{meta.icon} {meta.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex g1 wrap">
                {batchId && (
                  <button className="btn bg-btn" style={{ background: '#15803d', color: '#fff', border: 'none' }}
                    onClick={() => { setOpen(false); setViewBatchId(batchId); }}>
                    🔍 Review &amp; approve this batch
                  </button>
                )}
                <button className="btn ba" onClick={() => { setStep(0); setDone(false); setRecent([]); setBatchId(null); }}>
                  ⚡ Generate another set
                </button>
                <button className="btn ba" onClick={() => setOpen(false)}>Done</button>
              </div>
            </div>
          ) : (
            // ── Wizard step view ──────────────────────────────────
            <div>
              {/* Stepper dots */}
              <div className="flex ia g1 mb2" style={{ flexWrap: 'wrap' }}>
                {STEP_LABELS.map((lbl, i) => (
                  <span
                    key={lbl}
                    title={lbl}
                    style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99,
                      background: i === step ? 'var(--p)' : i < step ? 'rgba(20,184,166,.14)' : 'var(--bg)',
                      color: i === step ? '#fff' : i < step ? 'var(--p)' : 'var(--t3)',
                      border: `1px solid ${i <= step ? 'var(--p)' : 'var(--bd)'}`,
                    }}
                  >
                    {i < step ? '✓' : i + 1}. {lbl}
                  </span>
                ))}
              </div>

              <div style={{ fontFamily: 'var(--fh)', fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
                {step + 1}. {
                  step === 0 ? 'Which curriculum?'
                  : step === 1 ? 'Which subject?'
                  : step === 2 ? 'Which grade?'
                  : step === 3 ? 'Which topic?'
                  : step === 4 ? 'How many questions?'
                  : 'What difficulty mix?'
                }
              </div>
              <div className="xs ct3 mb2">
                {step === 3 ? `${theme.label} · Grade ${grade} — pick a CAPS topic.` : 'Tap to choose, then Next.'}
              </div>

              <div style={{ marginBottom: 18 }}>{renderStep()}</div>

              {/* Footer — Back / Next / Generate */}
              <div className="flex jb ia" style={{ gap: 8, borderTop: '1px solid var(--bd)', paddingTop: 12 }}>
                <button
                  className="btn ba"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={step === 0}
                  style={{ opacity: step === 0 ? 0.5 : 1 }}
                >
                  ← Back
                </button>
                <div className="xs ct3">
                  {curriculum} · {theme.short} · Gr {grade}{step >= 3 && topic ? ` · ${topic}` : ''}{step >= 4 ? ` · ${count}Q` : ''}
                </div>
                {step < 5 ? (
                  <button className="btn bg-btn" style={{ background: 'var(--p)', color: '#fff' }} onClick={() => setStep((s) => s + 1)}>
                    Next →
                  </button>
                ) : (
                  <button
                    className="btn bg-btn"
                    style={{ background: 'var(--p)', color: '#fff', fontWeight: 700 }}
                    onClick={generate}
                    disabled={busy || !topic}
                  >
                    {busy ? '⚡ Generating…' : `⚡ Generate ${count} questions`}
                  </button>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}

      {viewBatchId && (
        <BatchViewer id={viewBatchId} onClose={() => setViewBatchId(null)} onDelete={() => { setViewBatchId(null); refreshBatches(); }} />
      )}
    </div>
  );
}

// ─── Small presentational helpers ────────────────────────────────────
function Choices({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>{children}</div>;
}
function PickCard({ active, accent, onClick, children }: { active: boolean; accent?: string; onClick: () => void; children: React.ReactNode }) {
  const c = accent || 'var(--p)';
  return (
    <button
      type="button" onClick={onClick}
      style={{
        cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
        padding: '13px 14px', borderRadius: 12,
        background: active ? `${c}1a` : 'var(--bg)',
        border: `2px solid ${active ? c : 'var(--bd)'}`,
        color: 'var(--t)', transition: 'all .12s',
      }}
    >{children}</button>
  );
}
function Pill({ active, onClick, block, children }: { active: boolean; onClick: () => void; block?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        cursor: 'pointer', padding: '9px 14px', borderRadius: 10,
        textAlign: block ? 'left' : 'center',
        background: active ? 'var(--p)' : 'var(--bg)',
        color: active ? '#fff' : 'var(--t)',
        border: `1.5px solid ${active ? 'var(--p)' : 'var(--bd)'}`,
        fontWeight: active ? 700 : 600, fontSize: 13,
        flex: block ? undefined : '0 1 auto',
      }}
    >{children}</button>
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
      onDelete();
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
