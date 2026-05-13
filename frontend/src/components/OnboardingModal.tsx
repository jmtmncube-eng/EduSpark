import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { onboarding as onbApi } from '../services/api';
import Modal from './Modal';

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
    { id: 'admin_pack',   ico: '📦', title: 'Create your first Content Pack', body: 'Bundle questions and PDFs into a pack to share with tutors.', cta: 'Open Packs', link: '/app/packs' },
    { id: 'admin_pdf',    ico: '📄', title: 'Upload a practice PDF',          body: 'Add past papers or notes for tutors to share with students.',     cta: 'PDF Library', link: '/app/library' },
    { id: 'admin_tutor',  ico: '👩‍🏫', title: 'Approve a tutor request',         body: 'Pair tutors with students so they can manage their classes.',    cta: 'Tutors',      link: '/app/tutors' },
  ],
  TUTOR: [
    { id: 'tutor_request', ico: '🙋', title: 'Request a student',              body: 'Find students by name and request to add them to your class.',   cta: 'Students',    link: '/app/students' },
    { id: 'tutor_library', ico: '📦', title: 'Open your shared library',       body: 'Admin shares Content Packs with you — preview them here.',       cta: 'Library',     link: '/app/library' },
    { id: 'tutor_unlock',  ico: '🔓', title: 'Unlock a pack for a student',    body: 'Choose what each student practices by unlocking packs.',         cta: 'Library',     link: '/app/library' },
    { id: 'tutor_assign',  ico: '📋', title: 'Create your first assignment',   body: 'Pick questions from your library and set a due date.',          cta: 'Assignments', link: '/app/assignments' },
  ],
  STUDENT: [
    { id: 'student_pin',      ico: '🔑', title: 'Save your PIN somewhere safe',     body: 'You use this PIN every time you sign in.',                         cta: 'Profile',     link: '/app/dashboard' },
    { id: 'student_practice', ico: '📚', title: 'Try a practice quiz',              body: 'Practice the topics your tutor has unlocked for you.',             cta: 'Practice',    link: '/app/practice' },
    { id: 'student_work',     ico: '📋', title: 'Open your first assignment',       body: 'Complete assignments before the due date to earn XP.',             cta: 'My Work',     link: '/app/my-work' },
  ],
};

/**
 * Shown once per fresh login session — a modal "Get started" prompt for new users.
 *
 * Suppression rules:
 *   • `dismissed` on the server (user clicked ✕) → never show again
 *   • all steps completed → never show again
 *   • already shown this browser tab session → not shown again until next login
 */
export default function OnboardingModal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [completed, setCompleted] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Suppress on subsequent dashboard visits within the same browser session
    const sessionFlag = `es_onb_shown_${user.id}`;
    const shownThisSession = sessionStorage.getItem(sessionFlag) === '1';

    onbApi.get()
      .then((s) => {
        const role = user.role as keyof typeof STEPS;
        const steps = STEPS[role];
        const done = (s.completedSteps || []).filter((id) => steps?.some((step) => step.id === id));
        const allDone = !steps || done.length >= steps.length;
        setCompleted(s.completedSteps || []);

        // Open if not dismissed, not all-done, and not already shown this session
        if (!s.dismissed && !allDone && !shownThisSession) {
          setOpen(true);
          sessionStorage.setItem(sessionFlag, '1');
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [user]);

  if (!loaded || !user || !open) return null;
  const role = user.role as keyof typeof STEPS;
  const steps = STEPS[role];
  if (!steps) return null;

  const done = steps.filter((s) => completed.includes(s.id)).length;
  const pct = Math.round((done / steps.length) * 100);

  async function markStep(stepId: string, link: string) {
    if (!completed.includes(stepId)) {
      try { await onbApi.patch({ step: stepId }); } catch { /* ignore */ }
      setCompleted((c) => [...c, stepId]);
    }
    setOpen(false);
    navigate(link);
  }

  async function dismiss() {
    try { await onbApi.patch({ dismissed: true }); } catch { /* ignore */ }
    setOpen(false);
  }

  async function laterReminder() {
    // Don't dismiss permanently — just close for this session
    setOpen(false);
  }

  const intro =
    role === 'ADMIN'   ? 'Get your platform set up so tutors and students can hit the ground running.'
    : role === 'TUTOR' ? 'Welcome! Three quick steps to get your class learning.'
    : 'Welcome! Three quick steps to get going.';

  return (
    <Modal title={`🚀 Welcome, ${user.name.split(' ')[0]}!`} onClose={laterReminder}>
      <p className="sm ct2 mb2" style={{ marginTop: -4 }}>{intro}</p>

      {/* Progress bar */}
      <div style={{
        height: 8, background: 'var(--bd)', borderRadius: 99, overflow: 'hidden', marginBottom: 14,
      }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: 'linear-gradient(90deg, var(--p), #34D399)',
          transition: 'width .3s',
        }} />
      </div>
      <div className="xs ct3" style={{ textAlign: 'center', marginTop: -8, marginBottom: 14 }}>
        {done} of {steps.length} done · {pct}%
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {steps.map((s) => {
          const isDone = completed.includes(s.id);
          return (
            <div
              key={s.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 12,
                background: isDone ? 'rgba(34,197,94,.06)' : 'rgba(20,184,166,.05)',
                border: `1px solid ${isDone ? 'rgba(34,197,94,.25)' : 'var(--bd)'}`,
                opacity: isDone ? 0.7 : 1,
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: isDone ? '#22c55e' : 'var(--bg)',
                border: `2px solid ${isDone ? '#22c55e' : 'var(--p)'}`,
                color: isDone ? '#fff' : 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, flexShrink: 0,
              }}>
                {isDone ? '✓' : s.ico}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, textDecoration: isDone ? 'line-through' : 'none' }}>{s.title}</div>
                <div className="xs ct3" style={{ marginTop: 2, lineHeight: 1.4 }}>{s.body}</div>
              </div>
              {!isDone && (
                <button className="btn bg-btn btn-sm" onClick={() => markStep(s.id, s.link)} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                  {s.cta} →
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex g1 mt2" style={{ marginTop: 16 }}>
        <button className="btn ba wf" onClick={dismiss}>Don't show again</button>
        <button className="btn bg-btn wf" onClick={laterReminder}>Remind me next sign-in</button>
      </div>
    </Modal>
  );
}
