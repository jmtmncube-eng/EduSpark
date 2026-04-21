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

export default function Login() {
  const [role, setRole] = useState<'student' | 'tutor' | 'admin'>('student');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);

  // Shared PIN reveal state (students + tutors)
  const [newPin, setNewPin] = useState('');
  const [newName, setNewName] = useState('');
  const [pinCopied, setPinCopied] = useState(false);

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

  async function doLogin() {
    const trimmed = value.trim();
    if (!trimmed) { showToast('Please enter your name or PIN', 'warn'); return; }
    // PAR-XXXX: parent access — bypass role selection entirely
    if (/^PAR-[A-Z0-9]{4}$/i.test(trimmed)) {
      setLoading(true);
      try {
        const res = await auth.login(trimmed, 'student'); // role ignored by backend for PAR-
        const r = res as { token?: string; user?: User };
        if (r.token && r.user) {
          login(r.user, r.token);
          navigate('/app/dashboard');
        }
      } catch (e: unknown) { showToast((e as Error).message || 'Invalid parent PIN', 'err'); }
      finally { setLoading(false); }
      return;
    }
    setLoading(true);
    try {
      const res = await auth.login(trimmed, role);
      const r = res as { needsGrade?: boolean; needsProfile?: boolean; isNew?: boolean; token?: string; name?: string; user?: User };

      if (r.needsGrade) {
        setPendingName(r.name!);
        setGradeModal(true);
      } else if (r.needsProfile) {
        // New tutor — collect subjects + grades
        setPendingTutorName(r.name!);
        setTutorSubjects([]);
        setTutorGrades([]);
        setTutorModal(true);
      } else if (r.isNew && r.token) {
        // Shouldn't reach here in normal flow, but handle gracefully
        login(r.user!, r.token);
        setNewPin(r.user!.pin || '');
        setNewName(r.user!.name);
        setPinCopied(false);
      } else if (r.token) {
        login(r.user!, r.token);
        navigate('/app/dashboard');
        showToast(`Welcome back, ${r.user!.name}! 🎉`);
      }
    } catch (e: unknown) {
      showToast((e as Error).message || 'Login failed', 'err');
    } finally {
      setLoading(false);
    }
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
    if (tutorSubjects.length === 0) { showToast('Select at least one subject', 'warn'); return; }
    if (tutorGrades.length === 0) { showToast('Select at least one grade', 'warn'); return; }
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
    navigate('/app/dashboard');
    setNewPin('');
  }

  const isParentPin = (v: string) => /^PAR-/i.test(v);
  const isPin = (v: string) => /^(SPK|TCH|ADM|PAR)-/i.test(v);

  const placeholder =
    isParentPin(value) ? 'Enter parent access code (PAR-XXXX)' :
    role === 'admin' ? 'Enter your PIN (e.g. ADM-XXXX)' :
    role === 'tutor' ? 'Enter your name or PIN (TCH-XXXX)' :
    'Enter your PIN (SPK-XXXX) or your name';

  const hint =
    isParentPin(value) ? 'Parent access is temporary and view-only. No account creation needed.' :
    role === 'admin' ? 'Admin access requires a PIN. Contact the platform owner if locked out.' :
    role === 'tutor' ? 'New tutor? Enter your name to create an account. Returning? Use your TCH-XXXX PIN.' :
    'Returning student? Enter your SPK-XXXX PIN. First time? Enter your name.';

  return (
    <div id="login" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
      <button onClick={toggleTheme} style={{ position: 'fixed', top: 18, right: 18, zIndex: 10, background: 'rgba(255,255,255,.22)', backdropFilter: 'blur(12px)', border: '1.5px solid rgba(255,255,255,.45)', borderRadius: 12, padding: '8px 14px', cursor: 'pointer', fontSize: 18, lineHeight: 1, color: 'var(--t2)', transition: 'all .25s', boxShadow: '0 2px 12px rgba(0,0,0,.10)' }} title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
      <div className="lwrap glass-card">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 26 }}>
          <div className="logo-orb">🔬</div>
          <div className="brand-name">EduSpark</div>
          <div style={{ fontSize: 12, color: 'var(--t3)' }}>Maths and Science Learning Platform</div>
        </div>

        <div style={{ background: 'rgba(20,184,166,.08)', border: '1px solid rgba(20,184,166,.18)', borderRadius: 12, padding: '10px 14px', marginBottom: 22, fontSize: 12.5, color: 'var(--t2)', textAlign: 'center', fontStyle: 'italic' }}>
          {quote}
        </div>

        <div className="role-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {([
            { key: 'student', ico: '🎒', label: 'Student',  sub: 'SPK-XXXX' },
            { key: 'tutor',   ico: '📚', label: 'Tutor',    sub: 'TCH-XXXX' },
            { key: 'admin',   ico: '👨‍💼', label: 'Admin',    sub: 'ADM-XXXX' },
          ] as const).map(({ key, ico, label, sub }) => (
            <div key={key} className={`role-card ${role === key ? 'active' : ''}`} onClick={() => { setRole(key); setValue(''); }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{ico}</div>
              <div style={{ fontFamily: 'var(--fh)', fontSize: 14, fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{sub}</div>
            </div>
          ))}
        </div>

        <input
          type="text" className="l-in" autoComplete="off" spellCheck={false}
          placeholder={placeholder}
          value={value} onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doLogin()}
          style={{ letterSpacing: isPin(value) ? '.12em' : 'normal' }}
        />
        <p style={{ fontSize: 11.5, color: 'var(--t3)', marginBottom: 14, textAlign: 'center' }}>{hint}</p>

        <button className="l-btn" onClick={doLogin} disabled={loading}>
          {loading ? 'Loading…' : '🔐 Sign In'}
        </button>
        <div style={{ fontSize: 11, color: 'var(--t4)', textAlign: 'center' }}>Mathematics &amp; Physical Sciences · CAPS Aligned</div>
      </div>

      {/* Grade picker — new students */}
      {gradeModal && (
        <Modal title={`👋 Welcome, ${pendingName}!`} onClose={() => setGradeModal(false)}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🎓</div>
            <p className="sm ct2">You're new here — let's create your account.</p>
            <p className="sm" style={{ color: 'var(--p)', fontWeight: 600, marginTop: 4 }}>You'll get a unique PIN after this step. Write it down!</p>
          </div>
          <div className="fg">
            <label className="lbl">What grade are you in?</label>
            <select className="select" value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="10">Grade 10</option>
              <option value="11">Grade 11</option>
              <option value="12">Grade 12</option>
            </select>
          </div>
          <div className="flex g1 mt1">
            <button className="btn bp" onClick={doRegisterStudent} disabled={loading}>{loading ? '…' : '🚀 Create My Account'}</button>
            <button className="btn bg-btn" onClick={() => setGradeModal(false)}>Cancel</button>
          </div>
        </Modal>
      )}

      {/* Tutor profile — new tutors: subjects + grades */}
      {tutorModal && (
        <Modal title={`📚 Welcome, ${pendingTutorName}!`} onClose={() => setTutorModal(false)}>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 44, marginBottom: 6 }}>📚</div>
            <p className="sm ct2">Let's set up your tutor profile. This helps us pair you with the right students.</p>
          </div>

          <div className="fg mb2">
            <label className="lbl">What subjects do you teach?</label>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              {SUBJECTS.map(({ value: sv, label: sl }) => (
                <label key={sv} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', border: `2px solid ${tutorSubjects.includes(sv) ? 'var(--p)' : 'var(--bd)'}`, borderRadius: 10, cursor: 'pointer', background: tutorSubjects.includes(sv) ? 'rgba(20,184,166,.08)' : 'transparent', transition: 'all .18s', fontSize: 13, fontWeight: 600 }}>
                  <input type="checkbox" checked={tutorSubjects.includes(sv)} onChange={() => toggleSubject(sv)} style={{ display: 'none' }} />
                  <span style={{ fontSize: 20 }}>{tutorSubjects.includes(sv) ? '✅' : '⬜'}</span>
                  {sl}
                </label>
              ))}
            </div>
          </div>

          <div className="fg mb2">
            <label className="lbl">What grades do you teach?</label>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              {[10, 11, 12].map((g) => (
                <label key={g} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 8px', border: `2px solid ${tutorGrades.includes(g) ? 'var(--p)' : 'var(--bd)'}`, borderRadius: 10, cursor: 'pointer', background: tutorGrades.includes(g) ? 'rgba(20,184,166,.08)' : 'transparent', transition: 'all .18s', fontSize: 13, fontWeight: 700 }}>
                  <input type="checkbox" checked={tutorGrades.includes(g)} onChange={() => toggleTutorGrade(g)} style={{ display: 'none' }} />
                  <span style={{ fontSize: 18 }}>{tutorGrades.includes(g) ? '✅' : '⬜'}</span>
                  Grade {g}
                </label>
              ))}
            </div>
          </div>

          <div style={{ background: 'rgba(20,184,166,.06)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--t3)', marginBottom: 16 }}>
            💡 This info is used to recommend students whose subjects and grades match your teaching profile.
          </div>

          <div className="flex g1">
            <button className="btn bp" onClick={doRegisterTutor} disabled={loading}>{loading ? '…' : '🚀 Create My Account'}</button>
            <button className="btn bg-btn" onClick={() => setTutorModal(false)}>Cancel</button>
          </div>
        </Modal>
      )}

      {/* PIN reveal — students + tutors */}
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

          <button className={`btn wf mt1 ${pinCopied ? 'bp' : 'ba'}`} style={{ justifyContent: 'center' }} onClick={confirmPinSaved}>
            {pinCopied ? "✅ I've saved my PIN — Let's Go!" : '📋 Copy PIN First'}
          </button>
        </Modal>
      )}
    </div>
  );
}
