import { execFile, spawn } from 'child_process';
import os from 'os';
import path from 'path';

// Makes sure a local Ollama server is answering; if not, starts `ollama serve`
// detached (it keeps running after we exit) and waits for it to come up.
const EXTRA_PATH = process.platform === 'win32'
  ? [path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Ollama')]
  : ['/opt/homebrew/bin', '/usr/local/bin', path.join(os.homedir(), '.local', 'bin'), '/usr/bin', '/bin'];
const PATH = [process.env.PATH ?? '', ...EXTRA_PATH].filter(Boolean).join(path.delimiter);

let starting: Promise<boolean> | null = null;

async function reachable(url: string): Promise<boolean> {
  try {
    const r = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch { return false; }
}

function findBinary(): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(process.platform === 'win32' ? 'where' : 'which', ['ollama'], { env: { ...process.env, PATH }, timeout: 4000 },
      (err, out) => resolve(err ? null : out.split(/\r?\n/)[0].trim() || null));
  });
}

export async function ensureOllamaRunning(url: string, waitMs = 20_000): Promise<boolean> {
  if (await reachable(url)) return true;
  // Only auto-start a local instance.
  if (!/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(url.replace(/\/+$/, ''))) return false;
  if (!starting) {
    starting = (async () => {
      const bin = await findBinary();
      if (!bin) return false;
      try {
        const env = { ...process.env, PATH };
        delete (env as Record<string, string | undefined>).ELECTRON_RUN_AS_NODE;
        const child = spawn(bin, ['serve'], { detached: true, stdio: 'ignore', env });
        child.unref();
        console.log('[life-os] started ollama serve');
      } catch (e) {
        console.log(`[life-os] could not start ollama: ${e}`);
        return false;
      }
      const deadline = Date.now() + waitMs;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 700));
        if (await reachable(url)) return true;
      }
      return false;
    })().finally(() => { setTimeout(() => { starting = null; }, 5000); });
  }
  return starting;
}
