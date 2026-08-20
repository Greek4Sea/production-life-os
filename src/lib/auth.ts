import NextAuth, { type NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import { db, t } from '@/db';
import { getConfig, patchConfig } from '@/lib/config';

// Calendar (gcal module + add-to-calendar) and Gmail (AI inbox: read/label + send).
export const GOOGLE_SCOPES = [
  'openid', 'email', 'profile',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
].join(' ');

// Config is resolved per request so the setup wizard can save Google
// credentials and sign in immediately — no restart needed.
function buildConfig(): NextAuthConfig {
  const c = getConfig();
  return {
    secret: c.core.authSecret || 'life-os-unconfigured',
    trustHost: true,
    session: { strategy: 'jwt' },
    providers: c.google.clientId && c.google.clientSecret ? [
      Google({
        clientId: c.google.clientId,
        clientSecret: c.google.clientSecret,
        authorization: {
          params: { access_type: 'offline', prompt: 'consent', scope: GOOGLE_SCOPES },
        },
      }),
    ] : [],
    callbacks: {
      signIn({ profile }) {
        const email = profile?.email;
        if (!email) return false;
        const allowed = getConfig().core.allowedEmail;
        if (!allowed) {
          // Single-user app: the first account to sign in owns it.
          patchConfig({ core: { allowedEmail: email } });
          return true;
        }
        return email.toLowerCase() === allowed.toLowerCase();
      },
      async jwt({ token, account, profile }) {
        // First sign-in (or re-consent): persist the refresh token — it's the sync credential.
        if (account?.refresh_token) {
          await db().insert(t.googleTokens)
            .values({
              id: 'default',
              email: profile?.email ?? getConfig().core.allowedEmail,
              refreshToken: account.refresh_token,
              scopes: account.scope ?? null,
            })
            .onConflictDoUpdate({
              target: t.googleTokens.id,
              set: {
                refreshToken: account.refresh_token,
                scopes: account.scope ?? null,
                updatedAt: new Date(),
              },
            });
        }
        return token;
      },
    },
    pages: { signIn: '/signin' },
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => buildConfig());
