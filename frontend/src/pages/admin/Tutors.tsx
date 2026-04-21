import { useEffect, useState, useCallback } from 'react';
import { tutors as tutorsApi, studentSearch, students as studentsApi, tutorRequests as requestsApi } from '../../services/api';
import { showToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import type { User, TutorRequest } from '../../types';

interface Tutor extends User {
  students: { id: string; name: string; grade: number }[];
  subjects: string[];
  teachGrades: number[];
}

interface StudentResult { id: string; name: string; grade: number; pin: string; }

export default function AdminTutors() {
  const [list, setList] = useState<Tutor[]>([]);
  const [pendingReqs, setPendingReqs] = useState<TutorRequest[]>([]);
  const [showAssign, setShowAssign] = useState(false);
  const [selTutor, setSelTutor] = useState<Tutor | null>(null);
  const [stuSearch, setStuSearch] = useState('');
  const [stuResults, setStuResults] = useState<StudentResult[]>([]);
  const [saving, setSaving] = useState(false);
  const [resetTutor, setResetTutor] = useState<Tutor | null>(null);
  const [customPin, setCustomPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [showPinFor, setShowPinFor] = useState<string | null>(null);
  const [actioningReq, setActioningReq] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [tutorData, reqData] = await Promise.all([
      tutorsApi.list(),
      requestsApi.list(),
    ]);
    setList(tutorData as Tutor[]);
    setPendingReqs((reqData as TutorRequest[]).filter((r) => r.status === 'pending'));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (stuSearch.trim().length < 2) { setStuResults([]); return; }
    const t = setTimeout(() => studentSearch(stuSearch).then(setStuResults).catch(() => setStuResults([])), 300);
    return () => clearTimeout(t);
  }, [stuSearch]);

  async function approveRequest(req: TutorRequest) {
    setActioningReq(req.id);
    try {
      await requestsApi.updateStatus(req.id, 'approved');
      showToast(`${req.student?.name} assigned to ${req.tutor?.name} ✅`);
      load();
    } catch (e: unknown) { showToast((e as Error).message, 'err'); }
    finally { setActioningReq(null); }
  }

  async function denyRequest(req: TutorRequest) {
    setActioningReq(req.id);
    try {
      await requestsApi.updateStatus(req.id, 'denied');
      showToast(`Request denied`, 'info');
      load();
    } catch (e: unknown) { showToast((e as Error).message, 'err'); }
    finally { setActioningReq(null); }
  }

  async function assignStudent(student: StudentResult, tutorId: string) {
    setSaving(true);
    try {
      await tutorsApi.assignStudent(student.id, tutorId);
      showToast(`${student.name} assigned ✅`);
      setStuSearch(''); setStuResults([]);
      load();
    } catch (e: unknown) { showToast((e as Error).message, 'err'); }
    finally { setSaving(false); }
  }

  async function unassignStudent(studentId: string, studentName: string) {
    if (!confirm(`Remove ${studentName} from this teacher's class?`)) return;
    await tutorsApi.assignStudent(studentId, null);
    showToast(`${studentName} unassigned`, 'info');
    load();
  }

  async function toggleTutor(tutor: Tutor) {
    await tutorsApi.toggleActive(tutor.id);
    showToast(`${tutor.name} ${tutor.active ? 'deactivated' : 'activated'}`, 'info');
    load();
  }

  async function doResetPin() {
    if (!resetTutor) return;
    try {
      const r = await studentsApi.resetPin(resetTutor.id, customPin || undefined);
      setNewPin((r as { pin: string }).pin);
      showToast(`PIN reset for ${resetTutor.name}!`);
      load();
    } catch (e: unknown) { showToast((e as Error).message, 'err'); }
  }

  function copyPin(pin: string) {
    navigator.clipboard?.writeText(pin);
    showToast('PIN copied!', 'info');
  }

  return (
    <div>
      <div className="ph">
        <h2>📚 Tutors</h2>
        <p>Manage tutor accounts and allocate students to their classes. Tutors sign up via the login page under the "Tutor" tab and receive a TCH-XXXX PIN.</p>
      </div>

      {/* Pending pairing requests */}
      {pendingReqs.length > 0 && (
        <div className="cc mb3" style={{ border: '1.5px solid rgba(251,191,36,.4)', background: 'rgba(251,191,36,.05)' }}>
          <div className="flex jb ia mb2">
            <div>
              <div className="bold fh" style={{ fontSize: 15 }}>⏳ Pending Pairing Requests</div>
              <div className="xs ct3">Teachers have requested these students — approve or deny</div>
            </div>
            <span className="badge" style={{ background: 'rgba(251,191,36,.2)', color: 'var(--wr)', fontWeight: 700 }}>{pendingReqs.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingReqs.map((req) => (
              <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,.04)', borderRadius: 9, border: '1px solid var(--bd)' }}>
                <div>
                  <div style={{ fontSize: 13 }}>
                    <span className="bold" style={{ color: 'var(--p)' }}>{req.tutor?.name}</span>
                    <span className="ct3"> requested </span>
                    <span className="bold">{req.student?.name}</span>
                    <span className="xs ct3 ml1">· Grade {req.student?.grade}</span>
                  </div>
                  {req.note && <div className="xs ct3" style={{ marginTop: 3, fontStyle: 'italic' }}>"{req.note}"</div>}
                </div>
                <div className="flex g1">
                  <button
                    className="btn bp btn-sm"
                    disabled={actioningReq === req.id}
                    onClick={() => approveRequest(req)}
                  >
                    ✅ Approve
                  </button>
                  <button
                    className="btn bd-btn btn-sm"
                    disabled={actioningReq === req.id}
                    onClick={() => denyRequest(req)}
                  >
                    ✕ Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div className="empty">
          <div className="eico">📚</div>
          <h3>No tutors yet</h3>
          <p>Tutors register on the login page by selecting the "Tutor" tab and entering their name and teaching profile. They'll appear here once registered.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {list.map((t) => (
            <div key={t.id} className="cc" style={{ opacity: t.active ? 1 : 0.55 }}>
              <div className="flex jb ia wrap" style={{ gap: 10, marginBottom: t.students.length > 0 ? 14 : 0 }}>
                <div className="flex ia g2">
                  <div className="av" style={{ width: 42, height: 42, fontSize: 18, flexShrink: 0 }}>
                    {t.photo ? <img src={t.photo} alt={t.name} /> : t.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="bold fh" style={{ fontSize: 15 }}>{t.name}</div>
                    {(t.subjects?.length > 0 || t.teachGrades?.length > 0) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '4px 0 2px' }}>
                        {t.subjects?.map((s) => (
                          <span key={s} className="badge btl" style={{ fontSize: 9.5 }}>{s === 'MATHEMATICS' ? '📐 Maths' : '⚗️ Phys Sci'}</span>
                        ))}
                        {t.teachGrades?.map((g) => (
                          <span key={g} className="badge bcy" style={{ fontSize: 9.5 }}>Gr{g}</span>
                        ))}
                      </div>
                    )}
                    <div className="xs ct3" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                      <span
                        style={{ fontFamily: 'var(--fh)', fontWeight: 700, letterSpacing: '.1em', color: 'var(--p)', cursor: 'pointer', fontSize: 12 }}
                        onClick={() => setShowPinFor(showPinFor === t.id ? null : t.id)}
                        title="Click to reveal PIN"
                      >
                        {showPinFor === t.id ? t.pin : 'TCH-••••'} 👁
                      </span>
                      {showPinFor === t.id && (
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--p)', padding: 0 }} onClick={() => copyPin(t.pin || '')}>📋 Copy</button>
                      )}
                      <span>· {t.students.length} student{t.students.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
                <div className="flex g1 wrap">
                  <button className="btn bp btn-sm" onClick={() => { setSelTutor(t); setStuSearch(''); setStuResults([]); setShowAssign(true); }}>
                    + Assign Students
                  </button>
                  <button className="btn bw-btn btn-sm" onClick={() => { setResetTutor(t); setCustomPin(''); setNewPin(''); }}>
                    🔑 Reset PIN
                  </button>
                  <button className="btn bg-btn btn-sm" onClick={() => toggleTutor(t)}>
                    {t.active ? '🔒 Deactivate' : '✅ Activate'}
                  </button>
                </div>
              </div>

              {t.students.length > 0 && (
                <div>
                  <div className="xs ct3 mb1" style={{ fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase' }}>Allocated Students</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {t.students.map((s) => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(20,184,166,.08)', border: '1px solid rgba(20,184,166,.20)', borderRadius: 8, padding: '5px 10px', fontSize: 12.5 }}>
                        <span className="bold">{s.name}</span>
                        <span className="ct3">Gr{s.grade}</span>
                        <button onClick={() => unassignStudent(s.id, s.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--t3)', padding: '0 2px', lineHeight: 1 }} title="Remove">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {t.students.length === 0 && !t.active && (
                <div className="xs ct3" style={{ fontStyle: 'italic' }}>Deactivated — no students allocated</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Assign Students Modal */}
      {showAssign && selTutor && (
        <Modal title={`Assign Students to ${selTutor.name}`} onClose={() => setShowAssign(false)}>
          <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(20,184,166,.06)', borderRadius: 10, fontSize: 13, color: 'var(--t2)', borderLeft: '3px solid var(--p)' }}>
            Currently has <strong>{selTutor.students.length}</strong> student{selTutor.students.length !== 1 ? 's' : ''}. Search any student to assign (or move from another teacher).
          </div>
          <div className="fg">
            <label className="lbl">Search Student by Name</label>
            <input type="text" className="input" value={stuSearch} onChange={(e) => setStuSearch(e.target.value)}
              placeholder="Type student name…" autoFocus />
            {stuResults.length > 0 && (
              <div style={{ border: '1.5px solid var(--bd)', borderRadius: 10, overflow: 'hidden', marginTop: 6 }}>
                {stuResults.map((s) => {
                  const alreadyAssigned = selTutor.students.some((st) => st.id === s.id);
                  return (
                    <div key={s.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div className="bold" style={{ fontSize: 13 }}>{s.name}</div>
                        <div className="xs ct3">Grade {s.grade}</div>
                      </div>
                      {alreadyAssigned ? (
                        <span className="badge bok xs">Already in class</span>
                      ) : (
                        <button className="btn bp btn-sm" disabled={saving} onClick={() => assignStudent(s, selTutor.id)}>
                          + Assign
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {selTutor.students.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="lbl mb1">Currently Assigned</div>
              {selTutor.students.map((s) => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--bd)', fontSize: 13 }}>
                  <div><span className="bold">{s.name}</span> <span className="xs ct3">· Grade {s.grade}</span></div>
                  <button className="btn bd-btn btn-sm" onClick={() => { unassignStudent(s.id, s.name); setSelTutor({ ...selTutor, students: selTutor.students.filter((x) => x.id !== s.id) }); }}>Remove</button>
                </div>
              ))}
            </div>
          )}
          <button className="btn bg-btn wf mt2" style={{ justifyContent: 'center' }} onClick={() => setShowAssign(false)}>Done</button>
        </Modal>
      )}

      {/* Reset Tutor PIN Modal */}
      {resetTutor && (
        <Modal title="🔑 Reset Tutor PIN" onClose={() => setResetTutor(null)}>
          {newPin ? (
            <>
              <div className="pin-hero mb2" onClick={() => copyPin(newPin)}>
                <div className="pin-lbl">NEW PIN FOR {resetTutor.name.toUpperCase()}</div>
                <div className="pin-val">{newPin}</div>
                <div className="pin-hint">Click to copy · Old PIN no longer works</div>
              </div>
              <button className="btn bp wf" style={{ justifyContent: 'center' }} onClick={() => setResetTutor(null)}>✅ Done</button>
            </>
          ) : (
            <>
              <div className="flex ia g2 mb2">
                <div className="av">{resetTutor.name.charAt(0)}</div>
                <div>
                  <div className="bold">{resetTutor.name}</div>
                  <div className="sm ct2">Current PIN: <strong className="cp">{resetTutor.pin || '—'}</strong></div>
                </div>
              </div>
              <p className="sm ct2 mb2">A new TCH-XXXX tutor PIN will be generated. The old one stops working immediately.</p>
              <div className="fg">
                <label className="lbl">Custom 4-char suffix (optional)</label>
                <input type="text" className="input" value={customPin} onChange={(e) => setCustomPin(e.target.value.toUpperCase().slice(0, 4))} placeholder="Auto-generated if blank" maxLength={4} />
              </div>
              <div className="flex g1 mt1">
                <button className="btn bp" onClick={doResetPin}>🔑 Reset PIN</button>
                <button className="btn bg-btn" onClick={() => setResetTutor(null)}>Cancel</button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
