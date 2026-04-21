import { useEffect, useState, useCallback } from 'react';
import { assignments as assignmentsApi, questions as questionsApi, studentSearch } from '../../services/api';
import { showToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import type { Assignment, Question } from '../../types';
import { subjectBadge, fmtDate, compressImage } from '../../utils/helpers';

const TOPICS: Record<string, Record<number, string[]>> = {
  mathematics: { 10: ['Algebra','Functions & Graphs','Trigonometry','Statistics','Finance & Growth','Euclidean Geometry'], 11: ['Quadratic Equations','Trigonometric Functions','Analytical Geometry','Finance','Counting & Probability','Inequalities'], 12: ['Differential Calculus','Sequences & Series','Polynomials','Exponential & Logarithms','Regression Analysis','Trigonometry Advanced'] },
  physical_sciences: { 10: ["Newton's Laws",'Momentum','Energy & Power','Waves & Sound','Electricity & Magnetism','Chemistry: Matter'], 11: ['Projectile Motion','Electrostatics','Electric Circuits','Intermolecular Forces','Chemical Equilibrium','Vectors & Scalars'], 12: ['Momentum & Impulse','Vertical Projectile Motion','Electrodynamics','Organic Chemistry','Electrochemistry','Optical Phenomena'] },
};

interface DocForm { id?: string; title: string; content: string; imageData: string; }

export default function AdminAssignments() {
  const [list, setList] = useState<Assignment[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [viewAssign, setViewAssign] = useState<Assignment | null>(null);
  const [editId, setEditId] = useState('');
  const [allQs, setAllQs] = useState<Question[]>([]);
  const [selQIds, setSelQIds] = useState<Set<string>>(new Set());
  const [docs, setDocs] = useState<DocForm[]>([]);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [form, setForm] = useState({ title: '', dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], subject: 'mathematics', grade: '10', topic: 'Algebra', assignTo: 'all', specificStu: '' });
  const [stuSearch, setStuSearch] = useState('');
  const [stuResults, setStuResults] = useState<{ id: string; name: string; grade: number; pin: string }[]>([]);
  const [selStu, setSelStu] = useState<{ id: string; name: string; grade: number } | null>(null);

  const load = useCallback(async () => {
    const data = await assignmentsApi.list();
    setList(data as Assignment[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const topics = TOPICS[form.subject]?.[Number(form.grade)] || [];

  useEffect(() => {
    if (stuSearch.trim().length < 2) { setStuResults([]); return; }
    const t = setTimeout(() => studentSearch(stuSearch).then(setStuResults).catch(() => setStuResults([])), 300);
    return () => clearTimeout(t);
  }, [stuSearch]);

  async function openCreate() {
    setEditId(''); setSelQIds(new Set()); setDocs([]); setMaxAttempts(3); setSelStu(null); setStuSearch('');
    setForm({ title: '', dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], subject: 'mathematics', grade: '10', topic: 'Algebra', assignTo: 'all', specificStu: '' });
    const qs = await questionsApi.list();
    setAllQs(qs as Question[]);
    setShowCreate(true);
  }

  async function openEdit(a: Assignment) {
    setEditId(a.id);
    setMaxAttempts(a.maxAttempts ?? 3);
    setSelStu(null); setStuSearch('');
    setForm({ title: a.title, dueDate: a.dueDate.split('T')[0], subject: a.subject.toLowerCase(), grade: String(a.grade), topic: a.topic, assignTo: ['all','gr10','gr11','gr12','none'].includes(a.assignTo) ? a.assignTo : 'all', specificStu: '' });
    setSelQIds(new Set(a.questions.map((q) => q.question.id)));
    setDocs(a.documents.map((d) => ({ id: d.id, title: d.title, content: d.content || '', imageData: d.imageData || '' })));
    const qs = await questionsApi.list();
    setAllQs(qs as Question[]);
    setShowCreate(true);
  }

  async function saveAssign() {
    if (!form.title.trim()) { showToast('Enter a title', 'warn'); return; }
    if (!form.dueDate) { showToast('Set due date', 'warn'); return; }
    const payload = { title: form.title, subject: form.subject, grade: Number(form.grade), topic: form.topic, dueDate: form.dueDate, assignTo: selStu?.id || form.specificStu || form.assignTo, maxAttempts, questionIds: [...selQIds], documents: docs.filter((d) => d.title || d.content || d.imageData) };
    try {
      if (editId) { await assignmentsApi.update(editId, payload); showToast('Updated ✅'); }
      else { await assignmentsApi.create(payload); showToast(`✅ "${form.title}" created!`); }
      setShowCreate(false); load();
    } catch (e: unknown) { showToast((e as Error).message, 'err'); }
  }

  async function delAssign(id: string) {
    if (!confirm('Delete this assignment?')) return;
    await assignmentsApi.delete(id);
    showToast('Deleted', 'info'); load();
  }

  function toggleQ(id: string) {
    setSelQIds((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  function addDoc() { setDocs((d) => [...d, { title: '', content: '', imageData: '' }]); }
  function removeDoc(i: number) { setDocs((d) => d.filter((_, idx) => idx !== i)); }

  async function handleDocImg(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    const b64 = await compressImage(e.target.files[0]);
    setDocs((d) => d.map((doc, idx) => idx === i ? { ...doc, imageData: b64 } : doc));
  }

  const toLbl = (a: Assignment) => a.assignTo === 'all' ? 'All' : a.assignTo === 'gr10' ? 'Gr10' : a.assignTo === 'gr11' ? 'Gr11' : a.assignTo === 'gr12' ? 'Gr12' : a.assignTo === 'none' ? '🚫 Hidden' : a.assignTo;

  return (
    <div>
      <div className="ph"><h2>📋 Assignments</h2><p>Create quizzes, attach documents &amp; images, then allocate to students</p></div>
      <div className="flex jb ia mb2">
        <span className="sm ct2">{list.length} assignment(s)</span>
        <button className="btn bp" onClick={openCreate}>+ Create Assignment</button>
      </div>

      {list.length === 0 ? (
        <div className="empty"><div className="eico">📭</div><h3>No assignments yet</h3><p>Create your first assignment above.</p></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="dt">
            <thead><tr><th>Title</th><th>Subject</th><th>Assigned To</th><th>Qs</th><th>Docs</th><th>Attempts</th><th>Submissions</th><th>Due</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {list.map((a) => {
                const dd = new Date(a.dueDate), now = new Date(), ov = dd < now;
                return (
                  <tr key={a.id}>
                    <td><div className="bold fh" style={{ fontSize: 14 }}>{a.title}</div><div className="xs ct3">{a.topic}</div></td>
                    <td><span className={`badge ${subjectBadge(a.subject)}`}>{a.subject === 'MATHEMATICS' ? '📐' : '⚗️'} Gr{a.grade}</span></td>
                    <td><span className={`sm bold ${a.assignTo === 'none' ? 'cdr' : 'cp'}`}>{toLbl(a)}</span></td>
                    <td><span className="badge btl">{a.questions.length} Qs</span></td>
                    <td><span className="badge bcy">{a.documents.length} 📄</span></td>
                    <td><span className="xs ct2">Max {a.maxAttempts ?? 3}x</span></td>
                    <td><span className="badge btl">{a._count?.results ?? 0} 📋</span></td>
                    <td className={`${ov ? 'cdr' : 'cp'} sm bold`}>{fmtDate(a.dueDate)}</td>
                    <td><span className={`badge ${a.assignTo === 'none' ? 'bng' : ov ? 'bng' : 'bok'}`}>{a.assignTo === 'none' ? '🚫 Hidden' : ov ? 'Overdue' : 'Active'}</span></td>
                    <td>
                      <div className="flex g1 wrap">
                        <button className="btn bg-btn btn-sm" onClick={() => setViewAssign(a)}>👁 View</button>
                        <button className="btn ba btn-sm" onClick={() => openEdit(a)}>✏️</button>
                        <button className="btn bd-btn btn-sm" onClick={() => delAssign(a.id)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreate && (
        <Modal title={editId ? '📋 Edit Assignment' : '📋 Create Assignment'} onClose={() => setShowCreate(false)} wide>
          <div className="grid2" style={{ gap: 10 }}>
            <div className="fg"><label className="lbl">Title</label><input type="text" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Algebra Test 1" /></div>
            <div className="fg"><label className="lbl">Due Date</label><input type="date" className="input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
            <div className="fg"><label className="lbl">Subject</label>
              <select className="select" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value, topic: TOPICS[e.target.value]?.[Number(form.grade)]?.[0] || '' })}>
                <option value="mathematics">Mathematics</option><option value="physical_sciences">Physical Sciences</option>
              </select>
            </div>
            <div className="fg"><label className="lbl">Grade</label>
              <select className="select" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value, topic: TOPICS[form.subject]?.[Number(e.target.value)]?.[0] || '' })}>
                <option value="10">Grade 10</option><option value="11">Grade 11</option><option value="12">Grade 12</option>
              </select>
            </div>
          </div>
          <div className="fg"><label className="lbl">Topic</label>
            <input list="asgn-topics-list" className="input" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="Type or select a topic…" />
            <datalist id="asgn-topics-list">{topics.map((t) => <option key={t} value={t} />)}</datalist>
          </div>
          <div className="grid2" style={{ gap: 10 }}>
            <div className="fg"><label className="lbl">Assign To</label>
              <select className="select" value={form.assignTo} onChange={(e) => setForm({ ...form, assignTo: e.target.value, specificStu: '' })}>
                <option value="all">All Students</option><option value="gr10">Grade 10 Only</option><option value="gr11">Grade 11 Only</option><option value="gr12">Grade 12 Only</option>
                <option value="specific">Specific Student (enter PIN/ID below)</option>
                <option value="none">🚫 Hidden (archived)</option>
              </select>
            </div>
            <div className="fg"><label className="lbl">Max Attempts per Student</label>
              <select className="select" value={maxAttempts} onChange={(e) => setMaxAttempts(Number(e.target.value))}>
                <option value="1">1 — Single attempt</option>
                <option value="2">2 attempts</option>
                <option value="3">3 attempts (recommended)</option>
                <option value="5">5 attempts</option>
                <option value="99">Unlimited</option>
              </select>
            </div>
          </div>
          {form.assignTo === 'specific' && (
            <div className="fg">
              <label className="lbl">Search Student</label>
              {selStu ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(20,184,166,.08)', borderRadius: 10, border: '1.5px solid var(--p)' }}>
                  <div><div className="bold">{selStu.name}</div><div className="xs ct3">Grade {selStu.grade}</div></div>
                  <button className="btn bg-btn btn-sm" onClick={() => { setSelStu(null); setStuSearch(''); }}>✕</button>
                </div>
              ) : (
                <>
                  <input type="text" className="input" value={stuSearch} onChange={(e) => setStuSearch(e.target.value)} placeholder="Type student name to search…" />
                  {stuResults.length > 0 && (
                    <div style={{ border: '1.5px solid var(--bd)', borderRadius: 10, overflow: 'hidden', marginTop: 4 }}>
                      {stuResults.map((s) => (
                        <div key={s.id} onClick={() => { setSelStu(s); setStuSearch(s.name); setStuResults([]); }}
                          style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                          className="hover-row">
                          <span className="bold">{s.name}</span>
                          <span className="xs ct3">Grade {s.grade}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <span className="xs ct3 mt1">Only the selected student will see this assignment.</span>
                </>
              )}
            </div>
          )}
          {/* Question picker */}
          <div style={{ marginBottom: 14 }}>
            <div className="flex jb ia mb1"><label className="lbl">Select Questions from Bank</label><span className="sm ct2">{selQIds.size} selected</span></div>
            <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5, border: '1.5px solid var(--bd)', borderRadius: 'var(--rs)', padding: 10, background: 'rgba(20,184,166,.04)' }}>
              {allQs.length === 0 ? <div className="no-data">No questions yet.</div> :
                allQs.map((q) => (
                  <label key={q.id} className="chk-row">
                    <input type="checkbox" checked={selQIds.has(q.id)} onChange={() => toggleQ(q.id)} style={{ accentColor: 'var(--p)', width: 16, height: 16 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="sm bold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.question}</div>
                      <div className="xs ct3">{q.subject === 'MATHEMATICS' ? '📐' : '⚗️'} Gr{q.grade} · {q.topic} · {q.difficulty}</div>
                    </div>
                  </label>
                ))}
            </div>
          </div>
          {/* Documents */}
          <div style={{ marginBottom: 14 }}>
            <div className="flex jb ia mb1"><label className="lbl">Supporting Documents</label><button className="btn ba btn-sm" onClick={addDoc}>+ Add</button></div>
            {docs.map((d, i) => (
              <div key={i} className="card card-sm" style={{ border: '1.5px solid var(--bd)', marginBottom: 8 }}>
                <div className="flex jb ia mb1"><span className="sm bold">Document {i + 1}</span><button className="btn bd-btn btn-sm" onClick={() => removeDoc(i)}>Remove</button></div>
                <div className="fg"><label className="lbl">Title</label><input type="text" className="input" value={d.title} onChange={(e) => setDocs((ds) => ds.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} placeholder="e.g. Study Notes" /></div>
                <div className="fg"><label className="lbl">Content</label><textarea className="textarea" value={d.content} onChange={(e) => setDocs((ds) => ds.map((x, j) => j === i ? { ...x, content: e.target.value } : x))} placeholder="Type notes, formulas…" style={{ minHeight: 80 }} /></div>
                <div className="fg"><label className="lbl">Image</label>
                  <div className="file-zone" onClick={() => document.getElementById(`doc-img-${i}`)?.click()}>
                    <input type="file" id={`doc-img-${i}`} accept="image/*" style={{ display: 'none' }} onChange={(e) => handleDocImg(i, e)} />
                    {d.imageData ? <img src={d.imageData} style={{ maxHeight: 75, maxWidth: '100%', borderRadius: 6 }} /> : <span className="sm ct3">📎 Click to attach image</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex g1"><button className="btn bp" onClick={saveAssign}>💾 Save &amp; Allocate</button><button className="btn bg-btn" onClick={() => setShowCreate(false)}>Cancel</button></div>
        </Modal>
      )}

      {/* View Modal */}
      {viewAssign && (
        <Modal title={viewAssign.title} onClose={() => setViewAssign(null)} wide>
          <div className="flex ia g2 wrap mb2">
            <span className={`badge ${subjectBadge(viewAssign.subject)}`}>{viewAssign.subject === 'MATHEMATICS' ? '📐 Maths' : '⚗️ Physics'}</span>
            <span className="badge btl">Gr{viewAssign.grade} · {viewAssign.topic}</span>
            <span className="badge bcy">Due: {fmtDate(viewAssign.dueDate)}</span>
          </div>
          {viewAssign.documents.length > 0 && (
            <>
              <div className="sec-h">📄 Supporting Documents</div>
              {viewAssign.documents.map((d) => (
                <div key={d.id} className="doc-vw">
                  <div className="doc-title">📄 {d.title}</div>
                  {d.content && <div className="doc-body">{d.content}</div>}
                  {d.imageData && <img src={d.imageData} className="q-img mt1" alt="Document" />}
                </div>
              ))}
            </>
          )}
          <div className="sec-h mt2">📝 Questions ({viewAssign.questions.length})</div>
          {viewAssign.questions.map(({ question: q }, i) => (
            <div key={q.id} className="qcard" style={{ marginBottom: 8 }}>
              {q.imageData && <img src={q.imageData} className="q-img" alt="" />}
              <div className="qtxt" style={{ fontWeight: 600 }}>{i + 1}. {q.question}</div>
            </div>
          ))}
        </Modal>
      )}
    </div>
  );
}
