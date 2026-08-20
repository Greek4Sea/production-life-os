import webpush from 'web-push';
import { eq } from 'drizzle-orm';
import { db, t } from "@/db";
import { getConfig } from "@/lib/config";

let configuredKey = "";
function ensureConfigured() {
  const c = getConfig().core;
  if (configuredKey !== c.vapidPublicKey) {
    webpush.setVapidDetails(c.vapidSubject, c.vapidPublicKey, c.vapidPrivateKey);
    configuredKey = c.vapidPublicKey;
  }
}

// Desktop shell sink: Electron has no push service, so it drains this queue
// (GET /api/cron/desktop-queue) and shows native notifications.
type Queued = { id: number; title: string; body?: string; url?: string; at: number };
const g = globalThis as unknown as { __lifeosDesktopQueue?: Queued[]; __lifeosDesktopSeq?: number };
export function drainDesktopQueue(): Queued[] {
  const q = g.__lifeosDesktopQueue ?? [];
  g.__lifeosDesktopQueue = [];
  return q;
}

// Send to every registered device; prune subscriptions the push service says are gone.
export async function pushToAll(payload: { title: string; body?: string; url?: string }) {
  (g.__lifeosDesktopQueue ??= []).push({ id: (g.__lifeosDesktopSeq = (g.__lifeosDesktopSeq ?? 0) + 1), ...payload, at: Date.now() });
  if (g.__lifeosDesktopQueue.length > 50) g.__lifeosDesktopQueue.splice(0, g.__lifeosDesktopQueue.length - 50);
  if (!getConfig().core.vapidPublicKey) return 0;
  ensureConfigured();
  const subs = await db().select().from(t.pushSubscriptions);
  const results = await Promise.allSettled(subs.map((s) =>
    webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      JSON.stringify(payload),
    ).catch(async (err) => {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await db().delete(t.pushSubscriptions).where(eq(t.pushSubscriptions.id, s.id));
      }
      throw err;
    }),
  ));
  return results.filter((r) => r.status === 'fulfilled').length;
}
