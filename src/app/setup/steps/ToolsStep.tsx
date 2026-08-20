'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Busy, CopyRow, Note, saveConfig, useAction, type StepProps, type ToolsStatus } from './shared';

type Target = 'ollama' | 'tmux' | 'claude' | 'all';

function commandsFor(platform: string): { label: string; cmd: string }[] {
  if (platform === 'darwin') return [{ label: 'Everything (Homebrew)', cmd: 'brew install ollama tmux && npm i -g @anthropic-ai/claude-code' }];
  if (platform === 'win32') return [
    { label: 'Ollama', cmd: 'winget install Ollama.Ollama' },
    { label: 'Claude Code', cmd: 'npm i -g @anthropic-ai/claude-code' },
  ];
  return [
    { label: 'Ollama', cmd: 'curl -fsSL https://ollama.com/install.sh | sh' },
    { label: 'tmux', cmd: 'sudo apt install tmux' },
    { label: 'Claude Code', cmd: 'npm i -g @anthropic-ai/claude-code' },
  ];
}

export function ToolsStep({ status, onSaved }: StepProps) {
  const [tools, setTools] = useState<ToolsStatus | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [installing, setInstalling] = useState<Target | null>(null);
  const [pulls, setPulls] = useState<Record<string, { pct: number; status: string; done?: boolean; error?: string }>>({});
  const { busy, note, run } = useAction();
  const logRef = useRef<HTMLPreElement>(null);
  const desktop = typeof window !== 'undefined' ? window.lifeos : undefined;
  const platform = tools?.platform ?? desktop?.platform ?? 'darwin';

  const poll = useCallback(async () => {
    try { const r = await fetch('/api/setup/tools', { cache: 'no-store' }); if (r.ok) setTools(await r.json()); } catch { /* offline */ }
  }, []);
  useEffect(() => { poll(); }, [poll]);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [log]);

  const install = async (target: Target) => {
    if (!desktop) return;
    setInstalling(target); setLog([`$ install ${target}`]);
    const off = desktop.onInstallerOutput((line) => setLog((l) => [...l.slice(-500), line]));
    try {
      const r = await desktop.runInstaller(target);
      setLog((l) => [...l, r.ok ? '✓ done' : `✗ exited with code ${r.code}`]);
    } catch (e) {
      setLog((l) => [...l, `✗ ${String((e as Error).message ?? e)}`]);
    } finally { off(); setInstalling(null); poll(); }
  };

  const pull = async (model: string) => {
    setPulls((p) => ({ ...p, [model]: { pct: 0, status: 'starting' } }));
    try {
      const r = await fetch('/api/setup/ollama/pull', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model }) });
      if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
      const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          let j: { status?: string; completed?: number; total?: number; error?: string };
          try { j = JSON.parse(line); } catch { continue; }
          if (j.error) throw new Error(j.error);
          const pct = j.total ? Math.round(((j.completed ?? 0) / j.total) * 100) : 0;
          setPulls((p) => ({ ...p, [model]: { pct, status: j.status ?? '' } }));
        }
      }
      setPulls((p) => ({ ...p, [model]: { pct: 100, status: 'ready', done: true } }));
    } catch (e) {
      setPulls((p) => ({ ...p, [model]: { pct: 0, status: 'failed', error: String((e as Error).message ?? e) } }));
    } finally { poll(); }
  };

  const useAnthropicOnly = () => run('anthropic', async () => {
    const ok = await saveConfig({ ai: { provider: 'anthropic' } });
    if (ok) await onSaved();
    return { ok, text: ok ? 'Switched to Anthropic for everything — the AI step is now required.' : 'Could not save' };
  });
  const useOllama = () => run('ollama', async () => {
    const ok = await saveConfig({ ai: { provider: 'ollama' } });
    if (ok) await onSaved();
    return { ok, text: ok ? 'Using local Ollama models.' : 'Could not save' };
  });

  const Item = ({ ok, name, sub, target }: { ok: boolean; name: string; sub: string; target?: Target }) => (
    <li className={`tool-item${ok ? ' ok' : ''}`}>
      <span className={`dot ${ok ? 'on' : ''}`} />
      <span className="tool-name">{name}</span>
      <span className="tool-sub">{sub}</span>
      {!ok && desktop && target && (
        <button type="button" className="btn small" disabled={installing !== null} onClick={() => install(target)}>
          <Busy when={installing === target}>Install</Busy>
        </button>
      )}
    </li>
  );

  const missingModels = tools ? tools.ollama.wanted.filter((m) => !tools.ollama.models.some((x) => x === m || x.startsWith(`${m}:`) || m.startsWith(`${x}:`))) : [];
  const anthropicOnly = status.ai.provider === 'anthropic';

  return (
    <div className="step-stack">
      <p className="setup-text">
        These are optional helpers that run on this machine. <strong>Ollama</strong> runs private local AI models for Tasks, Recipes and
        Passwords. <strong>tmux</strong> and <strong>Claude Code</strong> power Kairos, the built-in terminal assistant.
      </p>

      <ul className="tool-list">
        {!tools && <li className="tool-item"><span className="spin" /> Checking…</li>}
        {tools && <>
          <Item ok={Boolean(tools.ollama.installed)} name="Ollama" target="ollama"
            sub={tools.ollama.installed ? (tools.ollama.running ? `running · ${tools.ollama.models.length} model(s)` : 'installed, not running — open the Ollama app') : 'not installed'} />
          {platform !== 'win32' && <Item ok={Boolean(tools.tmux)} name="tmux" target="tmux" sub={tools.tmux ? 'installed' : 'not installed'} />}
          <Item ok={Boolean(tools.claude)} name="Claude Code CLI" target="claude" sub={tools.claude ? 'installed' : 'not installed'} />
        </>}
      </ul>

      <div className="btn-row">
        {desktop ? (
          <button type="button" className="btn primary" disabled={installing !== null} onClick={() => install('all')}>
            <Busy when={installing === 'all'}>Install everything</Busy>
          </button>
        ) : null}
        <button type="button" className="btn small" onClick={poll}>Re-check</button>
      </div>

      {!desktop && (
        <div className="step-stack nested">
          <span className="field-label">Run in a terminal, then press Re-check:</span>
          {commandsFor(platform).map((c) => <CopyRow key={c.cmd} label={c.label} value={c.cmd} />)}
          {platform === 'win32' && <span className="field-hint">tmux is not available on Windows, so Kairos is not either.</span>}
        </div>
      )}

      {log.length > 0 && <pre className="setup-log" ref={logRef}>{log.join('\n')}</pre>}

      {tools?.ollama.running && !anthropicOnly && (
        <div className="step-stack nested">
          <span className="field-label">Local models</span>
          {tools.ollama.wanted.map((m) => {
            const have = !missingModels.includes(m); const p = pulls[m];
            return (
              <div key={m} className="model-row">
                <span className={`dot ${have || p?.done ? 'on' : ''}`} />
                <code className="model-name">{m}</code>
                {p && !p.done && !p.error && (
                  <div className="progress-bar"><span style={{ width: `${p.pct}%` }} /></div>
                )}
                {p && !p.done && !p.error && <span className="tool-sub">{p.pct}% {p.status}</span>}
                {p?.error && <span className="tool-sub err">{p.error}</span>}
                {!have && !p?.done && (
                  <button type="button" className="btn small" disabled={Boolean(p && !p.error)} onClick={() => pull(m)}>
                    {p?.error ? 'Retry' : 'Pull'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="choice-box">
        {anthropicOnly ? (
          <>
            <div className="label">Using Anthropic for everything</div>
            <div className="sub">Local AI is off. The AI step is required, and text you paste into Passwords, Tasks and Recipes is sent to Anthropic&apos;s API.</div>
            <button type="button" className="btn small" onClick={useOllama} disabled={busy !== null}><Busy when={busy === 'ollama'}>Switch back to local Ollama</Busy></button>
          </>
        ) : (
          <>
            <div className="label">I don&apos;t want local AI — use Anthropic for everything</div>
            <div className="sub">
              Skips Ollama entirely. The <strong>AI</strong> step then becomes required, and text you paste into Passwords, Tasks and Recipes
              is sent to Anthropic&apos;s API instead of staying on this machine.
            </div>
            <button type="button" className="btn small" onClick={useAnthropicOnly} disabled={busy !== null}><Busy when={busy === 'anthropic'}>Use Anthropic for everything</Busy></button>
          </>
        )}
      </div>
      <Note note={note} />
    </div>
  );
}
