import { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { assignments as assignmentsApi, questions as questionsApi, studentSearch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { showToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import type { Assignment, Question } from '../../types';
import { subjectBadge, fmtDate, compressImage, compressDiagram } from '../../utils/helpers';
import { diffMeta } from '../../utils/difficulty';
import PillSelect from '../../components/PillSelect';
import DiagramViewer from '../../components/DiagramViewer';
import AssignmentLiveTray from '../../components/AssignmentLiveTray';
import AssignmentHeatmap from '../../components/AssignmentHeatmap';

const TOPICS: Record<string, Record<number, string[]>> = {
  mathematics: { 10: ['Algebra','Functions & Graphs','Trigonometry','Statistics','Finance & Growth','Euclidean Geometry'], 11: ['Quadratic Equations','Trigonometric Functions','Analytical Geometry','Finance','Counting & Probability','Inequalities'], 12: ['Differential Calculus','Sequences & Series','Polynomials','Exponential & Logarithms','Regression Analysis','Trigonometry Advanced'] },
  physical_sciences: { 10: ["Newton's Laws",'Momentum','Energy & Power','Waves & Sound','Electricity & Magnetism','Chemistry: Matter'], 11: ['Projectile Motion','Electrostatics','Electric Circuits','Intermolecular Forces','Chemical Equilibrium','Vectors & Scalars'], 12: ['Momentum & Impulse','Vertical Projectile Motion','Electrodynamics','Organic Chemistry','Electrochemistry','Optical Phenomena'] },
};

interface DocForm { id?: string; title: string; content: string; imageData: string; }

export default function AdminAssignments() {
  const { user } = useAuth();
  const isTutor = user?.role === 'TUTOR';
  const [list, setList] = useState<Assignment[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [viewAssign, setViewAssign] = useState<Assignment | null>(null);
  const [heatmapFor, setHeatmapFor] = useState<{ id: string; title: string } | null>(null);
  const [expandedLive, setExpandedLive] = useState<Set<string>>(new Set());
  const [editId, setEditId] = useState('');
  const [allQs, setAllQs] = useState<Question[]>([]);
  const [selQIds, setSelQIds] = useState<Set<string>>(new Set());
  const [docs, setDocs] = useState<DocForm[]>([]);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [form, setForm] = useState({ title: '', dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], subject: 'mathematics', grade: '10', topic: 'Algebra', assignTo: 'all', specificStu: '' });
  const [stuSearch, setStuSearch] = useState('');
  const [stuResults, setStuResults] = useState<{ id: string; name: string; grade: number; pin: string }[]>([]);
  const [selStu, setSelStu] = useState<{ id: string; name: string; grade: number } | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'overdue' | 'hidden'>('all');

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

  // Prefill support — TutorSpotlight's "📋 Assign" deep-links here with a
  // student (and optionally their weakest topic) so the loop from "spot a
  // struggling student" to "set them work" is a single tap.
  async function openCreate(prefill?: { studentId: string; studentName: string; grade: number; topic?: string }) {
    setEditId(''); setSelQIds(new Set()); setDocs([]); setMaxAttempts(3); setStuSearch('');
    setSelStu(prefill ? { id: prefill.studentId, name: prefill.studentName, grade: prefill.grade } : null);
    // Resolve the subject from the prefilled topic (could be Maths or Physics).
    let subject = 'mathematics';
    let topic = 'Algebra';
    if (prefill?.topic) {
      const g = prefill.grade;
      if ((TOPICS.physical_sciences[g] || []).includes(prefill.topic)) { subject = 'physical_sciences'; topic = prefill.topic; }
      else if ((TOPICS.mathematics[g] || []).includes(prefill.topic)) { subject = 'mathematics'; topic = prefill.topic; }
    }
    if (topic === 'Algebra') topic = TOPICS[subject]?.[prefill?.grade ?? 10]?.[0] || 'Algebra';
    setForm({
      title: prefill ? `Practice for ${prefill.studentName}` : '',
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      subject, grade: prefill ? String(prefill.grade) : '10', topic,
      assignTo: 'all', specificStu: '',
    });
    const qs = await questionsApi.list({ status: 'PUBLISHED' });
    setAllQs(qs as Question[]);
    setShowCreate(true);
  }

  // Honour a deep-link prefill once on mount, then clear router state so a
  // refresh doesn't re-open the modal.
  const location = useLocation();
  const prefillHandled = useRef(false);
  useEffect(() => {
    if (prefillHandled.current) return;
    const prefill = (location.state as { prefill?: { studentId: string; studentName: string; grade: number; topic?: string } } | null)?.prefill;
    if (prefill) {
      prefillHandled.current = true;
      openCreate(prefill);
      window.history.replaceState({}, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  async function openEdit(a: Assignment) {
    setEditId(a.id);
    setMaxAttempts(a.maxAttempts ?? 3);
    setSelStu(null); setStuSearch('');
    setForm({ title: a.title, dueDate: a.dueDate.split('T')[0], subject: a.subject.toLowerCase(), grade: String(a.grade), topic: a.topic, assignTo: ['all','gr10','gr11','gr12','none'].includes(a.assignTo) ? a.assignTo : 'all', specificStu: '' });
    setSelQIds(new Set(a.questions.map((q) => q.question.id)));
    setDocs(a.documents.map((d) => ({ id: d.id, title: d.title, content: d.content || '', imageData: d.imageData || '' })));
    const qs = await questionsApi.list({ status: 'PUBLISHED' });
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
    const b64 = await compressDiagram(e.target.files[0]);
    void compressImage;
    setDocs((d) => d.map((doc, idx) => idx === i ? { ...doc, imageData: b64 } : doc));
  }

  const toLbl = (a: Assignment) => a.assignTo === 'all' ? 'All' : a.assignTo === 'gr10' ? 'Gr10' : a.assignTo === 'gr11' ? 'Gr11' : a.assignTo === 'gr12' ? 'Gr12' : a.assignTo === 'none' ? '🚫 Hidden' : a.assignTo;

  // Status filter — keeps the table scannable as assignments pile up.
  const isOverdue = (a: Assignment) => a.assignTo !== 'none' && new Date(a.dueDate) < new Date();
  const counts = {
    all: list.length,
    active: list.filter((a) => a.assignTo !== 'none' && !isOverdue(a)).length,
    overdue: list.filter(isOverdue).length,
    hidden: list.filter((a) => a.assignTo === 'none').length,
  };
  const visible = list.filter((a) =>
    filter === 'all' ? true
    : filter === 'active' ? (a.assignTo !== 'none' && !isOverdue(a))
    : filter === 'overdue' ? isOverdue(a)
    : a.assignTo === 'none');

  return (
    <div>
      <div className="ph"><h2>📋 Assignments</h2><p>Timed quizzes with a due date — built from your question pool.</p></div>

      {/* Flow hint */}
      <div className="ca" style={{
        padding: '10px 14px', marginBottom: 12,
        background: 'linear-gradient(135deg, rgba(20,184,166,.06), rgba(14,165,233,.04))',
        border: '1px solid var(--bd)',
      }}>
        <div className="flex ia g2" style={{ fontSize: 12 }}>
          <span style={{ fontSize: 18 }}>💡</span>
          <div className="ct2" style={{ flex: 1, lineHeight: 1.45 }}>
            {isTutor
              ? <>Your question pool below is scoped to <b>📦 Packs admin shared with you</b>. To get more questions, ask admin to share another Pack.</>
              : <>Assignments are graded events with a due date. For open-ended practice use <b>📦 Packs</b> instead — students access them without deadlines.</>
            }
          </div>
        </div>
      </div>

      <div className="flex jb ia mb2 wrap" style={{ gap: 8 }}>
        <div className="flex g1 wrap">
          {([
            { k: 'all', label: 'All' },
            { k: 'active', label: '🟢 Active' },
            { k: 'overdue', label: '⚠️ Overdue' },
            { k: 'hidden', label: '🚫 Hidden' },
          ] as const).map((f) => {
            const active = filter === f.k;
            return (
              <button
                key={f.k} type="button" className="btn btn-sm"
                onClick={() => setFilter(f.k)}
                style={{
                  background: active ? 'var(--p)' : 'var(--bg)',
                  color: active ? '#fff' : 'var(--t)',
                  border: `1px solid ${active ? 'var(--p)' : 'var(--bd)'}`,
                }}
              >{f.label} · {counts[f.k]}</button>
            );
          })}
        </div>
        <button className="btn bg-btn" onClick={() => openCreate()}>+ Create assignment</button>
      </div>

      {list.length === 0 ? (
        <div className="empty"><div className="eico">📭</div><h3>No assignments yet</h3><p>Create your first assignment above.</p></div>
      ) : visible.length === 0 ? (
        <div className="empty"><div className="eico">🔍</div><h3>None in this view</h3><p>No assignments match the “{filter}” filter.</p></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="dt">
            <thead><tr><th>Title</th><th>Subject</th><th>Assigned To</th><th>Qs</th><th>Docs</th><th>Attempts</th><th>Submissions</th><th>Due</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {visible.map((a) => {
                const dd = new Date(a.dueDate), now = new Date(), ov = dd < now;
                const liveOpen = expandedLive.has(a.id);
                return (
                  <>
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
                          <button
                            className={`btn btn-sm ${liveOpen ? 'bg-btn' : 'ba'}`}
                            onClick={() => setExpandedLive((cur) => { const s = new Set(cur); s.has(a.id) ? s.delete(a.id) : s.add(a.id); return s; })}
                            title="Live submissions"
                          >📡 Live</button>
                          <button className="btn ba btn-sm" onClick={() => setHeatmapFor({ id: a.id, title: a.title })} title="Question heatmap">🔥</button>
                          <button className="btn bg-btn btn-sm" onClick={() => setViewAssign(a)}>👁</button>
                          <button className="btn ba btn-sm" onClick={() => openEdit(a)}>✏️</button>
                          <button className="btn bd-btn btn-sm" onClick={() => delAssign(a.id)}>🗑</button>
                        </div>
                      </td>
                    </tr>
                    {liveOpen && (
                      <tr key={a.id + '-live'}>
                        <td colSpan={10} style={{ padding: '0 12px 8px' }}>
                          <AssignmentLiveTray
                            assignmentId={a.id}
                            onOpenHeatmap={() => setHeatmapFor({ id: a.id, title: a.title })}
                          />
                        </td>
                      </tr>
                    )}
                  </>
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
          </div>
          <div className="fg"><label className="lbl">Subject</label>
            <PillSelect
              ariaLabel="Subject"
              value={form.subject}
              onChange={(v) => setForm({ ...form, subject: v, topic: TOPICS[v]?.[Number(form.grade)]?.[0] || '' })}
              options={[
                { value: 'mathematics', label: 'Mathematics', icon: '📐' },
                { value: 'physical_sciences', label: 'Physical Sciences', icon: '⚗️' },
              ]}
            />
          </div>
          <div className="fg"><label className="lbl">Grade</label>
            <PillSelect
              ariaLabel="Grade"
              value={form.grade}
              onChange={(v) => setForm({ ...form, grade: v, topic: TOPICS[form.subject]?.[Number(v)]?.[0] || '' })}
              options={[10, 11, 12].map((g) => ({ value: String(g), label: `Grade ${g}` }))}
            />
          </div>
          <div className="fg"><label className="lbl">Topic</label>
            <PillSelect
              ariaLabel="Topic"
              value={form.topic}
              onChange={(v) => setForm({ ...form, topic: v })}
              options={topics.map((t) => ({ value: t, label: t }))}
            />
          </div>
          <div className="fg"><label className="lbl">Assign to</label>
            <PillSelect
              ariaLabel="Assign to"
              value={form.assignTo}
              onChange={(v) => setForm({ ...form, assignTo: v, specificStu: '' })}
              options={[
                { value: 'all', label: 'All students' },
                { value: 'gr10', label: 'Grade 10 only' },
                { value: 'gr11', label: 'Grade 11 only' },
                { value: 'gr12', label: 'Grade 12 only' },
                { value: 'specific', label: 'A specific student', icon: '🎯' },
                { value: 'none', label: 'Hidden (archived)', icon: '🚫' },
              ]}
            />
          </div>
          <div className="fg"><label className="lbl">Max attempts per student</label>
            <PillSelect
              ariaLabel="Max attempts"
              value={String(maxAttempts)}
              onChange={(v) => setMaxAttempts(Number(v))}
              options={[
                { value: '1', label: '1 attempt' },
                { value: '2', label: '2 attempts' },
                { value: '3', label: '3 (recommended)' },
                { value: '5', label: '5 attempts' },
                { value: '99', label: 'Unlimited' },
              ]}
            />
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
                      <div className="xs ct3">{q.subject === 'MATHEMATICS' ? '📐' : '⚗️'} Gr{q.grade} · {q.topic} · {(() => { const m = diffMeta(q.difficulty); return <span style={{ color: m.fg, fontWeight: 600 }}>{m.icon} {m.label}</span>; })()}</div>
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
                  {d.imageData && <div className="mt1"><DiagramViewer src={d.imageData} alt={d.title || 'Document'} maxThumbHeight={220} /></div>}
                </div>
              ))}
            </>
          )}
          <div className="sec-h mt2">📝 Questions ({viewAssign.questions.length})</div>
          {viewAssign.questions.map(({ question: q }, i) => (
            <div key={q.id} className="qcard" style={{ marginBottom: 8 }}>
              {q.imageData && <div className="mt1"><DiagramViewer src={q.imageData} alt="Question diagram" maxThumbHeight={220} /></div>}
              <div className="qtxt" style={{ fontWeight: 600 }}>{i + 1}. {q.question}</div>
            </div>
          ))}
        </Modal>
      )}

      {heatmapFor && (
        <AssignmentHeatmap
          assignmentId={heatmapFor.id}
          title={heatmapFor.title}
          onClose={() => setHeatmapFor(null)}
        />
      )}
    </div>
  );
}
