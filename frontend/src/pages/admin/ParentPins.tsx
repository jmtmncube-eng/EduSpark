import { useEffect, useState, useCallback } from 'react';
import { parent as parentApi, studentSearch } from '../../services/api';
import { showToast } from '../../components/Toast';
import Modal from '../../components/Modal';

interface ParentPin {
  id: string; pin: string; label: string | null; expiresAt: string;
  expired: boolean; daysLeft: number;
  student: { name: string; grade: number };
  createdAt: string;
}

interface StudentResult { id: string; name: string; grade: number; pin: string; }

export default function AdminParentPins() {
  const [pins, setPins] = useState<ParentPin[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<StudentResult[]>([]);
  const [selStudent, setSelStudent] = useState<StudentResult | null>(null);
  const [label, setLabel] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState('');

  const load = useCallback(async () => {
    const data = await parentApi.listPins();
    setPins(data as ParentPin[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (searchQ.trim().length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try { setSearchResults(await studentSearch(searchQ)); }
      catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  async function createPin() {
    if (!selStudent) { showToast('Select a student first', 'warn'); return; }
    setSaving(true);
    try {
      await parentApi.createPin(selStudent.id, label.trim() || undefined);
      showToast(`PIN created for ${selStudent.name} ✅`);
      setShowCreate(false);
      setSelStudent(null); setSearchQ(''); setLabel('');
      load();
    } catch (e: unknown) { showToast((e as Error).message, 'err'); }
    finally { setSaving(false); }
  }

  async function revokePin(id: string, name: string) {
    if (!confirm(`Revoke parent PIN for ${name}?`)) return;
    await parentApi.deletePin(id);
    showToast('PIN revoked', 'info');
    load();
  }

  function copyPin(pin: string, id: string) {
    navigator.clipboard?.writeText(pin).then(() => {
      setCopiedId(id);
      showToast(`PIN ${pin} copied!`, 'info');
      setTimeout(() => setCopiedId(''), 2000);
    });
  }

  const active = pins.filter((p) => !p.expired);
  const expired = pins.filter((p) => p.expired);

  const parentUrl = (pin: string) => `${window.location.origin}/parent/${pin}`;

  return (
    <div>
      <div className="ph">
        <h2>🔑 Parent Access PINs</h2>
        <p>Create temporary PINs for parents to view their child's progress. PINs expire after 7 days.</p>
      </div>

      <div className="flex jb ia mb2 wrap" style={{ gap: 10 }}>
        <div className="flex g2 ia">
          <span className="badge bok">{active.length} active</span>
          <span className="badge bng">{expired.length} expired</span>
        </div>
        <button className="btn bp" onClick={() => { setShowCreate(true); setSelStudent(null); setSearchQ(''); setLabel(''); }}>+ Create Parent PIN</button>
      </div>

      {pins.length === 0 ? (
        <div className="empty"><div className="eico">🔑</div><h3>No parent PINs yet</h3><p>Create a PIN to give a parent read-only access to their child's progress dashboard.</p></div>
      ) : (
        <>
          {active.length > 0 && (
            <>
              <div className="sec-h mb1">✅ Active PINs</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {active.map((p) => (
                  <div key={p.id} className="cc" style={{ padding: '14px 16px' }}>
                    <div className="flex jb ia wrap" style={{ gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="flex ia g2 wrap" style={{ marginBottom: 4 }}>
                          <span className="fh bold" style={{ fontSize: 16, letterSpacing: '.1em', color: 'var(--p)' }}>{p.pin}</span>
                          {p.label && <span className="badge btl">{p.label}</span>}
                          <span className="badge bok">⏳ {p.daysLeft}d left</span>
                        </div>
                        <div className="sm ct2">{p.student.name} · Grade {p.student.grade}</div>
                        <div className="xs ct3 mt1">Expires {new Date(p.expiresAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      </div>
                      <div className="flex g1 wrap">
                        <button className="btn ba btn-sm" onClick={() => copyPin(p.pin, p.id)}>
                          {copiedId === p.id ? '✅ Copied!' : '📋 Copy PIN'}
                        </button>
                        <button className="btn ba btn-sm" onClick={() => { navigator.clipboard?.writeText(parentUrl(p.pin)); showToast('Link copied!', 'info'); }}>🔗 Copy Link</button>
                        <button className="btn bd-btn btn-sm" onClick={() => revokePin(p.id, p.student.name)}>🗑 Revoke</button>
                      </div>
                    </div>
                    <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(20,184,166,.06)', borderRadius: 8, fontSize: 11.5, color: 'var(--t3)', wordBreak: 'break-all' }}>
                      🔗 {parentUrl(p.pin)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {expired.length > 0 && (
            <>
              <div className="sec-h mb1">⏰ Expired PINs</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {expired.map((p) => (
                  <div key={p.id} className="cc" style={{ padding: '12px 16px', opacity: 0.6 }}>
                    <div className="flex jb ia">
                      <div>
                        <span className="fh bold" style={{ fontSize: 15, letterSpacing: '.1em', color: 'var(--t3)' }}>{p.pin}</span>
                        <span className="badge bng ml1">Expired</span>
                        <div className="xs ct3 mt1">{p.student.name} · Grade {p.student.grade}</div>
                      </div>
                      <button className="btn bd-btn btn-sm" onClick={() => revokePin(p.id, p.student.name)}>🗑 Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {showCreate && (
        <Modal title="🔑 Create Parent PIN" onClose={() => setShowCreate(false)}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 14, padding: '10px 14px', background: 'rgba(20,184,166,.06)', borderRadius: 10, borderLeft: '3px solid var(--p)' }}>
              A unique <strong>PAR-XXXX</strong> PIN will be generated. Share it with the parent — it expires in <strong>7 days</strong> and gives read-only access to their child's progress.
            </div>

            <div className="fg">
              <label className="lbl">Search for Student</label>
              <input
                type="text" className="input"
                value={searchQ} onChange={(e) => { setSearchQ(e.target.value); setSelStudent(null); }}
                placeholder="Type student name…"
                autoFocus
              />
              {searchLoading && <div className="xs ct3 mt1">Searching…</div>}
              {searchResults.length > 0 && !selStudent && (
                <div style={{ marginTop: 6, border: '1.5px solid var(--bd)', borderRadius: 10, overflow: 'hidden' }}>
                  {searchResults.map((s) => (
                    <div key={s.id} onClick={() => { setSelStudent(s); setSearchQ(s.name); setSearchResults([]); }}
                      style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      className="hover-row">
                      <span className="bold">{s.name}</span>
                      <span className="xs ct3">Grade {s.grade}</span>
                    </div>
                  ))}
                </div>
              )}
              {selStudent && (
                <div style={{ marginTop: 8, padding: '10px 14px', background: 'rgba(20,184,166,.08)', borderRadius: 10, border: '1.5px solid var(--p)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div className="bold">{selStudent.name}</div>
                    <div className="xs ct3">Grade {selStudent.grade}</div>
                  </div>
                  <button className="btn bg-btn btn-sm" onClick={() => { setSelStudent(null); setSearchQ(''); }}>✕ Change</button>
                </div>
              )}
            </div>

            <div className="fg mt1">
              <label className="lbl">Label (optional)</label>
              <input type="text" className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Mom's PIN, Dad, Guardian…" />
            </div>
          </div>

          <div className="flex g1">
            <button className="btn bp" onClick={createPin} disabled={saving || !selStudent}>{saving ? '…' : '🔑 Generate PIN'}</button>
            <button className="btn bg-btn" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
