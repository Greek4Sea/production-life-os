'use client';
import { useEffect, useState } from 'react';
import { Busy, Note, saveConfig, useAction, type StepProps } from './shared';

type Link = { label: string; url: string };

export function QuickLinksStep({ status, onSaved }: StepProps) {
  const [links, setLinks] = useState<Link[]>(status.quickLinks);
  const { busy, note, run } = useAction();
  useEffect(() => { setLinks(status.quickLinks); }, [status.quickLinks]);

  const update = (i: number, k: keyof Link, v: string) => setLinks((l) => l.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const save = () => run('save', async () => {
    const clean = links.map((l) => ({ label: l.label.trim(), url: l.url.trim() })).filter((l) => l.label && l.url);
    const bad = clean.find((l) => !/^https?:\/\//.test(l.url));
    if (bad) return { ok: false, text: `“${bad.label}” needs a URL starting with http:// or https://` };
    const ok = await saveConfig({ quickLinks: clean });
    if (ok) await onSaved();
    return { ok, text: ok ? 'Saved' : 'Could not save' };
  });

  return (
    <div className="step-stack">
      <p className="setup-text">Optional. Up to 8 links shown as small buttons on the edge of the dashboard — your bank, the school portal, anything you open daily.</p>
      <div className="link-rows">
        {links.map((l, i) => (
          <div className="link-row" key={i}>
            <input className="text-input" value={l.label} maxLength={24} placeholder="Label" onChange={(e) => update(i, 'label', e.target.value)} />
            <input className="text-input" value={l.url} placeholder="https://…" onChange={(e) => update(i, 'url', e.target.value)} />
            <button type="button" className="btn small danger" aria-label="Remove" onClick={() => setLinks((x) => x.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
      </div>
      <div className="btn-row">
        <button type="button" className="btn small" disabled={links.length >= 8} onClick={() => setLinks((l) => [...l, { label: '', url: '' }])}>+ Add link</button>
        <button type="button" className="btn primary small" onClick={save} disabled={busy !== null}><Busy when={busy === 'save'}>Save</Busy></button>
      </div>
      <Note note={note} />
    </div>
  );
}
