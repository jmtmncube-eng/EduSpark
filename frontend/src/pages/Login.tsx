import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../services/api';
import { showToast } from '../components/Toast';
import Modal from '../components/Modal';
import type { User } from '../types';

const MOTIVATIONAL = [
  'Every question you answer brings you closer to your dreams. 🌟',
  'Great minds are built one study session at a time. 💪',
  'Maths opens every door. Science explains every wonder. 🚀',
  'Your hard work today is your success story tomorrow. 🏆',
  'Believe in yourself — your tutor already does. ✨',
];

const SUBJECTS = [
  { value: 'MATHEMATICS', label: '📐 Mathematics' },
  { value: 'PHYSICAL_SCIENCES', label: '⚗️ Physical Sciences' },
];

const SECURITY_QUESTIONS = [
  "What's the name of your first pet?",
  "What's your favourite band or artist?",
  "What primary school did you go to?",
  "What's the name of the street you grew up on?",
  "What's your favourite movie?",
  "What's your favourite sports team?",
  "What's the name of your best friend in primary school?",
];

type Stance = 'returning' | 'new';

export default function Login() {
  const [role, setRole] = useState<'student' | 'tutor' | 'admin'>('student');
  // ─── Account creation guard ────────────────────────────────────
  // 'returning' = PIN-only, no name lookup, no risk of creating duplicate account
  // 'new'       = name → registration flow (with explicit confirmation)
  const [stance, setStance] = useState<Stance>('returning');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);

  // Shared PIN reveal state
  const [newPin, setNewPin] = useState('');
  const [newName, setNewName] = useState('');
  const [pinCopied, setPinCopied] = useState(false);

  // ─── PIN recovery state ─────────────────────────────────────────
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [recoverStep, setRecoverStep] = useState<'name' | 'question' | 'reveal'>('name');
  const [recoverName, setRecoverName] = useState('');
  const [recoverQuestion, setRecoverQuestion] = useState('');
  const [recoverAnswer, setRecoverAnswer] = useState('');
  const [recoveredPin, setRecoveredPin] = useState('');
  const [recoverLoading, setRecoverLoading] = useState(false);

  // ─── Set-security-question prompt (after registration) ─────────
  const [securityPrompt, setSecurityPrompt] = useState(false);
  const [secQuestion, setSecQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [secCustom, setSecCustom] = useState('');
  const [secAnswer, setSecAnswer] = useState('');
  const [secSaving, setSecSaving] = useState(false);

  // Pre-create confirmation modal (the "are you sure you want a NEW account?" gate)
  const [confirmCreate, setConfirmCreate] = useState<null | { name: string; mode: 'student' | 'tutor' }>(null);

  // Student registration state
  const [gradeModal, setGradeModal] = useState(false);
  const [pendingName, setPendingName] = useState('');
  const [grade, setGrade] = useState('10');

  // Tutor profile state
  const [tutorModal, setTutorModal] = useState(false);
  const [pendingTutorName, setPendingTutorName] = useState('');
  const [tutorSubjects, setTutorSubjects] = useState<string[]>([]);
  const [tutorGrades, setTutorGrades] = useState<number[]>([]);

  const [theme, setTheme] = useState(() => localStorage.getItem('es_theme') || 'light');
  const { login } = useAuth();
  const navigate = useNavigate();
  const quote = MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)];

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('es_theme', next);
  }

  function toggleSubject(s: string) {
    setTutorSubjects((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }
  function toggleTutorGrade(g: number) {
    setTutorGrades((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
  }

  const isParentPin = (v: string) => /^PAR-/i.test(v);
  const isPin = (v: string) => /^(SPK|TCH|ADM|PAR)-/i.test(v);

  async function doLogin() {
    const trimmed = value.trim();
    if (!trimmed) { showToast('Please enter your name or PIN', 'warn'); return; }

    // PAR-XXXX always works regardless of stance
    if (/^PAR-[A-Z0-9]{4}$/i.test(trimmed)) {
      setLoading(true);
      try {
        const res = await auth.login(trimmed, 'student');
        const r = res as { token?: string; user?: User };
        if (r.token && r.user) { login(r.user, r.token); navigate('/app/dashboard'); }
      } catch (e: unknown) { showToast((e as Error).message || 'Invalid parent PIN', 'err'); }
      finally { setLoading(false); }
      return;
    }

    // ─── RETURNING USER GUARD ────────────────────────────────────
    // If stance is "returning", reject anything that's not a PIN — prevents accidental creation
    if (stance === 'returning' && !isPin(trimmed)) {
      showToast(
        role === 'admin' ? 'Admins sign in with a PIN only.'
          : 'Returning users sign in with their PIN. Switch to "I\'m new" if you don\'t have one yet.',
        'warn'
      );
      return;
    }

    setLoading(true);
    try {
      const res = await auth.login(trimmed, role);
      const r = res as { needsGrade?: boolean; needsProfile?: boolean; isNew?: boolean; token?: string; name?: string; user?: User };

      if (r.needsGrade) {
        // Backend confirmed: this is a NEW student name → require explicit confirmation
        setConfirmCreate({ name: r.name!, mode: 'student' });
      } else if (r.needsProfile) {
        setConfirmCreate({ name: r.name!, mode: 'tutor' });
      } else if (r.token && r.user) {
        login(r.user, r.token);
        navigate('/app/dashboard');
        showToast(`Welcome back, ${r.user.name}! 🎉`);
      }
    } catch (e: unknown) {
      showToast((e as Error).message || 'Login failed', 'err');
    } finally {
      setLoading(false);
    }
  }

  // After explicit "Yes, I'm new" confirmation → open the appropriate registration modal
  function proceedToRegistration() {
    if (!confirmCreate) return;
    if (confirmCreate.mode === 'student') {
      setPendingName(confirmCreate.name);
      setGradeModal(true);
    } else {
      setPendingTutorName(confirmCreate.name);
      setTutorSubjects([]);
      setTutorGrades([]);
      setTutorModal(true);
    }
    setConfirmCreate(null);
  }

  async function doRegisterStudent() {
    setLoading(true);
    try {
      const res = await auth.register(pendingName, Number(grade));
      const r = res as { token: string; user: User };
      login(r.user, r.token);
      setNewPin(r.user.pin || '');
      setNewName(pendingName);
      setGradeModal(false);
      setPinCopied(false);
    } catch (e: unknown) {
      showToast((e as Error).message || 'Registration failed', 'err');
    } finally {
      setLoading(false);
    }
  }

  async function doRegisterTutor() {
    if (tutorSubjects.length === 0) { showToast('Pick at least one subject', 'warn'); return; }
    if (tutorGrades.length === 0) { showToast('Pick at least one grade', 'warn'); return; }
    setLoading(true);
    try {
      const res = await auth.registerTutor(pendingTutorName, tutorSubjects, tutorGrades);
      const r = res as { token: string; user: User };
      login(r.user, r.token);
      setNewPin(r.user.pin || '');
      setNewName(pendingTutorName);
      setTutorModal(false);
      setPinCopied(false);
    } catch (e: unknown) {
      showToast((e as Error).message || 'Registration failed', 'err');
    } finally {
      setLoading(false);
    }
  }

  function copyPin() {
    navigator.clipboard?.writeText(newPin).then(() => {
      setPinCopied(true);
      showToast('PIN copied! Keep it safe 🔐', 'info');
    });
  }
  function confirmPinSaved() {
    if (!pinCopied) { showToast('Please copy your PIN first — you cannot sign in without it!', 'warn'); return; }
    setNewPin('');
    // Prompt for security question to enable PIN recovery later
    setSecurityPrompt(true);
  }

  function skipSecurity() {
    setSecurityPrompt(false);
    showToast('You can set a recovery question later in your profile.', 'info');
    navigate('/app/dashboard');
  }

  async function saveSecurity() {
    const finalQuestion = secQuestion === '__custom__' ? secCustom.trim() : secQuestion;
    if (!finalQuestion) { showToast('Pick a question or type your own.', 'warn'); return; }
    if (!secAnswer.trim() || secAnswer.trim().length < 2) { showToast('Answer is too short.', 'warn'); return; }
    setSecSaving(true);
    try {
      await auth.setSecurityQuestion(finalQuestion, secAnswer.trim());
      showToast('Recovery question saved 🔒', 'success');
      setSecurityPrompt(false);
      navigate('/app/dashboard');
    } catch (e) {
      showToast(String((e as Error).message), 'err');
    } finally { setSecSaving(false); }
  }

  // ─── Recovery flow ──────────────────────────────────────────────
  function openRecover() {
    setRecoverOpen(true);
    setRecoverStep('name');
    setRecoverName(value && !isPin(value) ? value : '');
    setRecoverQuestion('');
    setRecoverAnswer('');
    setRecoveredPin('');
  }

  async function doRecoverLookup() {
    if (!recoverName.trim()) { showToast('Enter the name you signed up with.', 'warn'); return; }
    if (role === 'admin') {
      showToast('Admins cannot self-recover. Ask another admin for help.', 'warn');
      return;
    }
    setRecoverLoading(true);
    try {
      const r = await auth.recoverLookup(recoverName.trim(), role);
      setRecoverQuestion(r.question);
      setRecoverStep('question');
    } catch (e) {
      showToast(String((e as Error).message), 'err');
    } finally { setRecoverLoading(false); }
  }

  async function doRecoverVerify() {
    if (!recoverAnswer.trim()) { showToast('Type your answer.', 'warn'); return; }
    setRecoverLoading(true);
    try {
      const r = await auth.recoverVerify(recoverName.trim(), role, recoverAnswer.trim());
      setRecoveredPin(r.pin);
      setRecoverStep('reveal');
    } catch (e) {
      showToast(String((e as Error).message), 'err');
    } finally { setRecoverLoading(false); }
  }

  function recoverDone() {
    // Auto-fill the PIN field so user can sign in immediately
    setValue(recoveredPin);
    setStance('returning');
    setRecoverOpen(false);
    showToast('PIN recovered — signed in below. Now save it!', 'success');
  }

  const placeholder =
    isParentPin(value) ? 'Enter your parent access code' :
    role === 'admin' ? 'Enter your admin PIN' :
    stance === 'returning'
      ? 'Enter your PIN'
      : 'Enter your full name to start setup';

  const hint =
    isParentPin(value) ? 'Parent access is temporary and view-only. No account creation.' :
    role === 'admin' ? 'Admin access requires a PIN. Contact the platform owner if locked out.' :
    stance === 'returning'
      ? '🔒 Returning sign-in. Only PINs are accepted — no risk of accidentally creating a new account.'
      : `⚠️ You're about to create a NEW ${role === 'tutor' ? 'tutor' : 'student'} account. Already signed in before? Switch to "I'm returning".`;

  return (
    <div id="login" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
      <button onClick={toggleTheme} style={{ position: 'fixed', top: 18, right: 18, zIndex: 10, background: 'rgba(255,255,255,.22)', backdropFilter: 'blur(12px)', border: '1.5px solid rgba(255,255,255,.45)', borderRadius: 12, padding: '8px 14px', cursor: 'pointer', fontSize: 18, lineHeight: 1, color: 'var(--t2)', boxShadow: '0 2px 12px rgba(0,0,0,.10)' }} title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
      <div className="lwrap glass-card">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <div className="logo-orb">🔬</div>
          <div className="brand-name">EduSpark</div>
          <div style={{ fontSize: 12, color: 'var(--t3)' }}>Maths and Science Learning Platform</div>
        </div>

        <div style={{ background: 'rgba(20,184,166,.08)', border: '1px solid rgba(20,184,166,.18)', borderRadius: 12, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: 'var(--t2)', textAlign: 'center', fontStyle: 'italic' }}>
          {quote}
        </div>

        {/* Role */}
        <div className="role-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {([
            { key: 'student', ico: '🎒', label: 'Student',  sub: 'Quizzes & practice' },
            { key: 'tutor',   ico: '📚', label: 'Tutor',    sub: 'Run a class' },
            { key: 'admin',   ico: '👨‍💼', label: 'Admin',    sub: 'Manage platform' },
          ] as const).map(({ key, ico, label, sub }) => (
            <div key={key} className={`role-card ${role === key ? 'active' : ''}`}
              onClick={() => { setRole(key); setValue(''); if (key === 'admin') setStance('returning'); }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{ico}</div>
              <div style={{ fontFamily: 'var(--fh)', fontSize: 14, fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Stance toggle — only meaningful for student / tutor */}
        {role !== 'admin' && (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14,
            padding: 4, background: 'rgba(0,0,0,.04)', borderRadius: 12, border: '1px solid var(--bd)',
          }}>
            <button
              onClick={() => { setStance('returning'); setValue(''); }}
              style={{
                padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                border: 0,
                background: stance === 'returning' ? 'var(--bg)' : 'transparent',
                boxShadow: stance === 'returning' ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                fontWeight: stance === 'returning' ? 700 : 500,
                fontSize: 12, color: 'var(--t)',
              }}
            >
              🔑 I'm returning (use PIN)
            </button>
            <button
              onClick={() => { setStance('new'); setValue(''); }}
              style={{
                padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                border: 0,
                background: stance === 'new' ? 'var(--bg)' : 'transparent',
                boxShadow: stance === 'new' ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                fontWeight: stance === 'new' ? 700 : 500,
                fontSize: 12, color: 'var(--t)',
              }}
            >
              ✨ I'm new (create account)
            </button>
          </div>
        )}

        <input
          type="text" className="l-in" autoComplete="off" spellCheck={false}
          placeholder={placeholder}
          value={value} onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doLogin()}
          style={{ letterSpacing: isPin(value) ? '.12em' : 'normal' }}
        />
        <p style={{
          fontSize: 11.5,
          color: stance === 'new' && role !== 'admin' ? '#d97706' : 'var(--t3)',
          marginBottom: 14, textAlign: 'center', fontWeight: stance === 'new' && role !== 'admin' ? 600 : 400,
        }}>
          {hint}
        </p>

        <button className="l-btn" onClick={doLogin} disabled={loading}>
          {loading ? 'Loading…' : stance === 'new' && role !== 'admin' ? '✨ Continue to setup' : '🔐 Sign In'}
        </button>

        {/* Forgot PIN — only meaningful for student/tutor returning */}
        {stance === 'returning' && role !== 'admin' && (
          <button
            onClick={openRecover}
            style={{
              background: 'transparent', border: 0, cursor: 'pointer',
              fontSize: 12, color: 'var(--p)', textDecoration: 'underline',
              marginTop: 10, padding: 4, width: '100%', fontWeight: 600,
            }}
          >
            🔓 Forgot your PIN? Recover it
          </button>
        )}

        {/* Why EduSpark — replaces the dev creds with something tasteful */}
        <div style={{
          marginTop: 22,
          padding: '14px 16px',
          background: 'linear-gradient(135deg, rgba(20,184,166,.07), rgba(14,165,233,.04))',
          border: '1px solid rgba(20,184,166,.18)',
          borderRadius: 14,
        }}>
          <div style={{
            fontFamily: 'var(--fh)', fontWeight: 800, fontSize: 12.5,
            color: 'var(--t2)', letterSpacing: '.08em', textTransform: 'uppercase',
            marginBottom: 10, textAlign: 'center',
          }}>
            Why EduSpark
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 8,
          }}>
            {[
              { ico: '📐', title: 'Maths & Physics', sub: 'Gr 10–12 · all the topics' },
              { ico: '🎯', title: 'SmartCoach',      sub: 'Personal next-best practice' },
              { ico: '📦', title: 'Content Packs',   sub: 'Curated by your teachers' },
              { ico: '📄', title: 'Branded PDFs',    sub: 'Worksheet + Memo exports' },
            ].map((c) => (
              <div key={c.title} style={{
                background: 'rgba(255,255,255,.5)',
                border: '1px solid var(--bd)',
                borderRadius: 10,
                padding: '8px 10px',
                display: 'flex', alignItems: 'center', gap: 8,
                minHeight: 50,
              }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{c.ico}</span>
                <div style={{ minWidth: 0, lineHeight: 1.2 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t)' }}>{c.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--t3)' }}>{c.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, flexWrap: 'wrap',
          }}>
            {['CAPS', 'IEB', 'NSC', 'Cambridge'].map((c) => (
              <span key={c} style={{
                fontSize: 10, fontWeight: 700, padding: '3px 10px',
                background: 'rgba(20,184,166,.10)', color: 'var(--p)',
                border: '1px solid rgba(20,184,166,.28)',
                borderRadius: 99, letterSpacing: '.04em',
              }}>{c}</span>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 10.5, color: 'var(--t4)', textAlign: 'center', marginTop: 12 }}>
          Maths &amp; Physical Sciences · Built for South African learners
        </div>

        {/* Athera attribution — mirrors the resihub footer pattern */}
        <div style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: '1px solid var(--bd)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          fontSize: 11,
          color: 'var(--t3)',
        }}>
          <span>Built by</span>
          <a
            href="https://athera.co.za"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 99,
              background: 'rgba(20,184,166,.10)',
              border: '1px solid rgba(20,184,166,.25)',
              color: 'var(--p)',
              fontWeight: 700,
              letterSpacing: '.02em',
              textDecoration: 'none',
              transition: 'background .15s, border-color .15s',
            }}
            onMouseOver={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(20,184,166,.18)'; }}
            onMouseOut={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(20,184,166,.10)'; }}
          >
            <span style={{ fontSize: 13 }}>🜲</span>
            Athera
          </a>
        </div>
      </div>

      {/* ─── Explicit "create new account?" confirmation ─────────── */}
      {confirmCreate && (
        <Modal title="🛑 Create a new account?" onClose={() => setConfirmCreate(null)}>
          <div style={{ textAlign: 'center', padding: '4px 0 12px' }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>🤔</div>
            <p className="sm ct2" style={{ marginBottom: 6 }}>
              We couldn't find an existing account for <strong>{confirmCreate.name}</strong>.
            </p>
            <div style={{
              background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.35)',
              borderRadius: 10, padding: '10px 12px', textAlign: 'left', fontSize: 12.5, marginTop: 10,
            }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠️ Before you continue:</div>
              <ul style={{ margin: '4px 0 0 18px', padding: 0, lineHeight: 1.5 }}>
                <li>Did you sign in before with a different spelling? <strong>Cancel</strong> and try your <strong>PIN</strong> instead.</li>
                <li>Names are case-insensitive but spaces and spelling matter.</li>
                <li>If you confirm, a brand new account is created and you'll get a permanent PIN.</li>
              </ul>
            </div>
          </div>
          <div className="flex g1 mt2">
            <button className="btn ba wf" onClick={() => setConfirmCreate(null)}>← I'll try my PIN</button>
            <button className="btn bg-btn wf" onClick={proceedToRegistration}>
              ✨ Yes, create new account
            </button>
          </div>
        </Modal>
      )}

      {/* Grade picker — new students */}
      {gradeModal && (
        <Modal title={`👋 Welcome, ${pendingName}!`} onClose={() => setGradeModal(false)}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🎓</div>
            <p className="sm ct2">Let's set up your account.</p>
            <p className="sm" style={{ color: 'var(--p)', fontWeight: 600, marginTop: 4 }}>
              You'll get a permanent PIN after this step — write it down!
            </p>
          </div>

          <div className="fg">
            <label className="lbl">Grade</label>
            <select className="select" value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="10">Grade 10</option>
              <option value="11">Grade 11</option>
              <option value="12">Grade 12</option>
            </select>
            <div className="xs ct3 mt1">Content follows the SA CAPS curriculum for Maths &amp; Physical Sciences.</div>
          </div>

          <div className="flex g1 mt2">
            <button className="btn ba wf" onClick={() => setGradeModal(false)}>Cancel</button>
            <button className="btn bg-btn wf" onClick={doRegisterStudent} disabled={loading}>{loading ? '…' : '🚀 Create my account'}</button>
          </div>
        </Modal>
      )}

      {/* Tutor profile */}
      {tutorModal && (
        <Modal title={`📚 Welcome, ${pendingTutorName}!`} onClose={() => setTutorModal(false)}>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 44, marginBottom: 6 }}>📚</div>
            <p className="sm ct2">Set up your tutor profile so we can pair you with the right students.</p>
          </div>

          <div className="fg mb2">
            <label className="lbl">Subjects you teach</label>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              {SUBJECTS.map(({ value: sv, label: sl }) => (
                <label key={sv} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', border: `2px solid ${tutorSubjects.includes(sv) ? 'var(--p)' : 'var(--bd)'}`, borderRadius: 10, cursor: 'pointer', background: tutorSubjects.includes(sv) ? 'rgba(20,184,166,.08)' : 'transparent', fontSize: 13, fontWeight: 600 }}>
                  <input type="checkbox" checked={tutorSubjects.includes(sv)} onChange={() => toggleSubject(sv)} style={{ display: 'none' }} />
                  <span style={{ fontSize: 20 }}>{tutorSubjects.includes(sv) ? '✅' : '⬜'}</span>
                  {sl}
                </label>
              ))}
            </div>
          </div>

          <div className="fg mb2">
            <label className="lbl">Grades you teach</label>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              {[10, 11, 12].map((g) => (
                <label key={g} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 8px', border: `2px solid ${tutorGrades.includes(g) ? 'var(--p)' : 'var(--bd)'}`, borderRadius: 10, cursor: 'pointer', background: tutorGrades.includes(g) ? 'rgba(20,184,166,.08)' : 'transparent', fontSize: 13, fontWeight: 700 }}>
                  <input type="checkbox" checked={tutorGrades.includes(g)} onChange={() => toggleTutorGrade(g)} style={{ display: 'none' }} />
                  <span style={{ fontSize: 18 }}>{tutorGrades.includes(g) ? '✅' : '⬜'}</span>
                  Grade {g}
                </label>
              ))}
            </div>
          </div>

          <div className="flex g1">
            <button className="btn ba wf" onClick={() => setTutorModal(false)}>Cancel</button>
            <button className="btn bg-btn wf" onClick={doRegisterTutor} disabled={loading}>{loading ? '…' : '🚀 Create my account'}</button>
          </div>
        </Modal>
      )}

      {/* PIN reveal */}
      {newPin && (
        <Modal title={newPin.startsWith('TCH') ? '📚 Tutor Account Created!' : '🎉 Account Created!'} onClose={() => {}}>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 42, marginBottom: 6 }}>{newPin.startsWith('TCH') ? '📚' : '🔐'}</div>
            <h3 className="fh" style={{ fontSize: 19, marginBottom: 4 }}>Your Permanent PIN</h3>
            <p className="sm ct2">
              {newPin.startsWith('TCH')
                ? 'This PIN is how you sign in as a Tutor. Save it — it cannot be recovered without an Admin!'
                : 'This is the only way to access your account. Your tutor cannot see it. Write it down now!'}
            </p>
          </div>

          <div className="pin-reveal-card" onClick={copyPin}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', letterSpacing: '.1em', marginBottom: 6 }}>
              {newPin.startsWith('TCH') ? 'TUTOR PIN FOR' : 'PIN CODE FOR'} {newName.toUpperCase()}
            </div>
            <div className="pin-big">{newPin}</div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>
              {pinCopied ? '✅ Copied to clipboard!' : '👆 Tap to copy'}
            </div>
          </div>

          <div style={{ background: 'rgba(251,191,36,.1)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 10, padding: '10px 14px', margin: '14px 0', fontSize: 12.5 }}>
            ⚠️ <strong>Important:</strong> From now on, sign in using <strong>this PIN</strong>. Your name alone will not work. Save it somewhere safe!
          </div>

          <button className={`btn wf mt1 ${pinCopied ? 'bg-btn' : 'ba'}`} style={{ justifyContent: 'center' }} onClick={confirmPinSaved}>
            {pinCopied ? "✅ I've saved my PIN — Continue" : '📋 Copy PIN First'}
          </button>
        </Modal>
      )}

      {/* ─── Set security question (right after PIN reveal) ─────── */}
      {securityPrompt && (
        <Modal title="🔒 Set a recovery question" onClose={() => {}}>
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 36, marginBottom: 6 }}>🛟</div>
            <p className="sm ct2">
              Pick a question only <strong>you</strong> know the answer to. If you ever forget your PIN,
              this is how you'll recover it.
            </p>
            <p className="xs ct3 mt1">Your answer is stored encrypted — even admins can't see it.</p>
          </div>

          <label className="lbl">Question</label>
          <select
            className="select"
            value={secQuestion}
            onChange={(e) => setSecQuestion(e.target.value)}
          >
            {SECURITY_QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
            <option value="__custom__">✏️ Write my own question</option>
          </select>

          {secQuestion === '__custom__' && (
            <div className="fg mt2">
              <input
                className="input"
                value={secCustom}
                onChange={(e) => setSecCustom(e.target.value)}
                placeholder="e.g. What's my grandmother's first name?"
                maxLength={200}
              />
            </div>
          )}

          <div className="fg mt2">
            <label className="lbl">Your answer</label>
            <input
              type="text"
              className="input"
              value={secAnswer}
              onChange={(e) => setSecAnswer(e.target.value)}
              placeholder="Something specific only you know"
              autoComplete="off"
            />
            <div className="xs ct3 mt1">Case &amp; spacing don't matter. Keep it short and memorable.</div>
          </div>

          <div className="flex g1 mt2">
            <button className="btn ba wf" onClick={skipSecurity}>Skip for now</button>
            <button className="btn bg-btn wf" onClick={saveSecurity} disabled={secSaving}>
              {secSaving ? '…' : '🔒 Save & continue'}
            </button>
          </div>
        </Modal>
      )}

      {/* ─── PIN recovery flow ────────────────────────────────── */}
      {recoverOpen && (
        <Modal title="🔓 Recover your PIN" onClose={() => setRecoverOpen(false)}>
          {recoverStep === 'name' && (
            <>
              <p className="sm ct2 mb2">
                Enter the name you signed up with. We'll ask the security question you chose
                at registration.
              </p>
              <div className="fg">
                <label className="lbl">Your full name</label>
                <input
                  className="input"
                  value={recoverName}
                  onChange={(e) => setRecoverName(e.target.value)}
                  placeholder={role === 'tutor' ? 'e.g. Moses Maharaj' : 'e.g. Zanele Mokoena'}
                  onKeyDown={(e) => e.key === 'Enter' && doRecoverLookup()}
                />
              </div>
              <div className="flex g1 mt2">
                <button className="btn ba wf" onClick={() => setRecoverOpen(false)}>Cancel</button>
                <button className="btn bg-btn wf" onClick={doRecoverLookup} disabled={recoverLoading}>
                  {recoverLoading ? '…' : 'Continue →'}
                </button>
              </div>
            </>
          )}

          {recoverStep === 'question' && (
            <>
              <div style={{
                background: 'rgba(14,165,233,.08)', border: '1px solid rgba(14,165,233,.25)',
                borderRadius: 10, padding: '12px 14px', marginBottom: 14,
              }}>
                <div className="xs ct3 mb1">Your recovery question:</div>
                <div className="sm bold">{recoverQuestion}</div>
              </div>
              <div className="fg">
                <label className="lbl">Your answer</label>
                <input
                  className="input"
                  value={recoverAnswer}
                  onChange={(e) => setRecoverAnswer(e.target.value)}
                  placeholder="Answer exactly as you set it"
                  autoComplete="off"
                  onKeyDown={(e) => e.key === 'Enter' && doRecoverVerify()}
                />
                <div className="xs ct3 mt1">Case &amp; spacing don't matter.</div>
              </div>
              <div className="flex g1 mt2">
                <button className="btn ba wf" onClick={() => setRecoverStep('name')}>← Back</button>
                <button className="btn bg-btn wf" onClick={doRecoverVerify} disabled={recoverLoading}>
                  {recoverLoading ? '…' : '🔍 Verify'}
                </button>
              </div>
            </>
          )}

          {recoverStep === 'reveal' && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 36 }}>🎉</div>
                <h3 className="fh" style={{ fontSize: 18, marginTop: 8 }}>Recovered!</h3>
                <p className="sm ct2">Here is your sign-in PIN. Write it down somewhere safe.</p>
              </div>
              <div className="pin-reveal-card" onClick={() => navigator.clipboard?.writeText(recoveredPin)}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', letterSpacing: '.1em', marginBottom: 6 }}>
                  YOUR PIN
                </div>
                <div className="pin-big">{recoveredPin}</div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>👆 Tap to copy</div>
              </div>
              <button className="btn bg-btn wf mt2" style={{ justifyContent: 'center' }} onClick={recoverDone}>
                ✅ Done — take me back to sign in
              </button>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
