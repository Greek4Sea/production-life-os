// Preload: the only bridge between the renderer (Next.js UI) and the Electron
// main process. Keep the surface minimal and typed.
import { contextBridge, ipcRenderer } from 'electron';

type InstallTarget = 'ollama' | 'tmux' | 'claude' | 'all';

export interface LifeOsBridge {
  pickFolder(): Promise<string | null>;
  runInstaller(target: InstallTarget): Promise<{ ok: boolean; code: number }>;
  onInstallerOutput(cb: (line: string) => void): () => void;
  openExternal(url: string): void;
  platform: string;
  version: string;
}

let version = process.env.npm_package_version ?? '';
void ipcRenderer.invoke('lifeos:version').then((v: string) => { version = v; }).catch(() => {});

const bridge: LifeOsBridge = {
  pickFolder: () => ipcRenderer.invoke('lifeos:pickFolder'),
  runInstaller: (target) => ipcRenderer.invoke('lifeos:runInstaller', target),
  onInstallerOutput: (cb) => {
    const handler = (_e: Electron.IpcRendererEvent, line: string) => cb(line);
    ipcRenderer.on('lifeos:installer-output', handler);
    return () => ipcRenderer.removeListener('lifeos:installer-output', handler);
  },
  openExternal: (url) => { void ipcRenderer.invoke('lifeos:openExternal', url); },
  platform: process.platform,
  get version() { return version; },
};

contextBridge.exposeInMainWorld('lifeos', bridge);
