import { useEffect, useState, useCallback } from 'react';
import { questions as questionsApi, packs as packsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { showToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import type { Question, Pack } from '../../types';
import { subjectBadge, diffBadge, compressImage } from '../../utils/helpers';

const TOPICS: Record<string, Record<number, string[]>> = {
  mathematics: {
    10: ['Algebra','Functions & Graphs','Trigonometry','Statistics','Finance & Growth','Euclidean Geometry'],
    11: ['Quadratic Equations','Trigonometric Functions','Analytical Geometry','Finance','Counting & Probability','Inequalities'],
    12: ['Differential Calculus','Sequences & Series','Polynomials','Exponential & Logarithms','Regression Analysis','Trigonometry Advanced'],
  },
  physical_sciences: {
    10: ["Newton's Laws",'Momentum','Energy & Power','Waves & Sound','Electricity & Magnetism','Chemistry: Matter'],
    11: ['Projectile Motion','Electrostatics','Electric Circuits','Intermolecular Forces','Chemical Equilibrium','Vectors & Scalars'],
    12: ['Momentum & Impulse','Vertical Projectile Motion','Electrodynamics','Organic Chemistry','Electrochemistry','Optical Phenomena'],
  },
};

interface QForm { subject: string; grade: string; topic: string; difficulty: string; question: string; options: string; answer: string; solution: string; imageData: string; }
const defaultForm = (): QForm => ({ subject: 'mathematics', grade: '10', topic: 'Algebra', difficulty: 'Easy', question: '', options: '', answer: '', solution: '', imageData: '' });

export default function AdminQuestions() {
  const { user } = useAuth();
  const isTutor = user?.role === 'TUTOR';
  const defaultGrade = isTutor && user?.teachGrades?.length ? String(Math.min(...(user.teachGrades as number[]))) : '10';

  const [qs, setQs] = useState<Question[]>([]);
  const [search, setSearch] = useState('');
  const [filterSub, setFilterSub] = useState('');
  const [filterGrade, setFilterGrade] = useState(isTutor && user?.teachGrades?.length ? defaultGrade : '');
  const [filterTopic, setFilterTopic] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState<QForm>(defaultForm());
  const [editId, setEditId] = useState('');
  const [importText, setImportText] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Pack-attach flow
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [attachOpen, setAttachOpen] = useState(false);

  // Generate
  const [genSub, setGenSub] = useState('mathematics');
  const [genGr, setGenGr] = useState(defaultGrade);
  const [genTp, setGenTp] = useState('Algebra');
  const [genCt, setGenCt] = useState('5');

  const load = useCallback(async () => {
    const params: Record<string, string> = {};
    if (filterSub) params.subject = filterSub.toUpperCase();
    if (filterGrade) params.grade = filterGrade;
    if (filterTopic) params.topic = filterTopic;
    if (search) params.search = search;
    const data = await questionsApi.list(params);
    setQs(data as Question[]);
  }, [search, filterSub, filterGrade, filterTopic]);

  useEffect(() => { load(); }, [load]);

  const filterTopics = filterSub && filterGrade ? TOPICS[filterSub]?.[Number(filterGrade)] || [] : [];
  const genTopics = TOPICS[genSub]?.[Number(genGr)] || [];
  const formTopics = TOPICS[form.subject]?.[Number(form.grade)] || [];
  const gradeOptions = isTutor && user?.teachGrades?.length ? (user.teachGrades as number[]).sort() : [10, 11, 12];

  async function generate() {
    try {
      const r = await questionsApi.generate(genSub, Number(genGr), genTp, Number(genCt)) as { count: number };
      showToast(`Generated ${r.count} question(s)`, 'success');
      load();
    } catch (e: unknown) { showToast((e as Error).message, 'err'); }
  }

  async function saveQ() {
    if (!form.topic || !form.question || !form.answer) { showToast('Fill required fields', 'warn'); return; }
    const opts = form.options.split('\n').map((o) => o.replace(/^★\s*/, '').trim()).filter(Boolean);
    const payload = {
      subject: form.subject, grade: Number(form.grade), topic: form.topic,
      difficulty: form.difficulty.toUpperCase(),
      question: form.question, options: opts, answer: form.answer, solution: form.solution,
      visibility: 'ALL', // legacy field — Packs now govern student visibility
      imageData: form.imageData || null,
    };
    try {
      if (editId) { await questionsApi.update(editId, payload); showToast('Updated', 'success'); }
      else { await questionsApi.create(payload); showToast('Added', 'success'); }
      setShowAdd(false); setForm(defaultForm()); setEditId(''); load();
    } catch (e: unknown) { showToast((e as Error).message, 'err'); }
  }

  async function delQ(id: string) {
    if (!confirm('Delete this question? It will be removed from any Pack it belongs to.')) return;
    await questionsApi.delete(id);
    showToast('Deleted', 'info'); load();
  }

  function editQ(q: Question) {
    setForm({
      subject: q.subject.toLowerCase(), grade: String(q.grade), topic: q.topic,
      difficulty: q.difficulty.charAt(0) + q.difficulty.slice(1).toLowerCase(),
      question: q.question,
      options: q.options.map((o) => (o === q.answer ? '★ ' : '') + o).join('\n'),
      answer: q.answer, solution: q.solution || '', imageData: q.imageData || '',
    });
    setEditId(q.id); setShowAdd(true);
  }

  async function doImport() {
    try {
      const r = await questionsApi.import(importText) as { count: number };
      showToast(`Imported ${r.count} question(s)`, 'success');
      setShowImport(false); setImportText(''); load();
    } catch (e: unknown) { showToast((e as Error).message, 'err'); }
  }

  function toggleExp(id: string) {
    setExpanded((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  function toggleSel(id: string) {
    setSelectedIds((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  async function handleImgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    const b64 = await compressImage(e.target.files[0]);
    setForm((f) => ({ ...f, imageData: b64 }));
  }

  return (
    <div>
      <div className="ph">
        <h2>📝 Question Bank</h2>
        <p>The source pool that feeds your Content Packs.</p>
      </div>

      {/* How this fits banner */}
      <div className="ca" style={{
        padding: '12px 14px', marginBottom: 14,
        background: 'linear-gradient(135deg, rgba(20,184,166,.08), rgba(14,165,233,.05))',
        border: '1px solid rgba(20,184,166,.25)',
      }}>
        <div className="flex ia g2" style={{ flexWrap: 'wrap' }}>
          <span style={{ fontSize: 22 }}>💡</span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontFamily: 'var(--fh)', fontWeight: 700, fontSize: 13 }}>How this fits the flow</div>
            <div className="xs ct2" style={{ lineHeight: 1.45 }}>
              Generate or write questions here, then bundle them into a <b>📦 Content Pack</b>.
              Packs are what you share with tutors, and tutors unlock for students.
              Students never see raw questions — only the packs unlocked for them.
            </div>
          </div>
          {selectedIds.size > 0 && (
            <button className="btn bg-btn btn-sm" onClick={() => setAttachOpen(true)}>
              📦 Add {selectedIds.size} to Pack →
            </button>
          )}
        </div>
      </div>

      {/* Generate */}
      <div className="card mb2">
        <div className="sec-h">⚡ Generate Questions</div>
        <div className="grid2" style={{ gap: 10, marginBottom: 12 }}>
          <div className="fg"><label className="lbl">Subject</label>
            <select className="select" value={genSub} onChange={(e) => { setGenSub(e.target.value); setGenTp(TOPICS[e.target.value]?.[Number(genGr)]?.[0] || ''); }}>
              <option value="mathematics">Mathematics</option><option value="physical_sciences">Physical Sciences</option>
            </select>
          </div>
          <div className="fg"><label className="lbl">Grade</label>
            <select className="select" value={genGr} onChange={(e) => { setGenGr(e.target.value); setGenTp(TOPICS[genSub]?.[Number(e.target.value)]?.[0] || ''); }}>
              {gradeOptions.map((g) => <option key={g} value={String(g)}>Grade {g}</option>)}
            </select>
          </div>
          <div className="fg"><label className="lbl">Topic</label>
            <input list="gen-topics-list" className="input" value={genTp} onChange={(e) => setGenTp(e.target.value)} placeholder="Pick a topic" />
            <datalist id="gen-topics-list">{genTopics.map((t) => <option key={t} value={t} />)}</datalist>
          </div>
          <div className="fg"><label className="lbl">Count</label>
            <select className="select" value={genCt} onChange={(e) => setGenCt(e.target.value)}>
              <option value="5">5 Questions</option><option value="10">10 Questions</option><option value="20">20 Questions</option>
            </select>
          </div>
        </div>
        <div className="flex g1 wrap">
          <button className="btn bg-btn" onClick={generate}>⚡ Auto-Generate</button>
          <button className="btn ba" onClick={() => { setForm(defaultForm()); setEditId(''); setShowAdd(true); }}>📝 Add Manually</button>
          <button className="btn ba" onClick={() => setShowImport(true)}>📂 Import Text</button>
          <button
            className={`btn ${selectMode ? 'bg-btn' : 'ba'}`}
            onClick={() => { setSelectMode((v) => !v); if (selectMode) setSelectedIds(new Set()); }}
            title="Select multiple questions to add to a Pack"
          >
            {selectMode ? '✓ Selecting' : '☑ Multi-select'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex g2 mb2 wrap">
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)' }}>🔍</span>
          <input type="text" className="input" style={{ paddingLeft: 34 }} placeholder="Search question text or topic" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="select" style={{ width: 'auto' }} value={filterSub} onChange={(e) => { setFilterSub(e.target.value); setFilterTopic(''); }}>
          <option value="">All subjects</option><option value="mathematics">Maths</option><option value="physical_sciences">Physics</option>
        </select>
        <select className="select" style={{ width: 'auto' }} value={filterGrade} onChange={(e) => { setFilterGrade(e.target.value); setFilterTopic(''); }}>
          <option value="">All grades</option>
          {gradeOptions.map((g) => <option key={g} value={String(g)}>Grade {g}</option>)}
        </select>
        <select className="select" style={{ width: 'auto' }} value={filterTopic} onChange={(e) => setFilterTopic(e.target.value)} disabled={filterTopics.length === 0}>
          <option value="">{filterTopics.length === 0 ? 'Pick subject & grade first' : 'All topics'}</option>
          {filterTopics.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* List */}
      {qs.length === 0 ? (
        <div className="empty"><div className="eico">📭</div><h3>No questions yet</h3><p>Generate or add questions above — then bundle them into a Pack.</p></div>
      ) : (
        qs.map((q) => {
          const isSel = selectedIds.has(q.id);
          return (
            <div className="qcard" key={q.id} style={{
              border: isSel ? '2px solid var(--p)' : undefined,
              background: isSel ? 'rgba(20,184,166,.06)' : undefined,
            }}>
              <div className="qhd">
                <div className="flex ia g1 wrap">
                  {selectMode && (
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggleSel(q.id)}
                      style={{ width: 18, height: 18, accentColor: 'var(--p)' }}
                    />
                  )}
                  <span className={`badge ${subjectBadge(q.subject)}`}>{q.subject === 'MATHEMATICS' ? '📐 Maths' : '⚗️ Physics'}</span>
                  <span className={`badge ${diffBadge(q.difficulty)}`}>{q.difficulty.charAt(0) + q.difficulty.slice(1).toLowerCase()}</span>
                  <span className="badge btl">Gr{q.grade}</span>
                  <span className="xs ct3">{q.topic}</span>
                  {q.imageData && <span className="badge bcy">🖼 Image</span>}
                </div>
                <div className="flex g1 wrap">
                  <button className="btn ba btn-sm" onClick={() => toggleExp(q.id)} title="Show answer & solution">👁</button>
                  <button className="btn ba btn-sm" onClick={() => editQ(q)} title="Edit">✏️</button>
                  <button className="btn ba btn-sm" onClick={() => delQ(q.id)} title="Delete">🗑</button>
                </div>
              </div>
              {q.imageData && <img src={q.imageData} className="q-img" alt="Question diagram" />}
              <div className="qtxt">{q.question}</div>
              <div className="qopts">{q.options.map((o, i) => <span key={i} className="qopt">{String.fromCharCode(65 + i)}. {o}</span>)}</div>
              {expanded.has(q.id) && (
                <div className="qrev">
                  <div className="qrev-lbl">✅ Correct Answer</div>
                  <strong>{q.answer}</strong>
                  <div style={{ marginTop: 8 }}>{(q.solution || '').split('\n').filter(Boolean).map((s, i) => (
                    <div key={i} className="qstep"><div className="qsn">{i + 1}</div><div>{s}</div></div>
                  ))}</div>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Add / Edit Modal */}
      {showAdd && (
        <Modal title={editId ? '✏️ Edit Question' : '📝 Add Question'} onClose={() => { setShowAdd(false); setEditId(''); }} wide>
          <div className="grid2" style={{ gap: 10 }}>
            <div className="fg"><label className="lbl">Subject</label>
              <select className="select" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value, topic: TOPICS[e.target.value]?.[Number(form.grade)]?.[0] || '' })}>
                <option value="mathematics">Mathematics</option><option value="physical_sciences">Physical Sciences</option>
              </select>
            </div>
            <div className="fg"><label className="lbl">Grade</label>
              <select className="select" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value, topic: TOPICS[form.subject]?.[Number(e.target.value)]?.[0] || '' })}>
                {gradeOptions.map((g) => <option key={g} value={String(g)}>Grade {g}</option>)}
              </select>
            </div>
            <div className="fg"><label className="lbl">Topic</label>
              <input list="form-topics-list" className="input" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="Type or pick a topic" />
              <datalist id="form-topics-list">{formTopics.map((t) => <option key={t} value={t} />)}</datalist>
            </div>
            <div className="fg"><label className="lbl">Difficulty</label>
              <select className="select" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                <option>Easy</option><option>Medium</option><option>Hard</option>
              </select>
            </div>
          </div>
          <div className="fg"><label className="lbl">Question</label><textarea className="textarea" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} placeholder="Type the question here" /></div>
          <div className="fg"><label className="lbl">Image (optional)</label>
            <div className="file-zone" onClick={() => document.getElementById('q-img-inp')?.click()}>
              <input type="file" id="q-img-inp" accept="image/*" style={{ display: 'none' }} onChange={handleImgUpload} />
              {form.imageData ? <img src={form.imageData} style={{ maxHeight: 150, maxWidth: '100%', borderRadius: 8 }} /> : <span className="sm ct3">📷 Click to attach an image</span>}
            </div>
            {form.imageData && <button className="btn ba btn-sm mt1" onClick={() => setForm({ ...form, imageData: '' })}>✕ Remove image</button>}
          </div>
          <div className="fg"><label className="lbl">Options (one per line · prefix correct with ★)</label><textarea className="textarea" value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} placeholder={'★ x = 5\nx = 3\nx = 7\nx = 10'} style={{ minHeight: 88 }} /></div>
          <div className="fg"><label className="lbl">Correct answer (must match one option exactly)</label><input type="text" className="input" value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} placeholder="e.g. x = 5" /></div>
          <div className="fg"><label className="lbl">Step-by-step solution</label><textarea className="textarea" value={form.solution} onChange={(e) => setForm({ ...form, solution: e.target.value })} placeholder={'Step 1: …\nStep 2: …'} style={{ minHeight: 85 }} /></div>
          <div className="xs ct3 mb2">
            💡 Student visibility is governed by <b>📦 Packs</b>. Add this question to a Pack to control who sees it.
          </div>
          <div className="flex g1"><button className="btn bg-btn" onClick={saveQ}>💾 Save question</button><button className="btn ba" onClick={() => { setShowAdd(false); setEditId(''); }}>Cancel</button></div>
        </Modal>
      )}

      {/* Import Modal */}
      {showImport && (
        <Modal title="📂 Import Questions" onClose={() => setShowImport(false)} wide>
          <p className="sm ct2 mb2">Paste questions in the format shown.</p>
          <div className="doc-vw mb2"><div className="doc-body" style={{ fontFamily: 'monospace', fontSize: 11.5 }}>{`SUBJECT: mathematics\nGRADE: 10\nTOPIC: Algebra\nDIFF: Easy\nQ: Solve for x: 2x + 4 = 10\nA: ★ x = 3\nA: x = 5\nANS: x = 3\nSOL: Step 1: Subtract 4: 2x=6\\nStep 2: x=3`}</div></div>
          <div className="fg"><label className="lbl">Paste here</label><textarea className="textarea" style={{ minHeight: 200 }} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Paste formatted questions…" /></div>
          <div className="flex g1"><button className="btn bg-btn" onClick={doImport}>📂 Import</button><button className="btn ba" onClick={() => setShowImport(false)}>Cancel</button></div>
        </Modal>
      )}

      {/* Bulk → Pack Modal */}
      {attachOpen && (
        <AttachToPackModal
          questionIds={Array.from(selectedIds)}
          onClose={() => setAttachOpen(false)}
          onDone={() => {
            setAttachOpen(false);
            setSelectedIds(new Set());
            setSelectMode(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Bulk-attach selected questions to a Pack ────────────────────
function AttachToPackModal({ questionIds, onClose, onDone }: { questionIds: string[]; onClose: () => void; onDone: () => void }) {
  const [list, setList] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    packsApi.list()
      .then((d) => { setList(d as Pack[]); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function attach() {
    if (!activeId) { showToast('Pick a pack', 'warn'); return; }
    setBusy(true);
    try {
      // Fetch current pack so we don't drop existing items
      const pack = await packsApi.get(activeId) as Pack;
      const existingQIds = pack.questions.map((q) => q.questionId);
      const existingDIds = pack.documents.map((d) => d.documentId);
      const merged = Array.from(new Set([...existingQIds, ...questionIds]));
      await packsApi.update(activeId, {
        questionIds: merged,
        documentIds: existingDIds,
      });
      showToast(`Added ${questionIds.length} question(s) to "${pack.title}"`, 'success');
      onDone();
    } catch (e: unknown) {
      showToast((e as Error).message, 'err');
    } finally { setBusy(false); }
  }

  return (
    <Modal title={`📦 Add ${questionIds.length} question(s) to a Pack`} onClose={onClose}>
      {loading ? (
        <div className="ct3" style={{ padding: 20 }}>Loading packs…</div>
      ) : list.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 36 }}>📦</div>
          <div className="sm ct2 mt1">No packs yet. Create one first in the Packs page.</div>
        </div>
      ) : (
        <>
          <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--bd)', borderRadius: 10 }}>
            {list.map((p) => (
              <label key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderBottom: '1px solid var(--bd)', cursor: 'pointer',
                background: activeId === p.id ? 'rgba(20,184,166,.08)' : 'transparent',
              }}>
                <input type="radio" name="pack" checked={activeId === p.id} onChange={() => setActiveId(p.id)} />
                <span style={{ fontSize: 22 }}>{p.coverEmoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="sm bold">{p.title}</div>
                  <div className="xs ct3">
                    {p.subject === 'MATHEMATICS' ? 'Maths' : 'Phys Sci'} · Gr{p.grade}
                    {p.topic ? ` · ${p.topic}` : ''} · 📝 {p.questions.length}
                  </div>
                </div>
              </label>
            ))}
          </div>
          <div className="flex g1 mt2">
            <button className="btn bg-btn wf" onClick={attach} disabled={busy}>{busy ? '…' : '➕ Add to pack'}</button>
            <button className="btn ba wf" onClick={onClose}>Cancel</button>
          </div>
        </>
      )}
    </Modal>
  );
}
