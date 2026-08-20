'use client';
import { useEffect, useState } from 'react';
import { Busy, CopyRow, ExtLink, Field, Note, SECRET_PLACEHOLDER, saveConfig, useAction, type StepProps } from './shared';
import { SignInButton } from '@/ui/SignInButton';

export function GoogleStep({ mode, status, onSaved, signInAction }: StepProps & { signInAction?: () => Promise<void> }) {
  const [id, setId] = useState(status.google.clientId);
  const [secret, setSecret] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const { busy, note, run } = useAction();
  useEffect(() => { setId(status.google.clientId); }, [status.google.clientId]);
  const redirect = `${status.origin}/api/auth/callback/google`;
  const hasBuiltin = Boolean(status.google.hasBuiltin);
  const usingBuiltin = Boolean(status.google.builtin);
  const saved = Boolean(status.google.clientId && status.google.hasSecret);
  const complete = Boolean(status.signedInAs && status.googleConnected);
  const showOwnClient = !hasBuiltin || advanced || (!usingBuiltin && saved);

  const save = () => run('save', async () => {
    const patch: Record<string, string> = { clientId: id.trim() };
    if (secret.trim()) patch.clientSecret = secret.trim();
    const ok = await saveConfig({ google: patch });
    if (ok) { setSecret(''); await onSaved(); }
    return { ok, text: ok ? 'Saved — now sign in below' : 'Could not save' };
  });
  const useBuiltin = () => run('builtin', async () => {
    const ok = await saveConfig({ google: { useBuiltin: true } });
    if (ok) { setAdvanced(false); await onSaved(); }
    return { ok, text: ok ? 'Using the built-in Google client' : 'Could not save' };
  });

  return (
    <div className="step-stack">
      <p className="setup-text">
        <strong>Required.</strong> Google sign-in is how you log in, and it gives Life OS access to your Calendar and Gmail.
        {hasBuiltin
          ? ' Just press the button below and approve the permissions.'
          : ' You create your own (free) Google Cloud project so the keys are yours — this takes about five minutes.'}
      </p>
      {hasBuiltin && usingBuiltin && (
        <div className="field-hint">
          Google will show an “unverified app” screen because Life OS is an open-source project that hasn&apos;t gone through
          Google&apos;s paid review — click <em>Advanced → Go to Life OS (unsafe)</em> to continue. Your data only ever goes to
          your own machine.
        </div>
      )}

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
          saved
            ? <SignInButton callbackUrl="/setup?step=google" label={status.signedInAs ? 'Sign in again' : 'Sign in with Google'} />
            : <button type="button" className="btn primary" disabled title="Save your Client ID and secret first">Sign in with Google</button>
        ) : (
          !complete && mode === 'edit' && <a className="btn small" href="/setup?step=google">Open the setup wizard to sign in</a>
        )}
        {!saved && <span className="field-hint">Save a Client ID and secret to enable sign-in.</span>}
        {status.signedInAs && !status.googleConnected && (
          <span className="field-hint">Signed in, but no Calendar/Gmail token was stored. Sign in again and accept all permissions.</span>
        )}
      </div>

      {hasBuiltin && !showOwnClient && (
        <button type="button" className="link-btn" onClick={() => setAdvanced(true)}>Advanced: use my own Google Cloud client</button>
      )}

      {showOwnClient && (
        <details open className="advanced-box">
          <summary>Your own Google Cloud OAuth client</summary>
          <ol className="setup-steps-list">
            <li>
              <ExtLink href="https://console.cloud.google.com/projectcreate">Create a Google Cloud project</ExtLink> (any name, e.g. “Life OS”).
            </li>
            <li>
              Enable the <ExtLink href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com">Google Calendar API</ExtLink> and
              the <ExtLink href="https://console.cloud.google.com/apis/library/gmail.googleapis.com">Gmail API</ExtLink>.
            </li>
            <li>
              Open the <ExtLink href="https://console.cloud.google.com/apis/credentials/consent">OAuth consent screen</ExtLink> → <strong>External</strong>,
              fill in the app name and your email, add yourself under <strong>Test users</strong>, then press <strong>Publish app</strong>
              (in testing mode Google expires your login every 7 days).
            </li>
            <li>
              <ExtLink href="https://console.cloud.google.com/apis/credentials">Credentials</ExtLink> → <strong>Create credentials → OAuth client ID</strong> →
              type <strong>Web application</strong> → add this redirect URI:
              <CopyRow value={redirect} />
            </li>
          </ol>
          <div className="grid-2">
            <Field label="Client ID"><input className="text-input" value={id} onChange={(e) => setId(e.target.value)} autoComplete="off" placeholder="…apps.googleusercontent.com" /></Field>
            <Field label="Client secret">
              <input className="text-input" type="password" autoComplete="off" value={secret}
                placeholder={status.google.hasSecret && !usingBuiltin ? SECRET_PLACEHOLDER : 'GOCSPX-…'} onChange={(e) => setSecret(e.target.value)} />
            </Field>
          </div>
          <div className="btn-row">
            <button type="button" className="btn primary small" onClick={save} disabled={busy !== null || !id.trim() || !secret.trim()}>
              <Busy when={busy === 'save'}>Save</Busy>
            </button>
            {hasBuiltin && !usingBuiltin && (
              <button type="button" className="btn small" onClick={useBuiltin} disabled={busy !== null}>
                <Busy when={busy === 'builtin'}>Switch back to the built-in client</Busy>
              </button>
            )}
          </div>
        </details>
      )}
      <Note note={note} />
    </div>
  );
}
