import { useEffect, useMemo, useRef, useState } from 'react';
import { documents as docsApi } from '../../services/api';
import type { PdfDocument } from '../../types';
import { showToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import PdfViewer from '../../components/PdfViewer';
import PillSelect from '../../components/PillSelect';

// One source of truth for the three filing drawers.
const KINDS = [
  { id: 'practice', label: 'Practice', icon: '📝', accent: '#0d9488', tint: 'rgba(20,184,166,.10)', blurb: 'Worksheets & exercises' },
  { id: 'test',     label: 'Tests',    icon: '📊', accent: '#dc2626', tint: 'rgba(239,68,68,.10)',  blurb: 'Past papers & exams' },
  { id: 'notes',    label: 'Notes',    icon: '📒', accent: '#0284c7', tint: 'rgba(14,165,233,.10)', blurb: 'Summaries & study guides' },
] as const;
type KindId = typeof KINDS[number]['id'];
const kindMeta = (id: string) => KINDS.find((k) => k.id === id) ?? KINDS[0];

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function AdminPdfLibrary() {
  const [list, setList] = useState<PdfDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<PdfDocument | null>(null);
  const [filter, setFilter] = useState<'all' | KindId>('all');
  const [search, setSearch] = useState('');
  // The drawer a new upload is filed into — picked before dropping/choosing.
  const [uploadKind, setUploadKind] = useState<KindId>('practice');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    setLoading(true);
    try {
      const data = await docsApi.list();
      setList(data as PdfDocument[]);
    } catch (e) { showToast(String((e as Error).message), 'err'); }
    finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  async function handleUpload(file: File, kind: KindId = uploadKind) {
    if (file.type !== 'application/pdf') { showToast('Only PDF files are accepted', 'err'); return; }
    if (file.size > 25 * 1024 * 1024) { showToast('PDF must be under 25 MB', 'err'); return; }
    setUploading(true);
    try {
      await docsApi.upload(file, { title: file.name.replace(/\.pdf$/i, ''), documentKind: kind });
      showToast(`Filed under ${kindMeta(kind).label} ✅`, 'success');
      refresh();
    } catch (e) { showToast(String((e as Error).message), 'err'); }
    finally { setUploading(false); }
  }

  async function handleDelete(d: PdfDocument) {
    if (!confirm(`Delete "${d.title}"? This removes it from all packs.`)) return;
    try {
      await docsApi.delete(d.id);
      showToast('PDF deleted', 'info');
      refresh();
    } catch (e) { showToast(String((e as Error).message), 'err'); }
  }

  // search → then split into the three drawers
  const matched = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? list.filter((d) => d.title.toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q))
      : list;
  }, [list, search]);

  const sections = KINDS
    .filter((k) => filter === 'all' || filter === k.id)
    .map((k) => ({ ...k, docs: matched.filter((d) => d.documentKind === k.id) }));
  const totalShown = sections.reduce((n, s) => n + s.docs.length, 0);

  return (
    <div>
      <div className="flex jb ia" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'var(--fh)', fontSize: 22 }}>📄 PDF Library</h2>
          <div className="xs ct3 mt1">Past papers, practice and notes — filed into three drawers, ready to attach to Packs.</div>
        </div>
      </div>

      {/* ─── Upload — pick the drawer first, then drop or choose ─── */}
      <div className="ca" style={{ padding: 14, marginBottom: 14 }}>
        <div className="flex ia g2 wrap" style={{ marginBottom: 10 }}>
          <span className="xs bold ct3" style={{ minWidth: 70 }}>File under</span>
          <PillSelect
            ariaLabel="Upload category"
            value={uploadKind}
            onChange={(v) => setUploadKind(v as KindId)}
            options={KINDS.map((k) => ({ value: k.id, label: k.label, icon: k.icon, hint: k.blurb }))}
          />
        </div>
        <DropZone kind={kindMeta(uploadKind)} uploading={uploading} onDrop={(f) => handleUpload(f)} onPick={() => fileInputRef.current?.click()} />
        <input
          ref={fileInputRef} type="file" accept="application/pdf" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }}
        />
      </div>

      {/* ─── Browse — search + drawer filter ─── */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)' }}>🔍</span>
        <input
          type="text" className="input" style={{ paddingLeft: 34 }}
          placeholder="Search PDFs by title or description…"
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="flex g1 mb2" style={{ flexWrap: 'wrap' }}>
        <button className={`btn btn-sm ${filter === 'all' ? 'bg-btn' : 'ba'}`} onClick={() => setFilter('all')}>
          All drawers · {list.length}
        </button>
        {KINDS.map((k) => {
          const count = list.filter((d) => d.documentKind === k.id).length;
          return (
            <button key={k.id} className={`btn btn-sm ${filter === k.id ? 'bg-btn' : 'ba'}`} onClick={() => setFilter(k.id)}>
              {k.icon} {k.label} · {count}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="ct3" style={{ padding: 40, textAlign: 'center' }}>Loading library…</div>
      ) : totalShown === 0 ? (
        <div className="ca" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>📄</div>
          <h3 style={{ margin: '0 0 6px', fontFamily: 'var(--fh)' }}>
            {search ? 'Nothing matches your search' : filter === 'all' ? 'No PDFs uploaded yet' : `No PDFs in ${kindMeta(filter).label}`}
          </h3>
          <div className="sm ct3">{search ? 'Try a different search term.' : 'Pick a drawer above and drop a PDF to start your library.'}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {sections.map((s) => (
            <div key={s.id}>
              {/* Drawer header */}
              <div className="flex ia g2" style={{
                padding: '8px 12px', borderRadius: 10, marginBottom: 8,
                background: s.tint, borderLeft: `4px solid ${s.accent}`,
              }}>
                <span style={{ fontSize: 18 }}>{s.icon}</span>
                <span style={{ fontFamily: 'var(--fh)', fontWeight: 800, fontSize: 14, color: s.accent }}>{s.label}</span>
                <span className="badge btl">{s.docs.length}</span>
                <span className="xs ct3">{s.blurb}</span>
              </div>
              {s.docs.length === 0 ? (
                <div className="xs ct3" style={{ padding: '6px 12px', fontStyle: 'italic' }}>
                  Nothing filed here yet{search ? ' for this search' : ''}.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                  {s.docs.map((d) => (
                    <div key={d.id} className="ca" style={{
                      padding: 14, display: 'flex', flexDirection: 'column', gap: 6,
                      borderLeft: `4px solid ${s.accent}`,
                    }}>
                      <div style={{ fontSize: 26 }}>{s.icon}</div>
                      <div style={{ fontFamily: 'var(--fh)', fontWeight: 700, fontSize: 14, wordBreak: 'break-word' }}>{d.title}</div>
                      <div className="xs ct3">{d.pageCount} page{d.pageCount === 1 ? '' : 's'} · {fmtSize(d.fileSize)}</div>
                      {d.description && <div className="xs ct2">{d.description}</div>}
                      <div className="flex g2" style={{ marginTop: 'auto', paddingTop: 6 }}>
                        <button className="btn ba btn-sm wf" onClick={() => setPreview(d)}>👁 Preview</button>
                        <button className="btn ba btn-sm" onClick={() => handleDelete(d)} title="Delete">🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {preview && (
        <Modal title={`${kindMeta(preview.documentKind).icon} ${preview.title}`} onClose={() => setPreview(null)} wide>
          <div className="xs ct3 mb2">
            <span className="badge" style={{ background: kindMeta(preview.documentKind).tint, color: kindMeta(preview.documentKind).accent }}>
              {kindMeta(preview.documentKind).icon} {kindMeta(preview.documentKind).label}
            </span>
            {' · '}{preview.pageCount} page{preview.pageCount === 1 ? '' : 's'} · {fmtSize(preview.fileSize)}
            {preview.description ? ` · ${preview.description}` : ''}
          </div>
          <PdfViewer documentId={preview.id} title={preview.title} />
          <div className="flex g2 mt2">
            <button className="btn bg-btn wf" onClick={() => setPreview(null)}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DropZone({ kind, uploading, onDrop, onPick }: {
  kind: typeof KINDS[number];
  uploading: boolean;
  onDrop: (file: File) => void;
  onPick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onDrop(f);
      }}
      onClick={onPick}
      style={{
        border: `2px dashed ${hover ? kind.accent : 'var(--bd)'}`,
        borderRadius: 12, padding: 20, textAlign: 'center', cursor: 'pointer',
        background: hover ? kind.tint : 'transparent',
        transition: 'background .2s, border-color .2s',
      }}
    >
      <div style={{ fontSize: 26 }}>{uploading ? '⏳' : '📥'}</div>
      <div className="sm bold mt1">
        {uploading ? 'Uploading…' : <>Drop a PDF here — files into <span style={{ color: kind.accent }}>{kind.icon} {kind.label}</span></>}
      </div>
      <div className="xs ct3">Or click to choose a file. Max 25 MB.</div>
    </div>
  );
}
