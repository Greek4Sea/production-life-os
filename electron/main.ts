// Electron shell for Life OS.
//
// Boots the bundled Next.js custom server (server.js) as a child Node process,
// waits until /api/setup/status answers, then opens a BrowserWindow on it.
// The server keeps running (syncing, scheduling) while the window is hidden;
// a tray icon lets the user re-open / restart / quit.
import {
  app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Notification, shell, Tray,
} from 'electron';
import { ChildProcess, spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import net from 'net';
import os from 'os';
import path from 'path';
import readline from 'readline';

const PREFERRED_PORT = 3210; // Google OAuth redirect URI is pinned to this port.
const LOG_MAX_BYTES = 5 * 1024 * 1024;
const READY_TIMEOUT_MS = 60_000;
const NOTIFY_INTERVAL_MS = 30_000;
const ALLOWED_HOSTS = /^(accounts\.google\.com|([a-z0-9-]+\.)*google\.com|accounts\.spotify\.com)$/i;

let port = PREFERRED_PORT;
let dataDir = '';
let logPath = '';
let logStream: fs.WriteStream | null = null;
let server: ChildProcess | null = null;
let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
let notifyTimer: NodeJS.Timeout | null = null;

// ---------------------------------------------------------------- paths

const isPackaged = app.isPackaged;
const repoRoot = path.resolve(__dirname, '..', '..'); // electron/dist → repo

function resolveServer(): { serverRoot: string; serverJs: string; migrationsDir: string; scriptsDir: string } {
  if (isPackaged) {
    const serverRoot = path.join(process.resourcesPath, 'app');
    return {
      serverRoot,
      serverJs: path.join(serverRoot, 'server.js'),
      migrationsDir: path.join(process.resourcesPath, 'drizzle'),
      scriptsDir: path.join(process.resourcesPath, 'scripts'),
    };
  }
  const standalone = path.join(repoRoot, '.next', 'standalone');
  const serverRoot = fs.existsSync(path.join(standalone, 'server.js')) ? standalone : repoRoot;
  return {
    serverRoot,
    serverJs: path.join(serverRoot, 'server.js'),
    migrationsDir: path.join(repoRoot, 'drizzle'),
    scriptsDir: path.join(repoRoot, 'scripts'),
  };
}

function widenedPath(): string {
  const home = os.homedir();
  const extra = process.platform === 'win32'
    ? [path.join(home, 'AppData', 'Local', 'Programs', 'Ollama'), path.join(home, 'AppData', 'Roaming', 'npm')]
    : ['/opt/homebrew/bin', '/usr/local/bin', path.join(home, '.local', 'bin'), path.join(home, '.npm-global', 'bin'), '/snap/bin', '/usr/bin', '/bin'];
  return [process.env.PATH ?? '', ...extra].filter(Boolean).join(path.delimiter);
}

// ---------------------------------------------------------------- logging

function openLog() {
  const dir = path.join(dataDir, 'logs');
  fs.mkdirSync(dir, { recursive: true });
  logPath = path.join(dir, 'server.log');
  try {
    if (fs.existsSync(logPath) && fs.statSync(logPath).size > LOG_MAX_BYTES) {
      fs.renameSync(logPath, path.join(dir, 'server.log.1'));
    }
  } catch { /* best effort */ }
  logStream = fs.createWriteStream(logPath, { flags: 'a' });
}

function log(line: string) {
  const msg = `[${new Date().toISOString()}] ${line}`;
  console.log(msg);
  logStream?.write(msg + '\n');
}

// ---------------------------------------------------------------- port

// A port counts as free only if nothing holds it on ANY interface — another
// server bound to 0.0.0.0 would still win the race for http://localhost:<p>.
function bindable(p: number, host?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    if (host) srv.listen(p, host); else srv.listen(p);
  });
}
async function portFree(p: number): Promise<boolean> {
  return (await bindable(p)) && (await bindable(p, '127.0.0.1'));
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const p = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(p));
    });
  });
}

async function choosePort(): Promise<number> {
  const forced = parseInt(process.env.LIFEOS_PORT ?? '', 10);
  if (forced) return forced;
  if (await portFree(PREFERRED_PORT)) return PREFERRED_PORT;
  const p = await freePort();
  log(`WARNING: port ${PREFERRED_PORT} is busy; using ${p}. Google OAuth redirect URIs pinned to ${PREFERRED_PORT} will not work until the other process is stopped.`);
  return p;
}

// ---------------------------------------------------------------- server

