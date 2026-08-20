'use client';
import { TIMEZONES } from '@/ui/timezones';
import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import { CalendarIcon, BookIcon, MailIcon, DumbbellIcon, SettingsIcon, MusicIcon, TrophyIcon, NoteIcon, LockIcon } from './icons';
import { Integrations } from './Integrations';

type Cal = { id: string; summary: string; primary: boolean };

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function TzToggle() {
  const [tz, setTz] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/settings/system').then((r) => r.json())
      .then((s) => setTz(s.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone)).catch(() => {});
  }, []);
  const pick = (next: string) => {
    setTz(next);
    fetch('/api/settings/system', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tz: next }),
    }).then(() => location.reload()).catch(() => {});
  };
  if (!tz) return null;
  return (
    <select className="tz-select" value={tz} onChange={(e) => pick(e.target.value)} aria-label="Timezone">
      {TIMEZONES.map((z) => <option key={z} value={z}>{z}</option>)}
    </select>
  );
}

function AppCard({ accent, icon, name, sub, children }: {
  accent: string; icon: React.ReactNode; name: string; sub?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`card settings-card ${accent}${open ? ' open' : ''}`}>
      <button className="card-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="tile-chip">{icon}</span>
        <span className="tile-name">{name}</span>
        {sub && !open && <span className="card-sub">{sub}</span>}
        <span className="chev" aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="card-body">{children}</div>}
    </div>
  );
}

