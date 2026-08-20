'use client';
import { useEffect, useState } from 'react';
import { Busy, CopyRow, ExtLink, Field, Note, SECRET_PLACEHOLDER, saveConfig, useAction, type StepProps } from './shared';

export function SpotifyStep({ status, onSaved }: StepProps) {
  const [id, setId] = useState(status.spotify.clientId);
  const [secret, setSecret] = useState('');
  const { busy, note, run } = useAction();
  useEffect(() => { setId(status.spotify.clientId); }, [status.spotify.clientId]);
  const redirect = `${status.origin}/api/mod/spotify/callback`;
  const configured = Boolean(status.spotify.clientId && status.spotify.hasSecret);

  const save = () => run('save', async () => {
    const patch: Record<string, string> = { clientId: id.trim() };
    if (secret.trim()) patch.clientSecret = secret.trim();
    const ok = await saveConfig({ spotify: patch });
    if (ok) { setSecret(''); await onSaved(); }
    return { ok, text: ok ? 'Saved' : 'Could not save' };
  });

  return (
    <div className="step-stack">
      <p className="setup-text">Optional. Shows what&apos;s playing and lets you control playback from the dashboard. The tile appears once the keys are saved.</p>
      <ol className="setup-steps-list">
        <li>Open <ExtLink href="https://developer.spotify.com/dashboard">developer.spotify.com/dashboard</ExtLink> and press <strong>Create app</strong>.</li>
        <li>Any name and description. Under <strong>Redirect URIs</strong> add exactly:
          <CopyRow value={redirect} /></li>
        <li>Tick <strong>Web API</strong>, save, then open the app&apos;s Settings to copy the Client ID and Client secret.</li>
      </ol>
      <div className="grid-2">
        <Field label="Client ID"><input className="text-input" value={id} onChange={(e) => setId(e.target.value)} autoComplete="off" /></Field>
        <Field label="Client secret">
          <input className="text-input" type="password" autoComplete="off" value={secret}
            placeholder={status.spotify.hasSecret ? SECRET_PLACEHOLDER : ''} onChange={(e) => setSecret(e.target.value)} />
        </Field>
      </div>
      <div className="btn-row">
        <button type="button" className="btn primary small" onClick={save} disabled={busy !== null || !id.trim()}>
          <Busy when={busy === 'save'}>Save</Busy>
        </button>
        {configured && (
          status.signedInAs
            ? <a className="btn small" href="/api/mod/spotify/connect">Connect Spotify</a>
            : <span className="field-hint">Sign in with Google first, then connect Spotify (the connect link is auth-protected).</span>
        )}
      </div>
      <Note note={note} />
    </div>
  );
}
