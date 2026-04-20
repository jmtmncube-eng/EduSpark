import { useEffect, useState } from 'react';
import { assignments as assignmentsApi, calendar, results as resultsApi } from '../../services/api';
import { showToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import type { Assignment, CalendarNote, QuizResult } from '../../types';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function fmtD(d: Date) { return d.toISOString().split('T')[0]; }

export default function StudentCalendar() {
  const [calDate, setCalDate] = useState(new Date());
  const [selDay, setSelDay] = useState('');
  const [asgns, setAsgns] = useState<Assignment[]>([]);
  const [notes, setNotes] = useState<CalendarNote[]>([]);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [requestNote, setRequestNote] = useState<CalendarNote | null>(null);
  const [requestMsg, setRequestMsg] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);

  useEffect(() => {
    assignmentsApi.list().then((d) => setAsgns(d as Assignment[]));
    calendar.notes().then((d) => setNotes(d as CalendarNote[]));
    resultsApi.list().then((d) => setResults(d as QuizResult[]));
  }, []);

  const yr = calDate.getFullYear(), mo = calDate.getMonth();
  const now = new Date();
  const fd = new Date(yr, mo, 1).getDay();
  const dim = new Date(yr, mo + 1, 0).getDate();
  const doneIds = results.map((r) => r.assignmentId);

  const evMap: Record<string, { title: string; cl: string }[]> = {};
  asgns.forEach((a) => {
    const d = a.dueDate.split('T')[0];
    if (!evMap[d]) evMap[d] = [];
    const done = doneIds.includes(a.id);
    const ov = new Date(a.dueDate) < now && !done;
    evMap[d].push({ title: a.title, cl: done ? 'cp' : ov ? 'ov' : 'fut' });
  });
  notes.forEach((n) => {
    if (!evMap[n.date]) evMap[n.date] = [];
    evMap[n.date].push({ title: n.title, cl: n.color || 'note' });
  });

  const dayAsgns = asgns.filter((a) => a.dueDate.split('T')[0] === selDay);
  const dayNotes = notes.filter((n) => n.date === selDay);

  async function submitRequest() {
    if (!requestNote || !requestMsg.trim()) { showToast('Enter a message', 'warn'); return; }
    setRequestLoading(true);
    try {
      await calendar.createRequest(requestNote.id, requestMsg);
      showToast('Request sent to your teacher! ✅');
      setRequestNote(null);
      setRequestMsg('');
    } catch {
      showToast('Could not send request — try again', 'err');
    } finally {
      setRequestLoading(false);
    }
  }

  return (
    <div>
      <div className="ph"><h2>📅 My Schedule</h2><p>Assignment deadlines and class notes</p></div>
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
            {Array.from({ length: fd }, (_, i) => <div key={`e-${i}`} className="cal-day other" />)}
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
          {!selDay ? <p className="sm ct3">Click any day to view assignments.</p> : (
            <>
              {!dayAsgns.length && !dayNotes.length && <p className="sm ct3">Nothing scheduled for this day.</p>}
              {dayAsgns.map((a) => {
                const done = doneIds.includes(a.id);
                const ov = new Date(a.dueDate) < now && !done;
                return (
                  <div key={a.id} className="cal-ev">
                    <div className="flex jb ia">
                      <div className="cal-ev-t">📋 {a.title}</div>
                      <span className={`cal-pill ${done ? 'cp' : ov ? 'ov' : 'fut'}`}>{done ? '✅ Done' : ov ? '❌ Overdue' : '📅 Pending'}</span>
                    </div>
                    <div className="cal-ev-s">{a.subject === 'MATHEMATICS' ? '📐' : '⚗️'} Gr{a.grade} · {a.topic}</div>
                  </div>
                );
              })}
              {dayNotes.map((n) => (
                <div key={n.id} className="cal-ev">
                  <div className="flex jb ia" style={{ marginBottom: 4 }}>
                    <div className="cal-ev-t">📌 {n.title}</div>
                    <span className={`cal-pill ${n.color}`}>Note</span>
                  </div>
                  {n.content && <div className="cal-ev-s" style={{ marginBottom: 6 }}>{n.content}</div>}
                  <button className="btn ba btn-sm" style={{ fontSize: 10.5 }} onClick={() => { setRequestNote(n); setRequestMsg(''); }}>
                    📝 Request Change
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="flex" style={{ gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
        {[['var(--dr)', 'Overdue'], ['var(--p)', 'Pending'], ['var(--s)', 'Completed'], ['var(--a)', 'Note']].map(([c, l]) => (
          <div key={l} className="flex ia" style={{ gap: 5, fontSize: 11, color: 'var(--t2)' }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />{l}</div>
        ))}
        <div className="sm ct3" style={{ marginLeft: 'auto' }}>💡 Click 📝 on notes to request a schedule change from your teacher</div>
      </div>

      {requestNote && (
        <Modal title="📝 Request Schedule Change" onClose={() => setRequestNote(null)}>
          <div style={{ marginBottom: 14 }}>
            <div className="sm ct2 mb1">Requesting change for: <strong className="cp">{requestNote.title}</strong></div>
            <div className="xs ct3">Your teacher will review your request and get back to you.</div>
          </div>
          <div className="fg">
            <label className="lbl">Your Message</label>
            <textarea
              className="textarea"
              value={requestMsg}
              onChange={(e) => setRequestMsg(e.target.value)}
              placeholder="Explain why you need this changed (e.g. I have a sports event, family commitment, etc.)"
              style={{ minHeight: 90 }}
            />
          </div>
          <div className="flex g1 mt1">
            <button className="btn bp" onClick={submitRequest} disabled={requestLoading}>
              {requestLoading ? '…' : '📨 Send Request'}
            </button>
            <button className="btn bg-btn" onClick={() => setRequestNote(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
