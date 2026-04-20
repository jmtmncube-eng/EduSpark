import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { students as studentsApi } from '../../services/api';
import { showToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import type { User, QuizResult } from '../../types';
import { getLvl, fmtDate } from '../../utils/helpers';

interface StudentWithResults extends User {
  results: (QuizResult & { assignment?: { title: string } })[];
}

export default function AdminStudents() {
  const [list, setList] = useState<StudentWithResults[]>([]);
  const [search, setSearch] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [viewStu, setViewStu] = useState<StudentWithResults | null>(null);
  const [resetPinStu, setResetPinStu] = useState<StudentWithResults | null>(null);
  const [customPin, setCustomPin] = useState('');
  const [newPin, setNewPin] = useState('');

  const navigate = useNavigate();

  const load = useCallback(async () => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (filterGrade) params.grade = filterGrade;
    const data = await studentsApi.list(params);
    setList(data as StudentWithResults[]);
  }, [search, filterGrade]);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(id: string) {
    await studentsApi.toggleActive(id);
    showToast('Status updated');
    load();
  }

  async function doResetPin() {
    if (!resetPinStu) return;
    try {
      const r = await studentsApi.resetPin(resetPinStu.id, customPin || undefined);
      setNewPin((r as { pin: string }).pin);
      showToast(`PIN reset for ${resetPinStu.name}!`);
      load();
    } catch (e: unknown) { showToast((e as Error).message, 'err'); }
  }

  function copyPin(pin: string) {
    navigator.clipboard?.writeText(pin);
    showToast('PIN copied!', 'info');
  }

  return (
    <div>
      <div className="ph"><h2>👥 Students &amp; PINs</h2><p>Manage student accounts, grades, PINs and access</p></div>
      <div className="flex g2 mb2 wrap">
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)' }}>🔍</span>
          <input type="text" className="input" style={{ paddingLeft: 34 }} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="select" style={{ width: 'auto' }} value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)}>
          <option value="">All Grades</option><option value="10">Grade 10</option><option value="11">Grade 11</option><option value="12">Grade 12</option>
        </select>
      </div>

      {list.length === 0 ? (
        <div className="empty"><div className="eico">👥</div><h3>No students yet</h3><p>Students appear once they register.</p></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="dt">
            <thead><tr><th>Student</th><th>PIN</th><th>Grade</th><th>Level</th><th>Quizzes</th><th>Avg</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {list.map((s) => {
                const avg = s.results?.length ? (s.results.reduce((x, r) => x + r.score, 0) / s.results.length).toFixed(1) : '—';
                const lv = getLvl(s.xp || 0);
                return (
                  <tr key={s.id}>
                    <td><div className="flex ia g1">
                      <div className="av" style={{ width: 28, height: 28, fontSize: 11 }}>{s.photo ? <img src={s.photo} alt={s.name} /> : s.name.charAt(0)}</div>
                      <span>{s.name}</span>
                    </div></td>
                    <td><span style={{ fontFamily: 'var(--fh)', fontWeight: 700, color: 'var(--p)', letterSpacing: '.12em', fontSize: 13, cursor: 'pointer' }} onClick={() => copyPin(s.pin || '')}>{s.pin || '—'} 📋</span></td>
                    <td>Gr{s.grade || 10}</td>
                    <td><span className={`lvl ${lv.cl}`} style={{ fontSize: 10.5 }}>{lv.ic} {lv.name}</span><div className="xs ct3">⚡{s.xp || 0} XP</div></td>
                    <td>{s.results?.length || 0}</td>
                    <td><strong>{avg}{avg !== '—' ? '%' : ''}</strong></td>
                    <td><span className={`badge ${s.active !== false ? 'bok' : 'bng'}`}>{s.active !== false ? 'Active' : 'Inactive'}</span></td>
                    <td><div className="flex g1 wrap">
                      <button className="btn bg-btn btn-sm" onClick={() => setViewStu(s)}>View</button>
                      <button className="btn ba btn-sm" onClick={() => navigate(`/app/report/${s.id}`)}>📊 Report</button>
                      <button className="btn bw-btn btn-sm" onClick={() => { setResetPinStu(s); setCustomPin(''); setNewPin(''); }}>🔑 PIN</button>
                      <button className="btn bg-btn btn-sm" onClick={() => toggleActive(s.id)}>{s.active !== false ? 'Deactivate' : 'Activate'}</button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* View Student Modal */}
      {viewStu && (
        <Modal title="Student Profile" onClose={() => setViewStu(null)}>
          <div className="flex ia g2 mb2">
            <div className="av" style={{ width: 56, height: 56, fontSize: 22 }}>{viewStu.photo ? <img src={viewStu.photo} alt={viewStu.name} /> : viewStu.name.charAt(0)}</div>
            <div><h3 className="fh" style={{ fontSize: 21 }}>{viewStu.name}</h3><div className="sm ct2">⚡{viewStu.xp || 0} XP · {viewStu.results?.length || 0} quizzes</div></div>
          </div>
          <div className="pin-hero mb2" onClick={() => copyPin(viewStu.pin || '')}>
            <div className="pin-lbl">STUDENT PIN CODE</div>
            <div className="pin-val">{viewStu.pin || '—'}</div>
            <div className="pin-hint">Click to copy · Share with student</div>
          </div>
          <div style={{ background: 'rgba(20,184,166,.06)', borderRadius: 11, padding: 12, marginBottom: 14 }}>
            {[['Grade', `Grade ${viewStu.grade || 10}`], ['Avg Score', `${viewStu.results?.length ? (viewStu.results.reduce((x, r) => x + r.score, 0) / viewStu.results.length).toFixed(1) : 0}%`], ['Level', getLvl(viewStu.xp || 0).name], ['Joined', fmtDate(viewStu.createdAt)]].map(([k, v]) => (
              <div key={k} className="flex jb" style={{ padding: '7px 0', borderBottom: '1px solid var(--bd)', fontSize: 13 }}><span className="ct2">{k}</span><span className="bold">{v}</span></div>
            ))}
          </div>
          <div className="sec-h">Recent Results</div>
          {(viewStu.results || []).slice(0, 5).map((r) => (
            <div key={r.id} className="flex jb ia" style={{ padding: '8px 0', borderBottom: '1px solid var(--bd)', fontSize: 13 }}>
              <span>{r.assignment?.title || 'Quiz'}</span>
              <span className={`bold ${r.score >= 70 ? 'cs' : r.score >= 50 ? 'cwr' : 'cdr'}`}>{r.score}%</span>
            </div>
          ))}
          {!(viewStu.results?.length) && <p className="sm ct2">No results yet</p>}
          <div className="flex g1 mt2 wrap">
            <button className="btn bp" onClick={() => { navigate(`/app/report/${viewStu.id}`); setViewStu(null); }}>📊 Exam Report</button>
            <button className="btn bw-btn" onClick={() => { setResetPinStu(viewStu); setViewStu(null); setCustomPin(''); setNewPin(''); }}>🔑 Reset PIN</button>
            <button className="btn bg-btn" onClick={() => { toggleActive(viewStu.id); setViewStu(null); }}>{viewStu.active !== false ? 'Deactivate' : 'Activate'}</button>
          </div>
        </Modal>
      )}

      {/* Reset PIN Modal */}
      {resetPinStu && (
        <Modal title="🔑 Manage PIN" onClose={() => setResetPinStu(null)}>
          {newPin ? (
            <>
              <div className="pin-hero mb2" onClick={() => copyPin(newPin)}>
                <div className="pin-lbl">NEW PIN FOR {resetPinStu.name.toUpperCase()}</div>
                <div className="pin-val">{newPin}</div>
                <div className="pin-hint">Click to copy · Old PIN no longer works</div>
              </div>
              <button className="btn bp wf" style={{ justifyContent: 'center' }} onClick={() => setResetPinStu(null)}>✅ Done</button>
            </>
          ) : (
            <>
              <div className="flex ia g2 mb2">
                <div className="av">{resetPinStu.name.charAt(0)}</div>
                <div><div className="bold">{resetPinStu.name}</div><div className="sm ct2">Current PIN: <strong className="cp">{resetPinStu.pin || '—'}</strong></div></div>
              </div>
              <p className="sm ct2 mb2">A new PIN will be generated. The old one stops working immediately.</p>
              <div className="fg"><label className="lbl">Custom 4-char suffix (optional)</label><input type="text" className="input" value={customPin} onChange={(e) => setCustomPin(e.target.value.toUpperCase().slice(0, 4))} placeholder="Auto-generated if blank" maxLength={4} /></div>
              <div className="flex g1 mt1"><button className="btn bp" onClick={doResetPin}>🔑 Reset PIN</button><button className="btn bg-btn" onClick={() => setResetPinStu(null)}>Cancel</button></div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
