import { requireAuth } from '@/lib/requireAuth';
import { MODULES } from '@/modules/registry';
import { db, t } from '@/db';
import { localDate } from '@/lib/dates';
import { getConfig } from '@/lib/config';

// One batched call feeds every dashboard tile.
export async function GET(req: Request) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  const tiles: Record<string, unknown> = {};
  await Promise.all(MODULES.map(async (m) => {
    try {
      if (m.enabled && !m.enabled()) { tiles[m.id] = { configured: false }; return; }
      tiles[m.id] = m.dashboardData ? await m.dashboardData() : null;
    } catch (e) {
      tiles[m.id] = { error: String(e) };
    }
  }));

  const sync = await db().select().from(t.syncState);

  return Response.json({
    date: localDate(),
    quickLinks: getConfig().quickLinks,
    modules: MODULES.map((m) => ({ id: m.id, name: m.name, tileSize: m.tileSize, enabled: m.enabled ? m.enabled() : true })),
    tiles,
    sync,
  });
}
