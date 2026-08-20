import { db, t } from "@/db";
import { getConfig } from "@/lib/config";

let cached: { token: string; exp: number } | null = null;

const basic = () =>
  Buffer.from(`${getConfig().spotify.clientId}:${getConfig().spotify.clientSecret}`).toString('base64');

export async function spotifyAccessToken(): Promise<string> {
  if (cached && Date.now() < cached.exp - 60_000) return cached.token;
  const row = await db().query.spotifyTokens.findFirst();
  if (!row) throw new Error('Spotify not connected');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      authorization: `Basic ${basic()}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: row.refreshToken }),
  });
  if (!res.ok) throw new Error(`Spotify token refresh failed: ${res.status}`);
  const data = await res.json();
  cached = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  if (data.refresh_token) {
    await db().update(t.spotifyTokens).set({ refreshToken: data.refresh_token, updatedAt: new Date() });
  }
  return cached.token;
}

// Returns null on 204/empty (nothing playing / control acks).
export async function spfetch(path: string, method: 'GET' | 'PUT' | 'POST' = 'GET', body?: unknown) {
  const token = await spotifyAccessToken();
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`Spotify API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  // Control acks sometimes return 200 with an empty/non-JSON body.
  try { return text ? JSON.parse(text) : null; } catch { return null; }
}

export async function exchangeCode(code: string, redirectUri: string) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      authorization: `Basic ${basic()}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
  });
  if (!res.ok) throw new Error(`Spotify code exchange failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{ refresh_token: string }>;
}
