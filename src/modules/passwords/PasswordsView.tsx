'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BackIcon, LockIcon } from '@/ui/icons';

type Entry = { category: string; name: string; path: string; mtime: number };
type Field = { key: string; value: string };

const SECRET = /pass|pin|secret|code|cvv|token/i;

const CATEGORY_ICONS: Record<string, string> = {
  Web: '🌐', Email: '✉️', Banking: '🏦', Work: '💼', School: '🎓',
  Devices: '💻', Wifi: '📶', Cards: '💳', Ids: '🪪', Other: '🗂',
};

// Pull the `- **key**: `value`` lines out of an entry's markdown.
function parseFields(md: string): { fields: Field[]; notes: string } {
  const fields: Field[] = [];
  const noteLines: string[] = [];
  let fmCount = 0, inOriginal = false;
  for (const line of md.split('\n')) {
    if (line.trim() === '---' && fmCount < 2) { fmCount++; continue; }
    if (fmCount < 2) continue;
    if (line.startsWith('## ')) { inOriginal = true; continue; }
    if (inOriginal || line.startsWith('# ')) continue;
    const m = line.match(/^- \*\*(.+?)\*\*: `?(.*?)`?$/);
    if (m) fields.push({ key: m[1], value: m[2] });
    else if (line.trim()) noteLines.push(line);
  }
  return { fields, notes: noteLines.join('\n').trim() };
}

export function PasswordsView() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [query, setQuery] = useState('');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [chat, setChat] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [open, setOpen] = useState<{ entry: Entry; fields: Field[]; notes: string } | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState('');

  const load = () =>
    fetch('/api/mod/passwords/list').then((r) => r.json())
      .then((d) => Array.isArray(d) && setEntries(d)).catch(() => {});
  useEffect(() => { load(); }, []);

  const add = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setChat((c) => [...c, { role: 'user', text }]);
    setBusy(true);
    fetch('/api/mod/passwords/add', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    }).then((r) => r.json()).then((d) => {
      setChat((c) => [...c, {
        role: 'ai',
        text: d.ok
          ? `${d.updated ? 'Updated' : 'Saved'} 🔒 ${d.entry?.service ?? ''} → ${d.path}`
          : (d.error ?? 'failed'),
      }]);
      if (d.ok) load();
    }).catch(() => setChat((c) => [...c, { role: 'ai', text: 'offline' }]))
      .finally(() => setBusy(false));
  };

  const openEntry = (entry: Entry) => {
    setRevealed(new Set());
    fetch(`/api/mod/passwords/entry?path=${encodeURIComponent(entry.path)}`)
      .then((r) => r.json())
      .then((d) => d.text && setOpen({ entry, ...parseFields(d.text) }))
      .catch(() => {});
  };

  const del = (entry: Entry) => {
    if (!confirm(`Delete ${entry.name}? This cannot be undone.`)) return;
    fetch(`/api/mod/passwords/entry?path=${encodeURIComponent(entry.path)}`, { method: 'DELETE' })
      .then(() => { setOpen(null); load(); }).catch(() => {});
  };

  const copy = (f: Field) => {
    navigator.clipboard.writeText(f.value).then(() => {
      setCopied(f.key);
      setTimeout(() => setCopied(''), 1200);
    }).catch(() => {});
  };

  const toggleReveal = (key: string) =>
    setRevealed((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  const q = query.trim().toLowerCase();
  const filtered = (entries ?? []).filter((e) =>
    !q || e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q));
  const cats = [...new Set(filtered.map((e) => e.category))];

  return (
    <div className="tasks-page">
      <header className="page-header">
        <Link href="/" className="back-btn" aria-label="Back to dashboard"><BackIcon /></Link>
        <h1>Passwords</h1>
      </header>

      <div className="tasks-split">
        {/* chat: the local AI files whatever you paste */}
        <div className="tasks-chat">
          <div className="tasks-chat-log">
            {chat.length === 0 && (
              <div className="tile-empty" style={{ padding: 20, textAlign: 'center' }}>
                Paste any credentials —<br />
                “netflix x@y.com pass hunter2 pin 4421”<br />
                — and I&apos;ll file them, organized.
              </div>
            )}
            {chat.map((m, i) => <div className={`tchat-msg ${m.role}`} key={i}>{m.text}</div>)}
            {busy && <div className="tchat-msg ai tchat-thinking">organizing…</div>}
          </div>
          <div className="tasks-chat-input">
            <textarea className="text-input" rows={2} value={input} disabled={busy}
              placeholder="Paste credentials…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(); } }} />
            <button className="btn primary" onClick={add} disabled={busy || !input.trim()}>↑</button>
          </div>
        </div>

        <div className="tasks-list">
          <input className="text-input" value={query} placeholder="Search passwords…"
            style={{ width: '100%', marginBottom: 12 }}
            onChange={(e) => setQuery(e.target.value)} />
          {open ? (
        <section className="section">
          <div className="pw-entry-head">
            <span className="pw-entry-icon">{CATEGORY_ICONS[open.entry.category] ?? '🗂'}</span>
            <div>
              <h2 className="pw-entry-name">{open.entry.name}</h2>
              <div className="s">{open.entry.category}</div>
            </div>
            <button className="btn small" style={{ marginLeft: 'auto' }} onClick={() => setOpen(null)}>← Back</button>
          </div>
          <div className="card pw-fields">
            {open.fields.map((f) => {
              const secret = SECRET.test(f.key) && f.key !== 'url';
              const shown = !secret || revealed.has(f.key);
              return (
                <div className="pw-field" key={f.key}>
                  <div className="pw-field-main">
                    <div className="pw-field-label">{f.key}</div>
                    <div className={`pw-field-value${secret ? ' secret' : ''}`}>
                      {shown ? f.value : '•'.repeat(Math.min(f.value.length, 14))}
                    </div>
                  </div>
                  {secret && (
                    <button className="btn small" onClick={() => toggleReveal(f.key)}>
                      {shown ? 'hide' : 'show'}
                    </button>
                  )}
                  <button className="btn small" onClick={() => copy(f)}>
                    {copied === f.key ? '✓' : 'copy'}
                  </button>
                </div>
              );
            })}
            {open.notes && <div className="pw-notes">{open.notes}</div>}
          </div>
          <button className="btn danger" style={{ marginTop: 12 }} onClick={() => del(open.entry)}>
            Delete entry
          </button>
        </section>
      ) : (
        <>
          {cats.map((cat) => (
            <section className="section" key={cat}>
              <h2 className="section-title">
                {CATEGORY_ICONS[cat] ?? '🗂'} {cat}
                <span className="pw-count">{filtered.filter((e) => e.category === cat).length}</span>
              </h2>
              <div className="pw-grid">
                {filtered.filter((e) => e.category === cat).map((e) => (
                  <button className="pw-card" key={e.path} onClick={() => openEntry(e)}>
                    <span className="pw-card-lock"><LockIcon /></span>
                    <span className="pw-card-name">{e.name}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
          {entries !== null && filtered.length === 0 && (
            <div className="card"><div className="tile-empty">
              {q ? 'No matches' : 'Nothing stored yet — paste credentials in the chat'}
            </div></div>
          )}
        </>
          )}
        </div>
      </div>
    </div>
  );
}
