'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BackIcon } from '@/ui/icons';

type NoteMeta = { name: string; path: string; mtime: number };
type Listing = { dir: string; dirs: string[]; notes: NoteMeta[] };
type Hit = NoteMeta & { snippet: string | null };

const ago = (ms: number) => {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 60) return `${min}m`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d}d` : `${Math.round(d / 30)}mo`;
};

import { mdToHtml } from '@/ui/md';

export function ObsidianView() {
  const [listing, setListing] = useState<Listing | null>(null);
  const [note, setNote] = useState<{ name: string; path: string; text: string } | null>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [capture, setCapture] = useState('');
  const [captureMsg, setCaptureMsg] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const saveNote = (path: string, text: string, thenOpen = true) =>
    fetch('/api/mod/obsidian/write', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path, text }),
    }).then((r) => r.json()).then((d) => {
      if (d.ok && thenOpen) { setEditing(false); setNote({ name: path.split('/').pop()!.replace(/\.md$/, ''), path, text }); }
      else if (d.error) setError(d.error);
    }).catch(() => setError('offline'));

  const newNote = () => {
    const name = prompt('Note name:');
    if (!name?.trim()) return;
    const clean = name.trim().replace(/[/\\]/g, '-');
    const dir = listing?.dir ? `${listing.dir}/` : 'My Notes/';
    const path = `${dir}${clean}.md`;
    setNote({ name: clean, path, text: `# ${clean}\n\n` });
    setDraft(`# ${clean}\n\n`);
    setEditing(true);
  };

  const openDir = (dir: string) => {
    setNote(null); setHits(null); setQuery('');
    fetch(`/api/mod/obsidian/list?dir=${encodeURIComponent(dir)}`)
      .then((r) => r.json())
      .then((d) => d.error ? setError(d.error) : setListing(d))
      .catch(() => setError('offline'));
  };

  const openNote = (path: string) => {
    fetch(`/api/mod/obsidian/note?path=${encodeURIComponent(path)}`)
      .then((r) => r.json())
      .then((d) => d.error ? setError(d.error) : setNote(d))
      .catch(() => setError('offline'));
  };

  // Wikilink taps: resolve by title through search.
  const openByTitle = (title: string) => {
    fetch(`/api/mod/obsidian/search?q=${encodeURIComponent(title)}`)
      .then((r) => r.json())
      .then((d) => {
        const hit = (d.hits ?? []).find((h: Hit) => h.name.toLowerCase() === title.toLowerCase())
          ?? d.hits?.[0];
        if (hit) openNote(hit.path);
      }).catch(() => {});
  };

  useEffect(() => { openDir(''); }, []);

  const onQuery = (q: string) => {
    setQuery(q);
    clearTimeout(searchTimer.current);
    if (!q.trim()) { setHits(null); return; }
    searchTimer.current = setTimeout(() => {
      fetch(`/api/mod/obsidian/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json()).then((d) => setHits(d.hits ?? [])).catch(() => {});
    }, 300);
  };

  const doCapture = () => {
    if (!capture.trim()) return;
    setCaptureMsg('');
    fetch('/api/mod/obsidian/capture', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: capture }),
    }).then((r) => r.json()).then((d) => {
      if (d.ok) { setCapture(''); setCaptureMsg(`saved to ${d.path}`); }
      else setCaptureMsg(d.error ?? 'failed');
    }).catch(() => setCaptureMsg('offline'));
  };

  const crumbs = listing?.dir ? listing.dir.split('/') : [];

  return (
    <>
      <header className="page-header">
        <Link href="/" className="back-btn" aria-label="Back to dashboard"><BackIcon /></Link>
        <h1>Notes</h1>
        <input className="text-input sp-search" value={query}
          onChange={(e) => onQuery(e.target.value)} placeholder="Search vault…" />
      </header>

      <div className="ob-capture">
        <input className="text-input" value={capture} placeholder="Quick capture → today's daily note"
          onChange={(e) => setCapture(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doCapture()} />
        <button className="btn small" onClick={doCapture}>Add</button>
      </div>
      {captureMsg && <div className="s" style={{ padding: '0 0 10px' }}>{captureMsg}</div>}
      {error && <div className="card"><div className="tile-empty">{error}</div></div>}

      {hits !== null ? (
        <section className="section">
          <h2 className="section-title">Search results</h2>
          <div className="card">
            {hits.length === 0 && <div className="tile-empty">No matches</div>}
            {hits.map((h) => (
              <button className="tile-row ob-row" key={h.path} onClick={() => { setHits(null); setQuery(''); openNote(h.path); }}>
                <div className="what">
                  <div className="t">{h.name}</div>
                  <div className="s">{h.snippet ?? h.path}</div>
                </div>
                <span className="when">{ago(h.mtime)}</span>
              </button>
            ))}
          </div>
        </section>
      ) : note ? (
        <section className="section">
          <div className="sp-pl-head">
            <h2 className="section-title" style={{ marginBottom: 0 }}>{note.name}</h2>
            <button className="btn small" onClick={() => { setEditing(false); setNote(null); }}>← Back</button>
            {editing ? (
              <button className="btn small primary" onClick={() => saveNote(note.path, draft)}>Save</button>
            ) : (
              <button className="btn small" onClick={() => { setDraft(note.text); setEditing(true); }}>✏️ Edit</button>
            )}
          </div>
          {editing ? (
            <textarea className="text-input ob-editor" value={draft}
              onChange={(e) => setDraft(e.target.value)} spellCheck={false} />
          ) : (
            <div className="card ob-note"
              onClick={(e) => {
                const t = (e.target as HTMLElement).closest('a.ob-wiki');
                if (t) openByTitle(t.getAttribute('data-note') ?? '');
              }}
              dangerouslySetInnerHTML={{ __html: mdToHtml(note.text) }} />
          )}
        </section>
      ) : listing && (
        <section className="section">
          <div className="ob-crumbs">
            <button className="btn small" onClick={() => openDir('')}>vault</button>
            {crumbs.map((c, i) => (
              <button className="btn small" key={i}
                onClick={() => openDir(crumbs.slice(0, i + 1).join('/'))}>{c}</button>
            ))}
            <button className="btn small primary" style={{ marginLeft: 'auto' }} onClick={newNote}>＋ New note</button>
          </div>
          <div className="card">
            {listing.dirs.map((d) => (
              <button className="tile-row ob-row" key={d}
                onClick={() => openDir(listing.dir ? `${listing.dir}/${d}` : d)}>
                <div className="what"><div className="t">📁 {d}</div></div>
              </button>
            ))}
            {listing.notes.map((n) => (
              <button className="tile-row ob-row" key={n.path} onClick={() => openNote(n.path)}>
                <div className="what"><div className="t">{n.name}</div></div>
                <span className="when">{ago(n.mtime)}</span>
              </button>
            ))}
            {listing.dirs.length === 0 && listing.notes.length === 0 && (
              <div className="tile-empty">Empty folder</div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
