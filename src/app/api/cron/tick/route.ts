import { requireCronSecret } from '@/lib/requireAuth';
import { runSyncs, sendDueNotifications } from '@/lib/tick';

export const maxDuration = 60;

// The heartbeat: run due module syncs, then send due notifications.
// Hit every ~10 min by GitHub Actions (Vercel) or a systemd timer (mini-PC).
export async function POST(req: Request) {
  const denied = requireCronSecret(req);
  if (denied) return denied;
  const report = await runSyncs();
  report._notifications = `${await sendDueNotifications()} sent`;
  return Response.json(report);
}

export const GET = POST; // convenience for curl / uptime pingers
