'use client';
import { useEffect, useState } from 'react';
import { Busy, CopyRow, ExtLink, Field, Note, SECRET_PLACEHOLDER, saveConfig, useAction, type StepProps } from './shared';

export function GoogleStep({ mode, status, onSaved, signInAction }: StepProps & { signInAction?: () => Promise<void> }) {
  const [id, setId] = useState(status.google.clientId);
  const [secret, setSecret] = useState('');
  const { busy, note, run } = useAction();
  useEffect(() => { setId(status.google.clientId); }, [status.google.clientId]);
  const redirect = `${status.origin}/api/auth/callback/google`;
  const saved = Boolean(status.google.clientId && status.google.hasSecret);
  const complete = Boolean(status.signedInAs && status.googleConnected);

  const save = () => run('save', async () => {
    const patch: Record<string, string> = { clientId: id.trim() };
    if (secret.trim()) patch.clientSecret = secret.trim();
    const ok = await saveConfig({ google: patch });
    if (ok) { setSecret(''); await onSaved(); }
    return { ok, text: ok ? 'Saved — now sign in below' : 'Could not save' };
  });

  return (
    <div className="step-stack">
      <p className="setup-text">
        <strong>Required.</strong> Google sign-in is how you log in, and it gives Life OS access to your Calendar and Gmail.
        You create your own (free) Google Cloud project so the keys are yours — this takes about five minutes.
      </p>
      <ol className="setup-steps-list">
        <li>
          <ExtLink href="https://console.cloud.google.com/projectcreate">Create a Google Cloud project</ExtLink> (any name, e.g. “Life OS”).
        </li>
        <li>
          Enable the <ExtLink href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com">Google Calendar API</ExtLink> and
          the <ExtLink href="https://console.cloud.google.com/apis/library/gmail.googleapis.com">Gmail API</ExtLink>.
        </li>
        <li>
          Open the <ExtLink href="https://console.cloud.google.com/apis/credentials/consent">OAuth consent screen</ExtLink> → choose <strong>External</strong>,
          fill in the app name and your email, and add your own email under <strong>Test users</strong>.
          <div className="field-hint">
            Recommended: afterwards press <strong>Publish app</strong>. In testing mode Google expires the refresh token every 7 days and you&apos;d
            have to sign in again weekly. An “unverified app” warning at sign-in is expected — click <em>Advanced → Go to … (unsafe)</em>.
          </div>
        </li>
        <li>
          Go to <ExtLink href="https://console.cloud.google.com/apis/credentials">Credentials</ExtLink> → <strong>Create credentials → OAuth client ID</strong> →
          type <strong>Web application</strong>. Under <strong>Authorized redirect URIs</strong> add exactly:
          <CopyRow value={redirect} />
          Then copy the Client ID and Client secret here.
        </li>
      </ol>
      <div className="grid-2">
        <Field label="Client ID"><input className="text-input" value={id} onChange={(e) => setId(e.target.value)} autoComplete="off" placeholder="…apps.googleusercontent.com" /></Field>
        <Field label="Client secret">
          <input className="text-input" type="password" autoComplete="off" value={secret}
            placeholder={status.google.hasSecret ? SECRET_PLACEHOLDER : 'GOCSPX-…'} onChange={(e) => setSecret(e.target.value)} />
        </Field>
      </div>
      <div className="btn-row">
        <button type="button" className="btn primary small" onClick={save} disabled={busy !== null || !id.trim() || (!secret.trim() && !status.google.hasSecret)}>
          <Busy when={busy === 'save'}>Save</Busy>
        </button>
      </div>
      <Note note={note} />

      <div className="status-box">
        <div className="status-line">
          <span className={`dot ${status.signedInAs ? 'on' : ''}`} />
          {status.signedInAs ? <>Signed in as <strong>{status.signedInAs}</strong> ✓</> : 'Not signed in yet'}
        </div>
        <div className="status-line">
          <span className={`dot ${status.googleConnected ? 'on' : ''}`} />
          {status.googleConnected ? 'Calendar & Gmail connected ✓' : 'Calendar & Gmail not connected'}
        </div>
        {signInAction ? (
          <form action={signInAction}>
            <button type="submit" className="btn primary" disabled={!saved}
              title={saved ? undefined : 'Save your Client ID and secret first'}>
              {status.signedInAs ? 'Sign in again' : 'Sign in with Google'}
            </button>
          </form>
        ) : (
          !complete && mode === 'edit' && <a className="btn small" href="/setup?step=google">Open the setup wizard to sign in</a>
        )}
        {!saved && <span className="field-hint">Save the Client ID and secret to enable sign-in.</span>}
        {status.signedInAs && !status.googleConnected && (
          <span className="field-hint">Signed in, but no Calendar/Gmail token was stored. Sign in again and accept all permissions.</span>
        )}
      </div>
    </div>
  );
}
