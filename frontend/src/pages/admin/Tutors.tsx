import { useEffect, useState, useCallback } from 'react';
import { tutors as tutorsApi, studentSearch } from '../../services/api';
import { showToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import type { User } from '../../types';

interface Tutor extends User {
  students: { id: string; name: string; grade: number }[];
}

interface StudentResult { id: string; name: string; grade: number; pin: string; }

export default function AdminTutors() {
  const [list, setList] = useState<Tutor[]>([]);
  const [showAssign, setShowAssign] = useState(false);
  const [selTutor, setSelTutor] = useState<Tutor | null>(null);
  const [stuSearch, setStuSearch] = useState('');
  const [stuResults, setStuResults] = useState<StudentResult[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const data = await tutorsApi.list();
    setList(data as Tutor[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (stuSearch.trim().length < 2) { setStuResults([]); return; }
    const t = setTimeout(() => studentSearch(stuSearch).then(setStuResults).catch(() => setStuResults([])), 300);
    return () => clearTimeout(t);
  }, [stuSearch]);

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

  return (
    <div>
      <div className="ph">
        <h2>👩‍🏫 Teachers</h2>
        <p>Manage teacher accounts and allocate students to their classes. Teachers sign up via the login page under the "Teacher" tab.</p>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <div className="eico">👩‍🏫</div>
          <h3>No teachers yet</h3>
          <p>Teachers register themselves on the login page by selecting the "Teacher" tab and entering their name. They'll appear here once registered.</p>
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
                    <div className="xs ct3">{t.students.length} student{t.students.length !== 1 ? 's' : ''} allocated</div>
                  </div>
                </div>
                <div className="flex g1 wrap">
                  <button className="btn bp btn-sm" onClick={() => { setSelTutor(t); setStuSearch(''); setStuResults([]); setShowAssign(true); }}>
                    + Assign Students
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
            </div>
          ))}
        </div>
      )}

      {showAssign && selTutor && (
        <Modal title={`Assign Students to ${selTutor.name}`} onClose={() => setShowAssign(false)}>
          <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(20,184,166,.06)', borderRadius: 10, fontSize: 13, color: 'var(--t2)', borderLeft: '3px solid var(--p)' }}>
            Currently has <strong>{selTutor.students.length}</strong> student{selTutor.students.length !== 1 ? 's' : ''}. Search below to add more.
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
                        <span className="badge bok xs">Already assigned</span>
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
    </div>
  );
}
