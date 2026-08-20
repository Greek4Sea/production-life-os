import { and, desc, isNull, lte } from 'drizzle-orm';
import { db, t } from '@/db';
import { requireAuth } from '@/lib/requireAuth';

// The in-app bell: recent notifications (latest per module + counts).
export async function GET(req: Request) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  const rows = await db().select().from(t.notifications)
    .where(lte(t.notifications.scheduledFor, new Date()))
    .orderBy(desc(t.notifications.scheduledFor))
    .limit(120);
  // one visible notification per app (the latest), plus its unread count
  const byModule = new Map<string, { latest: typeof rows[number]; unread: number; total: number }>();
  for (const n of rows) {
    const cur = byModule.get(n.moduleId);
    const unread = n.readAt ? 0 : 1;
    if (!cur) byModule.set(n.moduleId, { latest: n, unread, total: 1 });
    else { cur.unread += unread; cur.total += 1; }
  }
  const apps = [...byModule.entries()].map(([moduleId, v]) => ({
    moduleId,
    title: v.latest.title,
    body: v.latest.body,
    url: v.latest.url,
    at: v.latest.scheduledFor,
    unread: v.unread,
    total: v.total,
  })).filter((a) => a.unread > 0) // read notifications disappear from the bell
    .sort((a, b) => b.unread - a.unread || String(b.at).localeCompare(String(a.at)));
  const unreadApps = apps.length;
  return Response.json({ apps: apps.slice(0, 12), unreadApps });
}

// Mark everything read.
export async function PATCH(req: Request) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  await db().update(t.notifications)
    .set({ readAt: new Date() })
    .where(and(isNull(t.notifications.readAt), lte(t.notifications.scheduledFor, new Date())));
  return Response.json({ ok: true });
}
