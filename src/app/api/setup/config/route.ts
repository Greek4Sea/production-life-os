import { patchConfig, getPublicConfig, type AppConfig } from '@/lib/config';
import { requireSetupAccess } from '@/lib/setupAuth';

// Which keys the wizard may write. Everything else in config.json is internal.
const ALLOWED: Record<string, string[]> = {
  core: ['tz', 'aboutMe'],
  google: ['clientId', 'clientSecret'],
  ai: ['provider'],
  anthropic: ['apiKey'],
  ollama: ['url', 'tasksModel', 'recipesModel', 'passwordsModel'],
  canvas: ['baseUrl', 'token'],
  spotify: ['clientId', 'clientSecret'],
  obsidian: ['vault'],
  passwords: ['vault'],
  fitness: ['appUrl', 'allowedOrigin'],
  fencing: ['enabled', 'homeStates', 'trackerProfileUrl'],
  kairos: ['enabled', 'dir', 'tmuxPath'],
};

export async function POST(req: Request) {
  const denied = await requireSetupAccess(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'bad body' }, { status: 400 });
  const patch: Record<string, unknown> = {};
  for (const [section, fields] of Object.entries(body as Record<string, unknown>)) {
    if (section === 'quickLinks') {
      if (Array.isArray(fields)) {
        patch.quickLinks = fields
          .filter((l) => l && typeof l.label === 'string' && typeof l.url === 'string' && /^https?:\/\//.test(l.url))
          .slice(0, 8).map((l) => ({ label: String(l.label).slice(0, 24), url: String(l.url).slice(0, 500) }));
      }
      continue;
    }
    const allowed = ALLOWED[section];
    if (!allowed || !fields || typeof fields !== 'object') continue;
    const clean: Record<string, unknown> = {};
    for (const k of allowed) {
      const v = (fields as Record<string, unknown>)[k];
      if (v === undefined) continue;
      if (typeof v === 'string') clean[k] = v.trim();
      else if (typeof v === 'boolean' || Array.isArray(v)) clean[k] = v;
    }
    if (Object.keys(clean).length) patch[section] = clean;
  }
  patchConfig(patch as Partial<AppConfig>);
  return Response.json(getPublicConfig());
}
