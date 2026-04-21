import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { students as studentsApi, tutorRequests as requestsApi, availableStudents } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { showToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import type { User, QuizResult, TutorRequest, AvailableStudent } from '../../types';
import { getLvl, fmtDate } from '../../utils/helpers';

interface StudentWithResults extends User {
  results: (QuizResult & { assignment?: { title: string } })[];
}

export default function AdminStudents() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isTutor = user?.role === 'TUTOR';
  const [list, setList] = useState<StudentWithResults[]>([]);
  const [search, setSearch] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [viewStu, setViewStu] = useState<StudentWithResults | null>(null);
  const [resetPinStu, setResetPinStu] = useState<StudentWithResults | null>(null);
  const [customPin, setCustomPin] = useState('');
  const [newPin, setNewPin] = useState('');

  // Tutor request state
  const [showRequest, setShowRequest] = useState(false);
  const [available, setAvailable] = useState<AvailableStudent[]>([]);
  const [avGrade, setAvGrade] = useState('');
  const [myRequests, setMyRequests] = useState<TutorRequest[]>([]);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [reqNote, setReqNote] = useState('');

  const navigate = useNavigate();

  const load = useCallback(async () => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (filterGrade) params.grade = filterGrade;
    const data = await studentsApi.list(params);
    setList(data as StudentWithResults[]);
  }, [search, filterGrade]);

  const loadRequests = useCallback(async () => {
    if (!isTutor) return;
    const data = await requestsApi.list();
    setMyRequests((data as TutorRequest[]).filter((r) => r.status === 'pending'));
  }, [isTutor]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadRequests(); }, [loadRequests]);

  const openRequestModal = async () => {
    const data = await availableStudents(avGrade || undefined);
    setAvailable(data as AvailableStudent[]);
    setShowRequest(true);
  };

  useEffect(() => {
    if (!showRequest) return;
    availableStudents(avGrade || undefined).then((d) => setAvailable(d as AvailableStudent[]));
  }, [avGrade, showRequest]);

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

  async function requestStudent(studentId: string) {
    setRequestingId(studentId);
    try {
      await requestsApi.create(studentId, reqNote || undefined);
      showToast('Request sent — waiting for admin approval ✅');
      setReqNote('');
      loadRequests();
      const data = await availableStudents(avGrade || undefined);
      setAvailable(data as AvailableStudent[]);
    } catch (e: unknown) { showToast((e as Error).message, 'err'); }
    finally { setRequestingId(null); }
  }

  async function cancelRequest(id: string) {
    await requestsApi.cancel(id);
    showToast('Request cancelled', 'info');
    loadRequests();
    const data = await availableStudents(avGrade || undefined);
    setAvailable(data as AvailableStudent[]); // refresh — student may reappear as available
  }

  function copyPin(pin: string) {
    navigator.clipboard?.writeText(pin);
    showToast('PIN copied!', 'info');
  }

  async function toggleExamReadiness(s: StudentWithResults) {
    try {
      const res = await studentsApi.toggleExamReadiness(s.id);
      const { examReadinessUnlocked } = res as { examReadinessUnlocked: boolean };
      showToast(`Exam Readiness ${examReadinessUnlocked ? 'unlocked' : 'locked'} for ${s.name}`, 'info');
      setList((prev) => prev.map((x) => x.id === s.id ? { ...x, examReadinessUnlocked } : x));
    } catch (e: unknown) { showToast((e as Error).message, 'err'); }
  }

  // For recommendation: match grades already in tutor's cohort
  const tutorGrades = [...new Set(list.map((s) => s.grade).filter(Boolean))];
  const isRecommended = (grade: number) => tutorGrades.length === 0 || tutorGrades.includes(grade);

  // Check if tutor already has a pending request for a student
  const pendingStudentIds = new Set(myRequests.map((r) => r.studentId));

  return (
    <div>
      <div className="ph">
        <div className="flex jb ia wrap" style={{ gap: 10 }}>
          <div>
            <h2>👥 {isAdmin ? 'Students & PINs' : 'My Students'}</h2>
            <p>{isAdmin ? 'Manage all student accounts, grades, PINs and access' : 'Your allocated students — their progress, PINs and activities'}</p>
          </div>
          {isTutor && (
            <button className="btn bp" onClick={openRequestModal}>
              + Request Students
            </button>
          )}
        </div>
      </div>

      {/* Tutor: pending requests banner */}
      {isTutor && myRequests.length > 0 && (
        <div className="cc mb2" style={{ background: 'rgba(251,191,36,.07)', border: '1px solid rgba(251,191,36,.25)' }}>
          <div className="flex jb ia mb1">
            <div className="bold" style={{ fontSize: 13 }}>⏳ Pending Requests ({myRequests.length})</div>
            <button className="btn ba btn-sm" onClick={openRequestModal}>Manage</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {myRequests.map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(251,191,36,.1)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 8, padding: '5px 10px', fontSize: 12 }}>
                <span className="bold">{r.student?.name}</span>
                <span className="ct3">Gr{r.student?.grade}</span>
                <button onClick={() => cancelRequest(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--t3)', padding: '0 2px' }} title="Cancel">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

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
        <div className="empty">
          <div className="eico">👥</div>
          <h3>{isTutor ? 'No students allocated yet' : 'No students yet'}</h3>
          <p>{isTutor ? 'Use the "Request Students" button above, or wait for the admin to allocate students to your class.' : 'Students appear once they register.'}</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="dt">
            <thead><tr><th>Student</th><th>PIN</th><th>Grade</th>{isAdmin && <th>Tutor</th>}<th>Level</th><th>Quizzes</th><th>Avg</th><th>Status</th><th>Actions</th></tr></thead>
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
                    {isAdmin && <td><span className="xs ct2">{(s as StudentWithResults & { teacher?: { name: string } }).teacher?.name || <span className="ct3">—</span>}</span></td>}
                    <td><span className={`lvl ${lv.cl}`} style={{ fontSize: 10.5 }}>{lv.ic} {lv.name}</span><div className="xs ct3">⚡{s.xp || 0} XP</div></td>
                    <td>{s.results?.length || 0}</td>
                    <td><strong>{avg}{avg !== '—' ? '%' : ''}</strong></td>
                    <td><span className={`badge ${s.active !== false ? 'bok' : 'bng'}`}>{s.active !== false ? 'Active' : 'Inactive'}</span></td>
                    <td><div className="flex g1 wrap">
                      <button className="btn bg-btn btn-sm" onClick={() => setViewStu(s)}>View</button>
                      <button className="btn ba btn-sm" onClick={() => navigate(`/app/report/${s.id}`)}>📊 Report</button>
                      <button
                        className={`btn btn-sm ${s.examReadinessUnlocked ? 'bok' : 'ba'}`}
                        style={{ fontSize: 11 }}
                        title={s.examReadinessUnlocked ? 'Click to lock exam readiness' : 'Click to unlock exam readiness'}
                        onClick={() => toggleExamReadiness(s)}
                      >
                        {s.examReadinessUnlocked ? '🔓 Readiness' : '🔒 Readiness'}
                      </button>
                      <button className="btn bw-btn btn-sm" onClick={() => { setResetPinStu(s); setCustomPin(''); setNewPin(''); }}>🔑 PIN</button>
                      {isAdmin && <button className="btn bg-btn btn-sm" onClick={() => toggleActive(s.id)}>{s.active !== false ? 'Deactivate' : 'Activate'}</button>}
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
            {isAdmin && <button className="btn bg-btn" onClick={() => { toggleActive(viewStu.id); setViewStu(null); }}>{viewStu.active !== false ? 'Deactivate' : 'Activate'}</button>}
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

      {/* Request Students Modal (tutor only) */}
      {showRequest && isTutor && (
        <Modal title="🔎 Find & Request Students" onClose={() => setShowRequest(false)} wide>
          {/* Pending requests section */}
          {myRequests.length > 0 && (
            <div style={{ marginBottom: 18, padding: '12px 14px', background: 'rgba(251,191,36,.07)', border: '1px solid rgba(251,191,36,.25)', borderRadius: 10 }}>
              <div className="bold xs ct2 mb1" style={{ textTransform: 'uppercase', letterSpacing: '.05em' }}>⏳ Your Pending Requests</div>
              {myRequests.map((r) => (
                <div key={r.id} className="flex jb ia" style={{ padding: '7px 0', borderBottom: '1px solid var(--bd)', fontSize: 13 }}>
                  <div>
                    <span className="bold">{r.student?.name}</span>
                    <span className="xs ct3 ml1"> · Grade {r.student?.grade}</span>
                  </div>
                  <div className="flex ia g1">
                    <span className="badge" style={{ background: 'rgba(251,191,36,.15)', color: 'var(--wr)', fontSize: 10 }}>⏳ Pending</span>
                    <button className="btn bd-btn btn-sm" onClick={() => cancelRequest(r.id)}>Cancel</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Grade filter */}
          <div className="flex ia g2 mb2">
            <label className="lbl" style={{ whiteSpace: 'nowrap', marginBottom: 0 }}>Filter grade:</label>
            <select className="select" style={{ width: 'auto' }} value={avGrade} onChange={(e) => setAvGrade(e.target.value)}>
              <option value="">All Grades</option>
              <option value="10">Grade 10</option>
              <option value="11">Grade 11</option>
              <option value="12">Grade 12</option>
            </select>
            {tutorGrades.length > 0 && (
              <span className="xs ct3">Recommended: Gr{tutorGrades.join(', ')}</span>
            )}
          </div>

          {available.length === 0 ? (
            <div className="empty" style={{ padding: '24px 0' }}>
              <div className="eico" style={{ fontSize: 32 }}>🎓</div>
              <p className="sm ct2">No unallocated students{avGrade ? ` in Grade ${avGrade}` : ''} at the moment.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
              {available.map((s) => {
                const avg = s.results.length ? Math.round(s.results.reduce((a, r) => a + r.score, 0) / s.results.length) : null;
                const lv = getLvl(s.xp || 0);
                const rec = isRecommended(s.grade);
                const alreadyPending = pendingStudentIds.has(s.id);
                return (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: rec ? 'rgba(20,184,166,.05)' : 'rgba(0,0,0,.02)', border: `1px solid ${rec ? 'rgba(20,184,166,.2)' : 'var(--bd)'}`, borderRadius: 10 }}>
                    <div className="flex ia g2">
                      <div className="av" style={{ width: 34, height: 34, fontSize: 14, flexShrink: 0 }}>
                        {s.name.charAt(0)}
                      </div>
                      <div>
                        <div className="bold" style={{ fontSize: 13 }}>
                          {s.name}
                          {rec && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: 'var(--p)', background: 'rgba(20,184,166,.12)', padding: '2px 6px', borderRadius: 4, letterSpacing: '.04em' }}>⭐ REC</span>}
                        </div>
                        <div className="xs ct3 flex ia g1">
                          <span>Grade {s.grade}</span>
                          <span>·</span>
                          <span className={`lvl ${lv.cl}`} style={{ fontSize: 9 }}>{lv.ic} {lv.name}</span>
                          {avg !== null && <><span>·</span><span>Avg {avg}%</span></>}
                        </div>
                      </div>
                    </div>
                    <div className="flex ia g1">
                      {alreadyPending ? (
                        <span className="badge" style={{ background: 'rgba(251,191,36,.15)', color: 'var(--wr)', fontSize: 10 }}>⏳ Requested</span>
                      ) : (
                        <>
                          <input
                            type="text"
                            className="input"
                            style={{ width: 130, fontSize: 12, padding: '5px 10px' }}
                            placeholder="Note (optional)"
                            onFocus={(e) => setReqNote(e.target.value)}
                            onChange={(e) => setReqNote(e.target.value)}
                          />
                          <button
                            className="btn bp btn-sm"
                            disabled={requestingId === s.id}
                            onClick={() => requestStudent(s.id)}
                          >
                            {requestingId === s.id ? '…' : '+ Request'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button className="btn bg-btn wf mt2" style={{ justifyContent: 'center' }} onClick={() => setShowRequest(false)}>Done</button>
        </Modal>
      )}
    </div>
  );
}
