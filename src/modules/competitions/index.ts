import { randomUUID } from 'crypto';
import { db, t } from '@/db';
import { emit } from '@/lib/events';
import { localDate, TZ } from '@/lib/dates';
import { fetchAskfred, fetchUsafRegional, setHomeStates } from './sources';
import { getConfig } from '@/lib/config';
import type { ModuleManifest } from '../types';

async function sync() {
  setHomeStates(getConfig().fencing.homeStates);
  const deadline = Date.now() + 25_000; // stay well inside the serverless limit
  const results = await Promise.allSettled([
    fetchUsafRegional(),
    fetchAskfred(deadline),
  ]);
  const comps = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  const errors = results.filter((r) => r.status === 'rejected')
    .map((r) => String((r as PromiseRejectedResult).reason));
  if (!comps.length && errors.length) throw new Error(errors.join(' | '));

  let added = 0;
  for (const c of comps) {
    const existing = await db().query.compEvents.findFirst({
      where: (e, { eq }) => eq(e.uid, c.uid),
    });
    await db().insert(t.compEvents)
      .values({
        uid: c.uid, name: c.name, kind: c.kind, ageCategory: c.ageCategory,
        city: c.city || null, state: c.state || null,
        startDate: c.startDate, endDate: c.endDate,
        regCloses: c.regCloses, url: c.url, source: c.source,
        lastSeen: new Date(),
      })
      .onConflictDoUpdate({
        target: t.compEvents.uid,
        set: {
          name: c.name,
          startDate: c.startDate, endDate: c.endDate,
          // never wipe a stored value with null (same rule as the Python tracker)
          ...(c.city ? { city: c.city } : {}),
          ...(c.regCloses ? { regCloses: c.regCloses } : {}),
          lastSeen: new Date(),
        },
      });

    if (!existing) {
      added++;
      if (c.startDate >= localDate()) {
        await db().insert(t.notifications).values({
          id: randomUUID(), moduleId: 'competitions',
          title: `🤺 New competition: ${c.name}`,
          body: `${c.kind} ${c.ageCategory ?? ''} · ${c.city}, ${c.state} · ${c.startDate}`,
          url: '/m/competitions',
          scheduledFor: new Date(),
          dedupeKey: `comp:new:${c.uid}`,
        }).onConflictDoNothing();
      }
    }
    // Registration-close reminder a week out.
    if (c.regCloses && c.regCloses > new Date()) {
      const remindAt = new Date(c.regCloses.getTime() - 7 * 24 * 3600e3);
      if (remindAt > new Date()) {
        await db().insert(t.notifications).values({
          id: randomUUID(), moduleId: 'competitions',
          title: `🤺 Registration closes soon: ${c.name}`,
          body: `Closes ${c.regCloses.toLocaleDateString('en-US', { timeZone: TZ, month: 'short', day: 'numeric' })} — sign up if you're going`,
          url: c.url, scheduledFor: remindAt,
          dedupeKey: `comp:${c.uid}:regclose`,
        }).onConflictDoNothing();
      }
    }
  }
  await emit('competitions', 'competitions.synced', { total: comps.length, added, errors });
}

async function api(req: Request, path: string[]): Promise<Response | null> {
  if (req.method === 'GET' && path[0] === 'events') {
    const rows = await db().query.compEvents.findMany({
      orderBy: (e, { asc }) => [asc(e.startDate)],
    });
    return Response.json(rows);
  }
  if (req.method === 'POST' && path[0] === 'sync') {
    await sync();
    return Response.json({ ok: true });
  }
  return null;
}

async function dashboardData() {
  const today = localDate();
  const [upcoming, epee, lastResult] = await Promise.all([
    db().query.compEvents.findMany({
      where: (e, { gte }) => gte(e.endDate, today),
      orderBy: (e, { asc }) => [asc(e.startDate)],
    }),
    db().query.fencingRatings.findFirst(),
    db().query.fencingResults.findFirst({
      orderBy: (r, { desc }) => [desc(r.date)],
    }),
  ]);
  return {
    count: upcoming.length,
    next: upcoming.slice(0, 3),
    rating: epee?.rating ?? null,
    lastResult: lastResult
      ? {
          tournament: lastResult.tournament,
          place: lastResult.place,
          fieldSize: lastResult.fieldSize,
          date: lastResult.date,
        }
      : null,
  };
}

export const competitions: ModuleManifest = {
  enabled: () => getConfig().fencing.enabled,
  id: 'competitions',
  name: 'Competitions',
  tileSize: 'sm',
  syncEveryMin: 720, // twice a day is plenty
  sync,
  api,
  dashboardData,
};
