import { useEffect, useState } from 'react';
import { assignments as assignmentsApi, calendar, results as resultsApi } from '../../services/api';
import { showToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import type { Assignment, CalendarNote, QuizResult } from '../../types';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function fmtD(d: Date) { return d.toISOString().split('T')[0]; }

type RequestMode =
  | { type: 'move'; note: CalendarNote }
  | { type: 'cancel'; note: CalendarNote }
  | { type: 'new'; preselectDate?: string };

export default function StudentCalendar() {
  const [calDate, setCalDate] = useState(new Date());
  const [selDay, setSelDay] = useState('');
  const [asgns, setAsgns] = useState<Assignment[]>([]);
  const [notes, setNotes] = useState<CalendarNote[]>([]);
  const [results, setResults] = useState<QuizResult[]>([]);

  const [mode, setMode] = useState<RequestMode | null>(null);
  const [msg, setMsg] = useState('');
  const [proposedDate, setProposedDate] = useState('');
  const [proposedTitle, setProposedTitle] = useState('Tutoring session');
  const [busy, setBusy] = useState(false);

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
    const prefix = n.kind === 'broadcast' ? '📢 ' : n.kind === 'session' ? '🎓 ' : '';
    evMap[n.date].push({ title: prefix + n.title, cl: n.color || 'note' });
  });

  const dayAsgns = asgns.filter((a) => a.dueDate.split('T')[0] === selDay);
  const dayNotes = notes.filter((n) => n.date === selDay);

  function openRequest(m: RequestMode) {
    setMode(m);
    setMsg('');
    if (m.type === 'new') {
      setProposedDate(m.preselectDate || selDay || fmtD(now));
      setProposedTitle('Tutoring session');
    } else if (m.type === 'move') {
      setProposedDate(m.note.date);
    }
  }

  async function submitRequest() {
    if (!mode) return;
    if (!msg.trim()) { showToast('Add a short message', 'warn'); return; }
    setBusy(true);
    try {
      if (mode.type === 'move') {
        if (!proposedDate) { showToast('Pick a new date', 'warn'); setBusy(false); return; }
        await calendar.createRequest({
          noteId: mode.note.id,
          requestType: 'move',
          proposedDate,
          message: msg.trim(),
        });
      } else if (mode.type === 'cancel') {
        await calendar.createRequest({
          noteId: mode.note.id,
          requestType: 'cancel',
          message: msg.trim(),
        });
      } else {
        if (!proposedDate) { showToast('Pick a date', 'warn'); setBusy(false); return; }
        await calendar.createRequest({
          requestType: 'new',
          proposedDate,
          proposedTitle: proposedTitle.trim() || 'Tutoring session',
          message: msg.trim(),
        });
      }
      showToast('Request sent — your tutor will respond.', 'success');
      setMode(null);
    } catch (e) {
      showToast(String((e as Error).message), 'err');
    } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="ph"><h2>📅 My Schedule</h2><p>Assignment deadlines, class notes and tutoring sessions</p></div>

      <div className="flex jb ia mb2" style={{ flexWrap: 'wrap', gap: 8 }}>
        <button className="btn bg-btn btn-sm" onClick={() => openRequest({ type: 'new', preselectDate: selDay })}>
          🆕 Request new session
        </button>
        <div className="xs ct3">💡 Tap any note for options · 🎓 sessions · 📢 broadcasts</div>
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
                    {evs.slice(0, 2).map((e, j) => <div key={j} className={`cal-pill ${e.cl}`}>{e.title.slice(0, 13)}</div>)}
                    {evs.length > 2 && <div className="cal-pill note">+{evs.length - 2}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="cal-side">
          <div className="cal-side-t">{selDay ? new Date(selDay + 'T00:00').toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Select a day'}</div>
          {!selDay ? <p className="sm ct3">Click any day to view what's scheduled.</p> : (
            <>
              {!dayAsgns.length && !dayNotes.length && (
                <>
                  <p className="sm ct3">Nothing scheduled for this day.</p>
                  <button className="btn ba btn-sm wf" style={{ justifyContent: 'center', marginTop: 10 }} onClick={() => openRequest({ type: 'new', preselectDate: selDay })}>
                    🆕 Request a session on this day
                  </button>
                </>
              )}
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
              {dayNotes.map((n) => {
                const isSession = n.kind === 'session';
                const isBroadcast = n.kind === 'broadcast';
                return (
                  <div key={n.id} className="cal-ev">
                    <div className="flex jb ia" style={{ marginBottom: 4 }}>
                      <div className="cal-ev-t">{isSession ? '🎓' : isBroadcast ? '📢' : '📌'} {n.title}</div>
                      <span className={`cal-pill ${n.color}`}>{n.kind || 'note'}</span>
                    </div>
                    {n.content && <div className="cal-ev-s" style={{ marginBottom: 6 }}>{n.content}</div>}
                    {n.tutor && <div className="xs ct3">From 📚 {n.tutor.name}</div>}
                    {!isBroadcast && n.tutorId && (
                      <div className="flex g1" style={{ marginTop: 6, flexWrap: 'wrap' }}>
                        <button className="btn ba btn-sm" style={{ fontSize: 10.5 }} onClick={() => openRequest({ type: 'move', note: n })}>↔ Move</button>
                        <button className="btn ba btn-sm" style={{ fontSize: 10.5 }} onClick={() => openRequest({ type: 'cancel', note: n })}>❌ Request cancel</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      <div className="flex" style={{ gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
        {[['var(--dr)', 'Overdue'], ['var(--p)', 'Pending'], ['var(--s)', 'Completed'], ['var(--a)', 'Note']].map(([c, l]) => (
          <div key={l} className="flex ia" style={{ gap: 5, fontSize: 11, color: 'var(--t2)' }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />{l}</div>
        ))}
      </div>

      {mode && (
        <Modal
          title={
            mode.type === 'move'   ? '↔ Request to move this session'
            : mode.type === 'cancel' ? '❌ Request to cancel'
            : '🆕 Request a new tutoring session'
          }
          onClose={() => setMode(null)}
        >
          {mode.type !== 'new' && (
            <div className="sm ct2 mb2">
              Re: <strong>{mode.note.title}</strong> on {mode.note.date}
            </div>
          )}

          {mode.type === 'new' && (
            <>
              <div className="fg">
                <label className="lbl">Session title</label>
                <input className="input" value={proposedTitle} onChange={(e) => setProposedTitle(e.target.value)} placeholder="e.g. Algebra catch-up" />
              </div>
            </>
          )}

          {(mode.type === 'new' || mode.type === 'move') && (
            <div className="fg">
              <label className="lbl">{mode.type === 'new' ? 'Preferred date' : 'New date'}</label>
              <input type="date" className="input" value={proposedDate} onChange={(e) => setProposedDate(e.target.value)} />
            </div>
          )}

          <div className="fg">
            <label className="lbl">Message to your tutor</label>
            <textarea
              className="textarea"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder={
                mode.type === 'new'
                  ? "Why this session matters (e.g. I'm stuck on factorising)"
                  : "Why you need this change (e.g. I have a sports event)"
              }
              style={{ minHeight: 90 }}
            />
          </div>

          <div className="flex g1 mt1">
            <button className="btn bg-btn wf" onClick={submitRequest} disabled={busy}>
              {busy ? '…' : '📨 Send request'}
            </button>
            <button className="btn ba wf" onClick={() => setMode(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
