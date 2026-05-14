import { useEffect, useRef, useState, useCallback } from 'react';
import { questions as questionsApi, packs as packsApi, type QuestionStat } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { showToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import SnippetToolbar from '../../components/SnippetToolbar';
import type { Question, Pack, QuestionStatus } from '../../types';
import { compressDiagram } from '../../utils/helpers';
import DiagramViewer from '../../components/DiagramViewer';
import { diffMeta } from '../../utils/difficulty';
import DifficultyKey from '../../components/DifficultyKey';
import QuestionGenerator, { SUBJECT_THEME } from '../../components/QuestionGenerator';
import { statusMeta, qualityMeta, COGNITIVE_LEVELS } from '../../utils/questionMeta';
import PillSelect from '../../components/PillSelect';

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

interface QForm {
  subject: string; grade: string; topic: string; difficulty: string;
  question: string; options: string; answer: string; solution: string; imageData: string;
  capsCode: string; cognitiveLevel: string;
}
const defaultForm = (): QForm => ({
  subject: 'mathematics', grade: '10', topic: 'Algebra', difficulty: 'Easy',
  question: '', options: '', answer: '', solution: '', imageData: '',
  capsCode: '', cognitiveLevel: '',
});

export default function AdminQuestions() {
  const { user } = useAuth();
  const isTutor = user?.role === 'TUTOR';
  const defaultGrade = isTutor && user?.teachGrades?.length ? String(Math.min(...(user.teachGrades as number[]))) : '10';

  const isAdmin = user?.role === 'ADMIN';

  const [qs, setQs] = useState<Question[]>([]);
  const [search, setSearch] = useState('');
  const [filterSub, setFilterSub] = useState('');
  const [filterGrade, setFilterGrade] = useState(isTutor && user?.teachGrades?.length ? defaultGrade : '');
  const [filterTopic, setFilterTopic] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [form, setForm] = useState<QForm>(defaultForm());
  const [editId, setEditId] = useState('');
  const [importText, setImportText] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const optionsRef = useRef<HTMLTextAreaElement>(null);
  const answerRef = useRef<HTMLInputElement>(null);
  const solutionRef = useRef<HTMLTextAreaElement>(null);

  // Pack-attach flow
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [attachOpen, setAttachOpen] = useState(false);

  const [stats, setStats] = useState<Record<string, QuestionStat>>({});

  const load = useCallback(async () => {
    const params: Record<string, string> = {};
    if (filterSub) params.subject = filterSub.toUpperCase();
    if (filterGrade) params.grade = filterGrade;
    if (filterTopic) params.topic = filterTopic;
    if (search) params.search = search;
    if (filterStatus) {
      if (filterStatus === 'FLAGGED') params.qualityFlag = 'flagged';
      else params.status = filterStatus;
    }
    try {
      const data = await questionsApi.list(params);
      setQs(data as Question[]);
      // Quality signals — fetched in parallel, overlaid on cards
      try {
        const ids = (data as Question[]).map((q) => q.id).slice(0, 200);
        if (ids.length) setStats(await questionsApi.stats(ids));
        else setStats({});
      } catch { /* silent — stats are best-effort */ }
    } catch (e: unknown) {
      // Don't fail silently — a broken list call is why "I generated
      // questions but the bank is empty" happens. Surface it.
      showToast((e as Error).message || 'Could not load the question bank', 'err');
    }
  }, [search, filterSub, filterGrade, filterTopic, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const filterTopics = filterSub && filterGrade ? TOPICS[filterSub]?.[Number(filterGrade)] || [] : [];
  const formTopics = TOPICS[form.subject]?.[Number(form.grade)] || [];
  const gradeOptions = isTutor && user?.teachGrades?.length ? (user.teachGrades as number[]).sort() : [10, 11, 12];
  const baseGrade = isTutor && user?.teachGrades?.length ? defaultGrade : '';
  const anyFilter = !!(search || filterSub || filterTopic || filterStatus || filterGrade !== baseGrade);

  async function saveQ() {
    if (!form.topic || !form.question || !form.answer) { showToast('Fill required fields', 'warn'); return; }
    const opts = form.options.split('\n').map((o) => o.replace(/^★\s*/, '').trim()).filter(Boolean);
    const payload = {
      subject: form.subject, grade: Number(form.grade), topic: form.topic,
      difficulty: form.difficulty.toUpperCase(),
      question: form.question, options: opts, answer: form.answer, solution: form.solution,
      visibility: 'ALL', // legacy field — Packs now govern student visibility
      imageData: form.imageData || null,
      capsCode: form.capsCode.trim() || null,
      cognitiveLevel: form.cognitiveLevel ? Number(form.cognitiveLevel) : null,
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

  // Move a single question through the review pipeline.
  async function changeStatus(q: Question, status: QuestionStatus) {
    try {
      await questionsApi.setStatus(q.id, status);
      showToast(`Moved to ${statusMeta(status).label}`, 'success');
      load();
    } catch (e: unknown) { showToast((e as Error).message, 'err'); }
  }

  // Publish every clean (no validation errors) DRAFT/REVIEW question in a group.
  async function publishGroup(groupKey: string, items: Question[]) {
    const ready = items.filter(
      (q) => q.status !== 'PUBLISHED' && (q.validationErrors?.length ?? 0) === 0,
    );
    if (!ready.length) { showToast('Nothing ready to publish in this group', 'warn'); return; }
    if (!confirm(`Publish ${ready.length} validated question(s) in "${groupKey}"? They become eligible for Packs.`)) return;
    let ok = 0;
    for (const q of ready) {
      try { await questionsApi.setStatus(q.id, 'PUBLISHED'); ok++; } catch { /* keep going */ }
    }
    showToast(`Published ${ok} question(s)`, 'success');
    load();
  }

  async function delGroup(groupKey: string, ids: string[]) {
    if (!ids.length) return;
    if (!confirm(`Delete all ${ids.length} question(s) in "${groupKey}"? They will be removed from any Pack they belong to. This cannot be undone.`)) return;
    try {
      const r = await questionsApi.bulkDelete(ids);
      showToast(`Deleted ${r.deleted} question(s)`, 'info');
      setSelectedIds((prev) => { const s = new Set(prev); ids.forEach((id) => s.delete(id)); return s; });
      load();
    } catch (e: unknown) { showToast((e as Error).message, 'err'); }
  }

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
  }

  function editQ(q: Question) {
    setForm({
      subject: q.subject.toLowerCase(), grade: String(q.grade), topic: q.topic,
      difficulty: q.difficulty.charAt(0) + q.difficulty.slice(1).toLowerCase(),
      question: q.question,
      options: q.options.map((o) => (o === q.answer ? '★ ' : '') + o).join('\n'),
      answer: q.answer, solution: q.solution || '', imageData: q.imageData || '',
      capsCode: q.capsCode || '', cognitiveLevel: q.cognitiveLevel ? String(q.cognitiveLevel) : '',
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
    const b64 = await compressDiagram(e.target.files[0]);
    setForm((f) => ({ ...f, imageData: b64 }));
  }

  // ─── Group questions by subject · grade · topic ──────────────────
  // Keeps the bank tidy: every question lives under a collapsible header
  // showing its count, and each group can be deleted in one action.
  const groups = (() => {
    const map = new Map<string, { subject: string; grade: number; topic: string; items: Question[] }>();
    for (const q of qs) {
      const key = `${q.subject}__${q.grade}__${q.topic}`;
      if (!map.has(key)) map.set(key, { subject: q.subject, grade: q.grade, topic: q.topic, items: [] });
      map.get(key)!.items.push(q);
    }
    return Array.from(map.entries())
      .map(([key, g]) => ({ key, ...g }))
      .sort((a, b) =>
        a.subject.localeCompare(b.subject) || a.grade - b.grade || a.topic.localeCompare(b.topic));
  })();

  return (
    <div>
      <div className="ph">
        <h2>📚 My Question Bank</h2>
        <p>Search, generate, review and bundle your CAPS questions — all in one place.</p>
      </div>

      {/* ─── Browse & manage — search + filters + actions, pinned to the top ─── */}
      <div className="ca" style={{ padding: 14, marginBottom: 14 }}>
        <div className="flex jb ia wrap g2" style={{ marginBottom: 10 }}>
          <div className="xs ct3">
            {qs.length} question{qs.length === 1 ? '' : 's'}{anyFilter ? ' match your filters' : ' in your bank'}
            {' · '}generate below, grouped further down
          </div>
          <div className="flex g1 wrap">
            <button className="btn ba btn-sm" onClick={() => { setForm(defaultForm()); setEditId(''); setShowAdd(true); }}>📝 Add manually</button>
            <button className="btn ba btn-sm" onClick={() => setShowImport(true)}>📂 Import</button>
            <button
              className={`btn btn-sm ${selectMode ? 'bg-btn' : 'ba'}`}
              onClick={() => { setSelectMode((v) => !v); if (selectMode) setSelectedIds(new Set()); }}
              title="Select multiple questions to add to a Pack"
            >
              {selectMode ? `✓ Selecting ${selectedIds.size}` : '☑ Select for Pack'}
            </button>
            {selectedIds.size > 0 && (
              <button className="btn bg-btn btn-sm" onClick={() => setAttachOpen(true)}>
                📦 Add {selectedIds.size} to Pack →
              </button>
            )}
            {isAdmin && (
              <button className="btn ba btn-sm" onClick={() => setShowQuality(true)} title="Health check across the whole bank">
                📊 Quality report
              </button>
            )}
          </div>
        </div>

        {/* Browse bar — every filter is a visible, tappable pill. No dropdowns. */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)' }}>🔍</span>
          <input
            type="text" className="input" style={{ paddingLeft: 34 }}
            placeholder="Search question text or topic…"
            value={search} onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'grid', gap: 7 }}>
          <div className="flex ia g2 wrap">
            <span className="xs bold ct3" style={{ minWidth: 56 }}>Subject</span>
            <PillSelect
              ariaLabel="Filter by subject"
              value={filterSub}
              onChange={(v) => { setFilterSub(v); setFilterTopic(''); }}
              options={[
                { value: '', label: 'All' },
                { value: 'mathematics', label: SUBJECT_THEME.mathematics.short, icon: SUBJECT_THEME.mathematics.icon },
                { value: 'physical_sciences', label: SUBJECT_THEME.physical_sciences.short, icon: SUBJECT_THEME.physical_sciences.icon },
              ]}
            />
          </div>
          <div className="flex ia g2 wrap">
            <span className="xs bold ct3" style={{ minWidth: 56 }}>Grade</span>
            <PillSelect
              ariaLabel="Filter by grade"
              value={filterGrade}
              onChange={(v) => { setFilterGrade(v); setFilterTopic(''); }}
              options={[
                { value: '', label: 'All' },
                ...gradeOptions.map((g) => ({ value: String(g), label: `Gr ${g}` })),
              ]}
            />
          </div>
          <div className="flex ia g2 wrap">
            <span className="xs bold ct3" style={{ minWidth: 56 }}>Topic</span>
            {filterTopics.length === 0 ? (
              <span className="xs ct3" style={{ fontStyle: 'italic' }}>Pick a subject &amp; grade above to filter by topic</span>
            ) : (
              <PillSelect
                ariaLabel="Filter by topic"
                value={filterTopic}
                onChange={setFilterTopic}
                options={[
                  { value: '', label: 'All topics' },
                  ...filterTopics.map((t) => ({ value: t, label: t })),
                ]}
              />
            )}
          </div>
          {isAdmin && (
            <div className="flex ia g2 wrap">
              <span className="xs bold ct3" style={{ minWidth: 56 }}>Status</span>
              <PillSelect
                ariaLabel="Filter by review status"
                value={filterStatus}
                onChange={setFilterStatus}
                options={[
                  { value: '', label: 'All' },
                  { value: 'REVIEW', label: 'In review', icon: '🔍' },
                  { value: 'PUBLISHED', label: 'Published', icon: '✅' },
                  { value: 'DRAFT', label: 'Draft', icon: '✏️' },
                  { value: 'RETIRED', label: 'Retired', icon: '📦' },
                  { value: 'FLAGGED', label: 'Quality-flagged', icon: '🚩' },
                ]}
              />
            </div>
          )}
          {anyFilter && (
            <div>
              <button
                type="button" className="btn ba btn-sm"
                onClick={() => { setSearch(''); setFilterSub(''); setFilterGrade(baseGrade); setFilterTopic(''); setFilterStatus(''); }}
              >✕ Clear filters</button>
            </div>
          )}
        </div>
      </div>

      {/* Flow strip — where the bank sits in the pipeline */}
      <div className="ca" style={{
        padding: '9px 14px', marginBottom: 12,
        background: 'linear-gradient(135deg, rgba(20,184,166,.07), rgba(14,165,233,.04))',
        border: '1px solid rgba(20,184,166,.22)',
      }}>
        <div className="flex ia g1 wrap" style={{ fontSize: 12 }}>
          <span className="xs bold ct2" style={{ letterSpacing: .3 }}>HOW IT FLOWS</span>
          {[
            { i: '✏️', t: 'Create or generate' },
            { i: '🔍', t: 'Review' },
            { i: '✅', t: 'Publish' },
            { i: '📦', t: 'Bundle into a Pack' },
          ].map((s, idx, arr) => (
            <span key={s.t} className="flex ia" style={{ gap: 5 }}>
              <span style={{ fontWeight: 600 }}>{s.i} {s.t}</span>
              {idx < arr.length - 1 && <span className="ct3" style={{ margin: '0 2px' }}>→</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Difficulty key — only shown to tutors/admins */}
      <DifficultyKey />

      {/* Guided generator — generate, then it auto-focuses the bank on what you made */}
      <QuestionGenerator onDone={(created) => {
        // After a generation run, point the bank's filters at exactly what was
        // just created so the new questions are visible immediately — fixes
        // "I generated questions but the bank still looks empty".
        const first = created?.[0];
        if (first) {
          setFilterSub(first.subject.toLowerCase());
          setFilterGrade(String(first.grade));
          setFilterTopic(first.topic);
          setFilterStatus('');
        } else {
          load();
        }
      }} />

      {/* Grouped list — subject · grade · topic, each collapsible & deletable */}
      {qs.length === 0 ? (
        <div className="empty"><div className="eico">📭</div><h3>No questions yet</h3><p>Generate or add questions above — then bundle them into a Pack.</p></div>
      ) : (
        <>
          <div className="xs ct3 mb1">
            {qs.length} question{qs.length === 1 ? '' : 's'} across {groups.length} group{groups.length === 1 ? '' : 's'}
          </div>
          {groups.map((g) => {
            const collapsed = collapsedGroups.has(g.key);
            const subj = g.subject === 'MATHEMATICS' ? SUBJECT_THEME.mathematics : SUBJECT_THEME.physical_sciences;
            const groupIds = g.items.map((q) => q.id);
            const groupLabel = `${subj.short} · Gr${g.grade} · ${g.topic}`;
            const withImg = g.items.filter((q) => q.imageData).length;
            const published = g.items.filter((q) => q.status === 'PUBLISHED').length;
            const inReview = g.items.filter((q) => q.status === 'REVIEW' || q.status === 'DRAFT').length;
            const readyToPublish = g.items.filter(
              (q) => q.status !== 'PUBLISHED' && (q.validationErrors?.length ?? 0) === 0,
            ).length;
            return (
              <div key={g.key} style={{ marginBottom: 12 }}>
                {/* Group header */}
                <div className="flex ia g1 wrap" style={{
                  padding: '9px 12px', borderRadius: 10,
                  background: subj.bg, border: `1px solid ${subj.border}`,
                }}>
                  <button
                    className="btn btn-sm"
                    onClick={() => toggleGroup(g.key)}
                    title={collapsed ? 'Expand group' : 'Collapse group'}
                    style={{
                      width: 28, height: 28, padding: 0, flex: '0 0 auto',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--p)', color: '#fff', border: 'none', borderRadius: 8,
                      fontSize: 13, fontWeight: 800,
                    }}
                  >{collapsed ? '▸' : '▾'}</button>
                  <span style={{ fontSize: 16 }}>{subj.icon}</span>
                  <span style={{ fontFamily: 'var(--fh)', fontWeight: 800, fontSize: 13.5, color: subj.fg }}>
                    {groupLabel}
                  </span>
                  <span className="badge btl">{g.items.length} question{g.items.length === 1 ? '' : 's'}</span>
                  {published > 0 && <span className="badge" style={{ background: 'rgba(21,128,61,.12)', color: '#15803d' }} title="Published — eligible for Packs">✅ {published}</span>}
                  {inReview > 0 && <span className="badge" style={{ background: 'rgba(180,83,9,.12)', color: '#b45309' }} title="Draft or in review — not yet eligible for Packs">🔍 {inReview}</span>}
                  {withImg > 0 && <span className="badge bcy" title="Questions with a diagram">🖼 {withImg}</span>}
                  <div style={{ flex: 1 }} />
                  {selectMode && (
                    <button
                      className="btn ba btn-sm"
                      onClick={() => setSelectedIds((prev) => {
                        const s = new Set(prev);
                        const allSel = groupIds.every((id) => s.has(id));
                        groupIds.forEach((id) => allSel ? s.delete(id) : s.add(id));
                        return s;
                      })}
                      title="Select / deselect every question in this group"
                    >☑ Select group</button>
                  )}
                  {readyToPublish > 0 && (
                    <button
                      className="btn btn-sm"
                      onClick={() => publishGroup(groupLabel, g.items)}
                      title="Publish every validated question in this group"
                      style={{ background: '#15803d', color: '#fff', border: 'none' }}
                    >✅ Publish {readyToPublish}</button>
                  )}
                  <button
                    className="btn btn-sm"
                    onClick={() => delGroup(groupLabel, groupIds)}
                    title="Delete every question in this group"
                    style={{ background: '#b91c1c', color: '#fff', border: 'none' }}
                  >🗑 Delete group</button>
                </div>

                {/* Group body */}
                {!collapsed && g.items.map((q) => {
                  const isSel = selectedIds.has(q.id);
                  const sm = statusMeta(q.status);
                  const s = stats[q.id];
                  const qFlag = qualityMeta(s?.qualityFlag || q.qualityFlag);
                  const vErrors = q.validationErrors ?? [];
                  return (
                    <div className="qcard" key={q.id} style={{
                      marginTop: 8, marginLeft: 14,
                      border: isSel ? '2px solid var(--p)'
                        : vErrors.length ? '1px solid rgba(185,28,28,.4)' : undefined,
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
                          {/* Review status */}
                          <span title={sm.hint} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '2px 8px', borderRadius: 99,
                            background: sm.bg, color: sm.fg, border: `1px solid ${sm.border}`,
                            fontSize: 10.5, fontWeight: 700,
                          }}>{sm.icon} {sm.label}</span>
                          {(() => {
                            const m = diffMeta(q.difficulty);
                            return (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '2px 8px', borderRadius: 99,
                                background: m.bg, color: m.fg, border: `1px solid ${m.borderColor}`,
                                fontSize: 10.5, fontWeight: 700,
                              }}>{m.icon} {m.label}</span>
                            );
                          })()}
                          {/* Auto quality flag */}
                          {qFlag && (
                            <span title={qFlag.hint} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '2px 8px', borderRadius: 99,
                              background: qFlag.bg, color: qFlag.fg, border: `1px solid ${qFlag.border}`,
                              fontSize: 10.5, fontWeight: 700,
                            }}>{qFlag.icon} {qFlag.label}</span>
                          )}
                          {q.cognitiveLevel ? (
                            <span className="badge btl" title="CAPS cognitive level">L{q.cognitiveLevel}</span>
                          ) : null}
                          {q.capsCode && <span className="xs ct3" title="CAPS curriculum index">{q.capsCode}</span>}
                          {q.imageData && <span className="badge bcy">🖼 Image</span>}
                          {s && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: 'var(--t2)', marginLeft: 4 }}>
                              <span title="Number of packs containing this question">📦 {s.packCount}</span>
                              <span title="Total student attempts">🎯 {s.attempts}</span>
                              {s.attempts > 0 && (
                                <span
                                  title="Average correct rate"
                                  style={{
                                    fontWeight: 700,
                                    color: s.correctRate >= 70 ? '#16a34a' : s.correctRate >= 40 ? '#b45309' : '#b91c1c',
                                  }}
                                >{s.correctRate}%</span>
                              )}
                              {s.attempts >= 4 && (
                                <span
                                  title="Discrimination — how well it separates strong from weak students (higher is better)"
                                  style={{
                                    fontWeight: 700,
                                    color: s.discrimination >= 20 ? '#16a34a' : s.discrimination >= 10 ? '#b45309' : '#b91c1c',
                                  }}
                                >⚖️ {s.discrimination}</span>
                              )}
                            </span>
                          )}
                        </div>
                        <div className="flex g1 wrap">
                          {/* Review-pipeline actions */}
                          {q.status !== 'PUBLISHED' && (
                            <button
                              className="btn btn-sm"
                              onClick={() => changeStatus(q, 'PUBLISHED')}
                              disabled={vErrors.length > 0}
                              title={vErrors.length ? 'Fix validation errors before publishing' : 'Publish — eligible for Packs'}
                              style={{
                                background: vErrors.length ? 'var(--bg)' : '#15803d',
                                color: vErrors.length ? 'var(--t3)' : '#fff',
                                border: 'none', opacity: vErrors.length ? 0.6 : 1,
                              }}
                            >✅ Publish</button>
                          )}
                          {q.status === 'PUBLISHED' && (
                            <button className="btn ba btn-sm" onClick={() => changeStatus(q, 'RETIRED')} title="Retire — pull from circulation">📦 Retire</button>
                          )}
                          {(q.status === 'PUBLISHED' || q.status === 'RETIRED' || q.status === 'DRAFT') && (
                            <button className="btn ba btn-sm" onClick={() => changeStatus(q, 'REVIEW')} title="Send back to review">🔍 Review</button>
                          )}
                          <button className="btn ba btn-sm" onClick={() => toggleExp(q.id)} title="Show answer & solution">👁</button>
                          <button className="btn ba btn-sm" onClick={() => editQ(q)} title="Edit">✏️</button>
                          <button className="btn ba btn-sm" onClick={() => delQ(q.id)} title="Delete">🗑</button>
                        </div>
                      </div>
                      {/* Blocking validation errors */}
                      {vErrors.length > 0 && (
                        <div style={{
                          marginTop: 6, padding: '7px 10px', borderRadius: 8,
                          background: 'rgba(185,28,28,.08)', border: '1px solid rgba(185,28,28,.3)',
                        }}>
                          <div className="xs" style={{ fontWeight: 700, color: '#b91c1c' }}>
                            ⚠ {vErrors.length} issue{vErrors.length === 1 ? '' : 's'} block publishing:
                          </div>
                          <ul style={{ margin: '3px 0 0', paddingLeft: 18 }}>
                            {vErrors.map((er, i) => <li key={i} className="xs ct2">{er}</li>)}
                          </ul>
                        </div>
                      )}
                      {q.imageData && <div style={{ marginTop: 6 }}><DiagramViewer src={q.imageData} alt="Question diagram" maxThumbHeight={220} /></div>}
                      <div className="qtxt">{q.question}</div>
                      <div className="qopts">{q.options.map((o, i) => <span key={i} className="qopt">{String.fromCharCode(65 + i)}. {o}</span>)}</div>
                      {expanded.has(q.id) && (
                        <div className="qrev">
                          <div className="qrev-lbl">✅ Correct Answer</div>
                          <strong>{q.answer}</strong>
                          <div style={{ marginTop: 8 }}>{(q.solution || '').split('\n').filter(Boolean).map((sol, i) => (
                            <div key={i} className="qstep"><div className="qsn">{i + 1}</div><div>{sol}</div></div>
                          ))}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </>
      )}

      {/* Add / Edit Modal — guided, fully-tappable. No dropdowns. */}
      {showAdd && (
        <Modal title={editId ? '✏️ Edit Question' : '📝 Add a Question'} onClose={() => { setShowAdd(false); setEditId(''); }} wide>
          <div className="xs ct3 mb2">Answer the prompts below — every choice is one tap.</div>
          <div className="fg">
            <label className="lbl">1. Which subject?</label>
            <PillSelect
              ariaLabel="Subject"
              value={form.subject}
              onChange={(v) => setForm({ ...form, subject: v, topic: TOPICS[v]?.[Number(form.grade)]?.[0] || '' })}
              options={[
                { value: 'mathematics', label: SUBJECT_THEME.mathematics.label, icon: SUBJECT_THEME.mathematics.icon },
                { value: 'physical_sciences', label: SUBJECT_THEME.physical_sciences.label, icon: SUBJECT_THEME.physical_sciences.icon },
              ]}
            />
          </div>
          <div className="fg">
            <label className="lbl">2. Which grade?</label>
            <PillSelect
              ariaLabel="Grade"
              value={form.grade}
              onChange={(v) => setForm({ ...form, grade: v, topic: TOPICS[form.subject]?.[Number(v)]?.[0] || '' })}
              options={gradeOptions.map((g) => ({ value: String(g), label: `Grade ${g}` }))}
            />
          </div>
          <div className="fg">
            <label className="lbl">3. Which topic?</label>
            <PillSelect
              ariaLabel="Topic"
              value={form.topic}
              onChange={(v) => setForm({ ...form, topic: v })}
              options={formTopics.map((t) => ({ value: t, label: t }))}
            />
          </div>
          <div className="fg">
            <label className="lbl">4. How hard is it?</label>
            <PillSelect
              ariaLabel="Difficulty"
              value={form.difficulty}
              onChange={(v) => setForm({ ...form, difficulty: v })}
              options={(['Easy', 'Medium', 'Hard'] as const).map((d) => {
                const m = diffMeta(d.toUpperCase());
                return { value: d, label: m.label, icon: m.icon };
              })}
            />
          </div>
          <div className="grid2" style={{ gap: 10 }}>
            <div className="fg"><label className="lbl">CAPS code <span className="xs ct3">(optional)</span></label>
              <input className="input" value={form.capsCode} onChange={(e) => setForm({ ...form, capsCode: e.target.value })} placeholder="e.g. M10-01" />
            </div>
            <div className="fg"><label className="lbl">Cognitive level <span className="xs ct3">(CAPS 1-4 · optional)</span></label>
              <PillSelect
                ariaLabel="Cognitive level"
                value={form.cognitiveLevel}
                onChange={(v) => setForm({ ...form, cognitiveLevel: v })}
                options={[
                  { value: '', label: 'Not set' },
                  ...COGNITIVE_LEVELS.map((c) => ({ value: String(c.value), label: `L${c.value}`, hint: c.hint })),
                ]}
              />
            </div>
          </div>
          <div className="fg">
            <label className="lbl">5. Write the question</label>
            <textarea ref={questionRef} className="textarea" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} placeholder="Type the question here" />
            <SnippetToolbar targetRef={questionRef} value={form.question} onChange={(v) => setForm({ ...form, question: v })} />
          </div>
          <div className="fg"><label className="lbl">6. Add a diagram <span className="xs ct3">(optional)</span></label>
            <div className="file-zone" onClick={() => document.getElementById('q-img-inp')?.click()}>
              <input type="file" id="q-img-inp" accept="image/*" style={{ display: 'none' }} onChange={handleImgUpload} />
              {form.imageData ? <img src={form.imageData} style={{ maxHeight: 150, maxWidth: '100%', borderRadius: 8 }} /> : <span className="sm ct3">📷 Click to attach an image</span>}
            </div>
            {form.imageData && <button className="btn ba btn-sm mt1" onClick={() => setForm({ ...form, imageData: '' })}>✕ Remove image</button>}
          </div>
          <div className="fg">
            <label className="lbl">7. List the options <span className="xs ct3">(one per line · prefix the correct one with ★)</span></label>
            <textarea ref={optionsRef} className="textarea" value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} placeholder={'★ x = 5\nx = 3\nx = 7\nx = 10'} style={{ minHeight: 88 }} />
            <SnippetToolbar targetRef={optionsRef} value={form.options} onChange={(v) => setForm({ ...form, options: v })} />
          </div>
          <div className="fg">
            <label className="lbl">8. Confirm the correct answer <span className="xs ct3">(must match one option exactly)</span></label>
            <input ref={answerRef} type="text" className="input" value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} placeholder="e.g. x = 5" />
            <SnippetToolbar targetRef={answerRef} value={form.answer} onChange={(v) => setForm({ ...form, answer: v })} />
          </div>
          <div className="fg">
            <label className="lbl">9. Explain the solution <span className="xs ct3">(step by step)</span></label>
            <textarea ref={solutionRef} className="textarea" value={form.solution} onChange={(e) => setForm({ ...form, solution: e.target.value })} placeholder={'Step 1: …\nStep 2: …'} style={{ minHeight: 85 }} />
            <SnippetToolbar targetRef={solutionRef} value={form.solution} onChange={(v) => setForm({ ...form, solution: v })} />
          </div>
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
          unpublishedCount={qs.filter((q) => selectedIds.has(q.id) && q.status !== 'PUBLISHED').length}
          onClose={() => setAttachOpen(false)}
          onDone={() => {
            setAttachOpen(false);
            setSelectedIds(new Set());
            setSelectMode(false);
          }}
        />
      )}

      {/* Quality Report Modal */}
      {showQuality && (
        <QualityReportModal
          onClose={() => setShowQuality(false)}
          onJump={(flag) => { setShowQuality(false); setFilterStatus(flag === 'all' ? 'FLAGGED' : 'FLAGGED'); }}
        />
      )}
    </div>
  );
}

// ─── Quality report — bank-wide health check ─────────────────────
function QualityReportModal({ onClose, onJump }: { onClose: () => void; onJump: (flag: string) => void }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof questionsApi.qualityReport>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try { setData(await questionsApi.qualityReport()); }
    catch (e: unknown) { showToast((e as Error).message, 'err'); onClose(); }
    finally { setLoading(false); }
  }, [onClose]);

  useEffect(() => { fetch(); }, [fetch]);

  async function recompute() {
    setRecomputing(true);
    try {
      const r = await questionsApi.recomputeFlags();
      showToast(`Recomputed flags on ${r.updated} question(s)`, 'success');
      await fetch();
    } catch (e: unknown) { showToast((e as Error).message, 'err'); }
    finally { setRecomputing(false); }
  }

  return (
    <Modal title="📊 Question Bank — Quality Report" onClose={onClose} wide>
      {loading || !data ? (
        <div className="ct3" style={{ padding: 24, textAlign: 'center' }}>Crunching the numbers…</div>
      ) : (
        <>
          <div className="xs ct2 mb2">
            Every published &amp; in-review question, scored on real student attempts.
            <b> Garbage In, Garbage Out</b> — fix or retire the flagged ones so your stats stay trustworthy.
          </div>
          {/* Count tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginBottom: 14 }}>
            {[
              { k: 'healthy', label: 'Healthy', icon: '✅', color: '#15803d', n: data.counts.healthy },
              { k: 'broken', label: 'Likely broken', icon: '🛑', color: '#b91c1c', n: data.counts.broken },
              { k: 'low_discrimination', label: 'Low discrim.', icon: '⚖️', color: '#b45309', n: data.counts.low_discrimination },
              { k: 'trivial', label: 'Too easy', icon: '😴', color: '#b45309', n: data.counts.trivial },
              { k: 'no_attempts', label: 'Unproven', icon: '🆕', color: '#0369a1', n: data.counts.no_attempts },
            ].map((t) => (
              <div key={t.k} style={{
                padding: '10px 12px', borderRadius: 10, border: '1px solid var(--bd)', background: 'var(--bg)',
              }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: t.color }}>{t.icon} {t.n}</div>
                <div className="xs ct3">{t.label}</div>
              </div>
            ))}
          </div>
          <div className="flex g1 mb2 wrap">
            <button className="btn ba btn-sm" onClick={recompute} disabled={recomputing}>
              {recomputing ? '↻ Recomputing…' : '↻ Recompute flags'}
            </button>
            {data.flagged.length > 0 && (
              <button className="btn ba btn-sm" onClick={() => onJump('all')}>🔎 Show flagged in the bank</button>
            )}
          </div>
          {/* Flagged list */}
          {data.flagged.length === 0 ? (
            <div className="empty" style={{ padding: 20 }}>
              <div className="eico">🎉</div><h3>Nothing flagged</h3>
              <p>Every question with enough attempts is performing well.</p>
            </div>
          ) : (
            <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--bd)', borderRadius: 10 }}>
              {data.flagged.map((f) => {
                const qf = qualityMeta(f.flag);
                return (
                  <div key={f.id} style={{ padding: '9px 12px', borderBottom: '1px solid var(--bd)' }}>
                    <div className="flex ia g1 wrap">
                      {qf && (
                        <span style={{
                          padding: '2px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 700,
                          background: qf.bg, color: qf.fg, border: `1px solid ${qf.border}`,
                        }}>{qf.icon} {qf.label}</span>
                      )}
                      <span className="xs ct3">{f.subject === 'MATHEMATICS' ? 'Maths' : 'Phys Sci'} · Gr{f.grade} · {f.topic}</span>
                      <div style={{ flex: 1 }} />
                      <span className="xs ct2" title="Attempts">🎯 {f.attempts}</span>
                      <span className="xs ct2" title="Correct rate">{f.correctRate}%</span>
                      <span className="xs ct2" title="Discrimination">⚖️ {f.discrimination}</span>
                    </div>
                    <div className="sm" style={{ marginTop: 3 }}>{f.question}</div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

// ─── Bulk-attach selected questions to a Pack ────────────────────
function AttachToPackModal({ questionIds, unpublishedCount, onClose, onDone }: {
  questionIds: string[]; unpublishedCount: number; onClose: () => void; onDone: () => void;
}) {
  const [list, setList] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeId, setActiveId] = useState<string>('');
  const publishedCount = questionIds.length - unpublishedCount;

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
      // The backend only accepts PUBLISHED questions into a pack and tells us
      // how many it dropped — surface that so the user isn't surprised.
      const updated = await packsApi.update(activeId, {
        questionIds: merged,
        documentIds: existingDIds,
      }) as { skippedUnpublished?: number };
      const skipped = updated.skippedUnpublished ?? 0;
      const added = questionIds.length - skipped;
      if (skipped > 0) {
        showToast(
          `Added ${added} to "${pack.title}". ${skipped} skipped — only Published questions can go in a Pack.`,
          'warn',
        );
      } else {
        showToast(`Added ${added} question(s) to "${pack.title}"`, 'success');
      }
      onDone();
    } catch (e: unknown) {
      showToast((e as Error).message, 'err');
    } finally { setBusy(false); }
  }

  return (
    <Modal title={`📦 Add ${questionIds.length} question(s) to a Pack`} onClose={onClose}>
      {unpublishedCount > 0 && (
        <div style={{
          padding: '8px 11px', borderRadius: 8, marginBottom: 10,
          background: 'rgba(180,83,9,.09)', border: '1px solid rgba(180,83,9,.3)',
        }}>
          <div className="xs" style={{ fontWeight: 700, color: '#b45309' }}>
            ⚠ {unpublishedCount} of your {questionIds.length} selected question(s) aren’t Published yet
          </div>
          <div className="xs ct2" style={{ marginTop: 2 }}>
            Only <b>Published</b> questions go into a Pack — {publishedCount > 0 ? `${publishedCount} will be added, the rest skipped.` : 'none will be added until you publish them.'} Publish them first from the bank.
          </div>
        </div>
      )}
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
