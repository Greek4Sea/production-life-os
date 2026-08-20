import { promises as fs } from 'fs';
import { TZ } from '@/lib/dates';
import path from 'path';
import type { ModuleManifest } from '../types';

// Reads the Obsidian vault straight from disk (a vault is just markdown files),
// so everything works whether or not the Obsidian app is running. Local-only —
// this module assumes the server runs on the machine that owns the vault.

import { getConfig } from "@/lib/config";
const vaultPath = () => {
  const v = getConfig().obsidian.vault;
  if (!v) throw Object.assign(new Error("Obsidian vault is not set — pick a folder in Settings"), { status: 503 });
  return v;
};
export const obsidianConfigured = () => Boolean(getConfig().obsidian.vault);
const SKIP_DIRS = new Set(['node_modules']);
const skipDir = (name: string) => name.startsWith('.') || SKIP_DIRS.has(name);
const MAX_NOTE_BYTES = 512 * 1024;

// Confine a client-supplied relative path to the vault.
function safe(rel: string): string {
  const abs = path.resolve(vaultPath(), rel);
  if (abs !== vaultPath() && !abs.startsWith(vaultPath() + path.sep)) {
    throw Object.assign(new Error('path outside vault'), { status: 403 });
  }
  return abs;
}

type NoteMeta = { name: string; path: string; mtime: number };

async function walk(dir = vaultPath()): Promise<NoteMeta[]> {
  const out: NoteMeta[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!skipDir(e.name)) out.push(...await walk(path.join(dir, e.name)));
    } else if (e.name.endsWith('.md')) {
      const abs = path.join(dir, e.name);
      const st = await fs.stat(abs).catch(() => null);
      if (st) out.push({
        name: e.name.replace(/\.md$/, ''),
        path: path.relative(vaultPath(), abs),
        mtime: st.mtimeMs,
      });
    }
  }
  return out;
}

async function api(req: Request, p: string[]): Promise<Response | null> {
  try {
    if (req.method === 'GET' && p[0] === 'list') {
      const rel = new URL(req.url).searchParams.get('dir') ?? '';
      const abs = safe(rel);
      const entries = await fs.readdir(abs, { withFileTypes: true });
      const dirs: string[] = [], notes: NoteMeta[] = [];
      for (const e of entries) {
        if (e.isDirectory() && !skipDir(e.name)) dirs.push(e.name);
        else if (e.name.endsWith('.md')) {
          const st = await fs.stat(path.join(abs, e.name)).catch(() => null);
          notes.push({
            name: e.name.replace(/\.md$/, ''),
            path: path.join(rel, e.name),
            mtime: st?.mtimeMs ?? 0,
          });
        }
      }
      dirs.sort((a, b) => a.localeCompare(b));
      notes.sort((a, b) => b.mtime - a.mtime);
      return Response.json({ dir: rel, dirs, notes });
    }

    if (req.method === 'GET' && p[0] === 'note') {
      const rel = new URL(req.url).searchParams.get('path') ?? '';
      const abs = safe(rel);
      const st = await fs.stat(abs);
      if (st.size > MAX_NOTE_BYTES) return Response.json({ error: 'note too large' }, { status: 413 });
      const text = await fs.readFile(abs, 'utf8');
      return Response.json({ path: rel, name: path.basename(rel, '.md'), text, mtime: st.mtimeMs });
    }

    if (req.method === 'GET' && p[0] === 'search') {
      const q = (new URL(req.url).searchParams.get('q') ?? '').toLowerCase().trim();
      if (!q) return Response.json({ hits: [] });
      const notes = await walk();
      const hits: (NoteMeta & { snippet: string | null })[] = [];
      for (const n of notes) {
        const titleHit = n.name.toLowerCase().includes(q);
        let snippet: string | null = null;
        if (!titleHit) {
          const text = await fs.readFile(safe(n.path), 'utf8').catch(() => '');
          const i = text.toLowerCase().indexOf(q);
          if (i === -1) continue;
          snippet = text.slice(Math.max(0, i - 40), i + q.length + 60).replace(/\n+/g, ' ');
        }
        hits.push({ ...n, snippet });
        if (hits.length >= 25) break;
      }
      hits.sort((a, b) => b.mtime - a.mtime);
      return Response.json({ hits });
    }

    // Write/create a note — powers the in-app personal notes editor.
    if (req.method === 'POST' && p[0] === 'write') {
      const { path: rel, text } = await req.json();
      if (!rel?.endsWith('.md')) return Response.json({ error: 'path must end in .md' }, { status: 400 });
      const abs = safe(rel);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, text ?? '', 'utf8');
      return Response.json({ ok: true, path: rel });
    }

    if (req.method === 'DELETE' && p[0] === 'note') {
      const rel = new URL(req.url).searchParams.get('path') ?? '';
      if (!rel.endsWith('.md')) return Response.json({ error: 'notes only' }, { status: 400 });
      await fs.unlink(safe(rel));
      return Response.json({ ok: true });
    }

    // Quick capture: append a timestamped line to today's daily note.
    if (req.method === 'POST' && p[0] === 'capture') {
      const { text } = await req.json();
      if (!text?.trim()) return Response.json({ error: 'empty' }, { status: 400 });
      const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
      const abs = safe(path.join('Daily', `${today}.md`));
      const time = new Date().toLocaleTimeString('en-US', {
        timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
      });
      const exists = await fs.stat(abs).then(() => true).catch(() => false);
      const line = `${exists ? '' : `# ${today}\n`}\n- ${time} ${text.trim()}\n`;
      await fs.appendFile(abs, line, 'utf8');
      return Response.json({ ok: true, path: path.relative(vaultPath(), abs) });
    }

    return null;
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status) return Response.json({ error: String((e as Error).message) }, { status });
    throw e;
  }
}

async function dashboardData() {
  const notes = await walk();
  notes.sort((a, b) => b.mtime - a.mtime);
  return { count: notes.length, recent: notes.slice(0, 3) };
}

export const obsidian: ModuleManifest = {
  enabled: obsidianConfigured,
  id: 'obsidian',
  name: 'Notes',
  tileSize: 'sm',
  api,
  dashboardData,
};
