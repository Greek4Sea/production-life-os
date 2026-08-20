import { toolsStatus } from '@/lib/tools';
import { requireSetupAccess } from '@/lib/setupAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const denied = await requireSetupAccess(req);
  if (denied) return denied;
  return Response.json(await toolsStatus());
}
