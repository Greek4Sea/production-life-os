'use client';
import { useState, type ReactNode } from 'react';
import type { PublicConfig } from '@/lib/config';
import type { ToolsStatus } from '@/lib/tools';

export type SetupStatus = PublicConfig & { signedInAs: string | null; googleConnected: boolean; version?: string };
export type { ToolsStatus };

export type StepMode = 'wizard' | 'edit';
export interface StepProps {
  mode: StepMode;
  status: SetupStatus;
  onSaved: () => Promise<void> | void;
}

export async function fetchStatus(): Promise<SetupStatus> {
  const r = await fetch('/api/setup/status', { cache: 'no-store' });
  if (!r.ok) throw new Error(`status ${r.status}`);
  return r.json();
}

export async function saveConfig(patch: Record<string, unknown>): Promise<boolean> {
  const r = await fetch('/api/setup/config', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch),
  });
  return r.ok;
}

export type TestResult = { ok: boolean; detail: string; models?: string[] };
export async function runTest(what: 'anthropic' | 'canvas' | 'ollama' | 'folder', body: Record<string, unknown> = {}): Promise<TestResult> {
  const r = await fetch(`/api/setup/test?what=${what}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: Boolean(j.ok), detail: j.detail ?? j.error ?? `HTTP ${r.status}`, models: j.models };
}

export function openExternal(url: string) {
  if (typeof window === 'undefined') return;
  if (window.lifeos?.openExternal) window.lifeos.openExternal(url);
  else window.open(url, '_blank', 'noopener');
}

export function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="ext-link" target="_blank" rel="noopener"
      onClick={(e) => { e.preventDefault(); openExternal(href); }}>
      {children}
    </a>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function CopyRow({ value, label }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* no clipboard */ }
  };
  return (
    <div className="copy-row">
      {label && <span className="copy-label">{label}</span>}
      <code className="copy-value">{value}</code>
      <button type="button" className="btn small" onClick={copy}>{done ? 'Copied' : 'Copy'}</button>
    </div>
  );
}

// Tiny state machine for "Save" / "Test" buttons with a status line.
export function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (name: string, fn: () => Promise<{ ok: boolean; text: string } | void>) => {
    setBusy(name); setNote(null);
    try {
      const r = await fn();
      if (r) setNote(r);
    } catch (e) {
      setNote({ ok: false, text: String((e as Error).message ?? e) });
    } finally { setBusy(null); }
  };
  return { busy, note, run, setNote };
}

export function Note({ note }: { note: { ok: boolean; text: string } | null }) {
  if (!note) return null;
  return <p className={`pill-note ${note.ok ? 'ok-note' : 'err-note'}`} role="status">{note.text}</p>;
}

export function Busy({ when, children }: { when: boolean; children: ReactNode }) {
  return when ? <span className="spin" /> : <>{children}</>;
}

export function SaveBar({ busy, onSave, label = 'Save', disabled }: { busy: boolean; onSave: () => void; label?: string; disabled?: boolean }) {
  return (
    <div className="save-bar">
      <button type="button" className="btn primary small" onClick={onSave} disabled={busy || disabled}>
        <Busy when={busy}>{label}</Busy>
      </button>
    </div>
  );
}

export const SECRET_PLACEHOLDER = '•••••••• (saved — paste to replace)';

export function FolderInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const canPick = typeof window !== 'undefined' && Boolean(window.lifeos?.pickFolder);
  return (
    <div className="folder-input">
      <input className="text-input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {canPick && (
        <button type="button" className="btn small" onClick={async () => {
          const p = await window.lifeos!.pickFolder();
          if (p) onChange(p);
        }}>Browse…</button>
      )}
    </div>
  );
}
