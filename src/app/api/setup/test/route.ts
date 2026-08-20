import { getConfig } from '@/lib/config';
import { requireSetupAccess } from '@/lib/setupAuth';
import { ollamaStatus } from '@/lib/ollama';
import { promises as fs } from 'fs';

// Connectivity checks for the wizard: ?what=anthropic|canvas|ollama|folder
export async function POST(req: Request) {
  const denied = await requireSetupAccess(req);
  if (denied) return denied;
  const what = new URL(req.url).searchParams.get('what');
  const body = await req.json().catch(() => ({}));
  const c = getConfig();
  try {
    if (what === 'anthropic') {
      const key = body.apiKey || c.anthropic.apiKey;
      const r = await fetch('https://api.anthropic.com/v1/models', {
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, signal: AbortSignal.timeout(8000),
      });
      return Response.json({ ok: r.ok, detail: r.ok ? 'Key works' : `Anthropic said ${r.status}` });
    }
    if (what === 'canvas') {
      const base = String(body.baseUrl || c.canvas.baseUrl).replace(/\/+$/, '');
      const token = body.token || c.canvas.token;
      const r = await fetch(`${base}/api/v1/users/self`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
      const j = r.ok ? await r.json() : null;
      return Response.json({ ok: r.ok, detail: r.ok ? `Connected as ${j.name ?? j.short_name ?? 'you'}` : `Canvas said ${r.status}` });
    }
    if (what === 'ollama') {
      const s = await ollamaStatus();
      return Response.json({ ok: s.reachable, detail: s.reachable ? `Running · ${s.models.length} model(s)` : `Not reachable at ${s.url}`, models: s.models });
    }
    if (what === 'folder') {
      const st = await fs.stat(String(body.path || '')).catch(() => null);
      return Response.json({ ok: Boolean(st?.isDirectory()), detail: st?.isDirectory() ? 'Folder found' : 'Not a folder' });
    }
    return Response.json({ error: 'unknown test' }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, detail: String((e as Error).message ?? e).slice(0, 200) });
  }
}
