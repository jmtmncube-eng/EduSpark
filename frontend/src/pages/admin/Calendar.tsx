import { useEffect, useState, useCallback } from 'react';
import { assignments as assignmentsApi, calendar, students as studentsApi } from '../../services/api';
import { showToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import type { Assignment, CalendarNote, CalendarRequest, User } from '../../types';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function fmtD(d: Date) { return d.toISOString().split('T')[0]; }
function isIn3(due: string, now: Date) { const dd = new Date(due); return dd >= now && (dd.getTime() - now.getTime()) < 3 * 86400000; }

type NoteForm = {
  date: string;
  title: string;
  content: string;
  color: string;
  studentId: string;     // '' = all students  |  'maintenance' = admin-shared
  kind: string;          // 'session' | 'class' | 'maintenance' | 'broadcast' | 'note'
  sharedWithAdmin: boolean;
};

export default function StaffCalendar() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isTutor = user?.role === 'TUTOR';

  const [calDate, setCalDate] = useState(new Date());
  const [selDay, setSelDay] = useState('');
  const [asgns, setAsgns] = useState<Assignment[]>([]);
  const [notes, setNotes] = useState<CalendarNote[]>([]);
  const [requests, setRequests] = useState<CalendarRequest[]>([]);
  const [classStudents, setClassStudents] = useState<User[]>([]);
  const [showNote, setShowNote] = useState(false);
  const [noteForm, setNoteForm] = useState<NoteForm>({
    date: '', title: '', content: '', color: 'note',
    studentId: '', kind: isTutor ? 'session' : 'note', sharedWithAdmin: false,
  });
  const [noteEditId, setNoteEditId] = useState('');
  const [showRequests, setShowRequests] = useState(false);

  const loadRequests = useCallback(async () => {
    try { const d = await calendar.getRequests(); setRequests(d as CalendarRequest[]); } catch {}
  }, []);

  useEffect(() => {
    assignmentsApi.list().then((d) => setAsgns(d as Assignment[])).catch(() => {});
    calendar.notes().then((d) => setNotes(d as CalendarNote[])).catch(() => {});
    loadRequests();
    if (isTutor) studentsApi.list().then((d) => setClassStudents(d as User[])).catch(() => {});
  }, [loadRequests, isTutor]);

  const yr = calDate.getFullYear(), mo = calDate.getMonth();
  const now = new Date();
  const fd = new Date(yr, mo, 1).getDay();
  const dim = new Date(yr, mo + 1, 0).getDate();

  const evMap: Record<string, { id: string; title: string; cl: string; type: string; scope?: string }[]> = {};
  asgns.forEach((a) => {
    const d = a.dueDate.split('T')[0];
    if (!evMap[d]) evMap[d] = [];
    const ov = new Date(a.dueDate) < now;
    const cl = ov ? 'ov' : isIn3(a.dueDate, now) ? 'up' : 'fut';
    evMap[d].push({ id: a.id, title: a.title, cl, type: 'assignment' });
  });
  notes.forEach((n) => {
    if (!evMap[n.date]) evMap[n.date] = [];
    const scope = n.kind === 'broadcast' ? '📢' : n.kind === 'maintenance' ? '🛠' : n.kind === 'session' ? '🎓' : '📌';
    evMap[n.date].push({ id: n.id, title: `${scope} ${n.title}`, cl: n.color || 'note', type: 'note', scope });
  });

  const dayAsgns = asgns.filter((a) => a.dueDate.split('T')[0] === selDay);
  const dayNotes = notes.filter((n) => n.date === selDay);

  async function saveNote() {
    if (!noteForm.date || !noteForm.title.trim()) { showToast('Fill date and title', 'warn'); return; }
    const payload: {
      date: string; title: string; content?: string; color?: string;
      studentId?: string | null; kind?: string; sharedWithAdmin?: boolean;
    } = {
      date: noteForm.date,
      title: noteForm.title.trim(),
      content: noteForm.content,
      color: noteForm.color,
      kind: noteForm.kind,
    };
    if (isTutor) {
      payload.studentId = noteForm.studentId || null;
      payload.sharedWithAdmin = noteForm.sharedWithAdmin;
    } else if (isAdmin && noteForm.kind === 'broadcast') {
      payload.studentId = null;
    }
    try {
      if (noteEditId) {
        await calendar.updateNote(noteEditId, payload);
        showToast('Note updated', 'success');
      } else {
        await calendar.createNote(payload);
        showToast('Note saved', 'success');
      }
      const updated = await calendar.notes();
      setNotes(updated as CalendarNote[]);
      setShowNote(false);
    } catch (e) { showToast(String((e as Error).message), 'err'); }
  }

  async function delNote(id: string) {
    if (!confirm('Delete this note?')) return;
    try {
      await calendar.deleteNote(id);
      showToast('Note deleted', 'info');
      setNotes((n) => n.filter((x) => x.id !== id));
    } catch (e) { showToast(String((e as Error).message), 'err'); }
  }

  function openAddNote(date = selDay || fmtD(now)) {
    setNoteEditId('');
    setNoteForm({
      date, title: '', content: '', color: 'note',
      studentId: '', kind: isTutor ? 'session' : 'note', sharedWithAdmin: false,
    });
    setShowNote(true);
  }

  function openEditNote(n: CalendarNote) {
    // Only allow editing notes the user owns
    if (isTutor && n.tutorId !== user?.id) { showToast('Read-only — not your note', 'info'); return; }
    if (isAdmin && n.tutorId) { showToast('Read-only — tutor-owned note', 'info'); return; }
    setNoteEditId(n.id);
    setNoteForm({
      date: n.date, title: n.title, content: n.content || '', color: n.color,
      studentId: n.studentId || '', kind: n.kind || 'note',
      sharedWithAdmin: !!n.sharedWithAdmin,
    });
    setShowNote(true);
  }

  async function handleRequest(id: string, status: 'approved' | 'denied') {
    try {
      await calendar.updateRequest(id, status);
      showToast(status === 'approved' ? 'Approved' : 'Denied', status === 'approved' ? 'success' : 'info');
      loadRequests();
      const updated = await calendar.notes();
      setNotes(updated as CalendarNote[]);
    } catch (e) { showToast(String((e as Error).message), 'err'); }
  }

  return (
    <div>
      <div className="ph">
        <h2>📅 Calendar</h2>
        <p>{isAdmin ? 'School-wide events, broadcasts and tutor maintenance notes.'
            : 'Schedule sessions, broadcast to your class, and approve student requests.'}</p>
      </div>

      <div className="flex jb ia mb2" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="flex ia g2" style={{ flexWrap: 'wrap' }}>
          <button className="btn bg-btn btn-sm" onClick={() => openAddNote()}>+ Add {isTutor ? 'Session / Note' : 'Note'}</button>
          {requests.length > 0 && (
            <button className="btn ba btn-sm" onClick={() => setShowRequests(true)} style={{ background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.4)' }}>
              📨 {requests.length} pending request{requests.length > 1 ? 's' : ''}
            </button>
          )}
        </div>
        <div className="flex ia g2" style={{ fontSize: 11, color: 'var(--t3)' }}>
          {isTutor && <span>👤 Your class only · 🎓 Sessions · 📢 Broadcasts</span>}
          {isAdmin && <span>📌 Admin notes · 🛠 From tutors · 📢 Broadcasts</span>}
        </div>
      </div>

      <div className="cal-layout">
        <div className="cal-main">
          <div className="cal-hd">
            <div className="flex ia g1">
              <button className="btn bg-btn btn-sm" onClick={() => setCalDate(new Date(yr, mo - 1, 1))}>‹ Prev</button>
              <button className="btn bg-btn btn-sm" onClick={() => { setCalDate(new Date()); setSelDay(fmtD(now)); }}>Today</button>
            </div>
            <div className="cal-mo">{MONTHS[mo]} {yr}</div>
            <button className="btn bg-btn btn-sm" onClick={() => setCalDate(new Date(yr, mo + 1, 1))}>Next ›</button>
          </div>
          <div className="cal-g">
            {DAYS.map((d) => <div key={d} className="cal-dow">{d}</div>)}
            {Array.from({ length: fd }, (_, i) => <div key={`empty-${i}`} className="cal-day other" />)}
            {Array.from({ length: dim }, (_, i) => {
              const day = i + 1;
              const ds = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isT = now.getDate() === day && now.getMonth() === mo && now.getFullYear() === yr;
              const evs = evMap[ds] || [];
              return (
                <div key={day} className={`cal-day ${isT ? 'today' : ''} ${selDay === ds ? 'sel' : ''} ${evs.length ? 'hev' : ''}`} onClick={() => setSelDay(ds)}>
                  <div className="cal-dn">{day}</div>
                  <div className="cal-pills">
                    {evs.slice(0, 2).map((e, j) => <div key={j} className={`cal-pill ${e.cl}`}>{e.title.slice(0, 14)}</div>)}
                    {evs.length > 2 && <div className="cal-pill note">+{evs.length - 2}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="cal-side">
          <div className="cal-side-t">{selDay ? new Date(selDay + 'T00:00').toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Select a day'}</div>
          {!selDay ? <p className="sm ct3">Click any day to view events.</p> : (
            <>
              {!dayAsgns.length && !dayNotes.length && <p className="sm ct3">No events on this day.</p>}
              {dayAsgns.map((a) => {
                const ov = new Date(a.dueDate) < now;
                return (
                  <div key={a.id} className="cal-ev">
                    <div className="flex jb ia"><div className="cal-ev-t">📋 {a.title}</div><span className={`cal-pill ${ov ? 'ov' : isIn3(a.dueDate, now) ? 'up' : 'fut'}`}>{ov ? '❌ Overdue' : '📅 Upcoming'}</span></div>
                    <div className="cal-ev-s">{a.subject === 'MATHEMATICS' ? '📐' : '⚗️'} Gr{a.grade} · {a.topic}</div>
                  </div>
                );
              })}
              {dayNotes.map((n) => {
                const mine = (isTutor && n.tutorId === user?.id) || (isAdmin && !n.tutorId);
                const audienceLabel =
                  n.kind === 'broadcast' ? '📢 Broadcast — everyone'
                    : n.kind === 'maintenance' ? '🛠 Maintenance (admin)'
                    : n.studentId ? `👤 ${n.student?.name ?? 'one student'}`
                    : n.tutorId ? '👥 All your students'
                    : '🏫 School-wide';
                return (
                  <div key={n.id} className="cal-ev">
                    <div className="flex jb ia"><div className="cal-ev-t">{(n.kind === 'session' ? '🎓 ' : '📌 ')}{n.title}</div><span className={`cal-pill ${n.color || 'note'}`}>{n.kind || 'note'}</span></div>
                    {n.content && <div className="cal-ev-s">{n.content}</div>}
                    <div className="xs ct3 mt1">{audienceLabel}{n.tutor && !isTutor ? ` · 📚 ${n.tutor.name}` : ''}</div>
                    {mine && (
                      <div className="flex g1" style={{ marginTop: 6 }}>
                        <button className="btn ba btn-sm" onClick={() => openEditNote(n)}>✏ Edit</button>
                        <button className="btn ba btn-sm" onClick={() => delNote(n.id)}>🗑 Delete</button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div style={{ marginTop: 11 }}><button className="btn ba btn-sm wf" style={{ justifyContent: 'center' }} onClick={() => openAddNote(selDay)}>+ Add Note</button></div>
            </>
          )}
        </div>
      </div>

      <div className="flex" style={{ gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
        {[['var(--dr)', 'Overdue'], ['var(--wr)', 'Due soon'], ['var(--s)', 'Completed'], ['var(--a)', 'Note'], ['var(--p)', 'Future']].map(([c, l]) => (
          <div key={l} className="flex ia" style={{ gap: 5, fontSize: 11, color: 'var(--t2)' }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />{l}</div>
        ))}
      </div>

      {showRequests && (
        <Modal title={`📨 Student Calendar Requests (${requests.length})`} onClose={() => setShowRequests(false)}>
          {requests.length === 0 ? (
            <p className="sm ct3">No pending requests.</p>
          ) : requests.map((req) => {
            const typeLabel = req.requestType === 'new' ? '🆕 New session'
              : req.requestType === 'cancel' ? '❌ Cancel'
              : '↔ Move date';
            return (
              <div key={req.id} style={{ padding: 12, border: '1px solid var(--bd)', borderRadius: 11, marginBottom: 10 }}>
                <div className="flex jb ia mb1">
                  <span className="bold">{typeLabel} · {req.studentName}</span>
                  <span className="xs ct3">{new Date(req.createdAt).toLocaleDateString('en-ZA')}</span>
                </div>
                {req.note && <div className="xs ct3 mb1">Re: 📌 {req.note.title} ({req.note.date})</div>}
                {req.proposedDate && (
                  <div className="xs ct2 mb1">
                    <b>Proposed:</b> {req.proposedTitle || 'session'} on {req.proposedDate}
                  </div>
                )}
                <div className="sm ct2 mb2" style={{ background: 'rgba(20,184,166,.06)', borderRadius: 8, padding: '8px 10px' }}>{req.message}</div>
                <div className="flex g1">
                  <button className="btn bg-btn btn-sm" onClick={() => handleRequest(req.id, 'approved')}>✅ Approve</button>
                  <button className="btn ba btn-sm" onClick={() => handleRequest(req.id, 'denied')}>❌ Deny</button>
                </div>
              </div>
            );
          })}
        </Modal>
      )}

      {showNote && (
        <Modal title={noteEditId ? '✏️ Edit Note' : '+ Add Calendar Note'} onClose={() => setShowNote(false)}>
          <div className="fg"><label className="lbl">Date</label><input type="date" className="input" value={noteForm.date} onChange={(e) => setNoteForm({ ...noteForm, date: e.target.value })} /></div>
          <div className="fg"><label className="lbl">Title</label><input type="text" className="input" value={noteForm.title} onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })} placeholder="e.g. Mock Exam Reminder" /></div>
          <div className="fg"><label className="lbl">Note</label><textarea className="textarea" value={noteForm.content} onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })} placeholder="Details…" /></div>

          {/* Kind */}
          <div className="fg">
            <label className="lbl">Type</label>
            <select className="select" value={noteForm.kind} onChange={(e) => setNoteForm({ ...noteForm, kind: e.target.value })}>
              {isTutor && <option value="session">🎓 Tutoring session</option>}
              {isTutor && <option value="class">👥 Class note</option>}
              <option value="note">📌 General note</option>
              {isAdmin && <option value="broadcast">📢 Broadcast (everyone)</option>}
              {isAdmin && <option value="maintenance">🛠 Maintenance / Heads-up</option>}
            </select>
          </div>

          {/* Audience picker (tutor only) */}
          {isTutor && (
            <>
              <div className="fg">
                <label className="lbl">Who is this for?</label>
                <select className="select" value={noteForm.studentId} onChange={(e) => setNoteForm({ ...noteForm, studentId: e.target.value })}>
                  <option value="">👥 All my students (broadcast to class)</option>
                  {classStudents.map((s) => (
                    <option key={s.id} value={s.id}>👤 {s.name} (Gr {s.grade})</option>
                  ))}
                </select>
                {classStudents.length === 0 && (
                  <div className="xs ct3 mt1">You have no students yet — broadcast will reach no one.</div>
                )}
              </div>

              <label className="flex ia g2" style={{ cursor: 'pointer', padding: '8px 0' }}>
                <input
                  type="checkbox"
                  checked={noteForm.sharedWithAdmin}
                  onChange={(e) => setNoteForm({ ...noteForm, sharedWithAdmin: e.target.checked })}
                />
                <span className="sm">🛠 Share with Admin (e.g. for maintenance / facilities)</span>
              </label>
            </>
          )}

          <div className="fg"><label className="lbl">Color</label>
            <select className="select" value={noteForm.color} onChange={(e) => setNoteForm({ ...noteForm, color: e.target.value })}>
              <option value="note">Blue — General</option>
              <option value="session">Teal — Session</option>
              <option value="up">Amber — Reminder</option>
              <option value="cp">Green — Good News</option>
              <option value="ov">Red — Urgent</option>
            </select>
          </div>
          <div className="flex g1 mt2"><button className="btn bg-btn wf" onClick={saveNote}>💾 Save</button><button className="btn ba wf" onClick={() => setShowNote(false)}>Cancel</button></div>
        </Modal>
      )}
    </div>
  );
}
