import { useEffect, useState } from 'react';
import { documents as docsApi } from '../services/api';

/**
 * Robust authenticated-PDF viewer.
 *
 * The document stream sits behind auth. Rather than putting the JWT in the
 * iframe URL (which leaks into history/logs), we fetch the file as a blob
 * with the Authorization header and embed the resulting object-URL. The blob
 * URL is revoked on unmount. A new-tab link is offered as a fallback for
 * browsers/extensions that refuse to render PDFs inside an iframe.
 */
export default function PdfViewer({
  documentId,
  title,
  height = '72vh',
}: {
  documentId: string;
  title?: string;
  height?: string | number;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let revoked = false;
    let url: string | null = null;
    setBlobUrl(null);
    setError(null);

    docsApi.fileBlob(documentId)
      .then((u) => {
        if (revoked) { URL.revokeObjectURL(u); return; }
        url = u;
        setBlobUrl(u);
      })
      .catch((e: unknown) => setError((e as Error).message || 'Could not load PDF'));

    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [documentId]);

  const newTabUrl = docsApi.fileUrl(documentId);

  return (
    <div>
      <div style={{
        width: '100%', height,
        border: '1px solid var(--bd)', borderRadius: 10, overflow: 'hidden',
        background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {error ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 40 }}>📄</div>
            <div className="sm bold mt1">Couldn’t display this PDF here</div>
            <div className="xs ct3" style={{ maxWidth: 320, margin: '4px auto 0' }}>{error}</div>
            <a href={newTabUrl} target="_blank" rel="noreferrer" className="btn bg-btn btn-sm mt2" style={{ display: 'inline-block' }}>
              ↗ Open in a new tab
            </a>
          </div>
        ) : !blobUrl ? (
          <div className="ct3" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28 }}>⏳</div>
            <div className="sm mt1">Loading {title || 'PDF'}…</div>
          </div>
        ) : (
          <iframe
            src={blobUrl}
            title={title || 'PDF document'}
            style={{ width: '100%', height: '100%', border: 0 }}
          />
        )}
      </div>
      <div className="flex g2 mt2" style={{ flexWrap: 'wrap' }}>
        <a href={newTabUrl} target="_blank" rel="noreferrer" className="btn ba btn-sm" style={{ textDecoration: 'none' }}>
          ↗ Open in new tab
        </a>
        {blobUrl && (
          <a href={blobUrl} download={`${(title || 'document').replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`} className="btn ba btn-sm" style={{ textDecoration: 'none' }}>
            ⬇ Download
          </a>
        )}
      </div>
    </div>
  );
}
