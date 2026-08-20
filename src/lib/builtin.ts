// Built-in Google OAuth client shipped with the app (type "Desktop app").
// Google treats desktop-app client secrets as non-confidential — this is the
// same model the gcloud CLI, rclone and Thunderbird use — so users get a
// one-click "Sign in with Google" with no Cloud Console setup. Anyone who
// prefers their own client can override it in the wizard (Advanced).
//
// Unverified restricted-scope (Gmail) apps are capped by Google at 100 users
// until the app passes verification.
export const BUILTIN_GOOGLE = {
  clientId: '',
  clientSecret: '',
};

export const hasBuiltinGoogle = () => Boolean(BUILTIN_GOOGLE.clientId && BUILTIN_GOOGLE.clientSecret);
