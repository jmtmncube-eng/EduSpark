import { useEffect, useState, useCallback } from 'react';
import { assignments as assignmentsApi, calendar } from '../../services/api';
import { showToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import type { Assignment, CalendarNote, CalendarRequest } from '../../types';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function fmtD(d: Date) { return d.toISOString().split('T')[0]; }
function isIn3(due: string, now: Date) { const dd = new Date(due); return dd >= now && (dd.getTime() - now.getTime()) < 3 * 86400000; }

export default function AdminCalendar() {
  const [calDate, setCalDate] = useState(new Date());
  const [selDay, setSelDay] = useState('');
  const [asgns, setAsgns] = useState<Assignment[]>([]);
  const [notes, setNotes] = useState<CalendarNote[]>([]);
  const [requests, setRequests] = useState<CalendarRequest[]>([]);
  const [showNote, setShowNote] = useState(false);
  const [noteForm, setNoteForm] = useState({ date: '', title: '', content: '', color: 'note' });
  const [noteEditId, setNoteEditId] = useState('');
  const [showRequests, setShowRequests] = useState(false);

  const loadRequests = useCallback(async () => {
    try { const d = await calendar.getRequests(); setRequests(d as CalendarRequest[]); } catch {}
  }, []);

  useEffect(() => {
    assignmentsApi.list().then((d) => setAsgns(d as Assignment[]));
    calendar.notes().then((d) => setNotes(d as CalendarNote[]));
    loadRequests();
  }, [loadRequests]);

  const yr = calDate.getFullYear(), mo = calDate.getMonth();
  const now = new Date();
  const fd = new Date(yr, mo, 1).getDay();
  const dim = new Date(yr, mo + 1, 0).getDate();

  const evMap: Record<string, { id: string; title: string; cl: string; type: string }[]> = {};
  asgns.forEach((a) => {
    const d = a.dueDate.split('T')[0];
    if (!evMap[d]) evMap[d] = [];
    const ov = new Date(a.dueDate) < now;
    const cl = ov ? 'ov' : isIn3(a.dueDate, now) ? 'up' : 'fut';
    evMap[d].push({ id: a.id, title: a.title, cl, type: 'assignment' });
  });
  notes.forEach((n) => {
    if (!evMap[n.date]) evMap[n.date] = [];
    evMap[n.date].push({ id: n.id, title: n.title, cl: n.color || 'note', type: 'note' });
  });

  const dayAsgns = asgns.filter((a) => a.dueDate.split('T')[0] === selDay);
  const dayNotes = notes.filter((n) => n.date === selDay);

  async function saveNote() {
    if (!noteForm.date || !noteForm.title.trim()) { showToast('Fill date and title', 'warn'); return; }
    if (noteEditId) {
      await calendar.updateNote(noteEditId, noteForm);
      showToast('Note updated ✅');
    } else {
      await calendar.createNote(noteForm);
      showToast('Note saved ✅');
    }
    const updated = await calendar.notes();
    setNotes(updated as CalendarNote[]);
    setShowNote(false);
  }

  async function delNote(id: string) {
    await calendar.deleteNote(id);
    showToast('Note deleted', 'info');
    setNotes((n) => n.filter((x) => x.id !== id));
  }

  function openAddNote(date = selDay || fmtD(now)) {
    setNoteEditId('');
    setNoteForm({ date, title: '', content: '', color: 'note' });
    setShowNote(true);
  }

  async function handleRequest(id: string, status: 'approved' | 'denied') {
    await calendar.updateRequest(id, status);
    showToast(status === 'approved' ? 'Request approved ✅' : 'Request denied');
    loadRequests();
  }

  return (
    <div>
      <div className="ph"><h2>📅 Calendar</h2><p>Assignment deadlines, notes and events</p></div>
      <div className="flex jb ia mb2">
        <div className="flex ia g2">
          <button className="btn ba btn-sm" onClick={() => openAddNote()}>+ Add Note</button>
          {requests.length > 0 && (
            <button className="btn bw-btn btn-sm" onClick={() => setShowRequests(true)}>
              📨 {requests.length} Change Request{requests.length > 1 ? 's' : ''}
            </button>
          )}
        </div>
        <span />
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
                    {evs.slice(0, 2).map((e, j) => <div key={j} className={`cal-pill ${e.cl}`}>{e.title.slice(0, 11)}</div>)}
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
              {dayNotes.map((n) => (
                <div key={n.id} className="cal-ev">
                  <div className="flex jb ia"><div className="cal-ev-t">📌 {n.title}</div><span className={`cal-pill ${n.color}`}>Note</span></div>
                  {n.content && <div className="cal-ev-s">{n.content}</div>}
                  <div style={{ marginTop: 6 }}><button className="btn bd-btn btn-sm" onClick={() => delNote(n.id)}>🗑 Delete</button></div>
                </div>
              ))}
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
        <Modal title={`📨 Student Change Requests (${requests.length})`} onClose={() => setShowRequests(false)}>
          {requests.length === 0 ? (
            <p className="sm ct3">No pending requests.</p>
          ) : requests.map((req) => (
            <div key={req.id} style={{ padding: '12px 14px', border: '1.5px solid var(--bd)', borderRadius: 11, marginBottom: 10 }}>
              <div className="flex jb ia mb1">
                <span className="bold">{req.studentName}</span>
                <span className="xs ct3">{new Date(req.createdAt).toLocaleDateString('en-ZA')}</span>
              </div>
              {req.note && <div className="xs ct3 mb1">Re: 📌 {req.note.title} ({req.note.date})</div>}
              <div className="sm ct2 mb2" style={{ background: 'rgba(20,184,166,.06)', borderRadius: 8, padding: '8px 10px' }}>{req.message}</div>
              <div className="flex g1">
                <button className="btn bs btn-sm" onClick={() => handleRequest(req.id, 'approved')}>✅ Approve</button>
                <button className="btn bd-btn btn-sm" onClick={() => handleRequest(req.id, 'denied')}>❌ Deny</button>
              </div>
            </div>
          ))}
        </Modal>
      )}

      {showNote && (
        <Modal title={noteEditId ? 'Edit Note' : 'Add Calendar Note'} onClose={() => setShowNote(false)}>
          <div className="fg"><label className="lbl">Date</label><input type="date" className="input" value={noteForm.date} onChange={(e) => setNoteForm({ ...noteForm, date: e.target.value })} /></div>
          <div className="fg"><label className="lbl">Title</label><input type="text" className="input" value={noteForm.title} onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })} placeholder="e.g. Mock Exam Reminder" /></div>
          <div className="fg"><label className="lbl">Note</label><textarea className="textarea" value={noteForm.content} onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })} placeholder="Details…" /></div>
          <div className="fg"><label className="lbl">Color</label>
            <select className="select" value={noteForm.color} onChange={(e) => setNoteForm({ ...noteForm, color: e.target.value })}>
              <option value="note">Blue — General</option><option value="up">Amber — Reminder</option><option value="cp">Green — Good News</option><option value="ov">Red — Urgent</option>
            </select>
          </div>
          <div className="flex g1"><button className="btn bp" onClick={saveNote}>💾 Save</button><button className="btn bg-btn" onClick={() => setShowNote(false)}>Cancel</button></div>
        </Modal>
      )}
    </div>
  );
}
