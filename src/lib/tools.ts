import { execFile } from 'child_process';
import os from 'os';
import path from 'path';
import { getConfig } from '@/lib/config';
import { ollamaStatus } from '@/lib/ollama';

// Detects the optional local tools the wizard can install: Ollama (local AI),
// tmux + Claude Code (Kairos terminal). PATH is widened with the usual
// per-user install locations because GUI apps inherit a minimal PATH.
export function widenedPath(): string {
  const home = os.homedir();
  const extra = process.platform === 'win32'
    ? [path.join(home, 'AppData', 'Local', 'Programs', 'Ollama'), path.join(home, 'AppData', 'Roaming', 'npm')]
    : ['/opt/homebrew/bin', '/usr/local/bin', path.join(home, '.local', 'bin'), path.join(home, '.npm-global', 'bin'), '/snap/bin', '/usr/bin', '/bin'];
  return [process.env.PATH ?? '', ...extra].filter(Boolean).join(path.delimiter);
}

export function which(bin: string): Promise<string | null> {
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  return new Promise((resolve) => {
    execFile(cmd, [bin], { env: { ...process.env, PATH: widenedPath() }, timeout: 5000 },
      (err, stdout) => resolve(err ? null : stdout.split(/\r?\n/)[0].trim() || null));
  });
}

export type ToolsStatus = {
  platform: NodeJS.Platform;
  ollama: { installed: string | null; running: boolean; models: string[]; wanted: string[] };
  tmux: string | null;
  claude: string | null;
  kairosPossible: boolean;
};

export async function toolsStatus(): Promise<ToolsStatus> {
  const c = getConfig();
  const [ollamaBin, tmux, claude, oll] = await Promise.all([
    which('ollama'), process.platform === 'win32' ? Promise.resolve(null) : which('tmux'), which('claude'), ollamaStatus(),
  ]);
  const wanted = Array.from(new Set([c.ollama.tasksModel, c.ollama.recipesModel, c.ollama.passwordsModel]));
  return {
    platform: process.platform,
    ollama: { installed: ollamaBin, running: oll.reachable, models: oll.models, wanted },
    tmux, claude,
    kairosPossible: Boolean(tmux && claude),
  };
}
