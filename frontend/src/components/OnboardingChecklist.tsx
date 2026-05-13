import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { onboarding as onbApi } from '../services/api';

interface Step {
  id: string;
  title: string;
  body: string;
  cta: string;
  link: string;
  ico: string;
}

const STEPS: Record<'ADMIN' | 'TUTOR' | 'STUDENT', Step[]> = {
  ADMIN: [
    { id: 'admin_pack',   ico: '📦', title: 'Create your first Content Pack', body: 'Bundle questions and PDFs into a pack to share with tutors.', cta: 'Go to Packs',   link: '/app/packs' },
    { id: 'admin_pdf',    ico: '📄', title: 'Upload a practice PDF',          body: 'Add past papers or notes for tutors to share with students.',     cta: 'PDF Library',   link: '/app/library' },
    { id: 'admin_tutor',  ico: '👩‍🏫', title: 'Approve a tutor request',         body: 'Pair tutors with students so they can manage their classes.',    cta: 'Manage Tutors', link: '/app/tutors' },
  ],
  TUTOR: [
    { id: 'tutor_request', ico: '🙋', title: 'Request a student',              body: 'Find students by name and request to add them to your class.',   cta: 'My Students', link: '/app/students' },
    { id: 'tutor_library', ico: '📦', title: 'Open your shared library',       body: 'Admin shares Content Packs with you — preview them here.',       cta: 'Library',     link: '/app/library' },
    { id: 'tutor_unlock',  ico: '🔓', title: 'Unlock a pack for a student',    body: 'Choose what each student practices by unlocking packs.',         cta: 'Library',     link: '/app/library' },
    { id: 'tutor_assign',  ico: '📋', title: 'Create your first assignment',   body: 'Pick questions from your library and set a due date.',          cta: 'Assignments', link: '/app/assignments' },
  ],
  STUDENT: [
    { id: 'student_pin',      ico: '🔑', title: 'Save your PIN somewhere safe',     body: 'You use this PIN every time you sign in.',                         cta: 'View profile', link: '/app/dashboard' },
    { id: 'student_practice', ico: '📚', title: 'Try a practice quiz',              body: 'Practice the topics your tutor has unlocked for you.',             cta: 'Practice',     link: '/app/practice' },
    { id: 'student_work',     ico: '📋', title: 'Open your first assignment',       body: 'Complete assignments before the due date to earn XP.',             cta: 'My Work',      link: '/app/my-work' },
  ],
};

export default function OnboardingChecklist() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [completed, setCompleted] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    onbApi.get()
      .then((s) => { setCompleted(s.completedSteps || []); setDismissed(s.dismissed); })
      .catch(() => {});
  }, []);

  if (!user || dismissed) return null;
  const role = user.role as keyof typeof STEPS;
  const steps = STEPS[role];
  if (!steps) return null;

  const done = steps.filter((s) => completed.includes(s.id)).length;
  const pct = Math.round((done / steps.length) * 100);
  if (done === steps.length) return null; // hide when fully done

  async function markStep(stepId: string, link: string) {
    if (!completed.includes(stepId)) {
      try { await onbApi.patch({ step: stepId }); } catch { /* ignore */ }
      setCompleted((c) => [...c, stepId]);
    }
    navigate(link);
  }

  async function dismiss() {
    try { await onbApi.patch({ dismissed: true }); } catch { /* ignore */ }
    setDismissed(true);
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(20,184,166,.08), rgba(14,165,233,.05))',
      border: '1px solid var(--bd)', borderRadius: 14, padding: collapsed ? 12 : 18,
      marginBottom: 18,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: collapsed ? 0 : 10, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 22 }}>🚀</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: 'var(--fh)', fontWeight: 800, fontSize: 14 }}>
              Get started · {done} of {steps.length} done
            </div>
            <div style={{
              marginTop: 4, height: 6, background: 'var(--bd)', borderRadius: 99, overflow: 'hidden',
            }}>
              <div style={{
                width: `${pct}%`, height: '100%',
                background: 'linear-gradient(90deg, var(--p), #34D399)',
                transition: 'width .3s',
              }} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className="btn ba btn-sm"
            onClick={() => setCollapsed((v) => !v)}
            style={{ fontSize: 11 }}
            aria-label={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '▾' : '▴'}
          </button>
          <button
            className="btn ba btn-sm"
            onClick={dismiss}
            style={{ fontSize: 11 }}
            title="Hide forever"
          >
            ✕
          </button>
        </div>
      </div>

      {!collapsed && (
        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          {steps.map((s) => {
            const isDone = completed.includes(s.id);
            return (
              <div
                key={s.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  background: isDone ? 'rgba(34,197,94,.06)' : 'rgba(255,255,255,.4)',
                  border: '1px solid var(--bd)',
                  opacity: isDone ? 0.7 : 1,
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: isDone ? '#22c55e' : 'var(--bd)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, flexShrink: 0,
                }}>
                  {isDone ? '✓' : s.ico}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, textDecoration: isDone ? 'line-through' : 'none' }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>{s.body}</div>
                </div>
                {!isDone && (
                  <button className="btn bg-btn btn-sm" onClick={() => markStep(s.id, s.link)} style={{ fontSize: 11 }}>
                    {s.cta} →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
