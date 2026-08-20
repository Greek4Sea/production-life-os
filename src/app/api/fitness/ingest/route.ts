import { db, t } from '@/db';
import { getConfig } from '@/lib/config';

// An external fitness/calorie app pushes daily totals here, authenticated by
// the shared ingest key shown in Settings → Fitness. CORS is scoped to the
// origin configured there (empty = disabled).
const cors = () => ({
  'Access-Control-Allow-Origin': getConfig().fitness.allowedOrigin || 'null',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-fitness-key',
});

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors() });
}

export async function POST(req: Request) {
  const { ingestKey } = getConfig().fitness;
  if (!ingestKey || req.headers.get('x-fitness-key') !== ingestKey) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: cors() });
  }
  const body = await req.json();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date ?? '')) {
    return Response.json({ error: 'bad date' }, { status: 400, headers: cors() });
  }
  await db().insert(t.fitnessDays)
    .values({
      date: body.date,
      eaten: Math.round(body.eaten ?? 0),
      burned: Math.round(body.burned ?? 0),
      streak: Math.round(body.streak ?? 0),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: t.fitnessDays.date,
      set: {
        eaten: Math.round(body.eaten ?? 0),
        burned: Math.round(body.burned ?? 0),
        streak: Math.round(body.streak ?? 0),
        updatedAt: new Date(),
      },
    });
  return Response.json({ ok: true }, { headers: cors() });
}
