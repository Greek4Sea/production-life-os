// Bridge exposed by the Electron preload script. Absent in a plain browser —
// always feature-detect (`window.lifeos?.pickFolder`).
export {};

declare global {
  interface LifeOsDesktop {
    pickFolder(): Promise<string | null>;
    runInstaller(target: 'ollama' | 'tmux' | 'claude' | 'all'): Promise<{ ok: boolean; code: number }>;
    onInstallerOutput(cb: (line: string) => void): () => void;
    openExternal(url: string): void;
    platform: string;
    version: string;
  }
  interface Window {
    lifeos?: LifeOsDesktop;
  }
}
