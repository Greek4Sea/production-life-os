import { db, t } from "@/db";
import { getConfig } from "@/lib/config";

let cached: { token: string; exp: number } | null = null;

// Exchange the stored refresh token for a short-lived access token (cached in memory).
export async function googleAccessToken(): Promise<string> {
  if (cached && Date.now() < cached.exp - 60_000) return cached.token;
  const row = await db().query.googleTokens.findFirst();
  if (!row) throw new Error('Not connected to Google — sign in first');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: getConfig().google.clientId,
      client_secret: getConfig().google.clientSecret,
      refresh_token: row.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  cached = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

export async function gfetch(url: string, init: RequestInit = {}) {
  const token = await googleAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Google API ${res.status}: ${await res.text()}`);
  return res.json();
}
