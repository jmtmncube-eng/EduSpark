import { useEffect, useState, useCallback } from 'react';
import { parent as parentApi, students as studentsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { showToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import type { User } from '../../types';

interface ParentPin {
  id: string; pin: string; label: string | null; expiresAt: string;
  expired: boolean; daysLeft: number;
  student: { name: string; grade: number };
  createdAt: string;
}

const EXPIRY_OPTIONS = [
  { days: 7,  label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
  { days: 60, label: '60 days' },
];

export default function AdminParentPins() {
  const { user } = useAuth();
  const isTutor = user?.role === 'TUTOR';

  const [pins, setPins] = useState<ParentPin[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  // Student list state
  const [studentList, setStudentList] = useState<User[]>([]);
  const [stuSearch, setStuSearch] = useState('');
  const [stuGrade, setStuGrade] = useState('');
  const [selStudent, setSelStudent] = useState<User | null>(null);

  // PIN config state
  const [label, setLabel] = useState('');
  const [expiryDays, setExpiryDays] = useState(7);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState('');

  const load = useCallback(async () => {
    const data = await parentApi.listPins();
    setPins(data as ParentPin[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openCreate() {
    const params: Record<string, string> = {};
    if (stuGrade) params.grade = stuGrade;
    const data = await studentsApi.list(params);
    setStudentList(data as User[]);
    setSelStudent(null);
    setStuSearch('');
    setStuGrade('');
    setLabel('');
    setExpiryDays(7);
    setStep(1);
    setShowCreate(true);
  }

  async function refreshStudentList() {
    const params: Record<string, string> = {};
    if (stuGrade) params.grade = stuGrade;
    if (stuSearch) params.search = stuSearch;
    const data = await studentsApi.list(params);
    setStudentList(data as User[]);
  }

  useEffect(() => {
    if (!showCreate) return;
    refreshStudentList();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stuGrade, stuSearch, showCreate]);

  async function createPin() {
    if (!selStudent) { showToast('Select a student first', 'warn'); return; }
    setSaving(true);
    try {
      await parentApi.createPin(selStudent.id, label.trim() || undefined, expiryDays);
      showToast(`PIN created for ${selStudent.name} ✅`);
      setShowCreate(false);
      load();
    } catch (e: unknown) { showToast((e as Error).message, 'err'); }
    finally { setSaving(false); }
  }

  async function revokePin(id: string, name: string) {
    if (!confirm(`Revoke parent PIN for ${name}?`)) return;
    await parentApi.deletePin(id);
    showToast('PIN revoked', 'info');
    load();
  }

  function copyPin(pin: string, id: string) {
    navigator.clipboard?.writeText(pin).then(() => {
      setCopiedId(id);
      showToast(`PIN ${pin} copied!`, 'info');
      setTimeout(() => setCopiedId(''), 2000);
    });
  }

  const active = pins.filter((p) => !p.expired);
  const expired = pins.filter((p) => p.expired);
  const parentUrl = (pin: string) => `${window.location.origin}/parent/${pin}`;

  const filteredStudents = studentList.filter((s) =>
    !stuSearch || s.name.toLowerCase().includes(stuSearch.toLowerCase())
  );

  return (
    <div>
      <div className="ph">
        <h2>🔑 Parent Access PINs</h2>
        <p>Create temporary PINs for parents to view their child's progress. Select a student, set the expiry, and share the generated PIN or link.</p>
      </div>

      <div className="flex jb ia mb2 wrap" style={{ gap: 10 }}>
        <div className="flex g2 ia">
          <span className="badge bok">{active.length} active</span>
          <span className="badge bng">{expired.length} expired</span>
        </div>
        <button className="btn bp" onClick={openCreate}>+ New Parent PIN</button>
      </div>

      {pins.length === 0 ? (
        <div className="empty"><div className="eico">🔑</div><h3>No parent PINs yet</h3><p>Create a PIN to give a parent read-only access to their child's progress dashboard.</p></div>
      ) : (
        <>
          {active.length > 0 && (
            <>
              <div className="sec-h mb1">✅ Active PINs</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {active.map((p) => (
                  <div key={p.id} className="cc" style={{ padding: '14px 16px' }}>
                    <div className="flex jb ia wrap" style={{ gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="flex ia g2 wrap" style={{ marginBottom: 4 }}>
                          <span className="fh bold" style={{ fontSize: 17, letterSpacing: '.1em', color: 'var(--p)' }}>{p.pin}</span>
                          {p.label && <span className="badge btl">{p.label}</span>}
                          <span className="badge bok">⏳ {p.daysLeft}d left</span>
                        </div>
                        <div className="sm ct2">{p.student.name} · Grade {p.student.grade}</div>
                        <div className="xs ct3 mt1">Expires {new Date(p.expiresAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      </div>
                      <div className="flex g1 wrap">
                        <button className="btn ba btn-sm" onClick={() => copyPin(p.pin, p.id)}>
                          {copiedId === p.id ? '✅ Copied!' : '📋 Copy PIN'}
                        </button>
                        <button className="btn ba btn-sm" onClick={() => { navigator.clipboard?.writeText(parentUrl(p.pin)); showToast('Link copied!', 'info'); }}>🔗 Copy Link</button>
                        <button className="btn bd-btn btn-sm" onClick={() => revokePin(p.id, p.student.name)}>🗑 Revoke</button>
                      </div>
                    </div>
                    <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(20,184,166,.06)', borderRadius: 8, fontSize: 11.5, color: 'var(--t3)', wordBreak: 'break-all' }}>
                      🔗 {parentUrl(p.pin)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {expired.length > 0 && (
            <>
              <div className="sec-h mb1">⏰ Expired PINs</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {expired.map((p) => (
                  <div key={p.id} className="cc" style={{ padding: '12px 16px', opacity: 0.6 }}>
                    <div className="flex jb ia">
                      <div>
                        <span className="fh bold" style={{ fontSize: 15, letterSpacing: '.1em', color: 'var(--t3)' }}>{p.pin}</span>
                        <span className="badge bng ml1">Expired</span>
                        <div className="xs ct3 mt1">{p.student.name} · Grade {p.student.grade}</div>
                      </div>
                      <button className="btn bd-btn btn-sm" onClick={() => revokePin(p.id, p.student.name)}>🗑 Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Create PIN Modal — 2-step */}
      {showCreate && (
        <Modal title={step === 1 ? '🔑 Step 1 — Select Student' : `🔑 Step 2 — Configure PIN for ${selStudent?.name}`} onClose={() => setShowCreate(false)} wide>

          {step === 1 && (
            <>
              <p className="sm ct2 mb2">Browse your students and select who this parent PIN is for.</p>

              {/* Filters */}
              <div className="flex g2 mb2 wrap">
                <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)', fontSize: 13 }}>🔍</span>
                  <input type="text" className="input" style={{ paddingLeft: 30 }} placeholder="Search student…" value={stuSearch} onChange={(e) => setStuSearch(e.target.value)} />
                </div>
                <select className="select" style={{ width: 'auto' }} value={stuGrade} onChange={(e) => setStuGrade(e.target.value)}>
                  <option value="">All Grades</option>
                  <option value="10">Grade 10</option>
                  <option value="11">Grade 11</option>
                  <option value="12">Grade 12</option>
                </select>
              </div>

              {filteredStudents.length === 0 ? (
                <div className="empty" style={{ padding: '20px 0' }}>
                  <p className="sm ct3">No students found{stuSearch ? ` matching "${stuSearch}"` : ''}.</p>
                </div>
              ) : (
                <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {filteredStudents.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => { setSelStudent(s); setStep(2); }}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', border: '1.5px solid var(--bd)', borderRadius: 10, cursor: 'pointer', transition: 'all .15s' }}
                      className="hover-row"
                    >
                      <div className="flex ia g2">
                        <div className="av" style={{ width: 32, height: 32, fontSize: 13, flexShrink: 0 }}>
                          {s.photo ? <img src={s.photo} alt={s.name} /> : s.name.charAt(0)}
                        </div>
                        <div>
                          <div className="bold" style={{ fontSize: 13 }}>{s.name}</div>
                          <div className="xs ct3">Grade {s.grade} · ⚡{s.xp || 0} XP</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 18, color: 'var(--p)' }}>→</span>
                    </div>
                  ))}
                </div>
              )}

              <button className="btn bg-btn wf mt2" style={{ justifyContent: 'center' }} onClick={() => setShowCreate(false)}>Cancel</button>
            </>
          )}

          {step === 2 && selStudent && (
            <>
              {/* Selected student recap */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(20,184,166,.07)', border: '1.5px solid rgba(20,184,166,.25)', borderRadius: 10, marginBottom: 18 }}>
                <div className="av" style={{ width: 38, height: 38, fontSize: 16, flexShrink: 0 }}>
                  {selStudent.photo ? <img src={selStudent.photo} alt={selStudent.name} /> : selStudent.name.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="bold">{selStudent.name}</div>
                  <div className="xs ct3">Grade {selStudent.grade} · ⚡{selStudent.xp || 0} XP</div>
                </div>
                <button className="btn bg-btn btn-sm" onClick={() => setStep(1)}>← Change</button>
              </div>

              <div className="fg mb2">
                <label className="lbl">Label (optional)</label>
                <input type="text" className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Mom, Dad, Guardian…" autoFocus />
              </div>

              <div className="fg mb2">
                <label className="lbl">PIN expiry</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                  {EXPIRY_OPTIONS.map(({ days, label: dl }) => (
                    <label key={days} style={{ flex: 1, minWidth: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 8px', border: `2px solid ${expiryDays === days ? 'var(--p)' : 'var(--bd)'}`, borderRadius: 10, cursor: 'pointer', background: expiryDays === days ? 'rgba(20,184,166,.08)' : 'transparent', transition: 'all .15s', fontSize: 13, fontWeight: expiryDays === days ? 700 : 400 }}>
                      <input type="radio" name="expiry" checked={expiryDays === days} onChange={() => setExpiryDays(days)} style={{ display: 'none' }} />
                      {dl}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ background: 'rgba(20,184,166,.06)', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: 'var(--t2)', marginBottom: 18 }}>
                A unique <strong>PAR-XXXX</strong> PIN will be generated for <strong>{selStudent.name}</strong>. Share it with the parent — it gives read-only access to their child's progress and expires in <strong>{expiryDays} days</strong>.
              </div>

              <div className="flex g1">
                <button className="btn bp" onClick={createPin} disabled={saving}>{saving ? '…' : '🔑 Generate & Create PIN'}</button>
                <button className="btn bg-btn" onClick={() => setShowCreate(false)}>Cancel</button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
