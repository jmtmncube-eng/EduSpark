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
  'Believe in yourself — your teacher already does. ✨',
];

export default function Login() {
  const [role, setRole] = useState<'student' | 'tutor' | 'admin'>('student');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [newName, setNewName] = useState('');
  const [pinCopied, setPinCopied] = useState(false);
  const [gradeModal, setGradeModal] = useState(false);
  const [pendingName, setPendingName] = useState('');
  const [grade, setGrade] = useState('10');
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

  async function doLogin() {
    const trimmed = value.trim();
    if (!trimmed) { showToast('Please enter your name or PIN', 'warn'); return; }
    setLoading(true);
    try {
      const res = await auth.login(trimmed, role);
      if ((res as { needsGrade?: boolean }).needsGrade) {
        setPendingName((res as { name: string }).name);
        setGradeModal(true);
      } else if ((res as { token?: string }).token) {
        login((res as { user: User }).user, (res as { token: string }).token);
        navigate('/app/dashboard');
        const name = (res as { user: User }).user.name;
        showToast(`Welcome back, ${name}! 🎉`);
      }
    } catch (e: unknown) {
      showToast((e as Error).message || 'Login failed', 'err');
    } finally {
      setLoading(false);
    }
  }

  async function doRegister() {
    setLoading(true);
    try {
      const res = await auth.register(pendingName, Number(grade));
      login((res as { user: User }).user, (res as { token: string }).token);
      const pin = (res as { user: User }).user.pin || '';
      setNewPin(pin);
      setNewName(pendingName);
      setGradeModal(false);
      // Don't navigate yet — let them see + save their PIN first
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
    if (!pinCopied) {
      showToast('Please copy your PIN first — you cannot recover it without your teacher!', 'warn');
      return;
    }
    navigate('/app/dashboard');
    setNewPin('');
  }

  const placeholder = role === 'student' ? 'Enter your PIN (e.g. SPK-A1B2)' : 'Enter your name';
  const hint = role === 'student'
    ? 'New student? Enter your name to create an account.'
    : role === 'tutor'
    ? 'Enter your name to access your teacher dashboard.'
    : 'Enter your name for full platform access.';

  return (
    <div id="login" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
      {/* Theme toggle — top right */}
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
          <div className={`role-card ${role === 'student' ? 'active' : ''}`} onClick={() => { setRole('student'); setValue(''); }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>🎒</div>
            <div style={{ fontFamily: 'var(--fh)', fontSize: 14, fontWeight: 600 }}>Student</div>
            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>Sign in with PIN</div>
          </div>
          <div className={`role-card ${role === 'tutor' ? 'active' : ''}`} onClick={() => { setRole('tutor'); setValue(''); }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>👩‍🏫</div>
            <div style={{ fontFamily: 'var(--fh)', fontSize: 14, fontWeight: 600 }}>Teacher</div>
            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>Your class dashboard</div>
          </div>
          <div className={`role-card ${role === 'admin' ? 'active' : ''}`} onClick={() => { setRole('admin'); setValue(''); }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>👨‍💼</div>
            <div style={{ fontFamily: 'var(--fh)', fontSize: 14, fontWeight: 600 }}>Admin</div>
            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>Full platform control</div>
          </div>
        </div>

        <input
          type={role === 'student' ? 'text' : 'text'} className="l-in" autoComplete="off" spellCheck={false}
          placeholder={placeholder}
          value={value} onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doLogin()}
          style={{ letterSpacing: role === 'student' && value.toUpperCase().startsWith('SPK') ? '.12em' : 'normal' }}
        />
        <p style={{ fontSize: 11.5, color: 'var(--t3)', marginBottom: 14, textAlign: 'center' }}>{hint}</p>

        <button className="l-btn" onClick={doLogin} disabled={loading}>
          {loading ? 'Loading…' : role === 'student' ? '🔐 Sign In' : '→ Enter Dashboard'}
        </button>
        <div style={{ fontSize: 11, color: 'var(--t4)', textAlign: 'center' }}>Mathematics &amp; Physical Sciences · CAPS Aligned</div>
      </div>

      {/* Grade selection for new students */}
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
            <button className="btn bp" onClick={doRegister} disabled={loading}>{loading ? '…' : '🚀 Create My Account'}</button>
            <button className="btn bg-btn" onClick={() => setGradeModal(false)}>Cancel</button>
          </div>
        </Modal>
      )}

      {/* PIN reveal — must copy before continuing */}
      {newPin && (
        <Modal title="🎉 Account Created!" onClose={() => {}}>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 42, marginBottom: 6 }}>🔐</div>
            <h3 className="fh" style={{ fontSize: 19, marginBottom: 4 }}>Your Permanent PIN</h3>
            <p className="sm ct2">This is the <strong>only way</strong> to access your account. Your teacher cannot see it. Write it down now!</p>
          </div>

          <div className="pin-reveal-card" onClick={copyPin}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', letterSpacing: '.1em', marginBottom: 6 }}>PIN CODE FOR {newName.toUpperCase()}</div>
            <div className="pin-big">{newPin}</div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>
              {pinCopied ? '✅ Copied to clipboard!' : '👆 Tap to copy'}
            </div>
          </div>

          <div style={{ background: 'rgba(251,191,36,.1)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 10, padding: '10px 14px', margin: '14px 0', fontSize: 12.5 }}>
            ⚠️ <strong>Important:</strong> From now on, you must <strong>use this PIN to sign in</strong>. Your name alone will not work. Save it somewhere safe!
          </div>

          <button className={`btn wf mt1 ${pinCopied ? 'bp' : 'ba'}`} style={{ justifyContent: 'center' }} onClick={confirmPinSaved}>
            {pinCopied ? "✅ I've saved my PIN — Let's Go!" : '📋 Copy PIN First'}
          </button>
        </Modal>
      )}
    </div>
  );
}
