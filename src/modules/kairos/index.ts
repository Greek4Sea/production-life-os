import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import type { ModuleManifest } from '../types';

// Kairos: Claude Code (bypass permissions) living in ~/kairos, embedded in
// the app. server.js hosts the PTY WebSocket; this module issues the one-time
// tickets for it (shared via globalThis — same process) and serves the file
// panel, jailed to the Kairos project folder.

import { getConfig } from '@/lib/config';
import { kairosDefaultDir } from '@/lib/paths';
import { toolsStatus } from '@/lib/tools';

export const kairosDir = () => getConfig().kairos.dir || kairosDefaultDir();
const PREVIEW_CAP = 300_000;
const SKIP = new Set(['node_modules', '.git']);

type TicketMap = Map<string, number>;
const tickets: TicketMap =
  ((globalThis as { __kairosTickets?: TicketMap }).__kairosTickets ??= new Map());

function safe(rel: string): string {
  const root = kairosDir();
  const abs = path.resolve(root, rel);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw Object.assign(new Error('path outside kairos'), { status: 403 });
  }
  return abs;
}

async function api(req: Request, p: string[]): Promise<Response | null> {
  try {
    if (req.method === 'GET' && p[0] === 'status') {
      const t = await toolsStatus();
      return Response.json({
        enabled: getConfig().kairos.enabled, possible: t.kairosPossible,
        tmux: t.tmux, claude: t.claude, dir: kairosDir(), platform: t.platform,
      });
    }

    if (req.method === 'GET' && p[0] === 'ticket') {
      await fs.mkdir(kairosDir(), { recursive: true });
      const id = randomUUID();
      tickets.set(id, Date.now() + 60_000);
      for (const [k, exp] of tickets) if (exp < Date.now()) tickets.delete(k);
      return Response.json({ ticket: id });
    }

    if (req.method === 'GET' && p[0] === 'list') {
      const rel = new URL(req.url).searchParams.get('dir') ?? '';
      const abs = safe(rel);
      const entries = await fs.readdir(abs, { withFileTypes: true });
      const dirs: string[] = [], files: { name: string; path: string; size: number }[] = [];
      for (const e of entries) {
        if (e.name.startsWith('.') && e.name !== '.claude') continue;
        if (SKIP.has(e.name)) continue;
        if (e.isDirectory()) dirs.push(e.name);
        else {
          const st = await fs.stat(path.join(abs, e.name)).catch(() => null);
          files.push({ name: e.name, path: path.join(rel, e.name), size: st?.size ?? 0 });
        }
      }
      dirs.sort((a, b) => a.localeCompare(b));
      files.sort((a, b) => a.name.localeCompare(b.name));
      return Response.json({ dir: rel, dirs, files });
    }

    if (req.method === 'GET' && p[0] === 'file') {
      const rel = new URL(req.url).searchParams.get('path') ?? '';
      const abs = safe(rel);
      const st = await fs.stat(abs);
      if (st.size > PREVIEW_CAP) return Response.json({ error: 'file too large' }, { status: 413 });
      return Response.json({ path: rel, text: await fs.readFile(abs, 'utf8') });
    }

    return null;
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status) return Response.json({ error: String((e as Error).message) }, { status });
    throw e;
  }
}

export const kairos: ModuleManifest = {
  enabled: () => getConfig().kairos.enabled,
  id: 'kairos',
  name: 'Kairos',
  tileSize: 'sm',
  api,
};
