'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarIcon, BookIcon, MailIcon, DumbbellIcon, MusicIcon, TrophyIcon, NoteIcon, LockIcon, CheckIcon, CartIcon, BowlIcon, SproutIcon } from './icons';
import { TZ } from '@/lib/dates';

type DayItem = {
  id: string; date: string; time: string | null; title: string;
  subtitle: string | null; status: string; color?: string | null;
  payload?: { allDay?: boolean };
};
type CanvasA = { id: string; name: string; course: string; dueAt: string | null; htmlUrl: string };
type Mail = { id: string; fromAddr: string; summary: string | null };
type SpTrack = { name: string; artist: string; art: string | null; artBig: string | null; url: string | null };
type Cal = { id: string; summary: string; color: string | null; primary: boolean };
type Data = {
  date: string;
  quickLinks?: { label: string; url: string }[];
  modules?: { id: string; enabled: boolean }[];
  tiles: {
    gcal?: { items: DayItem[]; error?: string };
    canvas?: {
      assignments: CanvasA[];
      counts?: { today: number; week: number; overdue: number; total: number };
      courses: unknown[]; error?: string;
    };
    gmail?: {
      unread: number; important: Mail[];
      latest?: { id: string; fromAddr: string; subject: string | null; summary: string | null; unread: boolean; category: string }[];
      error?: string;
    };
    spotify?: { connected: boolean; playing?: boolean; track?: SpTrack | null; error?: string };
    fitness?: {
      hasData: boolean; isToday?: boolean;
      eaten?: number; burned?: number; deficit?: number; streak?: number; error?: string;
    };
    competitions?: {
      count: number;
      next: { uid: string; name: string; kind: string; city: string | null; state: string | null; startDate: string }[];
      rating?: string | null;
      lastResult?: { tournament: string; place: number | null; fieldSize: number | null; date: string } | null;
      error?: string;
    };
    obsidian?: {
      count: number;
      recent: { name: string; path: string; mtime: number }[];
      error?: string;
    };
    passwords?: { count: number; error?: string };
    tasks?: {
      open: number;
      next: { id: string; title: string; due: string | null; allDay: boolean; repeatDays: number | null }[];
      error?: string;
    };
  };
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).replace(' ', '').toLowerCase();

const agoShort = (ms: number) => {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 60) return `${Math.max(min, 1)}m`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
};

const daysUntil = (date: string) => {
  const d = Math.ceil((new Date(date + 'T12:00:00').getTime() - Date.now()) / 86400e3);
  return d <= 0 ? 'now' : `${d}d`;
};

function dueLabel(iso: string | null): { text: string; cls: string } {
  if (!iso) return { text: '—', cls: '' };
  const ms = new Date(iso).getTime() - Date.now();
  const h = ms / 3600e3;
  if (h < 0) return { text: 'past due', cls: 'due-urgent' };
  if (h < 24) return { text: `${Math.max(1, Math.round(h))}h left`, cls: 'due-urgent' };
  const d = Math.round(h / 24);
  return { text: `${d} day${d === 1 ? '' : 's'}`, cls: d <= 3 ? 'due-soon' : '' };
}

