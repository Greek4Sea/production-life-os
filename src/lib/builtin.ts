// Built-in Google OAuth client shipped with official builds (type "Desktop app").
// Google treats desktop-app client secrets as non-confidential — the same model
// the gcloud CLI, rclone and Thunderbird use — so users get a one-click
// "Sign in with Google" with no Cloud Console setup. Anyone can still use their
// own client from the wizard (Advanced).
//
// The values are injected at build time (LIFEOS_BUILTIN_GOOGLE_ID / _SECRET in
// .env.local or CI secrets — see next.config.ts). Builds without them simply
// fall back to the bring-your-own-client flow.
//
// Google caps unverified restricted-scope (Gmail) apps at 100 users until the
// app passes verification.
export const BUILTIN_GOOGLE = {
  clientId: process.env.LIFEOS_BUILTIN_GOOGLE_ID ?? '',
  clientSecret: process.env.LIFEOS_BUILTIN_GOOGLE_SECRET ?? '',
};

export const hasBuiltinGoogle = () => Boolean(BUILTIN_GOOGLE.clientId && BUILTIN_GOOGLE.clientSecret);
