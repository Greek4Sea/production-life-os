'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchStatus, type SetupStatus } from './steps/shared';
import { WelcomeStep } from './steps/WelcomeStep';
import { ToolsStep } from './steps/ToolsStep';
import { GoogleStep } from './steps/GoogleStep';
import { AiStep } from './steps/AiStep';
import { CanvasStep } from './steps/CanvasStep';
import { SpotifyStep } from './steps/SpotifyStep';
import { NotesStep } from './steps/NotesStep';
import { FencingFitnessStep } from './steps/FencingFitnessStep';
import { KairosStep } from './steps/KairosStep';
import { QuickLinksStep } from './steps/QuickLinksStep';
import { FinishStep } from './steps/FinishStep';

export type StepId = 'welcome' | 'tools' | 'google' | 'ai' | 'canvas' | 'spotify' | 'notes' | 'sports' | 'kairos' | 'links' | 'finish';

const STEPS: { id: StepId; title: string; short: string; required?: boolean }[] = [
  { id: 'welcome', title: 'Welcome', short: 'Start' },
  { id: 'tools', title: 'Install tools', short: 'Tools' },
  { id: 'google', title: 'Google', short: 'Google', required: true },
  { id: 'ai', title: 'AI', short: 'AI' },
  { id: 'canvas', title: 'School (Canvas)', short: 'School' },
  { id: 'spotify', title: 'Spotify', short: 'Spotify' },
  { id: 'notes', title: 'Notes (Obsidian)', short: 'Notes' },
  { id: 'sports', title: 'Fencing & Fitness', short: 'Sports' },
  { id: 'kairos', title: 'Kairos', short: 'Kairos' },
  { id: 'links', title: 'Quick links', short: 'Links' },
  { id: 'finish', title: 'Finish', short: 'Finish' },
];

function stepDone(id: StepId, s: SetupStatus): boolean {
  switch (id) {
    case 'welcome': return Boolean(s.core.tz);
    case 'google': return Boolean(s.signedInAs && s.googleConnected);
    case 'ai': return s.anthropic.hasKey;
    case 'canvas': return Boolean(s.canvas.baseUrl && s.canvas.hasToken);
    case 'spotify': return Boolean(s.spotify.clientId && s.spotify.hasSecret);
    case 'notes': return Boolean(s.obsidian.vault);
    case 'sports': return Boolean(s.fitness.appUrl || s.fencing.enabled);
    case 'kairos': return s.kairos.enabled;
    case 'links': return s.quickLinks.length > 0;
    case 'finish': return s.setupDone;
    default: return false;
  }
}

export function SetupWizard({ initial, signInAction }: { initial: SetupStatus; signInAction: () => Promise<void> }) {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<SetupStatus>(initial);
  const fromUrl = params.get('step') as StepId | null;
  const idx = Math.max(0, STEPS.findIndex((s) => s.id === fromUrl));
  const step = STEPS[idx];

  const go = useCallback((i: number) => {
    const next = STEPS[Math.min(Math.max(i, 0), STEPS.length - 1)];
    router.replace(`/setup?step=${next.id}`, { scroll: false });
    window.scrollTo({ top: 0 });
  }, [router]);

  const refresh = useCallback(async () => {
    try { setStatus(await fetchStatus()); } catch { /* keep what we have */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const aiRequired = status.ai.provider === 'anthropic';
  const doneCount = useMemo(() => STEPS.filter((s) => stepDone(s.id, status)).length, [status]);
  const canNext = step.id !== 'google' || stepDone('google', status);
  const common = { mode: 'wizard' as const, status, onSaved: refresh };

  return (
    <main className="setup">
      <aside className="setup-rail">
        <div className="setup-brand">
          <span className="setup-logo" aria-hidden>◐</span>
          <span>Life OS setup</span>
        </div>
        <ol className="setup-steps">
          {STEPS.map((s, i) => {
            const done = stepDone(s.id, status);
            const required = s.required || (s.id === 'ai' && aiRequired);
            return (
              <li key={s.id}>
                <button type="button"
                  className={`setup-step${i === idx ? ' current' : ''}${done ? ' done' : ''}`}
                  onClick={() => go(i)} aria-current={i === idx ? 'step' : undefined}>
                  <span className="setup-step-num">{done ? '✓' : i + 1}</span>
                  <span className="setup-step-title">{s.title}</span>
                  {required && !done && <span className="setup-req">required</span>}
                </button>
              </li>
            );
          })}
        </ol>
        <div className="setup-progress" aria-label="Progress">
          <div className="progress-bar"><span style={{ width: `${(doneCount / STEPS.length) * 100}%` }} /></div>
          <span className="setup-progress-text">{doneCount} of {STEPS.length}</span>
        </div>
      </aside>

      <section className="setup-panel">
        <header className="setup-panel-head">
          <span className="setup-kicker">Step {idx + 1} of {STEPS.length}</span>
          <h1>{step.title}</h1>
        </header>

        <div className="setup-body">
          {step.id === 'welcome' && <WelcomeStep {...common} />}
          {step.id === 'tools' && <ToolsStep {...common} />}
          {step.id === 'google' && <GoogleStep {...common} signInAction={signInAction} />}
          {step.id === 'ai' && <AiStep {...common} />}
          {step.id === 'canvas' && <CanvasStep {...common} />}
          {step.id === 'spotify' && <SpotifyStep {...common} />}
          {step.id === 'notes' && <NotesStep {...common} />}
          {step.id === 'sports' && <FencingFitnessStep {...common} />}
          {step.id === 'kairos' && <KairosStep {...common} onGoToTools={() => go(1)} />}
          {step.id === 'links' && <QuickLinksStep {...common} />}
          {step.id === 'finish' && <FinishStep {...common} onGoTo={(id) => go(STEPS.findIndex((s) => s.id === id))} />}
        </div>

        <footer className="setup-nav">
          <button type="button" className="btn" onClick={() => go(idx - 1)} disabled={idx === 0}>Back</button>
          <span className="setup-nav-spacer" />
          {step.id !== 'finish' && !step.required && step.id !== 'welcome' && (
            <button type="button" className="btn" onClick={() => go(idx + 1)}>Skip</button>
          )}
          {step.id !== 'finish' && (
            <button type="button" className="btn primary" onClick={() => go(idx + 1)} disabled={!canNext}
              title={canNext ? undefined : 'Finish Google sign-in first'}>
              Next
            </button>
          )}
        </footer>
      </section>
    </main>
  );
}
