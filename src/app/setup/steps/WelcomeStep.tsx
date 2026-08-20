'use client';
import { useEffect, useState } from 'react';
import { TIMEZONES } from '@/ui/timezones';
import { Field, Note, SaveBar, saveConfig, useAction, type StepProps } from './shared';

export function WelcomeStep({ mode, status, onSaved }: StepProps) {
  const detected = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';
  const [tz, setTz] = useState(status.core.tz || detected);
  const [about, setAbout] = useState(status.core.aboutMe ?? '');
  const { busy, note, run } = useAction();
  useEffect(() => { setTz(status.core.tz || detected); setAbout(status.core.aboutMe ?? ''); }, [status.core.tz, status.core.aboutMe, detected]);

  const save = () => run('save', async () => {
    const ok = await saveConfig({ core: { tz, aboutMe: about } });
    if (ok) await onSaved();
    return { ok, text: ok ? 'Saved' : 'Could not save' };
  });

  return (
    <div className="step-stack">
      {mode === 'wizard' && (
        <div className="setup-intro">
          <p>
            Life OS is a <strong>local-first, single-user</strong> dashboard: calendar, mail triage, tasks,
            school, notes, music and more in one place. It runs on this machine and your data stays here.
          </p>
          <ul className="setup-bullets">
            <li>Everything is stored in the app&apos;s data folder on this computer; nothing is uploaded to us.</li>
            <li>One Google account owns the app. The first account that signs in becomes the owner.</li>
            <li>Most steps are optional — you can skip them and come back later in Settings → Integrations. Dashboard tiles appear as each integration is configured.</li>
          </ul>
        </div>
      )}
      <Field label="Timezone" hint="Used for reminders, the calendar and daily summaries.">
        <select className="tz-select" value={tz} onChange={(e) => setTz(e.target.value)}>
          {!TIMEZONES.includes(tz) && <option value={tz}>{tz}</option>}
          {TIMEZONES.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
      </Field>
      <Field label="About me (optional)" hint="One line given to the AI so its summaries and drafts fit you. Example: “college student studying CS, plays tennis”.">
        <textarea className="text-input" rows={2} value={about} maxLength={400}
          placeholder="Who are you, in a sentence?" onChange={(e) => setAbout(e.target.value)} />
      </Field>
      <SaveBar busy={busy === 'save'} onSave={save} />
      <Note note={note} />
    </div>
  );
}
