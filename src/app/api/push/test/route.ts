import { requireAuth } from '@/lib/requireAuth';
import { pushToAll } from '@/lib/push';

export async function POST(req: Request) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  const sent = await pushToAll({ title: 'Life OS', body: 'Test notification — push works.', url: '/' });
  return Response.json({ sent });
}