function startServer() {
  const { serverRoot, serverJs, migrationsDir } = resolveServer();
  if (!fs.existsSync(serverJs)) {
    throw new Error(`server.js not found at ${serverJs} (run \`npm run build\` first)`);
  }
  log(`starting server: ${serverJs} (cwd ${serverRoot}) on port ${port}`);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    PORT: String(port),
    HOST: '127.0.0.1',
    LIFEOS_DATA_DIR: dataDir,
    LIFEOS_MIGRATIONS_DIR: migrationsDir,
    NODE_ENV: 'production',
    LIFEOS_DESKTOP: '1',
    PATH: widenedPath(),
  };
  const child = spawn(process.execPath, [serverJs], { env, cwd: serverRoot, stdio: ['ignore', 'pipe', 'pipe'] });
  server = child;
  const pipe = (stream: NodeJS.ReadableStream | null, tag: string) => {
    if (!stream) return;
    readline.createInterface({ input: stream }).on('line', (l) => log(`[server:${tag}] ${l}`));
  };
  pipe(child.stdout, 'out');
  pipe(child.stderr, 'err');
  child.on('exit', (code, signal) => {
    log(`server exited (code=${code} signal=${signal})`);
    if (server === child) server = null;
  });
}

function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    const child = server;
    if (!child || child.exitCode !== null) { resolve(); return; }
    const killTimer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* gone */ } }, 3000);
    child.once('exit', () => { clearTimeout(killTimer); resolve(); });
    try { child.kill('SIGTERM'); } catch { clearTimeout(killTimer); resolve(); }
  });
}

function httpGet(url: string, headers: Record<string, string> = {}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers, timeout: 5000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (!server) throw new Error('server process exited during startup');
    try {
      const r = await httpGet(`http://127.0.0.1:${port}/api/setup/status`);
      if (r.status === 200) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`server did not become ready within ${READY_TIMEOUT_MS / 1000}s`);
}

// ---------------------------------------------------------------- window

const appUrl = (p = '/') => `http://localhost:${port}${p.startsWith('/') ? p : `/${p}`}`;

function isAllowedNavigation(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.hostname === 'localhost' && u.port === String(port)) return true;
    return (u.protocol === 'https:') && ALLOWED_HOSTS.test(u.hostname);
  } catch { return false; }
}

function openExternalSafe(raw: string) {
  try {
    const u = new URL(raw);
    if (u.protocol === 'http:' || u.protocol === 'https:') void shell.openExternal(u.toString());
  } catch { /* ignore */ }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'Life OS',
    backgroundColor: '#020617',
    show: false,
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' as const } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.once('ready-to-show', () => win?.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedNavigation(url)) return { action: 'allow' };
    openExternalSafe(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (isAllowedNavigation(url)) return;
    e.preventDefault();
    openExternalSafe(url);
  });

  win.on('close', (e) => {
    if (process.platform === 'darwin' && !quitting) {
      e.preventDefault();
      win?.hide();
    }
  });
  win.on('closed', () => { win = null; });

  void win.loadURL(appUrl('/'));
}

function showWindow(route?: string) {
  if (!win) createWindow();
  else {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
  if (route && win) void win.loadURL(appUrl(route));
  if (process.platform === 'darwin') app.dock?.show();
}

// ---------------------------------------------------------------- tray

function trayIcon() {
  const candidates = [
    path.join(process.resourcesPath ?? '', 'app', 'public', 'icon-512.png'),
    path.join(repoRoot, 'public', 'icon-512.png'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      const img = nativeImage.createFromPath(c).resize({ width: 18, height: 18 });
      if (process.platform === 'darwin') img.setTemplateImage(false);
      return img;
    }
  }
  return nativeImage.createEmpty();
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip('Life OS');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Life OS', click: () => showWindow() },
    { label: 'Restart server', click: () => void restartServer() },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('click', () => showWindow());
}

async function restartServer() {
  log('restarting server (tray)');
  await stopServer();
  try {
    startServer();
    await waitForServer();
    win?.reload();
  } catch (e) {
    log(`restart failed: ${(e as Error).message}`);
    dialog.showErrorBox('Life OS', `Could not restart the server.\n\n${(e as Error).message}\n\nLog: ${logPath}`);
  }
}

// ---------------------------------------------------------------- notifications

function readCronSecret(): string {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(dataDir, 'config.json'), 'utf8'));
    return cfg?.core?.cronSecret ?? '';
  } catch { return ''; }
}

