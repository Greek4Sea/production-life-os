import { db, t } from '@/db';
import { spfetch, exchangeCode } from '@/lib/spotify';
import type { ModuleManifest } from "../types";
import { getConfig, appOrigin } from "@/lib/config";

const SCOPES = [
  'user-read-currently-playing', 'user-read-recently-played', 'user-top-read',
  'user-read-playback-state', 'user-modify-playback-state',
  'playlist-read-private', 'user-library-read',
  // Web Playback SDK (in-browser player on desktop; Spotify blocks it on iOS)
  'streaming', 'user-read-email', 'user-read-private',
].join(' ');

const origin = () => appOrigin();
const redirectUri = () => `${origin()}/api/mod/spotify/callback`;

type Track = {
  name: string;
  uri?: string;
  artists: { name: string }[];
  album?: { images?: { url: string; width: number }[] };
  external_urls?: { spotify?: string };
};

const slim = (tr: Track) => ({
  name: tr.name,
  uri: tr.uri ?? null, // spotify:track:… — what the play endpoint needs
  artist: tr.artists?.map((a) => a.name).join(', ') ?? '',
  art: tr.album?.images?.at(-1)?.url ?? null, // smallest image
  artBig: tr.album?.images?.[0]?.url ?? null,
  url: tr.external_urls?.spotify ?? null,
});

