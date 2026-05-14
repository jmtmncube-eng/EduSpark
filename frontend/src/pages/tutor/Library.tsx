import { useEffect, useMemo, useState } from 'react';
import {
  packs as packsApi,
  students as studentsApi,
  documents as docsApi,
  questions as questionsApi,
} from '../../services/api';
import type { Pack, User, Question } from '../../types';
import { showToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import { diffMeta } from '../../utils/difficulty';
import PackTemplatePicker from '../../components/PackTemplatePicker';

const EMOJIS = ['📦', '📚', '🧮', '⚗️', '🔬', '📐', '🎯', '🏆', '🧠', '✨'];

type Tab = 'all' | 'admin' | 'own';

export default function TutorLibrary() {
  const { user } = useAuth();
  const [list, setList] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Pack | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [tab, setTab] = useState<Tab>('all');

  async function refresh() {
    setLoading(true);
    try {
      const data = await packsApi.list();
      setList(data as Pack[]);
    } catch (e) { showToast(String((e as Error).message), 'err'); }
    finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  const adminPacks = useMemo(() => list.filter((p) => p.source !== 'own'), [list]);
  const ownPacks = useMemo(() => list.filter((p) => p.source === 'own'), [list]);
  const filtered = tab === 'admin' ? adminPacks : tab === 'own' ? ownPacks : list;

  async function deletePack(p: Pack) {
    if (!confirm(`Delete your pack "${p.title}"? Students will lose access.`)) return;
    try {
      await packsApi.delete(p.id);
      showToast('Pack deleted', 'info');
      refresh();
    } catch (e) { showToast(String((e as Error).message), 'err'); }
  }

  return (
    <div>
      <div className="flex jb ia" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'var(--fh)', fontSize: 22 }}>📦 Library</h2>
          <div className="xs ct3 mt1">
            Packs from admin you can unlock for your class · packs you create yourself for your students.
          </div>
        </div>
        <div className="flex g1">
          <button className="btn ba" onClick={() => setShowTemplate(true)}>✨ From template</button>
          <button className="btn bg-btn" onClick={() => setShowCreate(true)}>+ New custom pack</button>
        </div>
      </div>

      {/* Source tabs */}
      <div className="flex g2" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        <button className={`btn btn-sm ${tab === 'all' ? 'bg-btn' : 'ba'}`} onClick={() => setTab('all')}>
          All · {list.length}
        </button>
        <button className={`btn btn-sm ${tab === 'admin' ? 'bg-btn' : 'ba'}`} onClick={() => setTab('admin')}>
          📥 From admin · {adminPacks.length}
        </button>
        <button className={`btn btn-sm ${tab === 'own' ? 'bg-btn' : 'ba'}`} onClick={() => setTab('own')}>
          ✍️ My packs · {ownPacks.length}
        </button>
      </div>

      {loading ? (
        <div className="ct3" style={{ padding: 40, textAlign: 'center' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="ca" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>{tab === 'own' ? '✍️' : '📦'}</div>
          <h3 style={{ margin: '0 0 6px', fontFamily: 'var(--fh)' }}>
            {tab === 'own' ? 'No custom packs yet' : tab === 'admin' ? 'Nothing shared with you yet' : 'Your library is empty'}
          </h3>
          <div className="sm ct3" style={{ maxWidth: 380, margin: '0 auto 14px' }}>
            {tab === 'own'
              ? 'Build a pack with your own questions and PDFs — students never need to leave EduSpark.'
              : 'When Admin shares a Content Pack with you, it appears here.'}
          </div>
          {tab !== 'admin' && (
            <button className="btn bg-btn" onClick={() => setShowCreate(true)}>+ Create custom pack</button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {filtered.map((p) => (
            <PackCard
              key={p.id}
              pack={p}
              isOwner={p.createdById === user?.id}
              onOpen={() => setActive(p)}
              onDelete={() => deletePack(p)}
            />
          ))}
        </div>
      )}

      {active && (
        <PackDetail
          pack={active}
          isOwner={active.createdById === user?.id}
          onClose={() => setActive(null)}
          onDeleted={() => { setActive(null); refresh(); }}
        />
      )}

      {showCreate && (
        <CustomPackEditor
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); refresh(); }}
        />
      )}

      {showTemplate && (
        <PackTemplatePicker
          onClose={() => setShowTemplate(false)}
          onCreated={() => { setShowTemplate(false); refresh(); }}
        />
      )}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────
function PackCard({ pack, isOwner, onOpen, onDelete }: { pack: Pack; isOwner: boolean; onOpen: () => void; onDelete: () => void }) {
  return (
    <div className="ca" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
      <div className="flex jb ia">
        <div style={{ fontSize: 28 }}>{pack.coverEmoji}</div>
        <div className="flex g1">
          <span className={`badge ${pack.subject === 'MATHEMATICS' ? 'bma' : 'bph'}`}>
            {pack.subject === 'MATHEMATICS' ? 'Maths' : 'Phys Sci'} · Gr{pack.grade}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
            background: isOwner ? 'rgba(34,197,94,.14)' : 'rgba(14,165,233,.14)',
            color: isOwner ? '#16a34a' : '#0284c7',
            border: `1px solid ${isOwner ? 'rgba(34,197,94,.3)' : 'rgba(14,165,233,.3)'}`,
          }}>
            {isOwner ? '✍️ Mine' : '📥 Admin'}
          </span>
        </div>
      </div>
      <div style={{ fontFamily: 'var(--fh)', fontWeight: 700, fontSize: 15 }}>{pack.title}</div>
      {pack.topic && <div className="xs ct3">{pack.topic}</div>}
      {pack.description && <div className="sm ct2" style={{ lineHeight: 1.4 }}>{pack.description}</div>}
      {pack.shareNote && !isOwner && (
        <div className="xs ct2" style={{ background: 'rgba(20,184,166,.08)', padding: 6, borderRadius: 6 }}>💬 {pack.shareNote}</div>
      )}

      <div className="flex g2 ia" style={{ marginTop: 'auto', flexWrap: 'wrap', fontSize: 12, color: 'var(--t3)' }}>
        <span>📝 {pack.questions.length} Q</span>
        <span>📄 {pack.documents.length} PDF</span>
      </div>

      <div className="flex g2 mt1">
        <button className="btn bg-btn btn-sm wf" onClick={onOpen}>Open →</button>
        {isOwner && <button className="btn ba btn-sm" onClick={onDelete} title="Delete">🗑</button>}
      </div>
    </div>
  );
}

// ─── Detail Modal: Preview / Unlock / PDF / Edit ──────────────────
function PackDetail({ pack, isOwner, onClose, onDeleted }: { pack: Pack; isOwner: boolean; onClose: () => void; onDeleted: () => void }) {
  const [students, setStudents] = useState<User[]>([]);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'preview' | 'unlock' | 'export'>('preview');

  useEffect(() => {
    studentsApi.list().then((d) => setStudents(d as User[])).catch(() => {});
    packsApi.listUnlocks(pack.id).then((d) => {
      const ids = (d as { studentId: string }[]).map((u) => u.studentId);
      setUnlocked(new Set(ids));
    }).catch(() => {});
  }, [pack.id]);

  async function toggleUnlock(student: User) {
    setBusy(true);
    try {
      if (unlocked.has(student.id)) {
        await packsApi.revokeUnlock(pack.id, student.id);
        setUnlocked((cur) => { const n = new Set(cur); n.delete(student.id); return n; });
        showToast(`Revoked from ${student.name}`, 'info');
      } else {
        await packsApi.unlock(pack.id, [student.id]);
        setUnlocked((cur) => new Set(cur).add(student.id));
        showToast(`Unlocked for ${student.name} 🔓`, 'success');
      }
    } catch (e) { showToast(String((e as Error).message), 'err'); }
    finally { setBusy(false); }
  }

  async function unlockAll() {
    const remaining = students.filter((s) => !unlocked.has(s.id)).map((s) => s.id);
    if (!remaining.length) return;
    setBusy(true);
    try {
      await packsApi.unlock(pack.id, remaining);
      setUnlocked(new Set([...unlocked, ...remaining]));
      showToast(`Unlocked for ${remaining.length} students 🔓`, 'success');
    } catch (e) { showToast(String((e as Error).message), 'err'); }
    finally { setBusy(false); }
  }

  async function exportPdf(mode: 'worksheet' | 'memo') {
    setBusy(true);
    try {
      await packsApi.openPdf(pack.id, mode, pack.title);
      showToast(`${mode === 'memo' ? 'Memo' : 'Worksheet'} opened in new tab — use the browser Save button to download.`, 'info');
    } catch (e) { showToast(String((e as Error).message), 'err'); }
    finally { setBusy(false); }
  }

  async function handleDelete() {
    if (!confirm(`Delete your pack "${pack.title}"?`)) return;
    try {
      await packsApi.delete(pack.id);
      showToast('Deleted', 'info');
      onDeleted();
    } catch (e) { showToast(String((e as Error).message), 'err'); }
  }

  return (
    <Modal title={`${pack.coverEmoji} ${pack.title}`} onClose={onClose}>
      <div className="flex g2" style={{ marginBottom: 14, borderBottom: '1px solid var(--bd)', flexWrap: 'wrap' }}>
        <button className={tab === 'preview' ? 'btn bg-btn btn-sm' : 'btn ba btn-sm'} onClick={() => setTab('preview')}>👁 Preview</button>
        <button className={tab === 'unlock' ? 'btn bg-btn btn-sm' : 'btn ba btn-sm'} onClick={() => setTab('unlock')}>🔓 Unlock ({unlocked.size}/{students.length})</button>
        <button className={tab === 'export' ? 'btn bg-btn btn-sm' : 'btn ba btn-sm'} onClick={() => setTab('export')}>📥 Export PDF</button>
        {isOwner && <button className="btn ba btn-sm" onClick={handleDelete} style={{ marginLeft: 'auto' }}>🗑 Delete</button>}
      </div>

      {tab === 'preview' && (
        <div>
          {pack.documents.length > 0 && (
            <>
              <div className="sm bold mt1" style={{ marginBottom: 6 }}>📄 PDFs ({pack.documents.length})</div>
              {pack.documents.map((d) => (
                <div key={d.documentId} style={{ padding: '8px 10px', border: '1px solid var(--bd)', borderRadius: 8, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>📄</span>
                  <div style={{ flex: 1 }}>
                    <div className="sm bold">{d.document.title}</div>
                    <div className="xs ct3">{d.document.pageCount} pages · {d.document.documentKind}</div>
                  </div>
                  <a href={docsApi.fileUrl(d.document.id)} target="_blank" rel="noreferrer" className="btn ba btn-sm">↗</a>
                </div>
              ))}
            </>
          )}

          {pack.questions.length > 0 && (
            <>
              <div className="sm bold mt2" style={{ marginBottom: 6 }}>📝 Questions ({pack.questions.length})</div>
              <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--bd)', borderRadius: 10 }}>
                {pack.questions.map((q, i) => (
                  <div key={q.questionId} style={{ padding: 10, borderBottom: '1px solid var(--bd)' }}>
                    <div className="xs ct3">Q{i + 1} · {(() => { const m = diffMeta(q.question.difficulty); return <span style={{ color: m.fg, fontWeight: 600 }}>{m.icon} {m.label}</span>; })()}</div>
                    <div className="sm" style={{ fontWeight: 600, marginTop: 2 }}>{q.question.question}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'unlock' && (
        <div>
          <div className="flex jb ia" style={{ marginBottom: 8 }}>
            <div className="xs ct3">Tap a student to toggle access.</div>
            <button className="btn ba btn-sm" onClick={unlockAll} disabled={busy || unlocked.size === students.length}>Unlock all</button>
          </div>
          {students.length === 0 ? (
            <div className="ct3" style={{ padding: 20, textAlign: 'center' }}>You don't have any students yet.</div>
          ) : (
            <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--bd)', borderRadius: 10 }}>
              {students.map((s) => {
                const on = unlocked.has(s.id);
                return (
                  <button
                    key={s.id}
                    disabled={busy}
                    onClick={() => toggleUnlock(s)}
                    style={{
                      width: '100%', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderBottom: '1px solid var(--bd)',
                      background: on ? 'rgba(34,197,94,.08)' : 'transparent',
                      border: 0, cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: on ? '#22c55e' : 'var(--bd)',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700,
                    }}>
                      {on ? '✓' : s.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="sm bold">{s.name}</div>
                      <div className="xs ct3">Grade {s.grade} · {on ? 'Unlocked' : 'Locked'}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'export' && (
        <div>
          <div className="sm ct2 mb2">
            Open a branded PDF in a new tab. Use your browser's <b>Save</b> button to download it.
            <b> Worksheet</b> has space for students to write; <b>Memo</b> includes answers and step-by-step solutions.
          </div>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <button
              className="ca"
              onClick={() => exportPdf('worksheet')}
              disabled={busy || pack.questions.length === 0}
              style={{
                padding: 16, textAlign: 'left', cursor: 'pointer', border: '1px solid var(--bd)',
                background: 'var(--bg)', borderRadius: 12,
              }}
            >
              <div style={{ fontSize: 28 }}>📝</div>
              <div className="bold mt1">Worksheet</div>
              <div className="xs ct3 mt1">Questions only · for printing or handing out</div>
            </button>
            <button
              className="ca"
              onClick={() => exportPdf('memo')}
              disabled={busy || pack.questions.length === 0}
              style={{
                padding: 16, textAlign: 'left', cursor: 'pointer', border: '1px solid var(--bd)',
                background: 'var(--bg)', borderRadius: 12,
              }}
            >
              <div style={{ fontSize: 28 }}>🧾</div>
              <div className="bold mt1">Memo</div>
              <div className="xs ct3 mt1">Answers + solutions · teacher reference only</div>
            </button>
          </div>
          {pack.questions.length === 0 && (
            <div className="xs ct3 mt2">Add some questions before exporting.</div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─── Custom Pack Editor (tutor creates their own) ────────────────
function CustomPackEditor({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const defaultGrade = user?.teachGrades?.length ? Math.min(...(user.teachGrades as number[])) : 10;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState<string>('MATHEMATICS');
  const [grade, setGrade] = useState<number>(defaultGrade);
  const [topic, setTopic] = useState('');
  const [coverEmoji, setCoverEmoji] = useState('📦');
  const [selectedQ, setSelectedQ] = useState<string[]>([]);
  const [allQ, setAllQ] = useState<Question[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    questionsApi.list({ subject: subject.toLowerCase(), grade: String(grade) })
      .then((d) => setAllQ(d as Question[]))
      .catch(() => setAllQ([]));
  }, [subject, grade]);

  async function save() {
    if (!title.trim()) { showToast('Title required', 'warn'); return; }
    setSaving(true);
    try {
      await packsApi.create({
        title: title.trim(), description, subject, grade, topic, coverEmoji,
        questionIds: selectedQ, documentIds: [],
      });
      showToast('Pack created', 'success');
      onSaved();
    } catch (e) { showToast(String((e as Error).message), 'err'); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="✍️ New custom pack" onClose={onClose}>
      <div className="sm ct2 mb2">
        Bundle your questions and notes for your students. Use <b>+ Add manually</b> or
        ⚡ <b>generate</b> in the Question Bank to add fresh questions, then return here
        to bundle them.
      </div>

      <div className="fg"><label className="lbl">Title</label>
        <input className="ipt" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Trig warm-ups for Grade 11" />
      </div>
      <div className="fg"><label className="lbl">Short description</label>
        <textarea className="ipt" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this pack for?" />
      </div>

      <div className="flex g2">
        <label className="sm bold" style={{ flex: 1 }}>Subject
          <select className="ipt mt1" value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="MATHEMATICS">Mathematics</option>
            <option value="PHYSICAL_SCIENCES">Physical Sciences</option>
          </select>
        </label>
        <label className="sm bold" style={{ flex: 1 }}>Grade
          <select className="ipt mt1" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
            {(user?.teachGrades?.length ? (user.teachGrades as number[]) : [10, 11, 12]).map((g) => <option key={g} value={g}>Grade {g}</option>)}
          </select>
        </label>
      </div>

      <label className="sm bold mt2">Topic
        <input className="ipt mt1" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Quadratic Equations" />
      </label>

      <label className="sm bold mt2">Cover icon</label>
      <div className="flex g2" style={{ flexWrap: 'wrap', marginTop: 4 }}>
        {EMOJIS.map((e) => (
          <button
            key={e}
            onClick={() => setCoverEmoji(e)}
            style={{
              width: 40, height: 40, fontSize: 22, cursor: 'pointer',
              background: coverEmoji === e ? 'var(--p)' : 'transparent',
              border: '1px solid var(--bd)', borderRadius: 8,
            }}
          >{e}</button>
        ))}
      </div>

      <div className="sm bold mt2">Pick questions for this pack ({selectedQ.length} selected)</div>
      <div className="xs ct3" style={{ marginBottom: 6 }}>
        Showing your own questions + any from packs admin shared with you for Gr {grade} · {subject === 'MATHEMATICS' ? 'Maths' : 'PhysSci'}.
      </div>
      <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--bd)', borderRadius: 10 }}>
        {allQ.length === 0 ? (
          <div className="ct3" style={{ padding: 16, textAlign: 'center' }}>
            No questions yet. Add some in the Question Bank tab.
          </div>
        ) : allQ.map((q) => {
          const checked = selectedQ.includes(q.id);
          return (
            <label key={q.id} style={{
              display: 'flex', gap: 10, padding: '8px 12px',
              borderBottom: '1px solid var(--bd)', cursor: 'pointer',
              background: checked ? 'rgba(20,184,166,.08)' : 'transparent',
            }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setSelectedQ((cur) => e.target.checked ? [...cur, q.id] : cur.filter((x) => x !== q.id))}
                style={{ marginTop: 3 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="sm" style={{ fontWeight: 600 }}>{q.question}</div>
                <div className="xs ct3 mt1">{q.topic} · {(() => { const m = diffMeta(q.difficulty); return <span style={{ color: m.fg, fontWeight: 600 }}>{m.icon} {m.label}</span>; })()}</div>
              </div>
            </label>
          );
        })}
      </div>

      <div className="flex g2 mt2">
        <button className="btn ba wf" onClick={onClose}>Cancel</button>
        <button className="btn bg-btn wf" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Create pack'}</button>
      </div>
    </Modal>
  );
}
