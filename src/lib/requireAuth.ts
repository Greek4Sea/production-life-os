import { createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, t } from "@/db";
import { getConfig } from "@/lib/config";

// Dual auth: browser session cookie OR bearer token (future personal-ai-v2).
// Returns null if authorized, or a 401 Response to return as-is.
export async function requireAuth(req: Request): Promise<Response | null> {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (bearer) {
    const hash = createHash('sha256').update(bearer).digest('hex');
    const row = await db().query.apiTokens.findFirst({ where: eq(t.apiTokens.tokenHash, hash) });
    if (row) {
      db().update(t.apiTokens).set({ lastUsedAt: new Date() })
        .where(eq(t.apiTokens.id, row.id)).catch(() => {});
      return null;
    }
    return Response.json({ error: 'invalid token' }, { status: 401 });
  }
  const session = await auth();
  if (session?.user) return null;
  return Response.json({ error: 'unauthorized' }, { status: 401 });
}

export function requireCronSecret(req: Request): Response | null {
  const given = req.headers.get('x-cron-secret')
    ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (given && given === getConfig().core.cronSecret) return null;
  return Response.json({ error: 'unauthorized' }, { status: 401 });
}
