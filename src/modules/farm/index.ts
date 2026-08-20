import { db, t } from '@/db';
import type { ModuleManifest } from '../types';

// Life OS Farm — a Stardew-style farming game. Client-authoritative save:
// the whole game state lives in one jsonb row, written on sleep + autosave.

const MAX_SAVE_BYTES = 1_000_000;

async function api(req: Request, p: string[]): Promise<Response | null> {
  if (req.method === 'GET' && p[0] === 'state') {
    const row = await db().query.farmState.findFirst();
    return Response.json(row ?? null);
  }

  if (req.method === 'PUT' && p[0] === 'state') {
    const body = await req.text();
    if (body.length > MAX_SAVE_BYTES) {
      return Response.json({ error: 'save too large' }, { status: 413 });
    }
    let parsed: { version?: number; state?: unknown };
    try {
      parsed = JSON.parse(body);
    } catch {
      return Response.json({ error: 'bad json' }, { status: 400 });
    }
    if (typeof parsed.version !== 'number' || !parsed.state) {
      return Response.json({ error: 'missing version/state' }, { status: 400 });
    }
    await db().insert(t.farmState)
      .values({ id: 'main', version: parsed.version, state: parsed.state })
      .onConflictDoUpdate({
        target: t.farmState.id,
        set: { version: parsed.version, state: parsed.state, updatedAt: new Date() },
      });
    return Response.json({ ok: true });
  }

  // Settings → Reset: wipe the save; the client reloads and starts a new farm.
  if (req.method === 'DELETE' && p[0] === 'state') {
    await db().delete(t.farmState);
    return Response.json({ ok: true });
  }

  return null;
}

export const farmModule: ModuleManifest = {
  id: 'farm',
  name: 'Farm',
  tileSize: 'sm',
  api,
};
