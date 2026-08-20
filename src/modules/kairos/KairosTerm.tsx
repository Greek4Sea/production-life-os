'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BackIcon } from '@/ui/icons';
import { mdToHtml } from '@/ui/md';

// Kairos: Claude Code (bypass permissions) in its own ~/kairos project —
// terminal attached to the persistent tmux session, file panel on the side.

type XTerm = {
  open: (el: HTMLElement) => void;
  write: (d: Uint8Array | string) => void;
  onData: (cb: (d: string) => void) => void;
  focus: () => void;
  dispose: () => void;
  loadAddon: (a: unknown) => void;
  cols: number;
  rows: number;
};
declare global {
  interface Window {
    Terminal?: new (opts: Record<string, unknown>) => XTerm;
    FitAddon?: { FitAddon: new () => { fit: () => void } };
  }
}

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(src));
    document.body.appendChild(s);
  });

type Listing = { dir: string; dirs: string[]; files: { name: string; path: string; size: number }[] };

function FilePanel({ onClose }: { onClose?: () => void }) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [preview, setPreview] = useState<{ name: string; text: string; md: boolean } | null>(null);

  const openDir = (dir: string) =>
    fetch(`/api/mod/kairos/list?dir=${encodeURIComponent(dir)}`)
      .then((r) => r.json()).then((d) => !d.error && setListing(d)).catch(() => {});
  useEffect(() => { openDir(''); }, []);

  const openFile = (p: string, name: string) =>
    fetch(`/api/mod/kairos/file?path=${encodeURIComponent(p)}`)
      .then((r) => r.json())
      .then((d) => d.text !== undefined && setPreview({ name, text: d.text, md: name.endsWith('.md') }))
      .catch(() => {});

  const crumbs = listing?.dir ? listing.dir.split('/') : [];
  return (
    <div className="kfiles">
      <div className="kfiles-bar">
        <button className="btn small" onClick={() => openDir('')}>kairos</button>
        {crumbs.map((c, i) => (
          <button className="btn small" key={i} onClick={() => openDir(crumbs.slice(0, i + 1).join('/'))}>{c}</button>
        ))}
        <button className="btn small" style={{ marginLeft: 'auto' }}
          onClick={() => listing && openDir(listing.dir)} aria-label="Refresh">↻</button>
        {onClose && <button className="btn small" onClick={onClose}>✕</button>}
      </div>
      <div className="kfiles-list">
        {listing?.dirs.map((d) => (
          <button className="kfile" key={d}
            onClick={() => openDir(listing.dir ? `${listing.dir}/${d}` : d)}>📁 {d}</button>
        ))}
        {listing?.files.map((f) => (
          <button className="kfile" key={f.path} onClick={() => openFile(f.path, f.name)}>📄 {f.name}</button>
        ))}
      </div>
      {preview && (
        <div className="overlayx" onClick={() => setPreview(null)}>
          <div className="sheetx" onClick={(e) => e.stopPropagation()}>
            <div className="sheetx-bar">
              <span className="t">{preview.name}</span>
              <button className="btn small" onClick={() => setPreview(null)}>✕</button>
            </div>
            {preview.md
              ? <div className="ob-note sheetx-body" dangerouslySetInnerHTML={{ __html: mdToHtml(preview.text) }} />
              : <pre className="sheetx-body sheetx-pre">{preview.text}</pre>}
          </div>
        </div>
      )}
    </div>
  );
}

export function KairosTerm() {
  const holder = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<XTerm | null>(null);
  const [status, setStatus] = useState('connecting…');
  const [gen, setGen] = useState(0);
  const [showFiles, setShowFiles] = useState(false); // phone drawer

  useEffect(() => {
    let dead = false;
    let ws: WebSocket | null = null;
    let term: XTerm | null = null;
    (async () => {
      try {
        await Promise.all([loadScript('/xterm/xterm.min.js'), loadScript('/xterm/addon-fit.min.js')]);
        const t = await fetch('/api/mod/kairos/ticket').then((r) => r.json());
        if (t.error || !t.ticket) { setStatus(t.error ?? 'no ticket'); return; }
        if (dead || !holder.current || !window.Terminal || !window.FitAddon) return;

        term = new window.Terminal({
          fontSize: 13, fontFamily: 'ui-monospace, Menlo, monospace',
          theme: { background: '#0d1117' }, cursorBlink: true, scrollback: 5000,
        });
        const fit = new window.FitAddon.FitAddon();
        term.loadAddon(fit);
        term.open(holder.current);
        termRef.current = term;

        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        ws = new WebSocket(`${proto}://${location.host}/kairos/term?ticket=${t.ticket}`);
        ws.binaryType = 'arraybuffer';
        wsRef.current = ws;
        const sendSize = () => {
          if (ws?.readyState === 1 && term)
            ws.send(JSON.stringify({ t: 'r', cols: term.cols, rows: term.rows }));
        };
        ws.onopen = () => { fit.fit(); sendSize(); setStatus('connected'); term?.focus(); };
        ws.onmessage = (ev) =>
          term?.write(typeof ev.data === 'string' ? ev.data : new Uint8Array(ev.data as ArrayBuffer));
        ws.onclose = () => setStatus('disconnected — ↻ to reconnect (session keeps running)');
        ws.onerror = () => setStatus('connection error');
        term.onData((d) => ws?.readyState === 1 && ws.send(JSON.stringify({ t: 'i', d })));
        const ro = new ResizeObserver(() => { try { fit.fit(); sendSize(); } catch { /* noop */ } });
        ro.observe(holder.current);
        window.visualViewport?.addEventListener('resize', () => { try { fit.fit(); sendSize(); } catch { /* noop */ } });
      } catch {
        setStatus('failed to load terminal');
      }
    })();
    return () => { dead = true; ws?.close(); term?.dispose(); };
  }, [gen]);

  const key = (d: string) => {
    if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ t: 'i', d }));
    termRef.current?.focus();
  };

  return (
    <div className="kterm">
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/xterm/xterm.css" />
      <header className="page-header">
        <Link href="/" className="back-btn" aria-label="Back to dashboard"><BackIcon /></Link>
        <h1>Kairos</h1>
        <span className="s kterm-status">{status}</span>
        <button className="btn small kterm-claude"
          onClick={() => key('cd ~/kairos && claude --dangerously-skip-permissions\r')}
          title="Start Kairos (Claude Code, bypass permissions) in ~/kairos">▶ Claude</button>
        <button className="btn small kterm-filesbtn" onClick={() => setShowFiles(true)}>Files</button>
        <button className="btn small" onClick={() => setGen((g) => g + 1)} aria-label="Reconnect">↻</button>
      </header>

      <div className="kterm-split">
        <div className="kterm-side"><FilePanel /></div>
        <div className="kterm-screen" ref={holder} />
      </div>

      <div className="kterm-keys">
        <button onClick={() => key('\x1b')}>esc</button>
        <button onClick={() => key('\t')}>tab</button>
        <button onClick={() => key('\x03')}>ctrl-c</button>
        <button onClick={() => key('\x1b[A')}>↑</button>
        <button onClick={() => key('\x1b[B')}>↓</button>
        <button onClick={() => key('\x1b[D')}>←</button>
        <button onClick={() => key('\x1b[C')}>→</button>
        <button onClick={() => key('\r')}>enter</button>
      </div>

      {showFiles && (
        <div className="kterm-drawer" onClick={() => setShowFiles(false)}>
          <div className="kterm-drawer-panel" onClick={(e) => e.stopPropagation()}>
            <FilePanel onClose={() => setShowFiles(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