async function connected() {
  return !!(await db().query.spotifyTokens.findFirst());
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- local control: AppleScript straight into Spotify.app ----------
// Frictionless by design: no devices, no Premium requirement, no OAuth in the
// control path. If the app isn't running we launch it silently (-g).

async function osa(script: string): Promise<string> {
  const { execFile } = await import('child_process');
  return new Promise((resolve, reject) =>
    execFile('osascript', ['-e', script], { timeout: 20_000 }, (e, out) =>
      e ? reject(e) : resolve(out.trim())));
}

async function ensureSpotifyApp() {
  const running = await osa('tell application "System Events" to (name of processes) contains "Spotify"');
  if (running === 'true') return;
  const { execFile } = await import('child_process');
  await new Promise<void>((r) => execFile('open', ['-g', '-a', 'Spotify'], () => r()));
  for (let i = 0; i < 12; i++) {
    await sleep(600);
    if (await osa('tell application "System Events" to (name of processes) contains "Spotify"') === 'true') {
      await sleep(800); // let its AppleScript interface come up
      return;
    }
  }
  throw new Error('Spotify app failed to launch');
}

async function localControl(action: string) {
  await ensureSpotifyApp();
  const cmd = { play: 'play', pause: 'pause', next: 'next track', previous: 'previous track' }[action];
  if (!cmd) throw Object.assign(new Error('unknown action'), { status: 400 });
  await osa(`tell application "Spotify" to ${cmd}`);
}

async function localPlayUri(uri: string) {
  await ensureSpotifyApp();
  await osa(`tell application "Spotify" to play track "${uri.replace(/[^a-zA-Z0-9:._-]/g, '')}"`);
}

// Now-playing straight from the app (fresher than the Web API, no rate limit).
async function localState() {
  const out = await osa(`tell application "Spotify"
    if it is not running then return "off"
    try
      set t to current track
      return (player state as text) & "|~|" & (name of t) & "|~|" & (artist of t) & "|~|" & (artwork url of t) & "|~|" & (id of t)
    on error
      return (player state as text) & "|~|none"
    end try
  end tell`);
  if (out === 'off') return null;
  const [state, name, artist, art, id] = out.split('|~|');
  if (name === 'none' || !name) return { playing: state === 'playing', track: null };
  return {
    playing: state === 'playing',
    track: { name, artist, art: art || null, artBig: art || null, uri: id || null, url: null },
  };
}


async function api(req: Request, path: string[]): Promise<Response | null> {
  if (req.method === 'GET' && path[0] === 'connect') {
    if (!getConfig().spotify.clientId) {
      return Response.json({ error: 'SPOTIFY_CLIENT_ID not configured yet' }, { status: 500 });
    }
    const url = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
      response_type: 'code',
      client_id: getConfig().spotify.clientId,
      scope: SCOPES,
      redirect_uri: redirectUri(),
      state: 'lifeos',
    });
    return Response.redirect(url, 302);
  }

  if (req.method === 'GET' && path[0] === 'callback') {
    const params = new URL(req.url).searchParams;
    if (params.get('state') !== 'lifeos' || !params.get('code')) {
      return Response.redirect(`${origin()}/settings?spotify=error`, 302);
    }
    const data = await exchangeCode(params.get('code')!, redirectUri());
    await db().insert(t.spotifyTokens)
      .values({ id: 'default', refreshToken: data.refresh_token, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: t.spotifyTokens.id,
        set: { refreshToken: data.refresh_token, updatedAt: new Date() },
      });
    return Response.redirect(`${origin()}/settings?spotify=connected`, 302);
  }

  if (req.method === 'GET' && path[0] === 'status') {
    return Response.json({ connected: await connected(), configured: !!getConfig().spotify.clientId });
  }

  // Control = local Spotify.app via AppleScript. Always works, no Premium.
  if (req.method === 'POST' && path[0] === 'control') {
    const { action } = await req.json();
    try {
      await localControl(action);
      return Response.json({ ok: true });
    } catch (e) {
      if ((e as { status?: number }).status === 400) return Response.json({ error: 'unknown action' }, { status: 400 });
      return Response.json({ error: `Spotify app control failed: ${String(e).slice(0, 120)}` }, { status: 500 });
    }
  }

  // Access token for the Web Playback SDK (browser-side player).
  if (req.method === 'GET' && path[0] === 'token') {
    const { spotifyAccessToken } = await import('@/lib/spotify');
    return Response.json({ token: await spotifyAccessToken() });
  }

  if (req.method === 'GET' && path[0] === 'devices') {
    const data = await spfetch('/me/player/devices');
    return Response.json((data?.devices ?? []).map((d: {
      id: string; name: string; type: string; is_active: boolean;
    }) => ({ id: d.id, name: d.name, type: d.type, active: d.is_active })));
  }

  // Play a specific track/playlist — local app, one AppleScript call.
  if (req.method === 'POST' && path[0] === 'play') {
    const { uris, contextUri } = await req.json();
    const uri = contextUri ?? (uris?.length ? uris[0] : null);
    if (!uri) return Response.json({ error: 'uri required' }, { status: 400 });
    try {
      await localPlayUri(uri);
      return Response.json({ ok: true });
    } catch (e) {
      return Response.json({ error: `Play failed: ${String(e).slice(0, 120)}` }, { status: 500 });
    }
  }

  // Transfer playback to a device (e.g. the in-browser SDK player).
  if (req.method === 'POST' && path[0] === 'transfer') {
    const { deviceId, play } = await req.json();
    if (!deviceId) return Response.json({ error: 'deviceId required' }, { status: 400 });
    await spfetch('/me/player', 'PUT', { device_ids: [deviceId], play: play !== false });
    return Response.json({ ok: true });
  }

  if (req.method === 'GET' && path[0] === 'search') {
    const q = new URL(req.url).searchParams.get('q') ?? '';
    if (!q.trim()) return Response.json({ tracks: [] });
    const data = await spfetch(`/search?type=track&limit=12&q=${encodeURIComponent(q)}`);
    return Response.json({ tracks: (data?.tracks?.items ?? []).map(slim) });
  }

  if (req.method === 'GET' && path[0] === 'playlists') {
    const data = await spfetch('/me/playlists?limit=50');
    return Response.json((data?.items ?? []).map((p: {
      id: string; name: string; uri?: string; images?: { url: string }[];
      tracks?: { total: number }; external_urls?: { spotify?: string };
    }) => ({
      id: p.id, name: p.name,
      uri: p.uri ?? null,
      art: p.images?.at(-1)?.url ?? null,
      total: p.tracks?.total ?? 0,
      url: p.external_urls?.spotify ?? null,
    })));
  }

  if (req.method === 'GET' && path[0] === 'playlist' && path[1]) {
    const data = await spfetch(`/playlists/${path[1]}/tracks?limit=100`);
    return Response.json(
      (data?.items ?? [])
        .filter((i: { track: Track | null }) => i.track)
        .map((i: { track: Track }) => slim(i.track)),
    );
  }

  if (req.method === 'GET' && path[0] === 'recent') {
    const [recent, top] = await Promise.all([
      spfetch('/me/player/recently-played?limit=15'),
      spfetch('/me/top/tracks?limit=10&time_range=short_term'),
    ]);
    return Response.json({
      recent: (recent?.items ?? []).map((i: { track: Track; played_at: string }) => ({
        ...slim(i.track), playedAt: i.played_at,
      })),
      top: (top?.items ?? []).map(slim),
    });
  }
  return null;
}

async function dashboardData() {
  // Local app first: freshest truth, works even without the OAuth connect.
  const local = await localState().catch(() => null);
  if (local?.track) return { connected: true, ...local };
  if (!(await connected())) return { connected: local ? true : false, playing: local?.playing ?? false, track: null };
  try {
    const now = await spfetch('/me/player/currently-playing');
    if (now?.item) {
      return { connected: true, playing: true, track: slim(now.item as Track) };
    }
    const recent = await spfetch('/me/player/recently-played?limit=1');
    const last = recent?.items?.[0];
    return {
      connected: true,
      playing: false,
      track: last ? slim(last.track as Track) : null,
    };
  } catch (e) {
    return { connected: true, error: String(e) };
  }
}

export const spotify: ModuleManifest = {
  enabled: () => Boolean(getConfig().spotify.clientId && getConfig().spotify.clientSecret),
  id: 'spotify',
  name: 'Spotify',
  tileSize: 'sm',
  api,
  dashboardData,
};
