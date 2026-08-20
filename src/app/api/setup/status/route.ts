import { getPublicConfig } from '@/lib/config';
import { currentEmail } from '@/lib/setupAuth';
import { db, t } from '@/db';

export const dynamic = 'force-dynamic';

// Public, non-secret snapshot used by the wizard and the Electron shell's
// readiness probe.
export async function GET() {
  const cfg = getPublicConfig();
  const email = await currentEmail();
  let googleConnected = false;
  try { googleConnected = Boolean(await db().query.googleTokens.findFirst()); } catch { /* db booting */ }
  return Response.json({ ...cfg, signedInAs: email, googleConnected, version: process.env.NEXT_PUBLIC_OS_VERSION ?? 'dev' });
}
