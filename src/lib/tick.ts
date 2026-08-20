import { randomUUID } from 'crypto';
import { and, eq, lte } from 'drizzle-orm';
import { MODULES } from '@/modules/registry';
import { db, t } from '@/db';
import { pushToAll } from '@/lib/push';
import { textTaskReminder } from '@/lib/imessage';

// A sync failure that smells like expired/revoked credentials becomes an
// in-app notification (deduped per module per day) so re-login never goes
// unnoticed. Non-auth errors (wake-from-sleep "fetch failed", flaky Wi-Fi,
// one-off API hiccups) self-heal on the next tick — those only alert once
// the module hasn't succeeded for a sustained stretch.
const SUSTAINED_FAILURE_MS = 60 * 60_000;

async function notifyAuthProblem(moduleId: string, name: string, msg: string, lastOkAt: Date | null) {
  const isAuth = /401|403|token|auth|not connected|invalid_grant|sign in/i.test(msg);
  if (!isAuth && lastOkAt && Date.now() - lastOkAt.getTime() < SUSTAINED_FAILURE_MS) return;
  await db().insert(t.notifications).values({
    id: randomUUID(),
    moduleId,
    title: isAuth ? `⚠️ ${name} needs a re-login` : `⚠️ ${name} sync is failing`,
    body: `${msg.slice(0, 140)}${isAuth ? ' — open Settings to reconnect.' : ''}`,
    url: '/settings',
    scheduledFor: new Date(),
    dedupeKey: `err:${moduleId}:${new Date().toISOString().slice(0, 10)}`,
  }).onConflictDoNothing();
}

// Run module syncs. force=true ignores per-module intervals.
export async function runSyncs(force = false) {
  // Keep the server-side timezone in step with the Settings toggle.
  try {
    const { getSettings } = await import('@/lib/settings');
    const { setTZ } = await import('@/lib/dates');
    const sys = await getSettings<{ tz?: string }>('system');
    if (sys.tz) setTZ(sys.tz);
  } catch { /* default TZ stands */ }
  const report: Record<string, string> = {};
  const now = new Date();
  for (const m of MODULES) {
    if (!m.sync) continue;
    if (m.enabled && !m.enabled()) { report[m.id] = 'disabled'; continue; }
    const state = await db().query.syncState.findFirst({ where: eq(t.syncState.moduleId, m.id) });
    const everyMs = (m.syncEveryMin ?? 30) * 60_000;
    if (!force && state?.lastOkAt && now.getTime() - state.lastOkAt.getTime() < everyMs) {
      report[m.id] = 'fresh';
      continue;
    }
    try {
      await m.sync();
      await db().insert(t.syncState)
        .values({ moduleId: m.id, lastRunAt: now, lastOkAt: now, lastError: null })
        .onConflictDoUpdate({
          target: t.syncState.moduleId,
          set: { lastRunAt: now, lastOkAt: now, lastError: null },
        });
      report[m.id] = 'ok';
    } catch (e) {
      const msg = String(e).slice(0, 500);
      await db().insert(t.syncState)
        .values({ moduleId: m.id, lastRunAt: now, lastError: msg })
        .onConflictDoUpdate({
          target: t.syncState.moduleId,
          set: { lastRunAt: now, lastError: msg },
        });
      report[m.id] = `error: ${msg}`;
      await notifyAuthProblem(m.id, m.name, msg, state?.lastOkAt ?? null).catch(() => {});
    }
  }
  return report;
}

export async function sendDueNotifications() {
  const now = new Date();
  const due = await db().select().from(t.notifications)
    .where(and(eq(t.notifications.status, 'scheduled'), lte(t.notifications.scheduledFor, now)));
  for (const n of due) {
    try {
      await pushToAll({ title: n.title, body: n.body ?? undefined, url: n.url ?? undefined });
      if (n.moduleId === 'tasks') await textTaskReminder(n.title, n.body);
      await db().update(t.notifications)
        .set({ status: 'sent', sentAt: new Date() })
        .where(eq(t.notifications.id, n.id));
    } catch {
      await db().update(t.notifications)
        .set({ status: 'failed' })
        .where(eq(t.notifications.id, n.id));
    }
  }
  return due.length;
}
