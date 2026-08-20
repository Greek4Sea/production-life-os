'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BackIcon } from '@/ui/icons';

type Mail = {
  id: string; threadId: string; fromAddr: string; subject: string | null;
  snippet: string | null; category: string; summary: string | null;
  unread: boolean; receivedAt: string | null;
};

const fromName = (addr: string) => addr.replace(/<.*>/, '').replace(/"/g, '').trim() || addr;

const when = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(' ', '').toLowerCase()
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

function MailRow({ m, onRead }: { m: Mail; onRead: (id: string) => void }) {
  // Opens the in-app reader, which marks it read (here + Gmail + the bell).
  return (
    <Link
      className={`tile-row mail-row ${m.unread ? 'unread' : 'read'}`}
      href={`/m/gmail/${m.id}`}
    >
      <span className="dot" aria-hidden />
      <div className="what">
        <div className="t">{fromName(m.fromAddr)} · {m.subject}</div>
        {m.summary && <div className="mail-sum">{m.summary}</div>}
      </div>
      <span className="when" style={{ minWidth: 'auto' }}>{when(m.receivedAt)}</span>
      {m.unread && (
        <button
          className="mark-read" aria-label="Mark as read" title="Mark as read"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRead(m.id); }}
        >✓</button>
      )}
    </Link>
  );
}

export function Inbox() {
  const [mails, setMails] = useState<Mail[] | null>(null);
  const [showNoise, setShowNoise] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = () =>
    fetch('/api/mod/gmail/messages').then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) { setMails(data); setError(''); }
      else setError(data.error ?? 'failed to load');
    }).catch(() => setError('offline'));

  // Header ↻: pull from Gmail right now, then reload the list.
  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    fetch('/api/mod/gmail/sync', { method: 'POST' })
      .then((r) => r.json())
      .then((d) => { if (d?.error) setError(d.error); })
      .catch(() => {})
      .finally(() => { load().finally(() => setRefreshing(false)); });
  };

  useEffect(() => {
    load();
    // Refresh whenever the inbox comes back to the foreground, and every 2 min
    // while it stays open (mails only change when a background sync lands).
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(onVisible, 120_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markRead = (id: string) => {
    setMails((cur) => cur?.map((m) => m.id === id ? { ...m, unread: false } : m) ?? cur);
    fetch(`/api/mod/gmail/read/${id}`, { method: 'POST' }).catch(() => {});
  };

  const important = mails?.filter((m) => m.category === 'important') ?? [];
  const normal = mails?.filter((m) => m.category === 'normal') ?? [];
  const newsletters = mails?.filter((m) => m.category === 'newsletter') ?? [];
  const noise = mails?.filter((m) => m.category === 'noise') ?? [];

  return (
    <>
      <header className="page-header">
        <Link href="/" className="back-btn" aria-label="Back to dashboard"><BackIcon /></Link>
        <h1>Gmail</h1>
        <button className={`refresh-btn${refreshing ? ' busy' : ''}`} onClick={refresh} disabled={refreshing}
          aria-label="Refresh inbox" title="Sync Gmail now">
          {refreshing ? <span className="spin" /> : '↻'}
        </button>
      </header>

      {!mails && !error && <div className="tile-empty"><span className="spin" /></div>}
      {error && (
        <div className="card"><div className="tile-empty">
          {error.includes('insufficient') || error.includes('403') || error.includes('scope')
            ? 'Gmail access not granted yet — sign out and back in from Settings.'
            : `Couldn't load: ${error}`}
        </div></div>
      )}
      {mails && mails.length === 0 && (
        <div className="card"><div className="tile-empty">No mail synced yet — run a sync from Settings.</div></div>
      )}

      {important.length > 0 && (
        <section className="section">
          <h2 className="section-title">Important</h2>
          <div className="card accent-red">{important.map((m) => <MailRow m={m} key={m.id} onRead={markRead} />)}</div>
        </section>
      )}

      {normal.length > 0 && (
        <section className="section">
          <h2 className="section-title">Everything else</h2>
          <div className="card">{normal.map((m) => <MailRow m={m} key={m.id} onRead={markRead} />)}</div>
        </section>
      )}

      {newsletters.length > 0 && (
        <section className="section">
          <h2 className="section-title">Newsletters</h2>
          <div className="card" style={{ opacity: 0.75 }}>
            {newsletters.map((m) => <MailRow m={m} key={m.id} onRead={markRead} />)}
          </div>
        </section>
      )}

      {noise.length > 0 && (
        <section className="section">
          <h2 className="section-title">
            <button onClick={() => setShowNoise(!showNoise)} style={{ font: 'inherit', color: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit' }}>
              Filtered out ({noise.length}) {showNoise ? '▾' : '▸'}
            </button>
          </h2>
          {showNoise && (
            <div className="card" style={{ opacity: 0.55 }}>
              {noise.map((m) => <MailRow m={m} key={m.id} onRead={markRead} />)}
            </div>
          )}
        </section>
      )}

      <a className="btn" href="https://mail.google.com" target="_blank" rel="noreferrer"
        style={{ width: '100%', marginBottom: 8 }}>
        Open Gmail
      </a>
    </>
  );
}
