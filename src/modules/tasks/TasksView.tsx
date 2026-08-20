'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BackIcon } from '@/ui/icons';
import { TZ } from '@/lib/dates';

type Task = {
  id: string; title: string; due: string | null; allDay: boolean;
  repeatDays: number | null; done: boolean; doneAt: string | null;
};
type ChatMsg = { role: 'user' | 'ai'; text: string };

const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });

const fmtTime = (t: Task) => {
  if (!t.due || t.allDay) return null;
  return new Date(t.due).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })
    .toLowerCase().replace(' ', '');
};

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' });

const repeatLabel = (d: number | null) =>
  !d ? '' : d === 1 ? '↻ daily' : d === 7 ? '↻ weekly' : `↻ ${d}d`;

export function TasksView() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [repeat, setRepeat] = useState('0');
  const chatEnd = useRef<HTMLDivElement>(null);

  const load = () =>
    fetch('/api/mod/tasks/list').then((r) => r.json())
      .then((d) => Array.isArray(d) && setTasks(d)).catch(() => {});
  useEffect(() => { load(); }, []);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat, thinking]);

  const send = () => {
    const text = chatInput.trim();
    if (!text || thinking) return;
    setChatInput('');
    setChat((c) => [...c, { role: 'user', text }]);
    setThinking(true);
    fetch('/api/mod/tasks/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    }).then((r) => r.json()).then((d) => {
      setChat((c) => [...c, { role: 'ai', text: d.reply ?? d.error ?? 'failed' }]);
      load();
    }).catch(() => setChat((c) => [...c, { role: 'ai', text: 'offline' }]))
      .finally(() => setThinking(false));
  };

  const addManual = () => {
    if (!title.trim()) return;
    fetch('/api/mod/tasks/add', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title,
        due: due ? new Date(due).toISOString() : null,
        allDay: due.length === 10,
        repeatDays: parseInt(repeat, 10) || null,
      }),
    }).then(() => { setTitle(''); setDue(''); setRepeat('0'); setShowManual(false); load(); }).catch(() => {});
  };

  const toggle = (id: string) =>
    fetch('/api/mod/tasks/toggle', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    }).then(load).catch(() => {});

  const del = (id: string) =>
    fetch(`/api/mod/tasks/task/${id}`, { method: 'DELETE' }).then(load).catch(() => {});

  const today = todayKey();
  const all = tasks ?? [];
  const open = all.filter((t) => !t.done);
  // TODAY: overdue + due-today (repeats due today appear here naturally)
  const todayTasks = open.filter((t) => t.due && dayKey(t.due) <= today)
    .sort((a, b) => String(a.due).localeCompare(String(b.due)));
  const anytime = open.filter((t) => !t.due);
  // checked-off today: stays visible for the satisfaction, gone at midnight
  const doneToday = all.filter((t) => t.done && t.doneAt && dayKey(t.doneAt) === today)
    .sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt)));
  const upcoming = open.filter((t) => t.due && dayKey(t.due) > today)
    .sort((a, b) => String(a.due).localeCompare(String(b.due)));

  const row = (t: Task, opts?: { overdue?: boolean }) => (
    <div className={`task-row${t.done ? ' is-done' : ''}`} key={t.id}>
      <button className={`task-check${t.done ? ' on' : ''}`} onClick={() => toggle(t.id)}
        aria-label={t.done ? 'Mark not done' : 'Mark done'}>{t.done ? '✓' : ''}</button>
      <div className="what">
        <div className={`t${t.done ? ' task-done' : ''}`}>{t.title}</div>
        {(fmtTime(t) || t.repeatDays || opts?.overdue) && (
          <div className="s">
            {opts?.overdue && <span style={{ color: 'var(--red)', fontWeight: 700 }}>overdue · {fmtDay(t.due!)} </span>}
            {!opts?.overdue && fmtTime(t)}
            {t.repeatDays ? `${fmtTime(t) && !opts?.overdue ? ' · ' : ' '}${repeatLabel(t.repeatDays)}` : ''}
          </div>
        )}
      </div>
      <button className="task-del" onClick={() => del(t.id)} aria-label="Delete">✕</button>
    </div>
  );

  return (
    <div className="tasks-page">
      <header className="page-header">
        <Link href="/" className="back-btn" aria-label="Back to dashboard"><BackIcon /></Link>
        <h1>Tasks</h1>
        <span className="pill-note" style={{ marginLeft: 'auto' }}>
          {todayTasks.length + anytime.length} left today · {doneToday.length} done ✓
        </span>
        <button className="btn small" onClick={() => setShowManual(!showManual)}>＋ manual</button>
      </header>

      {showManual && (
        <div className="card task-add">
          <input className="text-input" value={title} placeholder="Task…" autoFocus
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addManual()} />
          <div className="task-add-row">
            <input className="text-input" type="datetime-local" value={due}
              onChange={(e) => setDue(e.target.value)} />
            <select className="text-input" value={repeat} onChange={(e) => setRepeat(e.target.value)}>
              <option value="0">no repeat</option>
              <option value="1">daily</option>
              <option value="7">weekly</option>
              <option value="14">every 2 weeks</option>
              <option value="30">monthly</option>
            </select>
            <button className="btn primary" onClick={addManual} disabled={!title.trim()}>Add</button>
          </div>
        </div>
      )}

      <div className="tasks-split">
        {/* chat — full column; it runs the list */}
        <div className="tasks-chat">
          <div className="tasks-chat-log">
            {chat.length === 0 && (
              <div className="tile-empty" style={{ padding: 20, textAlign: 'center' }}>
                Tell me anything —<br />
                “gym 4pm”, “eat”, “brush teeth every night”,<br />“i did the chem lab”<br />
                — I add, check off, and delete for you.
              </div>
            )}
            {chat.map((m, i) => (
              <div className={`tchat-msg ${m.role}`} key={i}>{m.text}</div>
            ))}
            {thinking && <div className="tchat-msg ai tchat-thinking">…</div>}
            <div ref={chatEnd} />
          </div>
          <div className="tasks-chat-input">
            <textarea className="text-input" rows={2} value={chatInput}
              placeholder="What's on your plate?"
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <button className="btn primary" onClick={send} disabled={thinking || !chatInput.trim()}>↑</button>
          </div>
        </div>

        {/* the day: check things off, feel good, midnight sweeps it clean */}
        <div className="tasks-list">
          <div className="card accent-blue task-today">
            <div className="task-today-head">
              <span className="task-today-title">{fmtDay(new Date().toISOString())}</span>
              {todayTasks.length + anytime.length === 0 && doneToday.length > 0 && (
                <span className="s" style={{ color: 'var(--green)' }}>all done 🎉</span>
              )}
            </div>
            {todayTasks.map((t) => row(t, { overdue: dayKey(t.due!) < today }))}
            {anytime.length > 0 && (
              <>
                <div className="task-sub">anytime</div>
                {anytime.map((t) => row(t))}
              </>
            )}
            {doneToday.length > 0 && (
              <>
                <div className="task-sub">done today</div>
                {doneToday.map((t) => row(t))}
              </>
            )}
            {todayTasks.length + anytime.length + doneToday.length === 0 && (
              <div className="tile-empty">Nothing yet — tell the chat</div>
            )}
          </div>

          {upcoming.length > 0 && (
            <div className="card task-upcoming">
              {upcoming.map((t) => (
                <div className="task-row slim" key={t.id}>
                  <span className="count-pill">{fmtDay(t.due!)}</span>
                  <div className="what">
                    <div className="t">{t.title}</div>
                    {(fmtTime(t) || t.repeatDays) && (
                      <div className="s">{fmtTime(t)}{t.repeatDays ? ` ${repeatLabel(t.repeatDays)}` : ''}</div>
                    )}
                  </div>
                  <button className="task-del" onClick={() => del(t.id)} aria-label="Delete">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
