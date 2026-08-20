'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BackIcon } from '@/ui/icons';
import { TZ } from '@/lib/dates';

type Course = {
  id: string; name: string; code: string | null;
  grade: string | null; score: number | null; term: string | null;
};
type Assignment = {
  id: string; courseId: string; name: string; dueAt: string | null;
  pointsPossible: number | null; htmlUrl: string | null; description: string | null;
  submitted: boolean; muted: boolean; score: number | null;
};
type Overview = {
  courses: Course[]; assignments: Assignment[];
  settings: { remindHoursBefore: number; hideZeroPoint: boolean };
};

const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });

// Mon–Sun of the current week, as YYYY-MM-DD keys in the app timezone.
function weekDays(): string[] {
  const today = todayKey();
  const noon = new Date(`${today}T12:00:00`); // stable day-of-week regardless of tz
  const dow = (noon.getDay() + 6) % 7; // Mon=0
  return Array.from({ length: 7 }, (_, i) =>
    new Date(noon.getTime() + (i - dow) * 864e5).toLocaleDateString('en-CA'));
}

function dueLabel(a: Assignment) {
  if (!a.dueAt) return { text: 'no due date', cls: '' };
  const due = new Date(a.dueAt);
  const h = (due.getTime() - Date.now()) / 3600e3;
  const time = due.toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })
    .toLowerCase().replace(' ', '');
  if (h < 0) return { text: 'past due', cls: 'due-urgent' };
  if (dayKey(a.dueAt) === todayKey()) return { text: `today ${time}`, cls: 'due-urgent' };
  const d = Math.ceil(h / 24);
  if (h < 48) return { text: `tomorrow ${time}`, cls: 'due-soon' };
  return {
    text: due.toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' }),
    cls: d <= 3 ? 'due-soon' : '',
  };
}

