import { getPublicConfig } from '@/lib/config';
import { auth, signIn } from '@/lib/auth';
import { db } from '@/db';
import { Suspense } from 'react';
import { SetupWizard } from './SetupWizard';

export const dynamic = 'force-dynamic';

// First-run wizard. Reachable without a session: on a fresh install nobody
// can sign in yet (Google credentials are entered here).
export default async function SetupPage() {
  const cfg = getPublicConfig();
  const session = await auth().catch(() => null);
  let googleConnected = false;
  try { googleConnected = Boolean(await db().query.googleTokens.findFirst()); } catch { /* db booting */ }

  async function signInAction() {
    'use server';
    await signIn('google', { redirectTo: '/setup?step=google' });
  }

  return (
    <Suspense fallback={null}>
      <SetupWizard
        initial={{ ...cfg, signedInAs: session?.user?.email ?? null, googleConnected }}
        signInAction={signInAction}
      />
    </Suspense>
  );
}
