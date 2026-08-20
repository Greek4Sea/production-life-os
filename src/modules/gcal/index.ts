import { randomUUID } from 'crypto';
import type Anthropic from "@anthropic-ai/sdk";
import { anthropicClient } from "@/lib/llm";
import { getConfig } from '@/lib/config';
import { eq } from 'drizzle-orm';
import { db, t } from '@/db';
import { gfetch, googleAccessToken } from '@/lib/google';
import { getSettings } from '@/lib/settings';
import { emit } from '@/lib/events';
import { localDate, TZ } from '@/lib/dates';
import type { ModuleManifest } from '../types';

const CAL = 'https://www.googleapis.com/calendar/v3';

type GEvent = {
  id: string; summary?: string; location?: string; htmlLink?: string; description?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
  status?: string;
};

async function refreshCalendarList() {
  const data = await gfetch(`${CAL}/users/me/calendarList?minAccessRole=reader`);
  for (const c of data.items ?? []) {
    await db().insert(t.gcalCalendars)
      .values({ id: c.id, summary: c.summary, color: c.backgroundColor ?? null, primary: !!c.primary, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: t.gcalCalendars.id,
        set: { summary: c.summary, color: c.backgroundColor ?? null, primary: !!c.primary, updatedAt: new Date() },
      });
  }
  return (data.items ?? []) as { id: string; primary?: boolean }[];
}

async function sync() {
  const settings = await getSettings<{ calendarIds: string[] }>('gcal');
  const list = await refreshCalendarList();
  let calendarIds = settings.calendarIds;
  if (!calendarIds?.length) {
    calendarIds = list.filter((c) => c.primary).map((c) => c.id);
  }

  // Wide window so the month view has data: 2 weeks back, 6 weeks forward.
  const timeMin = new Date(Date.now() - 14 * 24 * 3600e3).toISOString();
  const timeMax = new Date(Date.now() + 42 * 24 * 3600e3).toISOString();
  const rows: (typeof t.dayItems.$inferInsert)[] = [];

  for (const calId of calendarIds) {
    const data = await gfetch(
      `${CAL}/calendars/${encodeURIComponent(calId)}/events?` + new URLSearchParams({
        timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250',
      }),
    );
    for (const ev of (data.items ?? []) as GEvent[]) {
      if (ev.status === 'cancelled') continue;
      const allDay = !!ev.start.date;
      const start = allDay ? null : new Date(ev.start.dateTime!);
      const end = allDay ? null : new Date(ev.end.dateTime!);
      rows.push({
        id: randomUUID(),
        date: allDay ? ev.start.date! : localDate(start!),
        moduleId: 'gcal',
        kind: 'event',
        time: start,
        endTime: end,
        title: ev.summary ?? '(no title)',
        subtitle: ev.location ?? null,
        url: ev.htmlLink ?? null,
        payload: {
          calendarId: calId,
          allDay,
          description: ev.description?.replace(/<[^>]+>/g, '').slice(0, 500) || undefined,
        },
        externalId: `${calId}:${ev.id}`,
      });
    }
  }

  // Replace-then-insert: the 8-day window is fully re-fetched each sync.
  await db().transaction(async (tx) => {
    await tx.delete(t.dayItems).where(eq(t.dayItems.moduleId, 'gcal'));
    if (rows.length) await tx.insert(t.dayItems).values(rows);
  });
  await emit('gcal', 'gcal.synced', { count: rows.length });
}

