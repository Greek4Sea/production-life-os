'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BackIcon } from '@/ui/icons';

type FullMail = {
  id: string; threadId: string; from: string; to: string; date: string;
  subject: string; html: string | null; text: string;
};

const metaStyle = { fontSize: 12, color: 'var(--text-faint)' } as const;

// Emails are designed for a white canvas — render them in a sandboxed iframe
// (no scripts, links open in a new tab) with a few taming styles injected.
const frameDoc = (html: string) =>
  '<!doctype html><base target="_blank"><style>' +
  'body{margin:10px;font:14px/1.5 -apple-system,system-ui,sans-serif;color:#111;background:#fff;word-break:break-word}' +
  'img{max-width:100%;height:auto}' +
  '</style>' + html;

export function Reader({ id }: { id: string }) {
  const [mail, setMail] = useState<FullMail | null>(null);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState<'ai' | 'save' | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`/api/mod/gmail/message/${id}`).then((r) => r.json())
      .then((d) => (d.id ? setMail(d) : setError(d.error ?? 'failed to load')))
      .catch(() => setError('offline'));
  }, [id]);

  const aiDraft = async () => {
    setBusy('ai'); setMsg('');
    try {
      const r = await fetch('/api/mod/gmail/ai-draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, instruction, current: draft.trim() || undefined }),
      });
      const j = await r.json();
      if (j.draft) { setDraft(j.draft); setInstruction(''); }
      else setMsg(`AI couldn't draft: ${j.error ?? 'empty response'}`);
    } catch { setMsg('AI drafting failed — try again.'); }
    finally { setBusy(null); }
  };

  const sendToGmail = async () => {
    setBusy('save'); setMsg('');
    try {
      const r = await fetch('/api/mod/gmail/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, body: draft }),
      });
      const j = await r.json();
      if (j.url) {
        setMsg('Draft saved to the thread — hit Send in Gmail.');
        window.open(j.url, '_blank');
      } else setMsg(`Couldn't save draft: ${j.error ?? 'unknown error'}`);
    } catch { setMsg('Couldn’t save the draft — try again.'); }
    finally { setBusy(null); }
  };

  return (
    <>
      <header className="page-header">
        <Link href="/m/gmail" className="back-btn" aria-label="Back to inbox"><BackIcon /></Link>
        <h1>Email</h1>
      </header>

      {!mail && !error && <div className="tile-empty"><span className="spin" /></div>}
      {error && <div className="card"><div className="tile-empty">Couldn&apos;t load: {error}</div></div>}

      {mail && (
        <>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{mail.subject}</div>
            <div style={metaStyle}>From {mail.from}</div>
            {mail.to && <div style={metaStyle}>To {mail.to}</div>}
            {mail.date && <div style={metaStyle}>{mail.date}</div>}
          </div>

          <div className="card" style={{ padding: mail.html ? 0 : '14px 16px', overflow: 'hidden' }}>
            {mail.html ? (
              <iframe
                title="Email body"
                sandbox="allow-popups allow-popups-to-escape-sandbox"
                srcDoc={frameDoc(mail.html)}
                style={{ width: '100%', height: '55vh', border: 'none', background: '#fff', display: 'block' }}
              />
            ) : (
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{mail.text}</div>
            )}
          </div>

          <section className="section">
            <h2 className="section-title">Reply</h2>
            <div className="card" style={{ padding: '12px 14px', display: 'grid', gap: 8 }}>
              <textarea
                className="text-input"
                rows={7}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write your reply, or let the AI draft it…"
                style={{ resize: 'vertical', minHeight: 120, fontFamily: 'inherit' }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="text-input"
                  style={{ flex: 1, minWidth: 0 }}
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && busy === null) aiDraft(); }}
                  placeholder={draft.trim()
                    ? 'How should the AI change it? (shorter, more formal…)'
                    : 'Anything the AI should know? (optional)'}
                />
                <button className="btn small" onClick={aiDraft} disabled={busy !== null}>
                  {busy === 'ai' ? <span className="spin" /> : draft.trim() ? '✦ Refine' : '✦ Draft'}
                </button>
              </div>
              <button
                className="btn primary"
                onClick={sendToGmail}
                disabled={busy !== null || !draft.trim()}
              >
                {busy === 'save' ? <span className="spin" /> : 'Save draft → send in Gmail'}
              </button>
              {msg && <p className="pill-note" role="status" style={{ margin: 0 }}>{msg}</p>}
            </div>
          </section>
        </>
      )}
    </>
  );
}
