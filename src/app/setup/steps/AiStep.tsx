'use client';
import { useEffect, useState } from 'react';
import { Busy, ExtLink, Field, Note, SECRET_PLACEHOLDER, runTest, saveConfig, useAction, type StepProps } from './shared';

export function AiStep({ status, onSaved }: StepProps) {
  const [key, setKey] = useState('');
  const [provider, setProvider] = useState(status.ai.provider);
  const [o, setO] = useState(status.ollama);
  const [adv, setAdv] = useState(false);
  const { busy, note, run } = useAction();
  useEffect(() => { setProvider(status.ai.provider); setO(status.ollama); }, [status.ai.provider, status.ollama]);
  const required = provider === 'anthropic';

  const save = () => run('save', async () => {
    const patch: Record<string, unknown> = { ai: { provider }, ollama: o };
    if (key.trim()) patch.anthropic = { apiKey: key.trim() };
    const ok = await saveConfig(patch);
    if (ok) { setKey(''); await onSaved(); }
    return { ok, text: ok ? 'Saved' : 'Could not save' };
  });
  const test = () => run('test', async () => {
    const r = await runTest('anthropic', key.trim() ? { apiKey: key.trim() } : {});
    return { ok: r.ok, text: r.detail };
  });
  const testOllama = () => run('ollama', async () => {
    const ok = await saveConfig({ ollama: o });
    const r = await runTest('ollama');
    return { ok: ok && r.ok, text: r.detail };
  });

  return (
    <div className="step-stack">
      <p className="setup-text">
        The Gmail tile appears once you are signed in to Google <em>and</em> an Anthropic key is saved.
        An Anthropic API key powers <strong>Gmail triage and reply drafts</strong> and <strong>Calendar chat</strong>.
        {required
          ? ' You chose Anthropic for everything, so Tasks, Recipes and Passwords use it too — this key is required.'
          : ' Tasks, Recipes and Passwords run on local Ollama models, so the key is optional.'}
      </p>
      <Field label="Anthropic API key" hint={<>Create one at <ExtLink href="https://console.anthropic.com/settings/keys">console.anthropic.com/settings/keys</ExtLink>.</>}>
        <input className="text-input" type="password" autoComplete="off" value={key}
          placeholder={status.anthropic.hasKey ? SECRET_PLACEHOLDER : 'sk-ant-…'} onChange={(e) => setKey(e.target.value)} />
      </Field>
      <Field label="Provider for Tasks / Recipes / Passwords">
        <select className="tz-select" value={provider} onChange={(e) => setProvider(e.target.value as 'ollama' | 'anthropic')}>
          <option value="ollama">Local Ollama (private, runs on this machine)</option>
          <option value="anthropic">Anthropic API (text is sent to Anthropic)</option>
        </select>
      </Field>
      <div className="btn-row">
        <button type="button" className="btn small" onClick={test} disabled={busy !== null || (!key.trim() && !status.anthropic.hasKey)}>
          <Busy when={busy === 'test'}>Test key</Busy>
        </button>
        <button type="button" className="btn primary small" onClick={save} disabled={busy !== null}>
          <Busy when={busy === 'save'}>Save</Busy>
        </button>
      </div>
      <Note note={note} />

      <button type="button" className="disclosure" onClick={() => setAdv(!adv)} aria-expanded={adv}>
        {adv ? '▾' : '▸'} Advanced: Ollama URL and model names
      </button>
      {adv && (
        <div className="step-stack nested">
          <Field label="Ollama URL"><input className="text-input" value={o.url} onChange={(e) => setO({ ...o, url: e.target.value })} /></Field>
          <div className="grid-3">
            <Field label="Tasks model"><input className="text-input" value={o.tasksModel} onChange={(e) => setO({ ...o, tasksModel: e.target.value })} /></Field>
            <Field label="Recipes model"><input className="text-input" value={o.recipesModel} onChange={(e) => setO({ ...o, recipesModel: e.target.value })} /></Field>
            <Field label="Passwords model"><input className="text-input" value={o.passwordsModel} onChange={(e) => setO({ ...o, passwordsModel: e.target.value })} /></Field>
          </div>
          <div className="btn-row">
            <button type="button" className="btn small" onClick={testOllama} disabled={busy !== null}>
              <Busy when={busy === 'ollama'}>Save &amp; test Ollama</Busy>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