export function CanvasView() {
  const [data, setData] = useState<Overview | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () =>
    fetch('/api/mod/canvas/overview').then((r) => r.json())
      .then((d) => d.courses && setData(d)).catch(() => {});
  useEffect(() => { load(); }, []);

  const post = (path: string, body?: unknown) => {
    setBusy(true); setMsg(null);
    return fetch(`/api/mod/canvas/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => {
      if (!r.ok) setMsg((await r.json().catch(() => ({})))?.error ?? 'failed');
      return load();
    }).catch(() => setMsg('offline')).finally(() => setBusy(false));
  };

  const toggleZeroPoint = () => {
    if (!data) return;
    const next = !data.settings.hideZeroPoint;
    setData({ ...data, settings: { ...data.settings, hideZeroPoint: next } });
    fetch('/api/settings/canvas', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hideZeroPoint: next }),
    }).catch(() => {});
  };

  const hideZero = data?.settings.hideZeroPoint ?? false;
  const courses = data?.courses ?? [];
  const byCourse = useMemo(() => Object.fromEntries(courses.map((c) => [c.id, c])), [courses]);
  const isDemo = courses.some((c) => c.id.startsWith('fake-'));

  const all = data?.assignments ?? [];
  const hiddenCount = all.filter((a) => a.muted).length;
  const visible = all.filter((a) =>
    (showHidden || !a.muted) && !(hideZero && a.pointsPossible === 0));

  const now = Date.now();
  const open = visible.filter((a) => !a.submitted);
  const overdue = open.filter((a) => a.dueAt && new Date(a.dueAt).getTime() < now);
  const upcoming = open.filter((a) => !a.dueAt || new Date(a.dueAt).getTime() >= now);
  const done = visible.filter((a) => a.submitted);

  const days = weekDays();
  const perDay = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of open) if (a.dueAt) m[dayKey(a.dueAt)] = (m[dayKey(a.dueAt)] ?? 0) + 1;
    return m;
  }, [open]);

  const today = todayKey();
  const weekEndTs = new Date(`${days[6]}T23:59:59`).getTime();
  const dueToday = upcoming.filter((a) => a.dueAt && dayKey(a.dueAt) === today).length;
  const dueWeek = upcoming.filter((a) => a.dueAt && new Date(a.dueAt).getTime() <= weekEndTs).length;

  const listed = selectedDay
    ? open.filter((a) => a.dueAt && dayKey(a.dueAt) === selectedDay)
    : upcoming;

  const row = (a: Assignment) => {
    const d = dueLabel(a);
    const c = byCourse[a.courseId];
    const isOpen = expanded === a.id;
    return (
      <div key={a.id} className={`cv-item${a.muted ? ' cv-muted' : ''}`}>
        <button type="button" className="tile-row cv-row" onClick={() => setExpanded(isOpen ? null : a.id)}>
          <div className="what">
            <div className="t">{a.name}</div>
            <div className="s">
              {c?.code ?? c?.name ?? ''}
              {a.pointsPossible != null && ` · ${a.pointsPossible} pts`}
              {a.muted && ' · hidden'}
            </div>
          </div>
          <span className={`count-pill ${d.cls}`}>{d.text}</span>
        </button>
        {isOpen && (
          <div className="cv-detail">
            {a.description
              ? <p>{a.description}</p>
              : <p className="cv-nodesc">No description.</p>}
            {a.dueAt && (
              <p className="cv-nodesc">
                Due {new Date(a.dueAt).toLocaleString('en-US', {
                  timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric',
                  hour: 'numeric', minute: '2-digit',
                })}
              </p>
            )}
            <div className="cv-actions">
              {a.htmlUrl && (
                <a className="cv-btn" href={a.htmlUrl} target="_blank" rel="noreferrer">Open in Canvas ↗</a>
              )}
              <button
                type="button" className="cv-btn" disabled={busy}
                onClick={() => post('mute', { id: a.id, muted: !a.muted })}
              >
                {a.muted ? 'Unhide' : 'Hide'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <header className="page-header">
        <Link href="/" className="back-btn" aria-label="Back to dashboard"><BackIcon /></Link>
        <h1>Canvas</h1>
        <button
          type="button" className="back-btn cv-sync" aria-label="Sync now" disabled={busy}
          onClick={() => post('sync')}
        >
          {busy ? <span className="spin" /> : '⟳'}
        </button>
      </header>

      {msg && <p className="pill-note offline" style={{ marginBottom: 12 }}>{msg}</p>}

      {!data ? (
        <div className="tile-empty" style={{ minHeight: 120 }}><span className="spin" /></div>
      ) : courses.length === 0 ? (
        <div className="card cv-empty">
          <p>No courses yet — sync pulls the current semester from Canvas.</p>
          <div className="cv-actions" style={{ justifyContent: 'center' }}>
            <button type="button" className="cv-btn" disabled={busy} onClick={() => post('sync')}>Sync now</button>
            <button type="button" className="cv-btn" disabled={busy} onClick={() => post('seed')}>Load demo data</button>
          </div>
        </div>
      ) : (
        <>
          <div className="cv-stats">
            <div className="cv-stat"><div className="n">{dueToday}</div><div className="l">due today</div></div>
            <div className="cv-stat"><div className="n">{dueWeek}</div><div className="l">this week</div></div>
            <div className={`cv-stat${overdue.length ? ' bad' : ''}`}>
              <div className="n">{overdue.length}</div><div className="l">overdue</div>
            </div>
            <div className="cv-stat"><div className="n">{upcoming.length}</div><div className="l">upcoming</div></div>
          </div>

          <div className="cv-week">
            {days.map((d) => {
              const n = perDay[d] ?? 0;
              const date = new Date(`${d}T12:00:00`);
              return (
                <button
                  type="button" key={d}
                  className={`cv-day${d === today ? ' today' : ''}${selectedDay === d ? ' sel' : ''}`}
                  onClick={() => setSelectedDay(selectedDay === d ? null : d)}
                >
                  <span className="dow">{date.toLocaleDateString('en-US', { weekday: 'narrow' })}</span>
                  <span className="num">{date.getDate()}</span>
                  <span className={`cnt${n ? '' : ' zero'}`}>{n || '·'}</span>
                </button>
              );
            })}
          </div>

          <div className="cv-chips">
            <button type="button" className={`cv-chip${hideZero ? ' on' : ''}`} onClick={toggleZeroPoint}>
              Hide 0-pt
            </button>
            {hiddenCount > 0 && (
              <button type="button" className={`cv-chip${showHidden ? ' on' : ''}`} onClick={() => setShowHidden(!showHidden)}>
                Show hidden ({hiddenCount})
              </button>
            )}
            {selectedDay && (
              <button type="button" className="cv-chip on" onClick={() => setSelectedDay(null)}>
                {new Date(`${selectedDay}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ✕
              </button>
            )}
          </div>

          {!selectedDay && overdue.length > 0 && (
            <section className="section">
              <h2 className="section-title due-urgent">Overdue</h2>
              <div className="card">{overdue.map(row)}</div>
            </section>
          )}

          <section className="section">
            <h2 className="section-title">{selectedDay ? 'Due that day' : 'Due'}</h2>
            <div className="card">
              {listed.length === 0 && <div className="tile-empty">All caught up ✓</div>}
              {listed.map(row)}
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">Classes</h2>
            <div className="cv-classes">
              {courses.map((c) => {
                const n = open.filter((a) => a.courseId === c.id).length;
                return (
                  <div className="card cv-class" key={c.id}>
                    <div className="code">{c.code ?? c.name}</div>
                    <div className="grade">{c.grade ?? (c.score != null ? `${c.score}%` : '—')}</div>
                    <div className="sub">
                      {c.score != null && c.grade ? `${c.score}% · ` : ''}
                      {n ? `${n} due` : 'clear'}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {done.length > 0 && (
            <section className="section">
              <h2 className="section-title">Submitted</h2>
              <div className="card">
                {done.map((a) => (
                  <div className="tile-row" key={a.id} style={{ opacity: 0.6 }}>
                    <div className="what">
                      <div className="t">{a.name}</div>
                      <div className="s">{byCourse[a.courseId]?.code ?? ''}</div>
                    </div>
                    <span className="count-pill ok">
                      {a.score != null ? `${a.score}/${a.pointsPossible ?? '?'}` : '✓'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {isDemo && (
            <p className="cv-demo-note">
              Showing demo data ·{' '}
              <button type="button" disabled={busy} onClick={() => post('clear-demo')}>clear it</button>
            </p>
          )}
        </>
      )}
    </>
  );
}
