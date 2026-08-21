import { randomUUID } from 'crypto';
import { TZ } from '@/lib/dates';
import { eq } from 'drizzle-orm';
import { db, t } from '@/db';
import type { ModuleManifest } from '../types';

// Google-Tasks-style todos: simple, scheduled, or repeating (every N days).
// Due tasks get a push notification at their due time; completing a
// repeating task rolls it forward to its next occurrence.

async function scheduleReminder(id: string, title: string, due: Date) {
  if (due <= new Date()) return;
  await db().insert(t.notifications).values({
    id: randomUUID(), moduleId: 'tasks',
    title: `☑️ ${title}`,
    body: 'Task is due now',
    url: '/m/tasks',
    scheduledFor: due,
    dedupeKey: `task:${id}:${due.toISOString()}`,
  }).onConflictDoNothing();
}

import { chatJson } from '@/lib/llm';

// Time's up and still not done → keep nudging: a reminder every NAG_EVERY_MIN
// for NAG_HOURS after the due time (push + text), until the task is ticked off.
const NAG_EVERY_MIN = 30;
const NAG_HOURS = 4;
async function nagOverdue() {
  const now = Date.now();
  const open = await db().query.tasks.findMany({ where: (x, { eq: eqOp }) => eqOp(x.done, false) });
  for (const task of open) {
    if (!task.due || task.allDay) continue;
    const late = now - task.due.getTime();
    if (late <= 0 || late > NAG_HOURS * 3_600_000) continue;
    const slot = Math.floor(late / (NAG_EVERY_MIN * 60_000));
    if (slot < 1) continue; // the due-time reminder itself already fired
    const mins = slot * NAG_EVERY_MIN;
    await db().insert(t.notifications).values({
      id: randomUUID(), moduleId: 'tasks',
      title: `⏰ Time's up: ${task.title}`,
      body: mins >= 60 ? `Due ${Math.round(mins / 60 * 10) / 10}h ago — still not done` : `Due ${mins} min ago — still not done`,
      url: '/m/tasks',
      scheduledFor: new Date(),
      dedupeKey: `task:${task.id}:nag:${task.due.toISOString()}:${slot}`,
    }).onConflictDoNothing();
  }
}


// A Date for a wall-clock time in the app timezone (DST-safe).
function zoned(dateStr: string, hh: number, mm = 0): Date {
  const guess = new Date(`${dateStr}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`);
  const inTz = new Date(guess.toLocaleString('en-US', { timeZone: TZ }));
  const inUtc = new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(guess.getTime() + (inUtc.getTime() - inTz.getTime()));
}
const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });

type Op = {
  op?: 'create' | 'complete' | 'delete';
  title?: string; due?: string | null; allDay?: boolean; repeatDays?: number | null;
  id?: string;
};