function greeting() {
  const h = Number(new Date().toLocaleString('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }));
  if (h < 5) return 'Late night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function extOpen(url: string) {
  // In the desktop app external URLs are routed to the system browser by Electron.
  window.open(url, '_blank', 'noopener');
}

const APP_META: Record<string, { icon: string; name: string; url: string }> = {
  gcal: { icon: '📅', name: 'Calendar', url: '/m/gcal' },
  canvas: { icon: '📚', name: 'Canvas', url: '/m/canvas' },
  gmail: { icon: '✉️', name: 'Gmail', url: '/m/gmail' },
  competitions: { icon: '🤺', name: 'Competitions', url: '/m/competitions' },
  tasks: { icon: '☑️', name: 'Tasks', url: '/m/tasks' },
  passwords: { icon: '🔒', name: 'Passwords', url: '/m/passwords' },
  obsidian: { icon: '📝', name: 'Notes', url: '/m/obsidian' },
  spotify: { icon: '🎵', name: 'Spotify', url: '/m/spotify' },
  fitness: { icon: '🏋️', name: 'Fitness', url: '/m/fitness' },
  system: { icon: '⚙️', name: 'System', url: '/settings' },
};

type BellApp = { moduleId: string; title: string; body: string | null; url: string | null; at: string; unread: number; total: number };

// The bell: one line per app, unread-app count on the badge.
function NotificationBell() {
  const [data, setData] = useState<{ apps: BellApp[]; unreadApps: number } | null>(null);
  const [open, setOpen] = useState(false);
  const load = () => fetch('/api/notifications').then((r) => r.json())
    .then((d) => d.apps && setData(d)).catch(() => {});
  useEffect(() => { load(); const i = setInterval(load, 60_000); return () => clearInterval(i); }, []);
  const markRead = () =>
    fetch('/api/notifications', { method: 'PATCH' }).then(load).catch(() => {});
  return (
    <div className="bell-wrap">
      <button className="bell" onClick={() => setOpen(!open)} aria-label="Notifications">
        🔔{(data?.unreadApps ?? 0) > 0 && <span className="bell-badge">{data!.unreadApps}</span>}
      </button>
      {open && <div className="bell-backdrop" onClick={() => setOpen(false)} />}
      {open && (
        <div className="bell-panel">
          <div className="bell-head">
            <span>Notifications</span>
            <button className="btn small" onClick={markRead}>Mark read</button>
          </div>
          {!data?.apps.length && <div className="tile-empty">All quiet 🎐</div>}
          {data?.apps.map((a) => {
            // Tap-through: straight to the problem (or the app the news is about).
            const meta = APP_META[a.moduleId] ?? { icon: '🔔', name: a.moduleId, url: '/' };
            const dest = a.url ?? meta.url;
            const inner = (
              <>
                <span className="bell-ico">{meta.icon}</span>
                <span className="bell-main">
                  <span className="t">{a.title}</span>
                  {a.body && <span className="s">{a.body}</span>}
                </span>
                {a.total > 1 && <span className="count-pill">{a.total}</span>}
              </>
            );
            const cls = `bell-row${a.unread ? ' unread' : ''}`;
            return dest.startsWith('http') ? (
              <a href={dest} target="_blank" rel="noreferrer" className={cls}
                key={a.moduleId} onClick={() => setOpen(false)}>{inner}</a>
            ) : (
              <Link href={dest} className={cls} key={a.moduleId} onClick={() => setOpen(false)}>{inner}</Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Right-edge center button → drawer of extra apps (phone-style grid).
function ExtraApps({ off }: { off: (id: string) => boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="edge-links right-center">
        <button onClick={() => setOpen(true)} aria-label="More apps" title="More apps">▦</button>
      </div>
      {open && (
        <div className="xapps-wrap" onClick={() => setOpen(false)}>
          <div className="xapps" onClick={(e) => e.stopPropagation()}>
            <div className="xapps-title">More apps</div>
            <div className="xapps-grid">
              {!off('competitions') && <Link href="/m/competitions" className="xapp accent-orange" onClick={() => setOpen(false)}>
                <span className="xapp-ico"><TrophyIcon /></span>
                <span>Competitions</span>
              </Link>}
              {!off('obsidian') && <Link href="/m/obsidian" className="xapp accent-violet" onClick={() => setOpen(false)}>
                <span className="xapp-ico"><NoteIcon /></span>
                <span>Notes</span>
              </Link>}
              {!off('passwords') && <Link href="/m/passwords" className="xapp accent-red" onClick={() => setOpen(false)}>
                <span className="xapp-ico"><LockIcon /></span>
                <span>Passwords</span>
              </Link>}
              <Link href="/m/recipes" className="xapp accent-green" onClick={() => setOpen(false)}>
                <span className="xapp-ico"><BowlIcon /></span>
                <span>Recipes</span>
              </Link>
              <Link href="/m/farm" className="xapp accent-green" onClick={() => setOpen(false)}>
                <span className="xapp-ico"><SproutIcon /></span>
                <span>Farm</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Kairos top-left; user-defined quick links (Settings → Quick links) lower-left.
function EdgeLinks({ links, kairos }: { links: { label: string; url: string }[]; kairos: boolean }) {
  return (
    <>
      {kairos && (
        <div className="edge-links top">
          <Link href="/m/kairos" aria-label="Kairos" title="Kairos" style={{ color: 'var(--violet)' }}>✧</Link>
        </div>
      )}
      {links.length > 0 && (
        <div className="edge-links bottom">
          {links.slice(0, 4).map((l) => (
            <a key={l.url} role="button" tabIndex={0} onClick={() => extOpen(l.url)} aria-label={l.label} title={l.label}>
              {l.label.slice(0, 2)}
            </a>
          ))}
        </div>
      )}
    </>
  );
}

export function Dashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [offline, setOffline] = useState(false);
  const [spMsg, setSpMsg] = useState('');

  const refetch = () =>
    fetch('/api/dashboard').then((r) => r.json()).then(setData).catch(() => {});

  useEffect(() => {
    fetch('/api/dashboard').then((r) => r.json()).then(setData).catch(() => setOffline(true));
    // Kick off any due background syncs, then refresh if something updated.
    const syncDue = () =>
      fetch('/api/sync', { method: 'POST' })
        .then((r) => r.json())
        .then((report: Record<string, string>) => {
          if (Object.values(report).some((v) => v === 'ok')) refetch();
        })
        .catch(() => {});
    syncDue();
    // Keep the dashboard fresh while it's open: re-sync + refetch every 3 min
    // (only when visible) and immediately when the app comes back to foreground.
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') { syncDue(); refetch(); }
    }, 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') { syncDue(); refetch(); }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const spControl = (action: string) => {
    setSpMsg('');
    fetch('/api/mod/spotify/control', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action }),
    }).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setSpMsg(j.error?.includes('Premium') || j.error?.includes('403')
          ? 'Needs Premium + the new permissions — hit Reconnect in Settings'
          : j.error ?? 'Playback failed');
        return;
      }
      setTimeout(refetch, 600);
    }).catch(() => setSpMsg('Offline'));
  };

  const today = data?.date ?? new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  const events = (data?.tiles.gcal?.items ?? []).filter((i) => i.date === today);
  const upcoming = (data?.tiles.gcal?.items ?? []).filter((i) => i.date > today);
  const nowIso = new Date().toISOString();
  const nextIdx = events.findIndex((e) => !e.time || e.time > nowIso);
  const nextEvent = (nextIdx !== -1 ? events[nextIdx] : undefined) ?? upcoming[0];
  // around now: the event happening/just finished + the couple after the hero
  const prevEvent = nextIdx > 0 ? events[nextIdx - 1] : undefined;
  const restToday = [
    ...(prevEvent ? [prevEvent] : []),
    ...events.filter((e) => e !== nextEvent && e !== prevEvent && (!e.time || e.time > nowIso)).slice(0, 2),
  ];
  const assignments = data?.tiles.canvas?.assignments ?? [];
  const canvasCounts = data?.tiles.canvas?.counts;
  const loading = !data && !offline;
  const fit = data?.tiles.fitness;
  const sp = data?.tiles.spotify;
  // Module not configured yet → tile shows a hint instead of "no data".
  const off = (id: string) => data?.modules?.some((m) => m.id === id && !m.enabled) ?? false;
  const setupHint = <div className="tile-empty">Set up in Settings → Integrations</div>;

  return (
    <>
      <EdgeLinks links={data?.quickLinks ?? []} kairos={!off('kairos')} />
      <ExtraApps off={off} />
      <div className="top-cluster">
        <NotificationBell />
      </div>
      <header className="app-header">
        <div className="greet">{greeting()}</div>
        <div className="date">
          {new Date().toLocaleDateString('en-US', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
      </header>

      {offline && <p className="pill-note offline" style={{ marginBottom: 12 }}>Offline — showing last data</p>}

      <div className="board">
        <div className="board-main">
          <div className="board-left">
            <Link href="/m/gcal" className="tile accent-blue" aria-label="Open Calendar">
          <div className="tile-head">
            <span className="tile-chip"><CalendarIcon /></span>
            <span className="tile-name">Calendar</span>
            {events.length > 0 && <span className="badge">{events.length} today</span>}
          </div>
          <div className="gcal-tile-body">
            <div className="gcal-tile-main">
              {loading ? <div className="tile-empty"><span className="spin" /></div>
                : !nextEvent
                  ? <div className="tile-empty">Nothing scheduled — enjoy it</div>
                  : <>
                    <div className="tile-hero">
                      <div className="h-label">
                        {nextEvent.date === today ? 'Next up' : new Date(nextEvent.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })}
                      </div>
                      <div className="h-main">
                        <span className="cal-dot" style={{ background: nextEvent.color ?? 'var(--blue)' }} />
                        {nextEvent.title}
                      </div>
                      <div className="h-sub">
                        {nextEvent.payload?.allDay || !nextEvent.time ? 'All day' : fmtTime(nextEvent.time)}
                        {nextEvent.subtitle ? ` · ${nextEvent.subtitle}` : ''}
                      </div>
                    </div>
                    {restToday.map((e) => (
                      <div className="tile-row" key={e.id}>
                        <span className="when">{e.payload?.allDay || !e.time ? 'all day' : fmtTime(e.time)}</span>
                        <span className="cal-dot" style={{ background: e.color ?? 'var(--blue)' }} />
                        <div className="what"><div className="t">{e.title}</div></div>
                      </div>
                    ))}
                  </>}
            </div>
          </div>
        </Link>

            <Link href="/m/gmail" className="tile accent-red" aria-label="Open Gmail">
          <div className="tile-head">
            <span className="tile-chip"><MailIcon /></span>
            <span className="tile-name">Gmail</span>
            {data?.tiles.gmail && !data.tiles.gmail.error && (
              <span className="badge badge-green">{data.tiles.gmail.unread} unread</span>
            )}
          </div>
          {loading ? <div className="tile-empty"><span className="spin" /></div>
            : !data?.tiles.gmail || data.tiles.gmail.error
              ? (off('gmail') ? setupHint : <div className="tile-empty">Not synced yet</div>)
              : !data.tiles.gmail.latest?.length
                ? <div className="tile-empty">Inbox empty</div>
                : data.tiles.gmail.latest.map((m) => (
                  <div className="tile-row" key={m.id}>
                    <div className="what">
                      <div className={`t${m.unread ? '' : ' mail-read'}`}>{m.subject ?? '(no subject)'}</div>
                      <div className="s">{m.fromAddr}{m.summary ? ` — ${m.summary}` : ''}</div>
                    </div>
                    {m.category === 'important' && <span className="count-pill ok">!</span>}
                  </div>
                ))}
        </Link>

          </div>
          <div className="board-right">
            <Link href="/m/spotify" className="tile short accent-green" aria-label="Open Spotify">
          <div className="tile-head">
            <span className="tile-chip"><MusicIcon /></span>
            <span className="tile-name">Spotify</span>
            {sp?.playing && <span className="badge">▶ playing</span>}
          </div>
          {loading ? <div className="tile-empty"><span className="spin" /></div>
            : !sp?.connected
              ? <div className="tile-empty">Connect in Settings</div>
              : !sp.track
                ? (off('spotify') ? setupHint : <div className="tile-empty">Nothing played yet</div>)
                : <>
                  <div className="sp-now">
                    {sp.track.artBig && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={sp.track.artBig} alt="" className="sp-art" />
                    )}
                    <div className="sp-meta">
                      <div className="t">{sp.track.name}</div>
                      <div className="s">{sp.track.artist}</div>
                    </div>
                    <div className="sp-controls" onClick={(e) => e.preventDefault()}>
                      <button aria-label="Previous track" onClick={() => spControl('previous')}>⏮</button>
                      <button aria-label={sp.playing ? 'Pause' : 'Play'}
                        onClick={() => spControl(sp.playing ? 'pause' : 'play')}>
                        {sp.playing ? '⏸' : '▶'}
                      </button>
                      <button aria-label="Next track" onClick={() => spControl('next')}>⏭</button>
                    </div>
                  </div>
                  {spMsg && <div className="sp-err">{spMsg}</div>}
                </>}
        </Link>

            <Link href="/m/fitness" className="tile short accent-violet" aria-label="Open Fitness">
          <div className="tile-head">
            <span className="tile-chip"><DumbbellIcon /></span>
            <span className="tile-name">Fitness</span>
            {!!fit?.streak && <span className="badge">🔥 {fit.streak}</span>}
          </div>
          {loading ? <div className="tile-empty"><span className="spin" /></div>
            : !fit?.hasData
              ? <div className="tile-empty">Connect a fitness app in Settings</div>
              : <div className="fit-stats">
                <div className="fit-stat"><span className="v">{fit.eaten}</span><span className="k">eaten</span></div>
                <div className="fit-stat"><span className="v">{fit.burned}</span><span className="k">burned</span></div>
                <div className="fit-stat">
                  <span className={`v ${(fit.deficit ?? 0) >= 0 ? 'ok' : 'due-urgent'}`}>
                    {(fit.deficit ?? 0) >= 0 ? '−' : '+'}{Math.abs(fit.deficit ?? 0)}
                  </span>
                  <span className="k">{(fit.deficit ?? 0) >= 0 ? 'deficit' : 'surplus'}</span>
                </div>
              </div>}
        </Link>

            <Link href="/m/tasks" className="tile short accent-blue" aria-label="Open Tasks">
          <div className="tile-head">
            <span className="tile-chip"><CheckIcon /></span>
            <span className="tile-name">Tasks</span>
            {!!data?.tiles.tasks?.open && <span className="badge">{data.tiles.tasks.open}</span>}
          </div>
          {loading ? <div className="tile-empty"><span className="spin" /></div>
            : !data?.tiles.tasks?.next?.length
              ? <div className="tile-empty">Nothing to do 🎉</div>
              : data.tiles.tasks.next.map((tk) => (
                <div className="tile-row" key={tk.id}>
                  <div className="what"><div className="t">{tk.title}</div></div>
                  {tk.due && (
                    <span className={`count-pill${new Date(tk.due).getTime() < Date.now() ? ' due-urgent' : ''}`}>
                      {new Date(tk.due).toLocaleDateString('en-US', { timeZone: TZ, month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              ))}
        </Link>

            <Link href="/m/canvas" className="tile square accent-amber" aria-label="Open Canvas">
          <div className="tile-head">
            <span className="tile-chip"><BookIcon /></span>
            <span className="tile-name">Canvas</span>
          </div>
          {loading ? <div className="tile-empty"><span className="spin" /></div>
            : assignments.length === 0
              ? (off('canvas') ? setupHint : <div className="tile-empty">All caught up ✓</div>)
              : <>
                <div className="tile-hero">
                  <div className="h-big">{canvasCounts?.week ?? assignments.length}</div>
                  <div className="h-sub">
                    due this week
                    {!!canvasCounts?.today && ` · ${canvasCounts.today} today`}
                    {!!canvasCounts?.overdue && (
                      <span className="due-urgent">{` · ${canvasCounts.overdue} overdue`}</span>
                    )}
                  </div>
                </div>
                {assignments.slice(0, 4).map((a) => {
                  const d = dueLabel(a.dueAt);
                  return (
                    <div className="tile-row" key={a.id}>
                      <div className="what"><div className="t">{a.name}</div><div className="s">{a.course}</div></div>
                      <span className={`count-pill ${d.cls}`}>{d.text}</span>
                    </div>
                  );
                })}
              </>}
        </Link>

          </div>
        </div>
        <div className="os-version">
          Life OS {process.env.NEXT_PUBLIC_OS_VERSION} · {process.env.NEXT_PUBLIC_FARM_HASH}
        </div>
      </div>
    </>
  );
}
