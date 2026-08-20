'use client';
import { useEffect, useState } from 'react';
import { Busy, Field, Note, SECRET_PLACEHOLDER, runTest, saveConfig, useAction, type StepProps } from './shared';

export function CanvasStep({ status, onSaved }: StepProps) {
  const [url, setUrl] = useState(status.canvas.baseUrl);
  const [token, setToken] = useState('');
  const { busy, note, run } = useAction();
  useEffect(() => { setUrl(status.canvas.baseUrl); }, [status.canvas.baseUrl]);

  const save = () => run('save', async () => {
    const patch: Record<string, unknown> = { canvas: { baseUrl: url.trim().replace(/\/+$/, '') } };
    if (token.trim()) (patch.canvas as Record<string, unknown>).token = token.trim();
    const ok = await saveConfig(patch);
    if (ok) { setToken(''); await onSaved(); }
    return { ok, text: ok ? 'Saved' : 'Could not save' };
  });
  const test = () => run('test', async () => {
    const r = await runTest('canvas', { baseUrl: url.trim(), ...(token.trim() ? { token: token.trim() } : {}) });
    return { ok: r.ok, text: r.detail };
  });

  return (
    <div className="step-stack">
      <p className="setup-text">
        Optional. Connects your school&apos;s Canvas so assignments, due dates and grades show up in Life OS. The School tile appears once a URL and token are saved.
      </p>
      <Field label="Canvas URL" hint="The address you use to open Canvas.">
        <input className="text-input" value={url} placeholder="https://yourschool.instructure.com" onChange={(e) => setUrl(e.target.value)} />
      </Field>
      <Field label="Access token"
        hint="In Canvas: Account → Settings → Approved Integrations → “+ New Access Token”. Give it a name, leave the expiry blank, copy the token.">
        <input className="text-input" type="password" autoComplete="off" value={token}
          placeholder={status.canvas.hasToken ? SECRET_PLACEHOLDER : 'Paste the token'} onChange={(e) => setToken(e.target.value)} />
      </Field>
      <div className="btn-row">
        <button type="button" className="btn small" onClick={test} disabled={busy !== null || !url.trim() || (!token.trim() && !status.canvas.hasToken)}>
          <Busy when={busy === 'test'}>Test</Busy>
        </button>
        <button type="button" className="btn primary small" onClick={save} disabled={busy !== null || !url.trim()}>
          <Busy when={busy === 'save'}>Save</Busy>
        </button>
      </div>
      <Note note={note} />
    </div>
  );
}
