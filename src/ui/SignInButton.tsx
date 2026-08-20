'use client';
import { useEffect, useState } from 'react';

// Posts directly to Auth.js's sign-in endpoint (no server action), which is
// robust behind TLS-terminating proxies where Next's action redirects break.
export function SignInButton({ callbackUrl = '/', label = 'Sign in with Google' }: { callbackUrl?: string; label?: string }) {
  const [csrf, setCsrf] = useState('');
  useEffect(() => {
    fetch('/api/auth/csrf').then((r) => r.json()).then((d) => setCsrf(d.csrfToken ?? '')).catch(() => {});
  }, []);
  return (
    <form method="POST" action="/api/auth/signin/google">
      <input type="hidden" name="csrfToken" value={csrf} />
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <button type="submit" className="btn primary" disabled={!csrf}>{label}</button>
    </form>
  );
}