export function SettingsClient({ email: emailProp }: { email?: string }) {
  const [email, setEmail] = useState(emailProp ?? '');
  const [cals, setCals] = useState<Cal[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [remindHours, setRemindHours] = useState(24);
  const [notifyImportant, setNotifyImportant] = useState(true);
  const [importantSenders, setImportantSenders] = useState('');
  const [keepSenders, setKeepSenders] = useState('');
  const [pushState, setPushState] = useState<'unknown' | 'on' | 'off' | 'unsupported'>('unknown');
  const [spotify, setSpotify] = useState<{ connected: boolean; configured: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!emailProp) {
      fetch('/api/auth/session').then((r) => r.json())
        .then((s) => setEmail(s?.user?.email ?? '')).catch(() => {});
    }
    fetch('/api/mod/gcal/calendars').then((r) => r.json()).then(setCals).catch(() => {});
    fetch('/api/settings/gcal').then((r) => r.json())
      .then((s) => setSelected(s.calendarIds ?? [])).catch(() => {});
    fetch('/api/settings/canvas').then((r) => r.json())
      .then((s) => setRemindHours(s.remindHoursBefore ?? 24)).catch(() => {});
    fetch('/api/settings/gmail').then((r) => r.json())
      .then((s) => {
        setNotifyImportant(s.notifyImportant ?? true);
        setImportantSenders((s.importantSenders ?? []).join(', '));
        setKeepSenders((s.keepSenders ?? []).join(', '));
      }).catch(() => {});
    fetch('/api/mod/spotify/status').then((r) => r.json()).then(setSpotify).catch(() => {});
    // If a sync is already running in the background, pick the spinner back up.
    fetch('/api/sync').then((r) => r.json()).then((s) => {
      if (s.running) {
        setBusy('sync');
        watchSync().finally(() => setBusy(null));
      }
    }).catch(() => {});
    if (new URLSearchParams(window.location.search).get('spotify') === 'connected') {
      setMsg('Spotify connected 🎵');
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushState('unsupported');
    } else {
      navigator.serviceWorker.ready.then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setPushState(sub ? 'on' : 'off'))
        .catch(() => setPushState('off'));
    }
  }, []);

  const patch = (module: string, body: object) =>
    fetch(`/api/settings/${module}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});

  const effectiveSelected = selected.length === 0
    ? cals.filter((c) => c.primary).map((c) => c.id)
    : selected;

  const toggleCal = (id: string) => {
    const next = effectiveSelected.includes(id)
      ? effectiveSelected.filter((x) => x !== id)
      : [...effectiveSelected, id];
    setSelected(next); // optimistic
    patch('gcal', { calendarIds: next });
  };

  const enablePush = async () => {
    setBusy('push');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setMsg('Notifications were blocked — enable them in browser settings.'); return; }
      const reg = await navigator.serviceWorker.ready;
      const { core } = await fetch('/api/setup/status').then((r) => r.json());
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(core.vapidPublicKey),
      });
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error('subscribe failed');
      setPushState('on');
      setMsg('Notifications enabled on this device.');
    } catch (e) {
      setMsg(`Could not enable notifications: ${e}`);
    } finally { setBusy(null); }
  };

  const testPush = async () => {
    setBusy('test');
    try {
      const r = await fetch('/api/push/test', { method: 'POST' });
      const j = await r.json();
      setMsg(`Sent to ${j.sent} device${j.sent === 1 ? '' : 's'}.`);
    } finally { setBusy(null); }
  };

  // Follow the server-side background sync until it finishes. The sync itself
  // runs detached on the server, so leaving Settings never interrupts it —
  // this just keeps the spinner and the final report honest.
  const watchSync = async () => {
    for (;;) {
      const s = await fetch('/api/sync').then((r) => r.json());
      if (!s.running) {
        const report: Record<string, string> = s.report ?? {};
        const errors = Object.entries(report).filter(([, v]) => String(v).startsWith('error'));
        setMsg(errors.length
          ? `Sync finished — ${errors.map(([k]) => k).join(', ')} failed.`
          : 'Everything synced.');
        return;
      }
      setMsg('Syncing everything… (keeps running even if you leave this page)');
      await new Promise((res) => setTimeout(res, 2000));
    }
  };

  const syncNow = async () => {
    setBusy('sync');
    setMsg('Syncing everything…');
    try {
      await fetch('/api/sync?force=1&bg=1', { method: 'POST' });
      await watchSync();
    } finally { setBusy(null); }
  };

  return (
    <>
      {/* Platform */}
      <AppCard accent="accent-violet" icon={<SettingsIcon />} name="Life OS" sub={email}>
        <div className="setting-row">
          <div><div className="label">Google account</div><div className="sub">{email}</div></div>
          <button className="btn small danger" onClick={() => signOut({ callbackUrl: '/signin' })}>
            Sign out
          </button>
        </div>
        <div className="setting-row">
          <div>
            <div className="label">Push notifications</div>
            <div className="sub">
              {pushState === 'unsupported' ? 'Install the app to your home screen first (iOS)'
                : pushState === 'on' ? 'Enabled on this device' : 'Off on this device'}
            </div>
          </div>
          {pushState !== 'on' && pushState !== 'unsupported' && (
            <button className="btn small" onClick={enablePush} disabled={busy === 'push'}>
              {busy === 'push' ? <span className="spin" /> : 'Enable'}
            </button>
          )}
          {pushState === 'on' && (
            <button className="btn small" onClick={testPush} disabled={busy === 'test'}>
              {busy === 'test' ? <span className="spin" /> : 'Send test'}
            </button>
          )}
        </div>
        <div className="setting-row">
          <div><div className="label">Timezone</div><div className="sub">Where your days start and end</div></div>
          <TzToggle />
        </div>
      </AppCard>

      {/* Calendar */}
      <AppCard accent="accent-blue" icon={<CalendarIcon />} name="Calendar"
        sub={`${effectiveSelected.length || '…'} calendar${effectiveSelected.length === 1 ? '' : 's'} shown`}>
        <div className="setting-row" style={{ borderTop: 'none' }}>
          <div className="sub">Choose which calendars show up</div>
        </div>
        {cals.length === 0 && <div className="tile-empty">Sync once to load your calendar list</div>}
        {cals.map((c) => (
          <label className="checkbox-row" key={c.id}>
            <input
              type="checkbox"
              checked={effectiveSelected.includes(c.id)}
              onChange={() => toggleCal(c.id)}
            />
            <span>{c.summary}{c.primary ? ' (primary)' : ''}</span>
          </label>
        ))}
      </AppCard>

      {/* Canvas */}
      <AppCard accent="accent-amber" icon={<BookIcon />} name="Canvas" sub={`remind ${remindHours}h before`}>
        <div className="setting-row">
          <div><div className="label">Assignment reminder</div><div className="sub">Push before the due date</div></div>
          <select
            className="btn small"
            value={remindHours}
            onChange={(e) => {
              const v = Number(e.target.value);
              setRemindHours(v);
              patch('canvas', { remindHoursBefore: v });
            }}
          >
            <option value={12}>12h before</option>
            <option value={24}>24h before</option>
            <option value={48}>48h before</option>
          </select>
        </div>
      </AppCard>

      {/* Gmail */}
      <AppCard accent="accent-red" icon={<MailIcon />} name="Gmail" sub="AI filters & alerts">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={notifyImportant}
            onChange={(e) => {
              setNotifyImportant(e.target.checked);
              patch('gmail', { notifyImportant: e.target.checked });
            }}
          />
          <span>Notify me about important emails</span>
        </label>
        <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          <div><div className="label">Always important</div>
            <div className="sub">People/senders the AI must never bury (comma-separated)</div></div>
          <input
            className="text-input"
            value={importantSenders}
            onChange={(e) => setImportantSenders(e.target.value)}
            onBlur={() => patch('gmail', {
              importantSenders: importantSenders.split(',').map((s) => s.trim()).filter(Boolean),
            })}
            placeholder="Mom, Prof. Smith, HR"
          />
        </div>
        <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          <div><div className="label">Never filter out</div>
            <div className="sub">Newsletters/brands you actually want to see</div></div>
          <input
            className="text-input"
            value={keepSenders}
            onChange={(e) => setKeepSenders(e.target.value)}
            onBlur={() => patch('gmail', {
              keepSenders: keepSenders.split(',').map((s) => s.trim()).filter(Boolean),
            })}
            placeholder="Ollama"
          />
        </div>
        <div className="setting-row">
          <div><div className="label">Re-sort inbox</div>
            <div className="sub">Re-run the AI on existing mail after changing rules</div></div>
          <button className="btn small" disabled={busy === 'retriage'} onClick={async () => {
            setBusy('retriage');
            setMsg('Re-sorting your inbox…');
            try {
              const r = await fetch('/api/mod/gmail/retriage', { method: 'POST' });
              const j = await r.json();
              setMsg(j.retriaged != null ? `Re-sorted ${j.retriaged} emails.` : `Failed: ${j.error}`);
            } finally { setBusy(null); }
          }}>
            {busy === 'retriage' ? <span className="spin" /> : 'Re-sort'}
          </button>
        </div>
      </AppCard>

      {/* Spotify */}
      <AppCard accent="accent-green" icon={<MusicIcon />} name="Spotify"
        sub={spotify?.connected ? 'connected' : 'not connected'}>
        <div className="setting-row">
          <div>
            <div className="label">Account</div>
            <div className="sub">
              {!spotify ? 'Checking…'
                : !spotify.configured ? 'Add your Spotify app keys in Integrations → Spotify below'
                : spotify.connected ? 'Connected' : 'Not connected'}
            </div>
          </div>
          {spotify?.configured && (
            <a className="btn small" href="/api/mod/spotify/connect">
              {spotify.connected ? 'Reconnect' : 'Connect'}
            </a>
          )}
        </div>
      </AppCard>

      {/* Fitness */}
      <AppCard accent="accent-violet" icon={<DumbbellIcon />} name="Fitness" sub="calories & streaks">
        <div className="setting-row">
          <div className="sub">
            Your fitness web app is embedded at /m/fitness and pushes daily totals through the ingest key.
            Set the app URL and copy the key in Integrations → Fencing &amp; Fitness.
          </div>
        </div>
      </AppCard>

      {/* Competitions */}
      <AppCard accent="accent-orange" icon={<TrophyIcon />} name="Competitions" sub="askFRED + USA Fencing + fencingtracker">
        <div className="setting-row">
          <div className="sub">
            Tournaments in your home states sync twice a day; your results refresh monthly from your
            fencingtracker profile. Choose states and the profile URL in Integrations → Fencing &amp; Fitness.
          </div>
        </div>
      </AppCard>

      {/* Notes */}
      <AppCard accent="accent-violet" icon={<NoteIcon />} name="Notes" sub="Obsidian vault">
        <div className="setting-row">
          <div className="sub">
            Your notes vault. <code>LifeOS/</code> holds auto-mirrored data (fencing, fitness, mail,
            competitions — refreshed every 30 min); quick captures land in <code>Daily/</code>.
            Pick the folder in Integrations → Notes.
          </div>
        </div>
      </AppCard>

      {/* Passwords */}
      <AppCard accent="accent-red" icon={<LockIcon />} name="Passwords" sub="separate vault">
        <div className="setting-row">
          <div className="sub">
            A separate vault, organized by your chosen AI provider (local Ollama by default — nothing leaves
            this machine). Folder and model live in Integrations → Notes and Integrations → AI.
          </div>
        </div>
      </AppCard>

      {/* Kairos */}
      <AppCard accent="accent-violet" icon={<SettingsIcon />} name="Kairos" sub="terminal assistant">
        <div className="setting-row">
          <div className="sub">
            Claude Code embedded in Life OS (✧ icon). Its behavior is <code>rules.md</code> and its memory
            is <code>vault/Memory/</code> inside the Kairos folder — edit both in any editor. Enable it in
            Integrations → Kairos.
          </div>
        </div>
      </AppCard>

      {/* Integrations — every credential and path the setup wizard collected */}
      <AppCard accent="accent-blue" icon={<SettingsIcon />} name="Integrations" sub="keys, folders, connections">
        <Integrations />
      </AppCard>

      {/* Sync everything — lives at the bottom, out of the way */}
      <div className="card" style={{ marginTop: 4 }}>
        <div className="setting-row">
          <div><div className="label">Sync all apps now</div><div className="sub">Every module, including vault mirror</div></div>
          <button className="btn small" onClick={syncNow} disabled={busy === 'sync'}>
            {busy === 'sync' ? <span className="spin" /> : 'Sync'}
          </button>
        </div>
      </div>

      {msg && <p className="pill-note" role="status">{msg}</p>}
    </>
  );
}
