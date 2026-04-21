import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import Modal from './Modal';
import { fmtDate, getLvl, compressImage } from '../utils/helpers';
import { students as studentsApi, tutorRequests as requestsApi } from '../services/api';
import { showToast } from './Toast';

export default function Sidebar({ onToggle, open }: { onToggle: () => void; open: boolean }) {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('es_theme') || 'light');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    requestsApi.list()
      .then((data) => setPendingCount((data as { status: string }[]).filter((r) => r.status === 'pending').length))
      .catch(() => {});
  }, [user?.role]);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('es_theme', next);
  }

  function doLogout() { logout(); navigate('/'); }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0] || !user) return;
    const b64 = await compressImage(e.target.files[0]);
    await studentsApi.updatePhoto(user.id, b64);
    updateUser({ photo: b64 });
    showToast('Profile photo updated! 📷');
  }

  if (!user) return null;
  const isAdmin = user.role === 'ADMIN';
  const lv = getLvl(user.xp || 0);

  const adminLinks = [
    { to: '/app/dashboard', ico: '🏠', label: 'Dashboard', section: 'Main' },
    { to: '/app/questions', ico: '📝', label: 'Question Bank' },
    { to: '/app/assignments', ico: '📋', label: 'Assignments', section: 'Management' },
    { to: '/app/students', ico: '👥', label: 'Students & PINs' },
    { to: '/app/tutors', ico: '👩‍🏫', label: 'Teachers' },
    { to: '/app/parent-pins', ico: '🔑', label: 'Parent Access' },
    { to: '/app/analytics', ico: '📈', label: 'Analytics', section: 'Reports' },
    { to: '/app/calendar', ico: '📅', label: 'Calendar' },
  ];

  const tutorLinks = [
    { to: '/app/dashboard', ico: '🏠', label: 'Dashboard', section: 'Main' },
    { to: '/app/questions', ico: '📝', label: 'Question Bank' },
    { to: '/app/assignments', ico: '📋', label: 'Assignments', section: 'My Class' },
    { to: '/app/students', ico: '👥', label: 'My Students' },
    { to: '/app/parent-pins', ico: '🔑', label: 'Parent Access' },
    { to: '/app/analytics', ico: '📈', label: 'Analytics', section: 'Reports' },
    { to: '/app/calendar', ico: '📅', label: 'Calendar' },
  ];
  const studentLinks = [
    { to: '/app/dashboard', ico: '🏠', label: 'Dashboard', section: 'Main' },
    { to: '/app/questions', ico: '📚', label: 'Question Bank' },
    { to: '/app/progress', ico: '📈', label: 'My Progress', section: 'Learning' },
    { to: '/app/history', ico: '🗂', label: 'Quiz History' },
    { to: '/app/exam-readiness', ico: '🎯', label: 'Exam Readiness' },
    { to: '/app/calendar', ico: '📅', label: 'My Schedule' },
  ];
  const isTutor = user.role === 'TUTOR';
  const links = isAdmin ? adminLinks : isTutor ? tutorLinks : studentLinks;

  return (
    <>
      <aside className={`sb ${open ? 'open' : ''}`}>
        <div className="sb-hd">
          <div className="sb-logo">🔬</div>
          <div className="sb-brand">EduSpark<small>Maths &amp; Science Platform</small></div>
        </div>

        <div className="sb-usr" onClick={() => setShowProfile(true)}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div className="av">
              {user.photo ? <img src={user.photo} alt={user.name} /> : user.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, background: 'var(--p)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', border: '2px solid var(--bg)' }}>📷</div>
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="sb-nm">{user.name}</div>
            <div className="sb-pin">
              {isAdmin
                ? <span style={{ color: 'var(--t3)', letterSpacing: '.1em' }}>ADM-••••</span>
                : isTutor
                ? <span style={{ color: 'var(--t3)', letterSpacing: '.1em' }}>TCH-••••</span>
                : <span style={{ color: 'var(--t3)', letterSpacing: '.1em' }}>SPK-••••</span>}
            </div>
          </div>
        </div>

        <nav className="sb-nav">
          {links.map((l) => (
            <div key={l.to}>
              {l.section && <div className="nsec">{l.section}</div>}
              <NavLink to={l.to} className={({ isActive }) => `ni${isActive ? ' active' : ''}`} onClick={onToggle}>
                <span className="n-ico">{l.ico}</span>
                {l.label}
                {l.to === '/app/tutors' && pendingCount > 0 && (
                  <span style={{ marginLeft: 'auto', minWidth: 18, height: 18, background: 'var(--wr)', color: '#fff', borderRadius: '50%', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                    {pendingCount}
                  </span>
                )}
              </NavLink>
            </div>
          ))}
        </nav>

        <div className="sb-ft">
          <button className="th-btn" onClick={toggleTheme}>
            <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <button className="btn bg-btn wf btn-sm" style={{ justifyContent: 'center', marginTop: 4 }} onClick={doLogout}>← Sign Out</button>
        </div>
      </aside>

      {showProfile && (
        <Modal title={isAdmin ? '👩‍🏫 Teacher Profile' : '👤 My Profile'} onClose={() => { setShowProfile(false); setShowPin(false); }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <label style={{ cursor: 'pointer', position: 'relative', display: 'inline-block' }}>
              <div className="av" style={{ width: 80, height: 80, fontSize: 32, margin: '0 auto', border: '3px solid var(--p)' }}>
                {user.photo ? <img src={user.photo} alt={user.name} style={{ borderRadius: '50%' }} /> : user.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, background: 'var(--p)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, border: '2px solid var(--bg)', cursor: 'pointer' }}>📷</div>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
            </label>
            <div style={{ fontFamily: 'var(--fh)', fontSize: 22, fontWeight: 700, marginTop: 12 }}>{user.name}</div>
            {isAdmin
              ? <span className="badge btl mt1">SuperAdmin</span>
              : isTutor
              ? <span className="badge btl mt1">Teacher</span>
              : <span className="badge btl mt1">Grade {user.grade} Student</span>
            }
            <div className="xs ct3 mt1">Tap photo to change picture</div>
          </div>

          {!isAdmin && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ background: 'rgba(20,184,166,.06)', border: '1px solid var(--bd)', borderRadius: 12, padding: 14 }}>
                <div className="flex jb ia" style={{ marginBottom: showPin ? 8 : 0 }}>
                  <div>
                    <div className="sm bold">Your Login PIN</div>
                    <div className="xs ct3">{isTutor ? 'TCH-XXXX — used to sign in' : 'SPK-XXXX — used to sign in'}</div>
                  </div>
                  <button className="btn ba btn-sm" onClick={() => setShowPin((v) => !v)}>
                    {showPin ? '🙈 Hide' : '👁 Reveal'}
                  </button>
                </div>
                {showPin && (
                  <div style={{ marginTop: 10, padding: '12px 16px', background: 'rgba(20,184,166,.1)', borderRadius: 10, textAlign: 'center', cursor: 'pointer' }}
                    onClick={() => { navigator.clipboard?.writeText(user.pin || ''); showToast('PIN copied!', 'info'); }}>
                    <div style={{ fontFamily: 'var(--fh)', fontSize: 26, fontWeight: 800, letterSpacing: '.2em', color: 'var(--p)' }}>{user.pin}</div>
                    <div className="xs ct3 mt1">Tap to copy</div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ background: 'rgba(20,184,166,.05)', borderRadius: 11, padding: 13 }}>
            {(isAdmin || isTutor)
              ? [['Role', isAdmin ? 'SuperAdmin' : 'Teacher'], ['Account', 'Session-based']].map(([k, v]) => (
                  <div key={k} className="flex jb" style={{ padding: '7px 0', borderBottom: '1px solid var(--bd)', fontSize: 13 }}><span className="ct2">{k}</span><span className="bold">{v}</span></div>
                ))
              : [['Level', lv.ic + ' ' + lv.name], ['Total XP', '⚡ ' + (user.xp || 0) + ' XP'], ['Joined', fmtDate(user.createdAt)]].map(([k, v]) => (
                  <div key={k} className="flex jb" style={{ padding: '7px 0', borderBottom: '1px solid var(--bd)', fontSize: 13 }}><span className="ct2">{k}</span><span className="bold">{v}</span></div>
                ))
            }
          </div>
          <button className="btn bg-btn wf mt2" style={{ justifyContent: 'center' }} onClick={() => { setShowProfile(false); setShowPin(false); }}>Close</button>
        </Modal>
      )}
    </>
  );
}
