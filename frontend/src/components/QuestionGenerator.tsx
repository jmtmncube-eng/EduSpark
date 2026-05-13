import { useEffect, useMemo, useState } from 'react';
import { questions as questionsApi } from '../services/api';
import { showToast } from './Toast';
import { useAuth } from '../context/AuthContext';
import { ALL_DIFFICULTIES, diffMeta } from '../utils/difficulty';
import type { Question } from '../types';

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

  const topics = useMemo(() => subject ? TOPICS[subject][grade] ?? [] : [], [subject, grade]);

  useEffect(() => {
    if (topics.length && !topics.includes(topic)) setTopic(topics[0]);
  }, [topics, topic]);

  async function generate() {
    if (!subject) { showToast('Pick a subject', 'warn'); return; }
    if (!topic) { showToast('Pick a topic', 'warn'); return; }
    setBusy(true);
    setRecent([]);
    try {
      // The backend doesn't filter by difficulty yet — it generates whatever
      // the topic generator produces. We send `count` and surface the chosen
      // mix to the tutor as a hint; future versions can pass `mix` server-side.
      const r = await questionsApi.generate(subject, grade, topic, count) as { count: number; created: Question[] };
      showToast(`Generated ${r.count} ${SUBJECT_THEME[subject].short} question(s)`, 'success');
      setRecent(r.created);
      onDone?.(r.created);
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
              <div className="sm bold mb1">✅ Just generated · {recent.length}</div>
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
    </div>
  );
}
