'use client';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { fetchStatus, type SetupStatus } from '@/app/setup/steps/shared';
import { WelcomeStep } from '@/app/setup/steps/WelcomeStep';
import { ToolsStep } from '@/app/setup/steps/ToolsStep';
import { GoogleStep } from '@/app/setup/steps/GoogleStep';
import { AiStep } from '@/app/setup/steps/AiStep';
import { CanvasStep } from '@/app/setup/steps/CanvasStep';
import { SpotifyStep } from '@/app/setup/steps/SpotifyStep';
import { NotesStep } from '@/app/setup/steps/NotesStep';
import { FencingFitnessStep } from '@/app/setup/steps/FencingFitnessStep';
import { KairosStep } from '@/app/setup/steps/KairosStep';
import { QuickLinksStep } from '@/app/setup/steps/QuickLinksStep';

// Settings → Integrations: the wizard's step components in edit mode, one
// accordion card each, backed by /api/setup/*.
function Row({ name, sub, children }: { name: string; sub: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`integration${open ? ' open' : ''}`}>
      <button type="button" className="integration-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="integration-name">{name}</span>
        <span className="integration-sub">{sub}</span>
        <span className="chev" aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="integration-body">{children}</div>}
    </div>
  );
}

export function Integrations() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const refresh = useCallback(async () => { try { setStatus(await fetchStatus()); } catch { /* offline */ } }, []);
  useEffect(() => { refresh(); }, [refresh]);
  if (!status) return <div className="setting-row"><span className="spin" /></div>;
  const p = { mode: 'edit' as const, status, onSaved: refresh };
  const yes = (b: boolean, on = 'configured', off = 'not set') => (b ? on : off);
  return (
    <div className="integrations">
      <Row name="Profile" sub={`${status.core.tz || 'no timezone'}${status.core.aboutMe ? ' · about me set' : ''}`}><WelcomeStep {...p} /></Row>
      <Row name="Local tools" sub="Ollama · tmux · Claude Code"><ToolsStep {...p} /></Row>
      <Row name="Google" sub={status.signedInAs ? `${status.signedInAs}${status.googleConnected ? '' : ' · not connected'}` : 'not signed in'}><GoogleStep {...p} /></Row>
      <Row name="AI" sub={`${status.ai.provider === 'anthropic' ? 'Anthropic for everything' : 'local Ollama'} · key ${yes(status.anthropic.hasKey, 'saved', 'missing')}`}><AiStep {...p} /></Row>
      <Row name="School (Canvas)" sub={status.canvas.baseUrl || 'not set'}><CanvasStep {...p} /></Row>
      <Row name="Spotify" sub={yes(Boolean(status.spotify.clientId))}><SpotifyStep {...p} /></Row>
      <Row name="Notes (Obsidian)" sub={status.obsidian.vault || 'not set'}><NotesStep {...p} /></Row>
      <Row name="Fencing & Fitness" sub={[status.fencing.enabled ? 'fencing on' : '', status.fitness.appUrl ? 'fitness app' : ''].filter(Boolean).join(' · ') || 'not set'}><FencingFitnessStep {...p} /></Row>
      <Row name="Kairos" sub={status.kairos.enabled ? 'enabled' : 'off'}><KairosStep {...p} /></Row>
      <Row name="Quick links" sub={`${status.quickLinks.length} link(s)`}><QuickLinksStep {...p} /></Row>
    </div>
  );
}
