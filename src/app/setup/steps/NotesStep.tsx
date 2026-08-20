'use client';
import { useEffect, useState } from 'react';
import { Busy, Field, FolderInput, Note, runTest, saveConfig, useAction, type StepProps } from './shared';

export function NotesStep({ status, onSaved }: StepProps) {
  const [vault, setVault] = useState(status.obsidian.vault);
  const [pw, setPw] = useState(status.passwords.vault);
  const { busy, note, run } = useAction();
  useEffect(() => { setVault(status.obsidian.vault); setPw(status.passwords.vault); }, [status.obsidian.vault, status.passwords.vault]);

  const save = () => run('save', async () => {
    const ok = await saveConfig({ obsidian: { vault: vault.trim() }, passwords: { vault: pw.trim() } });
    if (ok) await onSaved();
    return { ok, text: ok ? 'Saved' : 'Could not save' };
  });
  const test = (which: 'vault' | 'pw') => run(which, async () => {
    const r = await runTest('folder', { path: which === 'vault' ? vault.trim() : pw.trim() });
    return { ok: r.ok, text: r.detail };
  });

  return (
    <div className="step-stack">
      <p className="setup-text">
        Optional. Point Life OS at an Obsidian vault: quick captures land in <code>Daily/</code> and the app mirrors
        its data (mail, fitness, competitions) into a <code>LifeOS/</code> folder you can read in Obsidian.
        Passwords live in a <em>separate</em> vault so they never mix with your notes. The Notes and Passwords tiles appear once their folders are set.
      </p>
      <Field label="Notes vault folder" hint="Any folder works — Obsidian is optional. Created files are plain Markdown.">
        <FolderInput value={vault} onChange={setVault} placeholder="/Users/you/Documents/Vault" />
      </Field>
      <div className="btn-row">
        <button type="button" className="btn small" onClick={() => test('vault')} disabled={busy !== null || !vault.trim()}>
          <Busy when={busy === 'vault'}>Check folder</Busy>
        </button>
      </div>
      <Field label="Passwords vault folder (separate)">
        <FolderInput value={pw} onChange={setPw} placeholder="/Users/you/Documents/Passwords" />
      </Field>
      <div className="btn-row">
        <button type="button" className="btn small" onClick={() => test('pw')} disabled={busy !== null || !pw.trim()}>
          <Busy when={busy === 'pw'}>Check folder</Busy>
        </button>
        <button type="button" className="btn primary small" onClick={save} disabled={busy !== null}>
          <Busy when={busy === 'save'}>Save</Busy>
        </button>
      </div>
      <Note note={note} />
    </div>
  );
}
