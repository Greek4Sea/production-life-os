import { promises as fs } from 'fs';
import path from 'path';
import type { ModuleManifest } from '../types';

// Password manager backed by its own separate Obsidian vault. A LOCAL Ollama
// model parses whatever freeform text the user pastes into structured fields
// and the entry is written as markdown. Nothing ever leaves the machine; the
// model is loaded on demand and unloads itself after 2 minutes (keep_alive).

import { getConfig } from "@/lib/config";
import { chatJson } from "@/lib/llm";
const vaultPath = () => {
  const v = getConfig().passwords.vault;
  if (!v) throw Object.assign(new Error("Passwords vault is not set — pick a folder in Settings"), { status: 503 });
  return v;
};
export const passwordsConfigured = () => Boolean(getConfig().passwords.vault);

function safe(rel: string): string {
  const abs = path.resolve(vaultPath(), rel);
  if (abs !== vaultPath() && !abs.startsWith(vaultPath() + path.sep)) {
    throw Object.assign(new Error('path outside vault'), { status: 403 });
  }
  return abs;
}

const cleanName = (s: string) =>
  (s || 'Untitled').replace(/[/\\:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 60);

type Extracted = {
  service?: string; category?: string; username?: string; password?: string;
  url?: string; notes?: string; extra?: Record<string, string>;
};

const SYSTEM = `You organize credentials. Extract from the user's text and reply with ONLY a JSON object:
{"service": "name of the site/app/thing", "category": "one of: Web, Email, Banking, Work, School, Devices, Wifi, Cards, Ids, Other",
"username": "...", "password": "...", "url": "...", "notes": "anything else important, brief",
"extra": {"field name": "value"}}
Omit keys you have no value for. Put PINs, security answers, account numbers, recovery codes into "extra". Never invent values.`;

async function extract(text: string): Promise<Extracted> {
  return chatJson<Extracted>({ system: SYSTEM, user: text, slot: "passwordsModel" });
}

function render(e: Extracted, original: string): string {
  const lines = ['---'];
  for (const [k, v] of Object.entries({
    username: e.username, password: e.password, url: e.url, updated: new Date().toISOString(),
  })) if (v) lines.push(`${k}: "${String(v).replace(/"/g, '\\"')}"`);
  lines.push('---', '', `# ${e.service ?? 'Untitled'}`, '');
  if (e.username) lines.push(`- **username**: \`${e.username}\``);
  if (e.password) lines.push(`- **password**: \`${e.password}\``);
  if (e.url) lines.push(`- **url**: ${e.url}`);
  for (const [k, v] of Object.entries(e.extra ?? {})) lines.push(`- **${k}**: \`${v}\``);
  if (e.notes) lines.push('', e.notes);
  lines.push('', '## Original input', '', '```', original.trim(), '```', '');
  return lines.join('\n');
}

async function listEntries() {
  const out: { category: string; name: string; path: string; mtime: number }[] = [];
  const cats = await fs.readdir(vaultPath(), { withFileTypes: true }).catch(() => []);
  for (const c of cats) {
    if (!c.isDirectory() || c.name.startsWith('.')) continue;
    for (const f of await fs.readdir(path.join(vaultPath(), c.name)).catch(() => [])) {
      if (!f.endsWith('.md')) continue;
      const st = await fs.stat(path.join(vaultPath(), c.name, f)).catch(() => null);
      out.push({
        category: c.name, name: f.replace(/\.md$/, ''),
        path: `${c.name}/${f}`, mtime: st?.mtimeMs ?? 0,
      });
    }
  }
  out.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  return out;
}

async function api(req: Request, p: string[]): Promise<Response | null> {
  try {
    if (req.method === 'POST' && p[0] === 'add') {
      const { text } = await req.json();
      if (!text?.trim()) return Response.json({ error: 'empty' }, { status: 400 });
      let e: Extracted;
      try {
        e = await extract(text);
      } catch (err) {
        const { notify } = await import('@/lib/notify');
        await notify({
          moduleId: 'passwords',
          title: '🤖 Passwords AI is not responding',
          body: String(err).slice(0, 140),
        }).catch(() => {});
        return Response.json({ error: `Local AI unavailable: ${String(err).slice(0, 100)}` }, { status: 502 });
      }
      if (!e.service && !e.password && !e.username) {
        return Response.json({ error: 'the model could not find credentials in that text' }, { status: 422 });
      }
      const category = cleanName(e.category ?? 'Other');
      const name = cleanName(e.service ?? 'Untitled');
      const rel = `${category}/${name}.md`;
      const abs = safe(rel);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      const existed = await fs.stat(abs).then(() => true).catch(() => false);
      if (existed) {
        // keep the old entry inline so nothing is ever silently lost
        const old = await fs.readFile(abs, 'utf8');
        await fs.writeFile(abs, render(e, text) + '\n## Previous version\n\n' +
          old.split('\n').map((l) => '> ' + l).join('\n') + '\n', { mode: 0o600 });
      } else {
        await fs.writeFile(abs, render(e, text), { mode: 0o600 });
      }
      return Response.json({ ok: true, path: rel, updated: existed, entry: e });
    }

    if (req.method === 'GET' && p[0] === 'list') {
      return Response.json(await listEntries());
    }

    if (req.method === 'GET' && p[0] === 'entry') {
      const rel = new URL(req.url).searchParams.get('path') ?? '';
      const text = await fs.readFile(safe(rel), 'utf8');
      return Response.json({ path: rel, text });
    }

    if (req.method === 'DELETE' && p[0] === 'entry') {
      const rel = new URL(req.url).searchParams.get('path') ?? '';
      await fs.unlink(safe(rel));
      return Response.json({ ok: true });
    }

    return null;
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status) return Response.json({ error: String((e as Error).message) }, { status });
    throw e;
  }
}

async function dashboardData() {
  const entries = await listEntries();
  return { count: entries.length };
}

export const passwords: ModuleManifest = {
  enabled: passwordsConfigured,
  id: 'passwords',
  name: 'Passwords',
  tileSize: 'sm',
  api,
  dashboardData,
};