// Freeform text → operations (create/complete/delete), via a local model.
// The model SEES the current open tasks so it can complete/delete by id.
async function planOps(text: string, openTasks: { id: string; title: string; due: Date | null }[]) {
  const nowStr = new Date().toLocaleString('en-US', {
    timeZone: TZ, dateStyle: 'full', timeStyle: 'short',
  });
  const list = openTasks.slice(0, 40)
    .map((t) => `${t.id.slice(0, 8)} | ${t.title}${t.due ? ` | due ${t.due.toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}`)
    .join('\n') || '(none)';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = await chatJson<any>({
    slot: 'tasksModel',
    user: text,
    system: `You manage a task list. Now: ${nowStr} (timezone: ${TZ}).

CURRENT OPEN TASKS (id | title | due):
${list}

Reply with ONLY this JSON shape:
{"ops":[{"op":"create","title":"...","due":"ISO-8601 with the UTC offset of ${TZ} or null","allDay":false,"repeatDays":null}, {"op":"complete","id":"8-char id from the list"}, {"op":"delete","id":"..."}]}

Rules:
- BE LIBERAL: any mention of something to do — even one word like "eat" or "chicken pick up" — becomes a create op ("Eat", "Pick up chicken"). When in doubt, CREATE. Only questions/smalltalk produce no ops.
- "due" rules — NEVER invent a date or time:
  · user gave an explicit date/time ("tomorrow", "friday 5pm", "tonight 8") → resolve it against Now into ISO; a time without a day means today at that time.
  · user said "someday"/"at some point"/"no rush" → "due":"someday".
  · otherwise ("eat", "clean desk" — no date, no time) → "due":null. Do NOT guess a time.
- repeatDays ONLY when the user explicitly says every/each/daily/weekly/monthly: "every day"→1, "every <weekday>"/"weekly"→7, "every 2 weeks"→14, "monthly"→30. A plain weekday mention ("gym friday") is a ONE-OFF, repeatDays null. Repeating tasks need a due for the first occurrence ("night time" ≈ 21:30, "morning" ≈ 08:00).
- "done/finished X", "i did X" → "complete" op with the matching id from the list.
- "remove/delete/cancel X" → "delete" op with the matching id.
- Titles short and imperative.

Example: "gym every tuesday at 7pm and i finished the essay" →
{"ops":[{"op":"create","title":"Gym","due":"<next tuesday 19:00 ISO>","allDay":false,"repeatDays":7},{"op":"complete","id":"<essay task id>"}]}`,
  });
  // tolerate shape drift: bare array, {tasks:[...]}, single op object
  const ops: Op[] = Array.isArray(parsed) ? parsed
    : Array.isArray(parsed.ops) ? parsed.ops
    : Array.isArray(parsed.tasks) ? parsed.tasks.map((t: Op) => ({ op: 'create', ...t }))
    : parsed.op ? [parsed] : [];
  return ops;
}

async function api(req: Request, p: string[]): Promise<Response | null> {
  // AI chat with full control: create / complete / delete. The confirmation
  // is built from what ACTUALLY happened in the DB — never from model claims.
  if (req.method === 'POST' && p[0] === 'chat') {
    const { text } = await req.json();
    if (!text?.trim()) return Response.json({ error: 'empty' }, { status: 400 });
    const open = await db().query.tasks.findMany({
      where: (x, { eq: eqOp }) => eqOp(x.done, false),
      orderBy: (x, { asc }) => [asc(x.due)],
    });
    let ops: Op[];
    try {
      ops = await planOps(text, open);
    } catch (e) {
      const { notify } = await import('@/lib/notify');
      await notify({
        moduleId: 'tasks',
        title: '🤖 Tasks AI is not responding',
        body: String(e).slice(0, 140),
      }).catch(() => {});
      return Response.json({ reply: `The local AI isn’t responding (${String(e).slice(0, 80)})`, changed: false });
    }
    const lines: string[] = [];
    const fmtDue = (d: Date | null, allDay: boolean) => !d ? '' :
      ` — ${d.toLocaleString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', ...(allDay ? {} : { hour: 'numeric', minute: '2-digit' }) })}`;
    const findTask = (id?: string) =>
      id ? open.find((x) => x.id === id || x.id.startsWith(id)) : undefined;

    for (const o of ops) {
      try {
        if (o.op === 'create' || (!o.op && o.title)) {
          if (!o.title?.trim()) continue;
          // Server-enforced defaults: nothing specified → TODAY all-day (no
          // invented time); explicit "someday" → dateless; else what was said.
          let validDue: Date | null = null;
          let allDay = !!o.allDay;
          if (o.due === 'someday') {
            validDue = null;
          } else if (o.due) {
            const d = new Date(o.due);
            if (isNaN(d.getTime())) { lines.push(`⚠️ "${o.title}" — bad date, put it on today instead`); }
            validDue = isNaN(d.getTime()) ? null : d;
          }
          if (!validDue && o.due !== 'someday') {
            // day tasks are due at 11pm in the app timezone
            validDue = zoned(todayStr(), 23, 0);
            allDay = true;
          }
          const id = randomUUID();
          await db().insert(t.tasks).values({
            id, title: o.title.trim(), due: validDue, allDay,
            repeatDays: o.repeatDays ? Math.max(1, Math.round(o.repeatDays)) : null,
          });
          if (validDue) await scheduleReminder(id, o.title.trim(), validDue);
          lines.push(`✓ added "${o.title.trim()}"${o.due === 'someday' ? ' — someday' : fmtDue(validDue, allDay)}${o.repeatDays ? ` ↻${o.repeatDays}d` : ''}`);
        } else if (o.op === 'complete') {
          const task = findTask(o.id);
          if (!task) { lines.push(`✗ couldn't find the task to complete`); continue; }
          await db().update(t.tasks).set({ done: true, doneAt: new Date() }).where(eq(t.tasks.id, task.id));
          lines.push(`✓ done "${task.title}"`);
        } else if (o.op === 'delete') {
          const task = findTask(o.id);
          if (!task) { lines.push(`✗ couldn't find the task to delete`); continue; }
          await db().delete(t.tasks).where(eq(t.tasks.id, task.id));
          lines.push(`✓ deleted "${task.title}"`);
        }
      } catch (e) {
        lines.push(`✗ ${o.op ?? 'op'} failed: ${String(e).slice(0, 80)}`);
      }
    }
    return Response.json({
      reply: lines.length ? lines.join('\n') : 'I didn’t find anything actionable in that.',
      changed: lines.some((l) => l.startsWith('✓')),
    });
  }

  if (req.method === 'GET' && p[0] === 'list') {
    const rows = await db().query.tasks.findMany({
      orderBy: (x, { asc, desc }) => [asc(x.done), asc(x.due), desc(x.createdAt)],
    });
    return Response.json(rows);
  }

  if (req.method === 'POST' && p[0] === 'add') {
    const { title, due, allDay, repeatDays } = await req.json();
    if (!title?.trim()) return Response.json({ error: 'title required' }, { status: 400 });
    const id = randomUUID();
    let dueDate = due ? new Date(due) : null;
    if (dueDate && allDay) {
      // all-day: due 11pm app-tz on that date
      dueDate = zoned(dueDate.toLocaleDateString('en-CA', { timeZone: TZ }), 23, 0);
    }
    if (!dueDate) { dueDate = zoned(todayStr(), 23, 0); }
    await db().insert(t.tasks).values({
      id, title: title.trim(),
      due: dueDate, allDay: !!allDay || !due,
      repeatDays: repeatDays ? Math.max(1, Math.round(repeatDays)) : null,
    });
    if (dueDate) await scheduleReminder(id, title.trim(), dueDate);
    return Response.json({ ok: true, id });
  }

  if (req.method === 'POST' && p[0] === 'toggle') {
    const { id } = await req.json();
    const task = await db().query.tasks.findFirst({ where: eq(t.tasks.id, id) });
    if (!task) return Response.json({ error: 'not found' }, { status: 404 });
    if (!task.done && task.repeatDays && task.due) {
      // Completing a repeating task: leave a checked "done today" copy for
      // the satisfaction (visible until the day rolls over), and roll the
      // repeating task to its next occurrence.
      const next = new Date(task.due.getTime() + task.repeatDays * 86400e3);
      await db().update(t.tasks).set({ due: next }).where(eq(t.tasks.id, id));
      await db().insert(t.tasks).values({
        id: randomUUID(), title: task.title, due: task.due, allDay: task.allDay,
        repeatDays: null, done: true, doneAt: new Date(),
      });
      if (!task.allDay) await scheduleReminder(id, task.title, next);
      return Response.json({ ok: true, rolledTo: next.toISOString() });
    }
    await db().update(t.tasks)
      .set({ done: !task.done, doneAt: task.done ? null : new Date() })
      .where(eq(t.tasks.id, id));
    return Response.json({ ok: true });
  }

  if (req.method === 'DELETE' && p[0] === 'task' && p[1]) {
    await db().delete(t.tasks).where(eq(t.tasks.id, p[1]));
    return Response.json({ ok: true });
  }

  return null;
}

async function dashboardData() {
  const rows = await db().query.tasks.findMany({
    where: (x, { eq: eqOp }) => eqOp(x.done, false),
    orderBy: (x, { asc, desc }) => [asc(x.due), desc(x.createdAt)],
  });
  // due-dated first (soonest), then undated by recency
  const dated = rows.filter((r) => r.due);
  const undated = rows.filter((r) => !r.due);
  return {
    open: rows.length,
    next: [...dated, ...undated].slice(0, 3).map((r) => ({
      id: r.id, title: r.title, due: r.due, allDay: r.allDay, repeatDays: r.repeatDays,
    })),
  };
}

export const tasksModule: ModuleManifest = {
  id: 'tasks',
  name: 'Tasks',
  tileSize: 'sm',
  syncEveryMin: 5,
  sync: nagOverdue,
  api,
  dashboardData,
};
