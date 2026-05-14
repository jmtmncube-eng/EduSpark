import { useEffect, useRef, useState } from 'react';
import { documents as docsApi } from '../../services/api';
import type { PdfDocument } from '../../types';
import { showToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import PdfViewer from '../../components/PdfViewer';

const KINDS = [
  { id: 'practice', label: '📝 Practice', color: 'rgba(20,184,166,.15)' },
  { id: 'test',     label: '📊 Test',     color: 'rgba(239,68,68,.15)' },
  { id: 'notes',    label: '📒 Notes',    color: 'rgba(14,165,233,.15)' },
];

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
  const [filter, setFilter] = useState('all');
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

  async function handleUpload(file: File, kind = 'practice') {
    if (file.type !== 'application/pdf') {
      showToast('Only PDF files are accepted', 'err');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      showToast('PDF must be under 25 MB', 'err');
      return;
    }
    setUploading(true);
    try {
      await docsApi.upload(file, { title: file.name.replace(/\.pdf$/i, ''), documentKind: kind });
      showToast('PDF uploaded ✅', 'success');
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

  const filtered = filter === 'all' ? list : list.filter((d) => d.documentKind === filter);

  return (
    <div>
      <div className="flex jb ia" style={{ marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'var(--fh)', fontSize: 22 }}>📄 PDF Library</h2>
          <div className="xs ct3 mt1">Upload past papers, practice tests, and notes — then attach them to Packs.</div>
        </div>
        <button
          className="btn bg-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Uploading…' : '＋ Upload PDF'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
            e.target.value = '';
          }}
        />
      </div>

      {/* Filter pills */}
      <div className="flex g2" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        <button className={`btn btn-sm ${filter === 'all' ? 'bg-btn' : 'ba'}`} onClick={() => setFilter('all')}>
          All · {list.length}
        </button>
        {KINDS.map((k) => {
          const count = list.filter((d) => d.documentKind === k.id).length;
          return (
            <button key={k.id} className={`btn btn-sm ${filter === k.id ? 'bg-btn' : 'ba'}`} onClick={() => setFilter(k.id)}>
              {k.label} · {count}
            </button>
          );
        })}
      </div>

      {/* Drop zone */}
      <DropZone onDrop={handleUpload} />

      {loading ? (
        <div className="ct3" style={{ padding: 40, textAlign: 'center' }}>Loading library…</div>
      ) : filtered.length === 0 ? (
        <div className="ca" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
          <h3 style={{ margin: '0 0 6px', fontFamily: 'var(--fh)' }}>
            {filter === 'all' ? 'No PDFs uploaded yet' : 'No PDFs in this category'}
          </h3>
          <div className="sm ct3">Drop a PDF above to add it to the library.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginTop: 14 }}>
          {filtered.map((d) => (
            <div key={d.id} className="ca" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="flex jb ia">
                <div style={{ fontSize: 28 }}>📄</div>
                <span className="badge" style={{
                  background: KINDS.find((k) => k.id === d.documentKind)?.color || 'rgba(0,0,0,.05)',
                }}>{d.documentKind}</span>
              </div>
              <div style={{ fontFamily: 'var(--fh)', fontWeight: 700, fontSize: 14, wordBreak: 'break-word' }}>{d.title}</div>
              <div className="xs ct3">{d.pageCount} pages · {fmtSize(d.fileSize)}</div>
              {d.description && <div className="xs ct2">{d.description}</div>}
              <div className="flex g2" style={{ marginTop: 'auto', paddingTop: 6 }}>
                <button className="btn ba btn-sm wf" onClick={() => setPreview(d)}>👁 Preview</button>
                <button className="btn ba btn-sm" onClick={() => handleDelete(d)} title="Delete">🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <Modal title={`📄 ${preview.title}`} onClose={() => setPreview(null)} wide>
          <div className="xs ct3 mb2">
            {preview.pageCount} page{preview.pageCount === 1 ? '' : 's'} · {fmtSize(preview.fileSize)}
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

function DropZone({ onDrop }: { onDrop: (file: File, kind?: string) => void }) {
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
      style={{
        border: `2px dashed ${hover ? 'var(--p)' : 'var(--bd)'}`,
        borderRadius: 12,
        padding: 22,
        textAlign: 'center',
        background: hover ? 'rgba(20,184,166,.06)' : 'transparent',
        marginBottom: 14,
        transition: 'background .2s',
      }}
    >
      <div style={{ fontSize: 28 }}>📥</div>
      <div className="sm bold mt1">Drag &amp; drop a PDF here</div>
      <div className="xs ct3">Or use the Upload PDF button. Max 25 MB.</div>
    </div>
  );
}
