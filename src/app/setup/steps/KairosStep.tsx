'use client';
import { useEffect, useState } from 'react';
import { Busy, Note, saveConfig, useAction, type StepProps, type ToolsStatus } from './shared';

export function KairosStep({ status, onSaved, onGoToTools }: StepProps & { onGoToTools?: () => void }) {
  const [tools, setTools] = useState<ToolsStatus | null>(null);
  const { busy, note, run } = useAction();
  useEffect(() => {
    fetch('/api/setup/tools', { cache: 'no-store' }).then((r) => r.ok ? r.json() : null).then(setTools).catch(() => {});
  }, []);
  const platform = tools?.platform ?? (typeof window !== 'undefined' ? window.lifeos?.platform : undefined);
  const possible = Boolean(tools?.kairosPossible);

  const setEnabled = (enabled: boolean) => run('save', async () => {
    const ok = await saveConfig({ kairos: { enabled } });
    if (ok) await onSaved();
    return { ok, text: ok ? (enabled ? 'Kairos enabled' : 'Kairos disabled') : 'Could not save' };
  });

  return (
    <div className="step-stack">
      <p className="setup-text">
        Kairos is a Claude Code session that lives inside Life OS (the ✧ icon) — a terminal assistant that can read your notes,
        run tasks and answer questions. It needs <strong>tmux</strong> and the <strong>Claude Code CLI</strong> on this machine. Its icon appears once enabled.
      </p>
      {platform === 'win32' ? (
        <p className="pill-note">Not available on Windows (tmux is required).</p>
      ) : !tools ? (
        <span className="spin" />
      ) : possible ? (
        <label className="checkbox-row">
          <input type="checkbox" checked={status.kairos.enabled} disabled={busy !== null} onChange={(e) => setEnabled(e.target.checked)} />
          <span>Enable Kairos <Busy when={busy === 'save'}>{null}</Busy></span>
        </label>
      ) : (
        <div className="choice-box">
          <div className="label">Missing: {[!tools.tmux && 'tmux', !tools.claude && 'Claude Code'].filter(Boolean).join(' and ')}</div>
          <div className="sub">Install them first, then come back here.</div>
          {onGoToTools
            ? <button type="button" className="btn small" onClick={onGoToTools}>Go to Install tools</button>
            : <a className="btn small" href="/setup?step=tools">Open Install tools</a>}
        </div>
      )}
      <p className="field-hint">
        Claude Code logs in separately from Life OS — the first time you open Kairos, run <code>/login</code> in its terminal.
        Its working folder is <code>{status.kairos.dir || '(default)'}</code>.
      </p>
      <Note note={note} />
    </div>
  );
}
