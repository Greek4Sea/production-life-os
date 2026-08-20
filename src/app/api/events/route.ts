import { gt, asc } from 'drizzle-orm';
import { requireAuth } from '@/lib/requireAuth';
import { db, t } from '@/db';

// Poll bus for the future personal-ai-v2: GET /api/events?since=<id>
export async function GET(req: Request) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  const since = Number(new URL(req.url).searchParams.get('since') ?? 0);
  const rows = await db().select().from(t.events)
    .where(gt(t.events.id, since))
    .orderBy(asc(t.events.id))
    .limit(200);
  return Response.json({ events: rows, latest: rows.at(-1)?.id ?? since });
}