async function drainNotifications() {
  if (!server) return;
  const secret = readCronSecret();
  if (!secret) return;
  try {
    const r = await httpGet(`http://127.0.0.1:${port}/api/cron/desktop-queue`, { 'x-cron-secret': secret });
    if (r.status !== 200) return;
    const items: { title: string; body?: string; url?: string }[] = JSON.parse(r.body)?.notifications ?? [];
    for (const item of items) {
      if (!Notification.isSupported()) break;
      const n = new Notification({ title: item.title, body: item.body ?? '' });
      n.on('click', () => showWindow(item.url || '/'));
      n.show();
    }
  } catch (e) {
    log(`notification poll failed: ${(e as Error).message}`);
  }
}

// ---------------------------------------------------------------- IPC

type InstallTarget = 'ollama' | 'tmux' | 'claude' | 'all';
const INSTALL_TARGETS: InstallTarget[] = ['ollama', 'tmux', 'claude', 'all'];

function registerIpc() {
  ipcMain.handle('lifeos:pickFolder', async () => {
    const opts: Electron.OpenDialogOptions = { properties: ['openDirectory', 'createDirectory'] };
    const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
    return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
  });

  ipcMain.handle('lifeos:openExternal', (_e, url: unknown) => {
    if (typeof url === 'string') openExternalSafe(url);
  });

  ipcMain.handle('lifeos:version', () => app.getVersion());

  ipcMain.handle('lifeos:runInstaller', (event, target: unknown) => {
    if (typeof target !== 'string' || !INSTALL_TARGETS.includes(target as InstallTarget)) {
      return Promise.resolve({ ok: false, code: 2 });
    }
    const { scriptsDir } = resolveServer();
    const send = (line: string) => {
      if (!event.sender.isDestroyed()) event.sender.send('lifeos:installer-output', line);
      log(`[installer] ${line}`);
    };
    let cmd: string; let args: string[];
    if (process.platform === 'win32') {
      cmd = 'powershell';
      args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(scriptsDir, 'install-tools.ps1'), target];
    } else {
      cmd = '/bin/bash';
      args = [path.join(scriptsDir, 'install-tools.sh'), target];
    }
    return new Promise<{ ok: boolean; code: number }>((resolve) => {
      let child: ChildProcess;
      try {
        child = spawn(cmd, args, {
          env: { ...process.env, PATH: widenedPath(), NONINTERACTIVE: '1', CI: '1' },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (e) {
        send(`failed to start installer: ${(e as Error).message}`);
        resolve({ ok: false, code: 1 });
        return;
      }
      send(`$ ${cmd} ${args.join(' ')}`);
      readline.createInterface({ input: child.stdout! }).on('line', send);
      readline.createInterface({ input: child.stderr! }).on('line', send);
      child.on('error', (e) => { send(`installer error: ${e.message}`); resolve({ ok: false, code: 1 }); });
      child.on('close', (code) => resolve({ ok: code === 0, code: code ?? 1 }));
    });
  });
}

// ---------------------------------------------------------------- lifecycle

app.setName('Life OS');
app.setAboutPanelOptions({
  applicationName: 'Life OS',
  applicationVersion: app.getVersion(),
  copyright: 'MIT License',
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());

  app.whenReady().then(async () => {
    dataDir = app.getPath('userData');
    fs.mkdirSync(dataDir, { recursive: true });
    openLog();
    log(`Life OS ${app.getVersion()} starting (packaged=${isPackaged}, dataDir=${dataDir})`);

    registerIpc();
    try {
      port = await choosePort();
      startServer();
      await waitForServer();
    } catch (e) {
      log(`startup failed: ${(e as Error).message}`);
      dialog.showErrorBox('Life OS could not start',
        `${(e as Error).message}\n\nSee the server log for details:\n${logPath}`);
      quitting = true;
      app.quit();
      return;
    }

    createTray();
    createWindow();
    notifyTimer = setInterval(() => void drainNotifications(), NOTIFY_INTERVAL_MS);
  });

  app.on('activate', () => showWindow()); // macOS dock click

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') { quitting = true; app.quit(); }
  });

  let cleanedUp = false;
  app.on('before-quit', (e) => {
    quitting = true;
    if (cleanedUp) return;
    e.preventDefault();
    if (notifyTimer) clearInterval(notifyTimer);
    void stopServer().finally(() => {
      cleanedUp = true;
      logStream?.end();
      app.quit();
    });
  });
}
