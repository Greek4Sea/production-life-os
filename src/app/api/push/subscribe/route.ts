import { randomUUID } from 'crypto';
import { requireAuth } from '@/lib/requireAuth';
import { db, t } from '@/db';

export async function POST(req: Request) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  const sub = await req.json();
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return Response.json({ error: 'invalid subscription' }, { status: 400 });
  }
  await db().insert(t.pushSubscriptions)
    .values({
      id: randomUUID(),
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent: req.headers.get('user-agent'),
    })
    .onConflictDoUpdate({
      target: t.pushSubscriptions.endpoint,
      set: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
  return Response.json({ ok: true });
}