// Used by the Gmail module ("add to calendar") and exposed as an API endpoint.
export async function addEvent(input: { title: string; start: string; end?: string; description?: string }) {
  const startDate = new Date(input.start);
  const endDate = input.end ? new Date(input.end) : new Date(startDate.getTime() + 3600e3);
  const created = await gfetch(`${CAL}/calendars/primary/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      summary: input.title,
      description: input.description,
      start: { dateTime: startDate.toISOString() },
      end: { dateTime: endDate.toISOString() },
    }),
  });
  await emit('gcal', 'gcal.event_added', { id: created.id, title: input.title });
  return created;
}

// ---------- calendar chat agent ----------

const CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'list_events',
    description: 'List the user\'s calendar events between two dates (inclusive). Use this to check the schedule before adding or removing anything.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'start date YYYY-MM-DD' },
        to: { type: 'string', description: 'end date YYYY-MM-DD' },
      },
      required: ['from', 'to'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_event',
    description: 'Create an event on the user\'s primary Google Calendar.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        start: { type: 'string', description: 'ISO datetime with offset, e.g. 2026-08-18T17:00:00-07:00' },
        end: { type: 'string', description: 'ISO datetime; defaults to 1h after start' },
        description: { type: 'string' },
      },
      required: ['title', 'start'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_event',
    description: 'Delete an event. Pass the external_id exactly as returned by list_events. Only delete when the user clearly asked to.',
    input_schema: {
      type: 'object',
      properties: { external_id: { type: 'string' } },
      required: ['external_id'],
      additionalProperties: false,
    },
  },
];

async function runChatTool(name: string, input: Record<string, string>): Promise<{ result: string; mutated: boolean }> {
  if (name === 'list_events') {
    const rows = await db().query.dayItems.findMany({
      where: (d, { and, gte, lte, eq: eqOp }) =>
        and(eqOp(d.moduleId, 'gcal'), gte(d.date, input.from), lte(d.date, input.to)),
      orderBy: (d, { asc }) => [asc(d.date), asc(d.time)],
      limit: 60,
    });
    return {
      result: JSON.stringify(rows.map((r) => ({
        external_id: r.externalId, date: r.date,
        start: r.time, end: r.endTime, title: r.title,
        location: r.subtitle ?? undefined,
      }))),
      mutated: false,
    };
  }
  if (name === 'create_event') {
    const created = await addEvent({
      title: input.title, start: input.start, end: input.end, description: input.description,
    });
    return { result: `Created "${input.title}" (id ${created.id})`, mutated: true };
  }
  if (name === 'delete_event') {
    const idx = input.external_id.indexOf(':');
    const calId = input.external_id.slice(0, idx);
    const eventId = input.external_id.slice(idx + 1);
    const token = await googleAccessToken();
    const res = await fetch(
      `${CAL}/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}`,
      { method: 'DELETE', headers: { authorization: `Bearer ${token}` } },
    );
    if (!res.ok && res.status !== 410) return { result: `Delete failed: ${res.status}`, mutated: false };
    await emit('gcal', 'gcal.event_deleted', { externalId: input.external_id });
    return { result: 'Deleted.', mutated: true };
  }
  return { result: `Unknown tool ${name}`, mutated: false };
}

async function chat(history: { role: 'user' | 'assistant'; content: string }[]) {
  const anthropic = anthropicClient();
  const now = new Date();
  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));
  let mutated = false;

  for (let i = 0; i < 6; i++) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1200,
      system:
        `You are the calendar assistant inside the user's personal dashboard, connected to their ` +
        `Google Calendar. Today is ${now.toLocaleDateString('en-US', { timeZone: TZ, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} ` +
        `and the time is ${now.toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })} in ${TZ} — use that timezone offset ` +
        `(${TZ}) in all ISO datetimes.${getConfig().core.aboutMe ? ` About the user: ${getConfig().core.aboutMe}.` : ''} ` +
        `Be brief and friendly. Check the schedule with list_events before creating or deleting. ` +
        `When the request is clear enough, just do it — don't ask for confirmation on simple adds.`,
      tools: CHAT_TOOLS,
      messages,
    });

    if (response.stop_reason !== 'tool_use') {
      const text = response.content.find((b) => b.type === 'text');
      return { reply: text?.type === 'text' ? text.text : 'Done.', mutated };
    }

    messages.push({ role: 'assistant', content: response.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        try {
          const r = await runChatTool(block.name, block.input as Record<string, string>);
          if (r.mutated) mutated = true;
          results.push({ type: 'tool_result', tool_use_id: block.id, content: r.result });
        } catch (e) {
          results.push({ type: 'tool_result', tool_use_id: block.id, content: String(e), is_error: true });
        }
      }
    }
    messages.push({ role: 'user', content: results });
  }
  return { reply: 'I got stuck — try rephrasing that.', mutated };
}

