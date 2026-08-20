'use client';
import { Busy, Note, useAction, type StepProps } from './shared';
import type { StepId } from '../SetupWizard';

export function FinishStep({ status, onGoTo }: StepProps & { onGoTo: (id: StepId) => void }) {
  const { busy, note, run } = useAction();
  const googleOk = Boolean(status.signedInAs && status.googleConnected);
  const aiRequired = status.ai.provider === 'anthropic';
  const aiOk = !aiRequired || status.anthropic.hasKey;
  const reason = !googleOk ? 'Sign in with Google first (required).' : !aiOk ? 'You chose Anthropic for everything — add an API key in the AI step.' : null;

  const rows: { id: StepId; name: string; value: string; ok: boolean }[] = [
    { id: 'welcome', name: 'Timezone', value: status.core.tz || 'not set', ok: Boolean(status.core.tz) },
    { id: 'google', name: 'Google', value: status.signedInAs ? `${status.signedInAs}${status.googleConnected ? ' · Calendar & Gmail' : ' · not connected'}` : 'not signed in', ok: googleOk },
    { id: 'ai', name: 'AI', value: `${status.ai.provider === 'anthropic' ? 'Anthropic for everything' : 'local Ollama + Anthropic for mail/calendar'} · key ${status.anthropic.hasKey ? 'saved' : 'missing'}`, ok: aiOk },
    { id: 'canvas', name: 'School (Canvas)', value: status.canvas.baseUrl || 'skipped', ok: Boolean(status.canvas.baseUrl && status.canvas.hasToken) },
    { id: 'spotify', name: 'Spotify', value: status.spotify.clientId ? 'configured' : 'skipped', ok: Boolean(status.spotify.clientId) },
    { id: 'notes', name: 'Notes', value: status.obsidian.vault || 'skipped', ok: Boolean(status.obsidian.vault) },
    { id: 'sports', name: 'Fencing & Fitness', value: [status.fencing.homeStates.length ? `${status.fencing.homeStates.length} states` : '', status.fitness.appUrl ? 'fitness app' : ''].filter(Boolean).join(' · ') || 'skipped', ok: Boolean(status.fencing.homeStates.length || status.fitness.appUrl) },
    { id: 'kairos', name: 'Kairos', value: status.kairos.enabled ? 'enabled' : 'off', ok: status.kairos.enabled },
    { id: 'links', name: 'Quick links', value: status.quickLinks.length ? `${status.quickLinks.length} link(s)` : 'none', ok: status.quickLinks.length > 0 },
  ];

  const modules: { name: string; on: boolean }[] = [
    { name: 'Calendar', on: googleOk },
    { name: 'Gmail', on: googleOk && status.anthropic.hasKey },
    { name: 'School (Canvas)', on: Boolean(status.canvas.baseUrl && status.canvas.hasToken) },
    { name: 'Spotify', on: Boolean(status.spotify.clientId && status.spotify.hasSecret) },
    { name: 'Notes', on: Boolean(status.obsidian.vault) },
    { name: 'Passwords', on: Boolean(status.passwords.vault) },
    { name: 'Fitness', on: Boolean(status.fitness.appUrl || status.fitness.allowedOrigin) },
    { name: 'Competitions', on: status.fencing.enabled },
    { name: 'Kairos', on: status.kairos.enabled },
  ];

  const finish = () => run('finish', async () => {
    const r = await fetch('/api/setup/finish', { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { location.href = '/'; return; }
    return { ok: false, text: j.error ?? `HTTP ${r.status}` };
  });

  return (
    <div className="step-stack">
      <p className="setup-text">Here&apos;s what you set up. Everything can be changed later in Settings → Integrations.</p>
      <ul className="summary-list">
        {rows.map((r) => (
          <li key={r.id}>
            <span className={`dot ${r.ok ? 'on' : ''}`} />
            <span className="summary-name">{r.name}</span>
            <span className="summary-value">{r.value}</span>
            <button type="button" className="btn small" onClick={() => onGoTo(r.id)}>Edit</button>
          </li>
        ))}
      </ul>
      <div className="choice-box">
        <div className="label">Active on your dashboard</div>
        <div className="chips">
          {modules.map((m) => <span key={m.name} className={`chip${m.on ? ' on' : ''}`}>{m.name}</span>)}
        </div>
        <div className="sub">Greyed-out modules stay hidden until configured in Settings → Integrations.</div>
      </div>
      <div className="btn-row">
        <button type="button" className="btn primary" onClick={finish} disabled={busy !== null || Boolean(reason)} title={reason ?? undefined}>
          <Busy when={busy === 'finish'}>Finish setup and open Life OS</Busy>
        </button>
      </div>
      {reason && <p className="pill-note err-note">{reason}</p>}
      <Note note={note} />
    </div>
  );
}
