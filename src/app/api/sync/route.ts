import { requireAuth } from '@/lib/requireAuth';
import { runSyncs } from '@/lib/tick';
import { startBackgroundSync, syncStatus } from '@/lib/syncRunner';

export const maxDuration = 60;

// Session-authed sync trigger: the dashboard fires this on open (due syncs only),
// the Settings "Sync" button uses ?force=1&bg=1 — bg detaches the sync from the
// request so it keeps running even if the user leaves Settings.
export async function POST(req: Request) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  const params = new URL(req.url).searchParams;
  const force = params.get('force') === '1';
  if (params.get('bg') === '1') {
    const started = startBackgroundSync(force);
    return Response.json({ started, running: true });
  }
  return Response.json(await runSyncs(force));
}

// Poll the background sync: Settings shows a live spinner off this,
// surviving navigation away and back.
export async function GET(req: Request) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  return Response.json(syncStatus());
}