async function api(req: Request, path: string[]): Promise<Response | null> {
  if (req.method === 'POST' && path[0] === 'chat') {
    const body = await req.json();
    const out = await chat(body.messages ?? []);
    if (out.mutated) {
      try { await sync(); } catch { /* agenda refresh best-effort */ }
    }
    return Response.json(out);
  }
  // Live Google query for ANY date window (beyond the synced 6-week cache).
  // GET /api/mod/gcal/range?from=YYYY-MM-DD&to=YYYY-MM-DD
  if (req.method === 'GET' && path[0] === 'range') {
    const q = new URL(req.url).searchParams;
    const from = q.get('from'), to = q.get('to') ?? q.get('from');
    if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to!)) {
      return Response.json({ error: 'from/to must be YYYY-MM-DD' }, { status: 400 });
    }
    const settings = await getSettings<{ calendarIds: string[] }>('gcal');
    let calendarIds = settings.calendarIds;
    if (!calendarIds?.length) {
      const cals = await db().select().from(t.gcalCalendars);
      calendarIds = cals.filter((c) => c.primary).map((c) => c.id);
    }
    const timeMin = new Date(`${from}T00:00:00`).toISOString(); // server runs in the user's tz
    const timeMax = new Date(`${to}T23:59:59`).toISOString();
    const events = [];
    for (const calId of calendarIds) {
      const data = await gfetch(
        `${CAL}/calendars/${encodeURIComponent(calId)}/events?` + new URLSearchParams({
          timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '100',
        }),
      );
      for (const ev of (data.items ?? []) as GEvent[]) {
        if (ev.status === 'cancelled') continue;
        events.push({
          calendarId: calId,
          title: ev.summary ?? '(no title)',
          start: ev.start.dateTime ?? ev.start.date,
          end: ev.end.dateTime ?? ev.end.date,
          allDay: !!ev.start.date,
          location: ev.location ?? null,
        });
      }
    }
    events.sort((a, b) => String(a.start).localeCompare(String(b.start)));
    return Response.json(events);
  }

  if (req.method === 'GET' && path[0] === 'agenda') {
    const items = await db().query.dayItems.findMany({
      where: (d, { eq: eqOp }) => eqOp(d.moduleId, 'gcal'),
      orderBy: (d, { asc }) => [asc(d.date), asc(d.time)],
    });
    return Response.json(items);
  }
  if (req.method === 'GET' && path[0] === 'calendars') {
    const cals = await db().select().from(t.gcalCalendars);
    return Response.json(cals);
  }
  if (req.method === 'POST' && path[0] === 'events') {
    const body = await req.json();
    if (!body.title || !body.start) return Response.json({ error: 'title and start required' }, { status: 400 });
    return Response.json(await addEvent(body));
  }
  if (req.method === 'POST' && path[0] === 'sync') {
    await sync();
    return Response.json({ ok: true });
  }
  return null;
}

async function dashboardData() {
  const today = localDate();
  const [items, cals] = await Promise.all([
    db().query.dayItems.findMany({
      where: (d, { and, gte, eq: eqOp }) => and(eqOp(d.moduleId, 'gcal'), gte(d.date, today)),
      orderBy: (d, { asc }) => [asc(d.date), asc(d.time)],
      limit: 12,
    }),
    db().select().from(t.gcalCalendars),
  ]);
  const colorOf = Object.fromEntries(cals.map((c) => [c.id, c.color]));
  return {
    today,
    items: items.map((i) => ({
      ...i,
      color: colorOf[(i.payload as { calendarId?: string } | null)?.calendarId ?? ''] ?? null,
    })),
  };
}

export const gcal: ModuleManifest = {
  enabled: () => Boolean(getConfig().core.allowedEmail),
  id: 'gcal',
  name: 'Calendar',
  tileSize: 'wide',
  syncEveryMin: 5,
  sync,
  api,
  dashboardData,
  defaultSettings: { calendarIds: [] }, // empty = primary calendar
};
