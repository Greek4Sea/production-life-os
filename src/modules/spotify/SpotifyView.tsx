'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BackIcon } from '@/ui/icons';

type Track = { name: string; uri: string | null; artist: string; art: string | null; artBig: string | null; url: string | null; playedAt?: string };
type Playlist = { id: string; name: string; uri: string | null; art: string | null; total: number; url: string | null };

const ago = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

function Row({ tr, right, onPlay }: { tr: Track; right?: string; onPlay: (tr: Track) => void }) {
  return (
    <div className="tile-row sp-track" role="button" tabIndex={0}
      onClick={() => onPlay(tr)}
      onKeyDown={(e) => e.key === 'Enter' && onPlay(tr)}>
      {tr.art && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={tr.art} alt="" className="sp-thumb" />
      )}
      <div className="what">
        <div className="t">{tr.name}</div>
        <div className="s">{tr.artist}</div>
      </div>
      {right && <span className="when" style={{ minWidth: 'auto' }}>{right}</span>}
      <span className="sp-play-hint">▶</span>
    </div>
  );
}

export function SpotifyView() {
  const [state, setState] = useState<'loading' | 'ok' | 'disconnected' | 'error'>('loading');
  const [recent, setRecent] = useState<Track[]>([]);
  const [top, setTop] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[] | null>(null);
  const [openPlaylist, setOpenPlaylist] = useState<Playlist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<Track[] | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [playMsg, setPlayMsg] = useState('');

  // One call — the server drives the local Spotify app directly.
  const playOn = async (body: { uris?: string[]; contextUri?: string }) => {
    setPlayMsg('');
    const res = await fetch('/api/mod/spotify/play', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!res) { setPlayMsg('Offline'); return; }
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setPlayMsg(j.error ?? 'Playback failed');
    }
  };
  const playTrack = (tr: Track) => {
    if (tr.uri) playOn({ uris: [tr.uri] });
    else if (tr.url) window.open(tr.url, '_blank');
  };
  useEffect(() => {
    fetch('/api/mod/spotify/status').then((r) => r.json()).then((s) => {
      if (!s.connected) { setState('disconnected'); return; }
      Promise.all([
        fetch('/api/mod/spotify/recent').then((r) => r.json()),
        fetch('/api/mod/spotify/playlists').then((r) => r.json()),
      ]).then(([d, pls]) => {
        if (d.error) { setState('error'); return; }
        setRecent(d.recent ?? []);
        setTop(d.top ?? []);
        setPlaylists(Array.isArray(pls) ? pls : []);
        setState('ok');
      }).catch(() => setState('error'));
    }).catch(() => setState('error'));
  }, []);

  // Debounced live search.
  const onQuery = (q: string) => {
    setQuery(q);
    clearTimeout(searchTimer.current);
    if (!q.trim()) { setResults(null); return; }
    searchTimer.current = setTimeout(() => {
      fetch(`/api/mod/spotify/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setResults(d.tracks ?? []))
        .catch(() => {});
    }, 350);
  };

  const showPlaylist = (p: Playlist) => {
    setOpenPlaylist(p);
    setPlaylistTracks(null);
    fetch(`/api/mod/spotify/playlist/${p.id}`)
      .then((r) => r.json())
      .then((d) => setPlaylistTracks(Array.isArray(d) ? d : []))
      .catch(() => setPlaylistTracks([]));
  };

  return (
    <>
      <header className="page-header">
        <Link href="/" className="back-btn" aria-label="Back to dashboard"><BackIcon /></Link>
        <h1>Spotify</h1>
        <input
          className="text-input sp-search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search songs, artists…"
        />
      </header>

      {state === 'loading' && <div className="tile-empty"><span className="spin" /></div>}
      {state === 'disconnected' && (
        <div className="card"><div className="tile-empty">Not connected — Settings → Spotify → Connect.</div></div>
      )}
      {state === 'error' && (
        <div className="card"><div className="tile-empty">Couldn&apos;t reach Spotify — if you just added permissions, hit Reconnect in Settings.</div></div>
      )}

      {playMsg && <div className="sp-err" role="alert">{playMsg}</div>}

      {state === 'ok' && (
        <div className="sp-layout">
          <aside className="sp-library">
            <h2 className="section-title">Your library</h2>
            {playlists.map((p) => (
              <button
                className={`sp-pl${openPlaylist?.id === p.id ? ' active' : ''}`}
                key={p.id} onClick={() => showPlaylist(p)}
              >
                {p.art
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={p.art} alt="" className="sp-thumb" />
                  : <span className="sp-thumb sp-thumb-empty">♪</span>}
                <span className="pl-meta">
                  <span className="t">{p.name}</span>
                  <span className="s">{p.total} songs</span>
                </span>
              </button>
            ))}
          </aside>

          <div className="sp-main">
            {results !== null ? (
              <section className="section">
                <h2 className="section-title">Search results</h2>
                <div className="card">
                  {results.length === 0 && <div className="tile-empty">No matches</div>}
                  {results.map((tr, i) => <Row tr={tr} key={i} onPlay={playTrack} />)}
                </div>
              </section>
            ) : openPlaylist ? (
              <section className="section">
                <div className="sp-pl-head">
                  <h2 className="section-title" style={{ marginBottom: 0 }}>{openPlaylist.name}</h2>
                  <button className="btn small" onClick={() => setOpenPlaylist(null)}>← Back</button>
                  {openPlaylist.uri && (
                    <button className="btn small"
                      onClick={() => playOn({ contextUri: openPlaylist.uri! })}>▶ Play all</button>
                  )}
                  {openPlaylist.url && (
                    <a className="btn small" href={openPlaylist.url} target="_blank" rel="noreferrer">Open ↗</a>
                  )}
                </div>
                <div className="card">
                  {!playlistTracks && <div className="tile-empty"><span className="spin" /></div>}
                  {playlistTracks?.map((tr, i) => <Row tr={tr} key={i} onPlay={playTrack} />)}
                </div>
              </section>
            ) : (
              <>
                <section className="section">
                  <h2 className="section-title">Recently played</h2>
                  <div className="card">
                    {recent.map((tr, i) => <Row tr={tr} key={i} right={tr.playedAt ? ago(tr.playedAt) : undefined} onPlay={playTrack} />)}
                  </div>
                </section>
                {top.length > 0 && (
                  <section className="section">
                    <h2 className="section-title">Your top tracks this month</h2>
                    <div className="card">
                      {top.map((tr, i) => <Row tr={tr} key={i} right={`#${i + 1}`} onPlay={playTrack} />)}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <a className="btn" href="https://open.spotify.com" target="_blank" rel="noreferrer"
        style={{ width: '100%', marginBottom: 8, marginTop: 12 }}>
        Open Spotify
      </a>
    </>
  );
}
