import { getConfig, patchConfig } from '@/lib/config';
import { requireSetupAccess } from '@/lib/setupAuth';
import { tickNow } from '@/lib/scheduler';

export async function POST(req: Request) {
  const denied = await requireSetupAccess(req);
  if (denied) return denied;
  const c = getConfig();
  if (!c.google.clientId || !c.core.allowedEmail) {
    return Response.json({ error: 'Google sign-in is required before finishing setup' }, { status: 400 });
  }
  if (c.ai.provider === 'anthropic' && !c.anthropic.apiKey) {
    return Response.json({ error: 'An Anthropic API key is required when local AI is skipped' }, { status: 400 });
  }
  patchConfig({ core: { setupCompletedAt: new Date().toISOString() } });
  tickNow(true).catch(() => {});
  return Response.json({ ok: true });
}
