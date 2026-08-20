import { requireCronSecret } from '@/lib/requireAuth';
import { drainDesktopQueue } from '@/lib/push';

export const dynamic = 'force-dynamic';

// Drained by the Electron shell (authenticated with the cron secret from
// config.json) to show native desktop notifications.
export async function GET(req: Request) {
  const denied = requireCronSecret(req);
  if (denied) return denied;
  return Response.json({ notifications: drainDesktopQueue() });
}
