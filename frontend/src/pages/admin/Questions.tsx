import { useEffect, useState, useCallback } from 'react';
import { questions as questionsApi } from '../../services/api';
import { showToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import type { Question } from '../../types';
import { subjectBadge, diffBadge, visLabel, compressImage } from '../../utils/helpers';

const CAPS_TOPICS: Record<string, Record<number, string[]>> = {
  mathematics: { 10: ['Algebra','Functions & Graphs','Trigonometry','Statistics','Finance & Growth','Euclidean Geometry'], 11: ['Quadratic Equations','Trigonometric Functions','Analytical Geometry','Finance','Counting & Probability','Inequalities'], 12: ['Differential Calculus','Sequences & Series','Polynomials','Exponential & Logarithms','Regression Analysis','Trigonometry Advanced'] },
  physical_sciences: { 10: ["Newton's Laws",'Momentum','Energy & Power','Waves & Sound','Electricity & Magnetism','Chemistry: Matter'], 11: ['Projectile Motion','Electrostatics','Electric Circuits','Intermolecular Forces','Chemical Equilibrium','Vectors & Scalars'], 12: ['Momentum & Impulse','Vertical Projectile Motion','Electrodynamics','Organic Chemistry','Electrochemistry','Optical Phenomena'] },
};

interface QForm { subject: string; grade: string; topic: string; difficulty: string; question: string; options: string; answer: string; solution: string; visibility: string; imageData: string; }

const defaultForm = (): QForm => ({ subject: 'mathematics', grade: '10', topic: 'Algebra', difficulty: 'Easy', question: '', options: '', answer: '', solution: '', visibility: 'all', imageData: '' });

export default function AdminQuestions() {
  const [qs, setQs] = useState<Question[]>([]);
  const [search, setSearch] = useState('');
  const [filterSub, setFilterSub] = useState('');
  const [filterVis, setFilterVis] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState<QForm>(defaultForm());
  const [editId, setEditId] = useState('');
  const [importText, setImportText] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Generate controls
  const [genSub, setGenSub] = useState('mathematics');
  const [genGr, setGenGr] = useState('10');
  const [genTp, setGenTp] = useState('Algebra');
  const [genCt, setGenCt] = useState('5');

  const load = useCallback(async () => {
    const params: Record<string, string> = {};
    if (filterSub) params.subject = filterSub.toUpperCase();
    if (filterVis) params.visibility = filterVis.toUpperCase();
    if (search) params.search = search;
    const data = await questionsApi.list(params);
    setQs(data as Question[]);
  }, [search, filterSub, filterVis]);

  useEffect(() => { load(); }, [load]);

  const topics = CAPS_TOPICS[genSub]?.[Number(genGr)] || [];
  const formTopics = CAPS_TOPICS[form.subject]?.[Number(form.grade)] || [];

  async function generate() {
    try {
      const r = await questionsApi.generate(genSub, Number(genGr), genTp, Number(genCt)) as { count: number };
      showToast(`✅ Generated ${r.count} questions!`);
      load();
    } catch (e: unknown) { showToast((e as Error).message, 'err'); }
  }

  async function saveQ() {
    if (!form.topic || !form.question || !form.answer) { showToast('Fill required fields', 'warn'); return; }
    const opts = form.options.split('\n').map((o) => o.replace(/^★\s*/, '').trim()).filter(Boolean);
    const payload = { subject: form.subject, grade: Number(form.grade), topic: form.topic, difficulty: form.difficulty.toUpperCase(), question: form.question, options: opts, answer: form.answer, solution: form.solution, visibility: form.visibility.toUpperCase(), imageData: form.imageData || null };
    try {
      if (editId) { await questionsApi.update(editId, payload); showToast('Updated ✅'); }
      else { await questionsApi.create(payload); showToast('Added ✅'); }
      setShowAdd(false); setForm(defaultForm()); setEditId(''); load();
    } catch (e: unknown) { showToast((e as Error).message, 'err'); }
  }

  async function delQ(id: string) {
    if (!confirm('Delete this question?')) return;
    await questionsApi.delete(id);
    showToast('Deleted', 'info'); load();
  }

  async function cycleVis(id: string) {
    const updated = await questionsApi.cycleVisibility(id) as Question;
    showToast(`Visibility → ${visLabel(updated.visibility)}`);
    load();
  }

  function editQ(q: Question) {
    setForm({ subject: q.subject.toLowerCase(), grade: String(q.grade), topic: q.topic, difficulty: q.difficulty.charAt(0) + q.difficulty.slice(1).toLowerCase(), question: q.question, options: q.options.map((o) => (o === q.answer ? '★ ' : '') + o).join('\n'), answer: q.answer, solution: q.solution || '', visibility: q.visibility.toLowerCase(), imageData: q.imageData || '' });
    setEditId(q.id); setShowAdd(true);
  }

  async function doImport() {
    try {
      const r = await questionsApi.import(importText) as { count: number };
      showToast(`✅ Imported ${r.count} question(s)!`);
      setShowImport(false); setImportText(''); load();
    } catch (e: unknown) { showToast((e as Error).message, 'err'); }
  }

  function toggleExp(id: string) {
    setExpanded((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  async function handleImgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    const b64 = await compressImage(e.target.files[0]);
    setForm((f) => ({ ...f, imageData: b64 }));
  }

  return (
    <div>
      <div className="ph"><h2>📝 Question Bank</h2><p>Generate, upload and manage CAPS questions.</p></div>

      {/* Generate */}
      <div className="card mb2">
        <div className="sec-h">⚡ Generate Questions</div>
        <div className="grid2" style={{ gap: 10, marginBottom: 12 }}>
          <div className="fg"><label className="lbl">Subject</label>
            <select className="select" value={genSub} onChange={(e) => { setGenSub(e.target.value); setGenTp(CAPS_TOPICS[e.target.value]?.[Number(genGr)]?.[0] || ''); }}>
              <option value="mathematics">Mathematics</option><option value="physical_sciences">Physical Sciences</option>
            </select>
          </div>
          <div className="fg"><label className="lbl">Grade</label>
            <select className="select" value={genGr} onChange={(e) => { setGenGr(e.target.value); setGenTp(CAPS_TOPICS[genSub]?.[Number(e.target.value)]?.[0] || ''); }}>
              <option value="10">Grade 10</option><option value="11">Grade 11</option><option value="12">Grade 12</option>
            </select>
          </div>
          <div className="fg"><label className="lbl">Topic</label>
            <select className="select" value={genTp} onChange={(e) => setGenTp(e.target.value)}>
              {topics.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="fg"><label className="lbl">Count</label>
            <select className="select" value={genCt} onChange={(e) => setGenCt(e.target.value)}>
              <option value="5">5 Questions</option><option value="10">10 Questions</option>
            </select>
          </div>
        </div>
        <div className="flex g1 wrap">
          <button className="btn bp" onClick={generate}>⚡ Auto-Generate</button>
          <button className="btn bs" onClick={() => { setForm(defaultForm()); setEditId(''); setShowAdd(true); }}>📝 Add Manually</button>
          <button className="btn ba" onClick={() => setShowImport(true)}>📂 Import Text</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex g2 mb2 wrap">
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)' }}>🔍</span>
          <input type="text" className="input" style={{ paddingLeft: 34 }} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="select" style={{ width: 'auto' }} value={filterSub} onChange={(e) => setFilterSub(e.target.value)}>
          <option value="">All Subjects</option><option value="mathematics">Maths</option><option value="physical_sciences">Physics</option>
        </select>
        <select className="select" style={{ width: 'auto' }} value={filterVis} onChange={(e) => setFilterVis(e.target.value)}>
          <option value="">All Visibility</option><option value="all">Visible All</option><option value="gr10">Gr10 Only</option><option value="gr11">Gr11 Only</option><option value="gr12">Gr12 Only</option><option value="none">Hidden</option>
        </select>
      </div>

      {/* Question list */}
      {qs.length === 0 ? (
        <div className="empty"><div className="eico">📭</div><h3>No questions yet</h3><p>Generate or add questions above.</p></div>
      ) : (
        qs.map((q) => (
          <div className="qcard" key={q.id}>
            <div className="qhd">
              <div className="flex ia g1 wrap">
                <span className={`badge ${subjectBadge(q.subject)}`}>{q.subject === 'MATHEMATICS' ? '📐 Maths' : '⚗️ Physics'}</span>
                <span className={`badge ${diffBadge(q.difficulty)}`}>{q.difficulty.charAt(0) + q.difficulty.slice(1).toLowerCase()}</span>
                <span className="badge btl">Gr{q.grade}</span>
                <span className="xs ct3">{q.topic}</span>
                <span style={{ fontSize: '9.5px', padding: '2px 8px', borderRadius: 99, background: 'rgba(8,145,178,.10)', color: 'var(--a)', border: '1px solid rgba(8,145,178,.22)' }}>👁 {visLabel(q.visibility)}</span>
                {q.imageData && <span className="badge bcy">🖼 Image</span>}
              </div>
              <div className="flex g1 wrap">
                <button className="btn bg-btn btn-sm" onClick={() => cycleVis(q.id)}>🔒 Vis</button>
                <button className="btn bg-btn btn-sm" onClick={() => toggleExp(q.id)}>👁</button>
                <button className="btn bg-btn btn-sm" onClick={() => editQ(q)}>✏️</button>
                <button className="btn bd-btn btn-sm" onClick={() => delQ(q.id)}>🗑</button>
              </div>
            </div>
            {q.imageData && <img src={q.imageData} className="q-img" alt="Question diagram" />}
            <div className="qtxt">{q.question}</div>
            <div className="qopts">{q.options.map((o, i) => <span key={i} className="qopt">{String.fromCharCode(65 + i)}. {o}</span>)}</div>
            {expanded.has(q.id) && (
              <div className="qrev">
                <div className="qrev-lbl">✅ Correct Answer</div>
                <strong>{q.answer}</strong>
                <div style={{ marginTop: 8 }}>{(q.solution || '').split('\n').map((s, i) => (
                  <div key={i} className="qstep"><div className="qsn">{i + 1}</div><div>{s}</div></div>
                ))}</div>
              </div>
            )}
          </div>
        ))
      )}

      {/* Add/Edit Modal */}
      {showAdd && (
        <Modal title={editId ? 'Edit Question' : 'Add Question'} onClose={() => { setShowAdd(false); setEditId(''); }} wide>
          <div className="grid2" style={{ gap: 10 }}>
            <div className="fg"><label className="lbl">Subject</label>
              <select className="select" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value, topic: CAPS_TOPICS[e.target.value]?.[Number(form.grade)]?.[0] || '' })}>
                <option value="mathematics">Mathematics</option><option value="physical_sciences">Physical Sciences</option>
              </select>
            </div>
            <div className="fg"><label className="lbl">Grade</label>
              <select className="select" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value, topic: CAPS_TOPICS[form.subject]?.[Number(e.target.value)]?.[0] || '' })}>
                <option value="10">Grade 10</option><option value="11">Grade 11</option><option value="12">Grade 12</option>
              </select>
            </div>
            <div className="fg"><label className="lbl">Topic</label>
              <select className="select" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
                {formTopics.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="fg"><label className="lbl">Difficulty</label>
              <select className="select" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                <option>Easy</option><option>Medium</option><option>Hard</option>
              </select>
            </div>
          </div>
          <div className="fg"><label className="lbl">Question Text</label><textarea className="textarea" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} placeholder="Enter the question…" /></div>
          <div className="fg"><label className="lbl">Question Image (optional)</label>
            <div className="file-zone" onClick={() => document.getElementById('q-img-inp')?.click()}>
              <input type="file" id="q-img-inp" accept="image/*" style={{ display: 'none' }} onChange={handleImgUpload} />
              {form.imageData ? <img src={form.imageData} style={{ maxHeight: 150, maxWidth: '100%', borderRadius: 8 }} /> : <span className="sm ct3">📷 Click to attach an image</span>}
            </div>
            {form.imageData && <button className="btn bg-btn btn-sm mt1" onClick={() => setForm({ ...form, imageData: '' })}>✕ Remove Image</button>}
          </div>
          <div className="fg"><label className="lbl">Answer Options (prefix correct with ★, one per line)</label><textarea className="textarea" value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} placeholder={'★ x = 5\nx = 3\nx = 7\nx = 10'} style={{ minHeight: 88 }} /></div>
          <div className="fg"><label className="lbl">Correct Answer</label><input type="text" className="input" value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} placeholder="e.g. x = 5" /></div>
          <div className="fg"><label className="lbl">Step-by-step Solution</label><textarea className="textarea" value={form.solution} onChange={(e) => setForm({ ...form, solution: e.target.value })} placeholder={'Step 1: …\nStep 2: …'} style={{ minHeight: 85 }} /></div>
          <div className="fg"><label className="lbl">Visible To Students</label>
            <select className="select" value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
              <option value="all">All Students</option><option value="gr10">Grade 10 Only</option><option value="gr11">Grade 11 Only</option><option value="gr12">Grade 12 Only</option><option value="none">Hidden (Admin Only)</option>
            </select>
          </div>
          <div className="flex g1"><button className="btn bp" onClick={saveQ}>💾 Save Question</button><button className="btn bg-btn" onClick={() => { setShowAdd(false); setEditId(''); }}>Cancel</button></div>
        </Modal>
      )}

      {/* Import Modal */}
      {showImport && (
        <Modal title="📂 Import Questions" onClose={() => setShowImport(false)} wide>
          <p className="sm ct2 mb2">Paste questions in the format shown.</p>
          <div className="doc-vw mb2"><div className="doc-body" style={{ fontFamily: 'monospace', fontSize: 11.5 }}>{`SUBJECT: mathematics\nGRADE: 10\nTOPIC: Algebra\nDIFF: Easy\nVIS: all\nQ: Solve for x: 2x + 4 = 10\nA: ★ x = 3\nA: x = 5\nANS: x = 3\nSOL: Step 1: Subtract 4: 2x=6\\nStep 2: x=3`}</div></div>
          <div className="fg"><label className="lbl">Paste Questions Here</label><textarea className="textarea" style={{ minHeight: 200 }} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Paste formatted questions…" /></div>
          <div className="flex g1"><button className="btn bp" onClick={doImport}>📂 Import</button><button className="btn bg-btn" onClick={() => setShowImport(false)}>Cancel</button></div>
        </Modal>
      )}
    </div>
  );
}
