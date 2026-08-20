import { requireAuth } from '@/lib/requireAuth';
import { getSettings, patchSettings } from '@/lib/settings';
import { getModule } from '@/modules/registry';

export async function GET(req: Request, ctx: { params: Promise<{ module: string }> }) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  const { module: moduleId } = await ctx.params;
  if (!getModule(moduleId)) return Response.json({ error: 'unknown module' }, { status: 404 });
  return Response.json(await getSettings(moduleId));
}

// Deep-merge patch semantics (server-side).
export async function PATCH(req: Request, ctx: { params: Promise<{ module: string }> }) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  const { module: moduleId } = await ctx.params;
  if (!getModule(moduleId)) return Response.json({ error: 'unknown module' }, { status: 404 });
  return Response.json(await patchSettings(moduleId, await req.json()));
}
