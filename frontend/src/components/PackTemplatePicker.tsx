import { useEffect, useState } from 'react';
import Modal from './Modal';
import PillSelect from './PillSelect';
import { packs as packsApi } from '../services/api';
import { showToast } from './Toast';
import { useAuth } from '../context/AuthContext';

type Template = Awaited<ReturnType<typeof packsApi.templates>>[number];

const TOPICS: Record<'MATHEMATICS' | 'PHYSICAL_SCIENCES', Record<number, string[]>> = {
  MATHEMATICS: {
    10: ['Algebra', 'Functions & Graphs', 'Trigonometry', 'Statistics', 'Finance & Growth', 'Euclidean Geometry'],
    11: ['Quadratic Equations', 'Trigonometric Functions', 'Analytical Geometry', 'Finance', 'Counting & Probability', 'Inequalities'],
    12: ['Differential Calculus', 'Sequences & Series', 'Polynomials', 'Exponential & Logarithms', 'Regression Analysis', 'Trigonometry Advanced'],
  },
  PHYSICAL_SCIENCES: {
    10: ["Newton's Laws", 'Momentum', 'Energy & Power', 'Waves & Sound', 'Electricity & Magnetism', 'Chemistry: Matter'],
    11: ['Projectile Motion', 'Electrostatics', 'Electric Circuits', 'Intermolecular Forces', 'Chemical Equilibrium', 'Vectors & Scalars'],
    12: ['Momentum & Impulse', 'Vertical Projectile Motion', 'Electrodynamics', 'Organic Chemistry', 'Electrochemistry', 'Optical Phenomena'],
  },
};

interface Props {
  onClose: () => void;
  onCreated: (pack: { id: string; title: string }) => void;
}

export default function PackTemplatePicker({ onClose, onCreated }: Props) {
  const { user } = useAuth();
  const tutorGrades = (user?.teachGrades?.length ? user.teachGrades : [10, 11, 12]) as number[];
  const [templates, setTemplates] = useState<Template[]>([]);
  const [picked, setPicked] = useState<Template | null>(null);
  const [subject, setSubject] = useState<'MATHEMATICS' | 'PHYSICAL_SCIENCES'>('MATHEMATICS');
  const [grade, setGrade] = useState<number>(tutorGrades[0] ?? 10);
  const [topic, setTopic] = useState<string>('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    packsApi.templates().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  const topics = TOPICS[subject]?.[grade] ?? [];
  useEffect(() => { if (topics.length && !topics.includes(topic)) setTopic(topics[0]); }, [topics, topic]);

  async function create() {
    if (!picked) return;
    if (!topic) { showToast('Pick a topic', 'warn'); return; }
    setBusy(true);
    try {
      const pack = await packsApi.fromTemplate({
        templateId: picked.id,
        subject, grade, topic,
        title: title.trim() || undefined,
      }) as { id: string; title: string };
      showToast(`✓ Created "${pack.title}"`, 'success');
      onCreated(pack);
    } catch (e) {
      showToast(String((e as Error).message), 'err');
    } finally { setBusy(false); }
  }

  return (
    <Modal title="✨ Create from a template" onClose={onClose}>
      {!picked ? (
        <>
          <p className="sm" style={{ color: 'var(--t2)', marginBottom: 14 }}>
            Each template auto-generates the right number of questions at the right difficulty
            mix for that use case — your students are unlocked-ready in seconds.
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setPicked(t)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: 14, borderRadius: 12,
                  background: 'var(--bg)', border: '1px solid var(--bd)',
                  cursor: 'pointer', textAlign: 'left', color: 'var(--t)',
                }}
              >
                <span style={{ fontSize: 30 }}>{t.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div className="bold" style={{ fontSize: 14, color: 'var(--t)' }}>{t.title}</div>
                  <div className="xs" style={{ color: 'var(--t2)', marginTop: 2 }}>{t.description}</div>
                  <div className="xs" style={{ color: 'var(--t3)', marginTop: 4 }}>
                    🌱 {t.mix.EASY} · 🎯 {t.mix.MEDIUM} · 🚀 {t.mix.HARD}
                    {' '}({t.mix.EASY + t.mix.MEDIUM + t.mix.HARD} questions)
                  </div>
                </div>
                <span style={{ fontSize: 18, color: 'var(--p)' }}>→</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 28 }}>{picked.emoji}</span>
            <div>
              <div className="bold" style={{ fontSize: 14 }}>{picked.title}</div>
              <div className="xs" style={{ color: 'var(--t2)' }}>{picked.description}</div>
            </div>
            <button
              onClick={() => setPicked(null)}
              style={{ marginLeft: 'auto', background: 'transparent', border: 0, color: 'var(--t3)', cursor: 'pointer' }}
            >← back</button>
          </div>

          <div className="fg">
            <label className="lbl">1. Which subject?</label>
            <PillSelect
              ariaLabel="Subject"
              value={subject}
              onChange={(v) => setSubject(v)}
              options={[
                { value: 'MATHEMATICS', label: 'Mathematics', icon: '📐' },
                { value: 'PHYSICAL_SCIENCES', label: 'Physical Sciences', icon: '⚗️' },
              ]}
            />
          </div>

          <div className="fg">
            <label className="lbl">2. Which grade?</label>
            <PillSelect
              ariaLabel="Grade"
              value={String(grade)}
              onChange={(v) => setGrade(Number(v))}
              options={tutorGrades.map((g) => ({ value: String(g), label: `Grade ${g}` }))}
            />
          </div>

          <div className="fg">
            <label className="lbl">3. Which topic?</label>
            <PillSelect
              ariaLabel="Topic"
              value={topic}
              onChange={setTopic}
              options={topics.map((t) => ({ value: t, label: t }))}
            />
          </div>

          <div className="fg">
            <label className="lbl">Pack title (optional)</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`${picked.emoji} ${picked.title} · ${topic}`}
            />
          </div>

          <div className="flex g1 mt2">
            <button className="btn ba wf" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn bg-btn wf" onClick={create} disabled={busy}>
              {busy ? 'Generating…' : `Create from template`}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
