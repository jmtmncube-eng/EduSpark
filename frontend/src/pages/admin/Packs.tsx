import { useEffect, useState } from 'react';
import { packs as packsApi, documents as docsApi, questions as questionsApi, tutors as tutorsApi } from '../../services/api';
import type { Pack, Question, PdfDocument } from '../../types';
import { showToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import { diffMeta } from '../../utils/difficulty';
import PackTemplatePicker from '../../components/PackTemplatePicker';

const SUBJECTS = ['MATHEMATICS', 'PHYSICAL_SCIENCES'] as const;
const EMOJIS = ['📦', '📚', '🧮', '⚗️', '🔬', '📐', '🎯', '🏆', '🧠', '✨'];

export default function AdminPacks() {
  const [list, setList] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState<Pack | 'new' | null>(null);
  const [shareTarget, setShareTarget] = useState<Pack | null>(null);
  const [search, setSearch] = useState('');
  const [templatePicker, setTemplatePicker] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const data = await packsApi.list();
      setList(data as Pack[]);
    } catch (e) { showToast(String((e as Error).message), 'err'); }
    finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  async function handleDelete(p: Pack) {
    if (!confirm(`Delete pack "${p.title}"? Shares with tutors will be removed.`)) return;
    try {
      await packsApi.delete(p.id);
      showToast('Pack deleted', 'info');
      refresh();
    } catch (e) { showToast(String((e as Error).message), 'err'); }
  }

  const filtered = list.filter((p) =>
    !search.trim() || p.title.toLowerCase().includes(search.toLowerCase()) ||
    (p.topic || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex jb ia" style={{ marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'var(--fh)', fontSize: 22 }}>📦 Content Packs</h2>
          <div className="xs ct3 mt1">
            Bundle questions and PDFs into reusable Packs, then share them with Tutors.
          </div>
        </div>
        <div className="flex g2 ia">
          <input
            className="ipt"
            placeholder="🔍 Search packs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 200 }}
          />
          <button className="btn ba" onClick={() => setTemplatePicker(true)}>✨ From template</button>
          <button className="btn bg-btn" onClick={() => setShowEditor('new')}>+ New Pack</button>
        </div>
      </div>

      {loading ? (
        <div className="ct3" style={{ padding: 40, textAlign: 'center' }}>Loading packs…</div>
      ) : filtered.length === 0 ? (
        <EmptyState onCreate={() => setShowEditor('new')} hasSearch={!!search.trim()} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {filtered.map((p) => (
            <PackCard
              key={p.id}
              pack={p}
              onEdit={() => setShowEditor(p)}
              onShare={() => setShareTarget(p)}
              onDelete={() => handleDelete(p)}
            />
          ))}
        </div>
      )}

      {showEditor && (
        <PackEditor
          pack={showEditor === 'new' ? null : showEditor}
          onClose={() => setShowEditor(null)}
          onSaved={() => { setShowEditor(null); refresh(); }}
        />
      )}

      {shareTarget && (
        <ShareModal
          pack={shareTarget}
          onClose={() => setShareTarget(null)}
          onShared={() => { setShareTarget(null); refresh(); }}
        />
      )}

      {templatePicker && (
        <PackTemplatePicker
          onClose={() => setTemplatePicker(false)}
          onCreated={() => { setTemplatePicker(false); refresh(); }}
        />
      )}
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────────
function PackCard({ pack, onEdit, onShare, onDelete }: { pack: Pack; onEdit: () => void; onShare: () => void; onDelete: () => void }) {
  return (
    <div className="ca" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="flex jb ia">
        <div style={{ fontSize: 28 }}>{pack.coverEmoji}</div>
        <span className={`badge ${pack.subject === 'MATHEMATICS' ? 'bma' : 'bph'}`}>
          {pack.subject === 'MATHEMATICS' ? 'Maths' : 'Phys Sci'} · Gr{pack.grade}
        </span>
      </div>
      <div style={{ fontFamily: 'var(--fh)', fontWeight: 700, fontSize: 15 }}>{pack.title}</div>
      {pack.topic && <div className="xs ct3">{pack.topic}</div>}
      {pack.description && <div className="sm ct2" style={{ lineHeight: 1.4 }}>{pack.description}</div>}

      <div className="flex g2 ia" style={{ marginTop: 'auto', flexWrap: 'wrap', fontSize: 12, color: 'var(--t3)' }}>
        <span>📝 {pack.questions.length} Q</span>
        <span>📄 {pack.documents.length} PDF</span>
        <span>👩‍🏫 {pack._count?.shares ?? 0} tutors</span>
        <span>🎓 {pack._count?.unlocks ?? 0} students</span>
      </div>

      <div className="flex g2" style={{ marginTop: 10, flexWrap: 'wrap' }}>
        <button className="btn ba btn-sm wf" onClick={onEdit}>✏️ Edit</button>
        <button className="btn bg-btn btn-sm wf" onClick={onShare}>📤 Share</button>
        <button className="btn ba btn-sm" onClick={onDelete} title="Delete">🗑</button>
      </div>
      <div className="flex g1" style={{ marginTop: 6 }}>
        <button
          className="btn ba btn-sm wf"
          disabled={pack.questions.length === 0}
          onClick={async () => {
            try {
              await packsApi.openPdf(pack.id, 'worksheet', pack.title);
              showToast('Worksheet opened in new tab — use the browser Save button to download.', 'info');
            } catch (e) { showToast(String((e as Error).message), 'err'); }
          }}
          title="Download branded worksheet PDF"
          style={{ fontSize: 11 }}
        >📝 Worksheet</button>
        <button
          className="btn ba btn-sm wf"
          disabled={pack.questions.length === 0}
          onClick={async () => {
            try {
              await packsApi.openPdf(pack.id, 'memo', pack.title);
              showToast('Memo opened in new tab — use the browser Save button to download.', 'info');
            } catch (e) { showToast(String((e as Error).message), 'err'); }
          }}
          title="Download branded memo PDF (with answers)"
          style={{ fontSize: 11 }}
        >🧾 Memo</button>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────
function EmptyState({ onCreate, hasSearch }: { onCreate: () => void; hasSearch: boolean }) {
  if (hasSearch) {
    return <div className="ca" style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
      <div className="ct3">No packs match your search.</div>
    </div>;
  }
  return (
    <div className="ca" style={{ padding: 48, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
      <h3 style={{ margin: '0 0 6px', fontFamily: 'var(--fh)' }}>Build your first Content Pack</h3>
      <div className="sm ct3" style={{ maxWidth: 380, margin: '0 auto 16px' }}>
        A Pack is a bundle of questions and PDF resources. Share it with Tutors,
        and Tutors decide which of their students can practice from it.
      </div>
      <button className="btn bg-btn" onClick={onCreate}>+ Create First Pack</button>
    </div>
  );
}

// ─── Editor modal ─────────────────────────────────────────────────
function PackEditor({ pack, onClose, onSaved }: { pack: Pack | null; onClose: () => void; onSaved: () => void }) {
  const isNew = !pack;
  const [title, setTitle] = useState(pack?.title || '');
  const [description, setDescription] = useState(pack?.description || '');
  const [subject, setSubject] = useState<string>(pack?.subject || 'MATHEMATICS');
  const [grade, setGrade] = useState<number>(pack?.grade || 10);
  const [topic, setTopic] = useState(pack?.topic || '');
  const [coverEmoji, setCoverEmoji] = useState(pack?.coverEmoji || '📦');
  const [selectedQ, setSelectedQ] = useState<string[]>(pack?.questions.map((q) => q.questionId) || []);
  const [selectedD, setSelectedD] = useState<string[]>(pack?.documents.map((d) => d.documentId) || []);
  const [allQ, setAllQ] = useState<Question[]>([]);
  const [allD, setAllD] = useState<PdfDocument[]>([]);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'meta' | 'questions' | 'pdfs'>('meta');

  useEffect(() => {
    // Only PUBLISHED questions are eligible for a Pack — show only those so
    // the picker can't silently drop a DRAFT/REVIEW question on save.
    questionsApi.list({ grade: String(grade), subject: subject.toLowerCase(), status: 'PUBLISHED' })
      .then((d) => setAllQ(d as Question[])).catch(() => {});
    docsApi.list().then((d) => setAllD(d as PdfDocument[])).catch(() => {});
  }, [grade, subject]);

  async function handleSave() {
    if (!title.trim()) { showToast('Title required', 'warn'); return; }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(), description, subject, grade, topic, coverEmoji,
        questionIds: selectedQ, documentIds: selectedD,
      };
      if (isNew) await packsApi.create(payload);
      else await packsApi.update(pack!.id, payload);
      showToast(`Pack ${isNew ? 'created' : 'updated'}`, 'success');
      onSaved();
    } catch (e) { showToast(String((e as Error).message), 'err'); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={isNew ? '➕ New Content Pack' : '✏️ Edit Pack'} onClose={onClose}>
      <div className="flex g2" style={{ marginBottom: 14, borderBottom: '1px solid var(--bd)' }}>
        {(['meta', 'questions', 'pdfs'] as const).map((t) => (
          <button
            key={t}
            className={tab === t ? 'btn bg-btn btn-sm' : 'btn ba btn-sm'}
            onClick={() => setTab(t)}
            style={{ borderRadius: '8px 8px 0 0' }}
          >
            {t === 'meta' ? '📋 Details' : t === 'questions' ? `📝 Questions (${selectedQ.length})` : `📄 PDFs (${selectedD.length})`}
          </button>
        ))}
      </div>

      {tab === 'meta' && (
        <div style={{ display: 'grid', gap: 10 }}>
          <label className="sm bold">Title
            <input className="ipt mt1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Algebra Foundations" />
          </label>
          <label className="sm bold">Description
            <textarea className="ipt mt1" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional summary for tutors and students" />
          </label>
          <div className="flex g2">
            <label className="sm bold" style={{ flex: 1 }}>Subject
              <select className="ipt mt1" value={subject} onChange={(e) => setSubject(e.target.value)}>
                {SUBJECTS.map((s) => <option key={s} value={s}>{s === 'MATHEMATICS' ? 'Mathematics' : 'Physical Sciences'}</option>)}
              </select>
            </label>
            <label className="sm bold" style={{ flex: 1 }}>Grade
              <select className="ipt mt1" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
                {[10, 11, 12].map((g) => <option key={g} value={g}>Grade {g}</option>)}
              </select>
            </label>
          </div>
          <label className="sm bold">Topic
            <input className="ipt mt1" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Quadratic Equations" />
          </label>
          <label className="sm bold">Cover icon</label>
          <div className="flex g2" style={{ flexWrap: 'wrap' }}>
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
        </div>
      )}

      {tab === 'questions' && (
        <div>
          <div className="xs ct3" style={{ marginBottom: 8 }}>
            ✅ Published questions only · Grade {grade} · {subject === 'MATHEMATICS' ? 'Maths' : 'Phys Sci'} — change in Details.
            Questions in review won’t appear here until you publish them in the Question Bank.
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--bd)', borderRadius: 10 }}>
            {allQ.length === 0 && <div className="ct3" style={{ padding: 20, textAlign: 'center' }}>No published questions for this grade &amp; subject yet. Publish some in the Question Bank.</div>}
            {allQ.map((q) => {
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
        </div>
      )}

      {tab === 'pdfs' && (
        <div>
          <div className="xs ct3" style={{ marginBottom: 8 }}>Pick PDFs from the library. Upload new ones in PDF Library page.</div>
          <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--bd)', borderRadius: 10 }}>
            {allD.length === 0 && <div className="ct3" style={{ padding: 20, textAlign: 'center' }}>No PDFs uploaded yet.</div>}
            {allD.map((d) => {
              const checked = selectedD.includes(d.id);
              return (
                <label key={d.id} style={{
                  display: 'flex', gap: 10, padding: '10px 12px',
                  borderBottom: '1px solid var(--bd)', cursor: 'pointer',
                  background: checked ? 'rgba(20,184,166,.08)' : 'transparent',
                }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setSelectedD((cur) => e.target.checked ? [...cur, d.id] : cur.filter((x) => x !== d.id))}
                    style={{ marginTop: 3 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="sm" style={{ fontWeight: 600 }}>📄 {d.title}</div>
                    <div className="xs ct3 mt1">{d.pageCount} pages · {d.documentKind}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex g2 mt2">
        <button className="btn ba wf" onClick={onClose}>Cancel</button>
        <button className="btn bg-btn wf" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : (isNew ? 'Create Pack' : 'Save Changes')}
        </button>
      </div>
    </Modal>
  );
}

// ─── Share modal ──────────────────────────────────────────────────
function ShareModal({ pack, onClose, onShared }: { pack: Pack; onClose: () => void; onShared: () => void }) {
  const [tutors, setTutors] = useState<{ id: string; name: string; subjects?: string[]; teachGrades?: number[] }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    tutorsApi.list().then((d) => setTutors(d as typeof tutors)).catch(() => {});
  }, []);

  async function handleShare() {
    if (!selected.length) { showToast('Pick at least one tutor', 'warn'); return; }
    setBusy(true);
    try {
      const r = await packsApi.share(pack.id, selected, note);
      showToast(`Shared with ${r.shared} tutor(s)`, 'success');
      onShared();
    } catch (e) { showToast(String((e as Error).message), 'err'); }
    finally { setBusy(false); }
  }

  return (
    <Modal title={`📤 Share "${pack.title}"`} onClose={onClose}>
      <div className="sm ct2" style={{ marginBottom: 10 }}>
        Tutors you share with will see the pack in their Library. They can then unlock it
        for individual students.
      </div>

      <label className="sm bold">Tutors</label>
      <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--bd)', borderRadius: 10, marginTop: 6 }}>
        {tutors.length === 0 && <div className="ct3" style={{ padding: 20, textAlign: 'center' }}>No tutors yet.</div>}
        {tutors.map((t) => (
          <label key={t.id} style={{
            display: 'flex', gap: 10, padding: '10px 12px',
            borderBottom: '1px solid var(--bd)', cursor: 'pointer',
            background: selected.includes(t.id) ? 'rgba(20,184,166,.08)' : 'transparent',
          }}>
            <input
              type="checkbox"
              checked={selected.includes(t.id)}
              onChange={(e) => setSelected((cur) => e.target.checked ? [...cur, t.id] : cur.filter((x) => x !== t.id))}
              style={{ marginTop: 3 }}
            />
            <div style={{ flex: 1 }}>
              <div className="sm" style={{ fontWeight: 600 }}>📚 {t.name}</div>
              <div className="xs ct3 mt1">
                {(t.subjects && t.subjects.length) ? t.subjects.map((s) => s === 'MATHEMATICS' ? 'Maths' : 'PhysSci').join(', ') : '—'}
                {(t.teachGrades && t.teachGrades.length) ? ` · ${t.teachGrades.map((g) => `Gr${g}`).join(', ')}` : ''}
              </div>
            </div>
          </label>
        ))}
      </div>

      <label className="sm bold mt2">Note (optional)
        <textarea className="ipt mt1" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="A short message for the tutor" />
      </label>

      <div className="flex g2 mt2">
        <button className="btn ba wf" onClick={onClose}>Cancel</button>
        <button className="btn bg-btn wf" onClick={handleShare} disabled={busy}>
          {busy ? 'Sharing…' : `Share with ${selected.length || 0} tutor(s)`}
        </button>
      </div>
    </Modal>
  );
}
