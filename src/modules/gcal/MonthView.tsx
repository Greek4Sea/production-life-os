'use client';
import { TIMEZONES } from '@/ui/timezones';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BackIcon } from '@/ui/icons';
import { CalChat } from './CalChat';

type Item = {
  id: string; date: string; time: string | null; endTime: string | null;
  title: string; subtitle: string | null; url: string | null;
  payload?: { allDay?: boolean; calendarId?: string; description?: string } | null;
};
type Cal = { id: string; summary: string; color: string | null; primary: boolean };

const FALLBACK = '#38bdf8';

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const mins = d.getMinutes();
  const h = d.toLocaleTimeString('en-US', { hour: 'numeric' }).split(' ')[0];
  const ap = d.getHours() < 12 ? 'am' : 'pm';
  return mins === 0 ? `${h}${ap}` : `${h}:${String(mins).padStart(2, '0')}${ap}`;
};

export function MonthView() {
  const today = ymd(new Date());
  const [anchor, setAnchor] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState(today);
  const [items, setItems] = useState<Item[]>([]);
  const [colors, setColors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [view, setView] = useState<'month' | 'week'>('month');
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); d.setHours(12, 0, 0, 0); return d;
  });
  const [cals, setCals] = useState<Cal[]>([]);
  const [calSel, setCalSel] = useState<string[]>([]);
  const [showCals, setShowCals] = useState(false);
  const [tz, setTz] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings/gcal').then((r) => r.json())
      .then((s) => setCalSel(s.calendarIds ?? [])).catch(() => {});
    fetch('/api/settings/system').then((r) => r.json())
      .then((s) => setTz(s.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone)).catch(() => {});
  }, []);

  const effectiveSel = calSel.length === 0
    ? cals.filter((c) => c.primary).map((c) => c.id)
    : calSel;

  const toggleCal = (id: string) => {
    const next = effectiveSel.includes(id)
      ? effectiveSel.filter((x) => x !== id)
      : [...effectiveSel, id];
    setCalSel(next);
    fetch('/api/settings/gcal', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ calendarIds: next }),
    }).then(() => fetch('/api/mod/gcal/sync', { method: 'POST' }))
      .then(() => load())
      .catch(() => {});
  };

  const pickTz = (next: string) => {
    setTz(next);
    fetch('/api/settings/system', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tz: next }),
    }).then(() => location.reload()).catch(() => {});
  };

  const load = useCallback(() => {
    Promise.all([
      fetch('/api/mod/gcal/agenda').then((r) => r.json()),
      fetch('/api/mod/gcal/calendars').then((r) => r.json()),
    ]).then(([agenda, cals]) => {
      setItems(Array.isArray(agenda) ? agenda : []);
      if (Array.isArray(cals)) {
        setColors(Object.fromEntries((cals as Cal[]).map((c) => [c.id, c.color ?? FALLBACK])));
        setCals(cals as Cal[]);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const colorOf = (i: Item) => colors[i.payload?.calendarId ?? ''] ?? FALLBACK;

  const byDate = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const i of items) {
      if (!m.has(i.date)) m.set(i.date, []);
      m.get(i.date)!.push(i);
    }
    return m;
  }, [items]);

  const cells = useMemo(() => {
    const start = new Date(anchor);
    start.setDate(1 - start.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [anchor]);

  const dayEvents = byDate.get(selected) ?? [];
  const selDate = new Date(selected + 'T12:00:00');
  const selLabel = selDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const shiftMonth = (n: number) =>
    setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + n, 1));

  const shiftWeek = (n: number) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + n * 7); setWeekStart(d);
  };
  const weekCells = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d;
    }), [weekStart]);
  const [wkWidth, setWkWidth] = useState(1200);
  const wkRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    setWkWidth(el.clientWidth);
    new ResizeObserver(() => setWkWidth(el.clientWidth)).observe(el);
  }, []);
  const viewDays = wkWidth < 560 ? 3 : wkWidth < 940 ? 5 : 7;
  const wkCols = { gridTemplateColumns: `52px repeat(${viewDays}, 1fr)` } as const;
  const viewCells = useMemo(() => {
    if (viewDays === 7) return weekCells;
    const base = new Date(weekStart);
    const t = new Date();
    if (t >= weekCells[0] && t <= new Date(weekCells[6].getTime() + 864e5)) {
      base.setDate(t.getDate() + (t.getMonth() === base.getMonth() ? 0 : 0));
      base.setTime(t.getTime());
    }
    base.setHours(12, 0, 0, 0);
    return Array.from({ length: viewDays }, (_, i) => {
      const d = new Date(base); d.setDate(base.getDate() + i); return d;
    });
  }, [viewDays, weekCells, weekStart]);
  const shiftDays = (n: number) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + n * viewDays); setWeekStart(d);
  };
  const shift = view === 'month' ? shiftMonth : (viewDays === 7 ? shiftWeek : shiftDays);
  const titleDate = view === 'month' ? anchor : weekStart;

  // week time-grid helpers
  const HOUR_H = 64;
  const [nowMin, setNowMin] = useState(() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); });
  useEffect(() => {
    const i = setInterval(() => { const d = new Date(); setNowMin(d.getHours() * 60 + d.getMinutes()); }, 60_000);
    return () => clearInterval(i);
  }, []);
  const wkScroll = useCallback((el: HTMLDivElement | null) => {
    if (el) el.scrollTop = 7 * HOUR_H - 8; // land at ~7am
  }, []);
  const minutesOf = (iso: string) => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); };
  // google-style overlap handling: overlapping events share the column width
  const layoutDay = (evts: Item[]) => {
    const timed = evts.filter((e) => e.time && !e.payload?.allDay)
      .map((e) => {
        const start = minutesOf(e.time!);
        const end = e.endTime ? Math.max(minutesOf(e.endTime), start + 25) : start + 60;
        return { e, start, end, lane: 0, lanes: 1 };
      })
      .sort((a, b) => a.start - b.start || b.end - a.end);
    const laneEnds: number[] = [];
    let cluster: typeof timed = [];
    const closeCluster = () => {
      const lanes = Math.max(1, ...cluster.map((x) => x.lane + 1));
      for (const x of cluster) x.lanes = lanes;
      cluster = [];
      laneEnds.length = 0;
    };
    for (const item of timed) {
      if (cluster.length && item.start >= Math.max(...laneEnds)) closeCluster();
      let lane = laneEnds.findIndex((end) => end <= item.start);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
      laneEnds[lane] = item.end;
      item.lane = lane;
      cluster.push(item);
    }
    if (cluster.length) closeCluster();
    return timed;
  };
  const fmtHour = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`;

  return (
    <>
      <header className="page-header cal-header">
        <Link href="/" className="back-btn" aria-label="Back to dashboard"><BackIcon /></Link>
        <div className="cal-title">
          <h1>{titleDate.toLocaleDateString('en-US', { month: 'long' })}</h1>
          <span className="cal-year">{titleDate.getFullYear()}</span>
        </div>
        <div className="month-nav">
          <button onClick={() => shift(-1)} aria-label="Previous">‹</button>
          <button className="today-btn" onClick={() => {
            const d = new Date();
            setAnchor(new Date(d.getFullYear(), d.getMonth(), 1));
            const w = new Date(); w.setDate(w.getDate() - w.getDay()); w.setHours(12, 0, 0, 0);
            setWeekStart(w);
            setSelected(today);
          }}>Today</button>
          <button onClick={() => shift(1)} aria-label="Next">›</button>
        </div>
      </header>

      <div className="cal-controls">
        <div className="cal-seg">
          <button className={view === 'week' ? 'on' : ''} onClick={() => setView('week')}>Week</button>
          <button className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>Month</button>
        </div>
        <button className="btn small" onClick={() => setShowCals(!showCals)}>
          Calendars {showCals ? '▴' : '▾'}
        </button>
        {tz && (
          <div className="cal-seg" style={{ marginLeft: 'auto' }}>
            <select className="tz-select" value={tz} onChange={(e) => pickTz(e.target.value)} aria-label="Timezone">
              {TIMEZONES.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
        )}
      </div>
      {showCals && (
        <div className="card cal-pick-panel">
          {cals.map((c) => (
            <label className="cal-pick" key={c.id}>
              <input type="checkbox" checked={effectiveSel.includes(c.id)} onChange={() => toggleCal(c.id)} />
              <span className="cal-dot" style={{ background: c.color ?? 'var(--blue)' }} />
              <span className="n">{c.summary}</span>
            </label>
          ))}
        </div>
      )}

      <div className={`cal-wrap${chatOpen ? ' chat-open' : ''}`}>
      <CalChat open={chatOpen} onClose={() => setChatOpen(false)} onCalendarChanged={load} />
      <div className="cal-inner">
      <div className={`cal-body${view === 'week' ? ' wk-mode' : ''}`}>
      {view === 'week' ? (
      <div className="wk" ref={wkRef}>
        <div className="wk-head" style={wkCols}>
          <div className="wk-gutter-spacer" />
          {viewCells.map((d) => {
            const key = ymd(d);
            return (
              <button key={key} className={`wk-day${key === today ? ' today' : ''}${key === selected ? ' sel' : ''}`}
                onClick={() => setSelected(key)}>
                <span className="dow">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                <span className="num">{d.getDate()}</span>
              </button>
            );
          })}
        </div>
        <div className="wk-allday" style={wkCols}>
          <div className="wk-gutter-label">all-day</div>
          {viewCells.map((d) => {
            const key = ymd(d);
            const ad = (byDate.get(key) ?? []).filter((e) => e.payload?.allDay || !e.time);
            return (
              <div className="wk-adcell" key={key} onClick={() => setSelected(key)}>
                {ad.slice(0, 2).map((e) => (
                  <span className="wk-adchip" key={e.id} title={e.title}
                    style={{ background: `color-mix(in srgb, ${colorOf(e)} 24%, transparent)`, color: colorOf(e) }}>
                    {e.title}
                  </span>
                ))}
                {ad.length > 2 && <span className="evt-more">+{ad.length - 2}</span>}
              </div>
            );
          })}
        </div>
        <div className="wk-scroll" ref={wkScroll}>
          <div className="wk-body" style={{ ...wkCols, height: 24 * HOUR_H }}>
            <div className="wk-gutter">
              {Array.from({ length: 23 }, (_, i) => (
                <span key={i} style={{ top: (i + 1) * HOUR_H }}>{fmtHour(i + 1)}</span>
              ))}
            </div>
            {viewCells.map((d) => {
              const key = ymd(d);
              const placed = layoutDay(byDate.get(key) ?? []);
              return (
                <div className={`wk-col${key === today ? ' today' : ''}`} key={key} onClick={() => setSelected(key)}>
                  {placed.map(({ e, start, end, lane, lanes }) => (
                    <span className="wk-evt" key={e.id} title={`${fmtTime(e.time!)} ${e.title}`}
                      style={{
                        top: (start / 60) * HOUR_H + 1,
                        height: Math.max(26, ((end - start) / 60) * HOUR_H - 3),
                        left: `calc(${(lane / lanes) * 100}% + 2px)`,
                        width: `calc(${100 / lanes}% - 5px)`,
                        background: `color-mix(in srgb, ${colorOf(e)} 24%, var(--surface))`,
                        borderLeftColor: colorOf(e),
                      }}>
                      <b>{e.title}</b>
                      <i>{fmtTime(e.time!)}</i>
                    </span>
                  ))}
                  {key === today && (
                    <span className="wk-now" style={{ top: (nowMin / 60) * HOUR_H }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      ) : (
      <div className="month-grid" role="grid">
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
          <div className="month-dow" key={d}>{d}</div>
        ))}
        {cells.map((d) => {
          const key = ymd(d);
          const evts = byDate.get(key) ?? [];
          const inMonth = d.getMonth() === anchor.getMonth();
          return (
            <button
              key={key}
              className={
                'month-cell' + (inMonth ? '' : ' out') +
                (key === today ? ' today' : '') + (key === selected ? ' sel' : '')
              }
              onClick={() => setSelected(key)}
            >
              <span className="num">{d.getDate()}</span>
              {evts.slice(0, 3).map((e) => (
                <span
                  className="evt-bar" key={e.id}
                  style={{
                    background: `color-mix(in srgb, ${colorOf(e)} 26%, transparent)`,
                    color: colorOf(e),
                  }}
                >
                  {e.payload?.allDay || !e.time ? '' : fmtTime(e.time) + ' '}{e.title}
                </span>
              ))}
              {evts.length > 3 && <span className="evt-more">+{evts.length - 3} more</span>}
            </button>
          );
        })}
      </div>
      )}

      {view === 'month' && (
      <section className="section" style={{ marginTop: 18 }}>
        <div className="agenda-head">
          <span className={`agenda-daynum${selected === today ? ' is-today' : ''}`}>{selDate.getDate()}</span>
          <div>
            <div className="agenda-daylabel">{selected === today ? 'Today' : selLabel.split(',')[0]}</div>
            <div className="agenda-sub">
              {selLabel} · {dayEvents.length === 0 ? 'no events' : `${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}`}
            </div>
          </div>
        </div>
        <div className="agenda">
          {loading && <div className="tile-empty"><span className="spin" /></div>}
          {!loading && dayEvents.length === 0 && (
            <div className="tile-empty">Nothing scheduled — free day</div>
          )}
          {dayEvents.map((e) => (
            <a
              className="agenda-row" key={e.id}
              href={e.url ?? '#'} target="_blank" rel="noreferrer"
              style={{ borderLeftColor: colorOf(e) }}
            >
              <div className="agenda-when">
                {e.payload?.allDay || !e.time
                  ? <span className="allday">All day</span>
                  : <>
                    <span className="start">{fmtTime(e.time)}</span>
                    {e.endTime && <span className="end">{fmtTime(e.endTime)}</span>}
                  </>}
              </div>
              <div className="agenda-what">
                <div className="t">{e.title}</div>
                {e.subtitle && <div className="s">📍 {e.subtitle}</div>}
                {e.payload?.description && <div className="desc">{e.payload.description}</div>}
              </div>
            </a>
          ))}
        </div>
      </section>
      )}
      </div>

      <a className="btn" href="https://calendar.google.com" target="_blank" rel="noreferrer"
        style={{ width: '100%', marginBottom: 8 }}>
        Open Google Calendar
      </a>
      </div>
      </div>

      {!chatOpen && (
        <button className="calchat-tab" onClick={() => setChatOpen(true)} aria-label="Open calendar assistant">
          ✦<span>AI</span>
        </button>
      )}
    </>
  );
}
