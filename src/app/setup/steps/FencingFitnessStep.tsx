'use client';
import { useEffect, useState } from 'react';
import { Busy, CopyRow, Field, Note, saveConfig, useAction, type StepProps } from './shared';

export const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

export function FencingFitnessStep({ mode, status, onSaved }: StepProps) {
  const hasAny = Boolean(status.fencing.enabled || status.fitness.appUrl);
  const [open, setOpen] = useState(mode === 'edit' || hasAny);
  const [fence, setFence] = useState(status.fencing.enabled);
  const [states, setStates] = useState<string[]>(status.fencing.homeStates);
  const [tracker, setTracker] = useState(status.fencing.trackerProfileUrl);
  const [appUrl, setAppUrl] = useState(status.fitness.appUrl);
  const [origin, setOrigin] = useState(status.fitness.allowedOrigin);
  const { busy, note, run } = useAction();
  useEffect(() => {
    setFence(status.fencing.enabled);
    setStates(status.fencing.homeStates); setTracker(status.fencing.trackerProfileUrl);
    setAppUrl(status.fitness.appUrl); setOrigin(status.fitness.allowedOrigin);
  }, [status.fencing, status.fitness]);

  const toggle = (s: string) => setStates((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);
  const save = () => run('save', async () => {
    const ok = await saveConfig({
      fencing: { enabled: fence, homeStates: states, trackerProfileUrl: tracker.trim() },
      fitness: { appUrl: appUrl.trim(), allowedOrigin: origin.trim() },
    });
    if (ok) await onSaved();
    return { ok, text: ok ? 'Saved' : 'Could not save' };
  });
  const curl = `curl -X POST ${status.origin}/api/fitness/ingest -H 'x-fitness-key: ${status.fitness.ingestKey}' -H 'content-type: application/json' -d '{"date":"2025-01-31","eaten":1850,"burned":420,"streak":12}'`;

  if (!open) {
    return (
      <div className="step-stack">
        <p className="setup-text">Optional. Tournament tracking for fencers and a calorie/streak tile for anyone with a fitness app. Their dashboard tiles appear once configured.</p>
        <label className="checkbox-row"><input type="checkbox" checked={false} onChange={() => setOpen(true)} /> I fence / I track calories</label>
      </div>
    );
  }

  return (
    <div className="step-stack">
      <section className="step-stack nested">
        <span className="field-label">Fencing</span>
        <label className="checkbox-row">
          <input type="checkbox" checked={fence} onChange={(e) => setFence(e.target.checked)} />
          <span>I fence — track tournaments and results<span className="field-hint" style={{ display: 'block' }}>The competitions scraper and its notifications only run while this is on. Save to apply.</span></span>
        </label>
        <Field label="Home states for tournaments" hint="Competitions in these states are pulled in. Leave all unselected to include every state.">
          <div className="chips" role="group">
            {US_STATES.map((s) => (
              <button type="button" key={s} className={`chip${states.includes(s) ? ' on' : ''}`} aria-pressed={states.includes(s)} onClick={() => toggle(s)}>{s}</button>
            ))}
          </div>
        </Field>
        <Field label="fencingtracker profile URL" hint="Your results page on fencingtracker.com (optional).">
          <input className="text-input" value={tracker} placeholder="https://fencingtracker.com/p/…" onChange={(e) => setTracker(e.target.value)} />
        </Field>
      </section>

      <section className="step-stack nested">
        <span className="field-label">Fitness</span>
        <Field label="Fitness web app URL" hint="Embedded at /m/fitness inside Life OS.">
          <input className="text-input" value={appUrl} placeholder="https://fitness.example.com" onChange={(e) => setAppUrl(e.target.value)} />
        </Field>
        <Field label="Allowed origin (CORS)" hint="The origin your fitness app calls from, e.g. https://fitness.example.com">
          <input className="text-input" value={origin} placeholder="https://fitness.example.com" onChange={(e) => setOrigin(e.target.value)} />
        </Field>
        <Field label="Ingest key (read-only)" hint="Your fitness app pushes daily totals with this key.">
          <CopyRow value={status.fitness.ingestKey || '(generated at first start)'} />
        </Field>
        <Field label="Example request" hint={<>POST JSON <code>{'{date, eaten, burned, streak}'}</code> with the <code>x-fitness-key</code> header.</>}>
          <CopyRow value={curl} />
        </Field>
      </section>

      <div className="btn-row">
        <button type="button" className="btn primary small" onClick={save} disabled={busy !== null}><Busy when={busy === 'save'}>Save</Busy></button>
      </div>
      <Note note={note} />
    </div>
  );
}
