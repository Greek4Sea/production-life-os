import { auth } from '@/lib/auth';
import { getConfig } from '@/lib/config';

// Setup endpoints are open while no owner exists yet (first run, localhost
// only). Once an account has signed in, they require that session.
export async function requireSetupAccess(req: Request): Promise<Response | null> {
  if (!getConfig().core.allowedEmail) return null;
  const { requireAuth } = await import('@/lib/requireAuth');
  return requireAuth(req);
}

export async function currentEmail(): Promise<string | null> {
  const s = await auth().catch(() => null);
  return s?.user?.email ?? null;
}
