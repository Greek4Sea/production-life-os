import { requireAuth } from '@/lib/requireAuth';
import { getModule } from '@/modules/registry';

// Every module's API namespace: /api/mod/<id>/<path...>
async function handle(req: Request, ctx: { params: Promise<{ module: string; path: string[] }> }) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  const { module: moduleId, path } = await ctx.params;
  const mod = getModule(moduleId);
  if (!mod?.api) return Response.json({ error: 'unknown module' }, { status: 404 });

  try {
    const res = await mod.api(req, path);
    return res ?? Response.json({ error: 'not found' }, { status: 404 });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
