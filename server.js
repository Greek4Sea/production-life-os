// Production server: Next.js + (optional) WebSocket PTY for the embedded
// Kairos terminal. Launched by the Electron shell or `npm start`.
//
// Env: PORT (default 3210), HOST (default 127.0.0.1), LIFEOS_DATA_DIR,
//      LIFEOS_MIGRATIONS_DIR (set by Electron; defaults work for `npm start`).
const { createServer } = require('http');
const { parse } = require('url');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const next = require('next');
const { WebSocketServer } = require('ws');

let pty = null;
try { pty = require('node-pty'); } catch { /* Kairos terminal unavailable on this build */ }

const port = parseInt(process.env.PORT || '3210', 10);
const host = process.env.HOST || '127.0.0.1';
process.env.AUTH_URL = process.env.AUTH_URL || `http://localhost:${port}`;
process.env.AUTH_TRUST_HOST = 'true';

const dataDir = process.env.LIFEOS_DATA_DIR || path.join(os.homedir(), '.life-os');
const configPath = path.join(dataDir, 'config.json');
const readConfig = () => { try { return JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch { return {}; } };

const EXTRA_PATH = process.platform === 'win32' ? [] : ['/opt/homebrew/bin', '/usr/local/bin', path.join(os.homedir(), '.local', 'bin'), '/usr/bin', '/bin'];
const widenedPath = () => [process.env.PATH || '', ...EXTRA_PATH].filter(Boolean).join(path.delimiter);
function findTmux() {
  const cfg = readConfig();
  if (cfg.kairos && cfg.kairos.tmuxPath && fs.existsSync(cfg.kairos.tmuxPath)) return cfg.kairos.tmuxPath;
  try { return execFileSync('which', ['tmux'], { env: { ...process.env, PATH: widenedPath() }, encoding: 'utf8' }).trim() || null; }
  catch { return null; }
}

globalThis.__kairosTickets = globalThis.__kairosTickets || new Map();

// Inside the standalone bundle the resolved Next config is pre-extracted
// (see scripts/prepare-standalone.mjs); from the repo, Next loads next.config.ts.
let conf;
const standaloneConfig = path.join(__dirname, 'standalone-config.json');
if (fs.existsSync(standaloneConfig)) {
  conf = JSON.parse(fs.readFileSync(standaloneConfig, 'utf8'));
  process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(conf);
  process.chdir(__dirname);
}
process.env.NODE_ENV = 'production';
const app = next({ dev: false, dir: __dirname, conf });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  // Boot: secrets, migrations, scheduler — same as src/instrumentation.ts for dev.
  // (instrumentation.ts also runs under `next start`-style boot; calling it here
  // keeps behaviour identical for the custom server.)
  const server = createServer((req, res) => handle(req, res, parse(req.url, true)));
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname, query } = parse(req.url, true);
    if (pathname !== '/kairos/term') { socket.destroy(); return; }
    const ticket = query.ticket;
    const exp = globalThis.__kairosTickets.get(ticket);
    globalThis.__kairosTickets.delete(ticket); // one-time use, valid or not
    if (!ticket || !exp || exp < Date.now()) { socket.destroy(); return; }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const tmux = findTmux();
      if (!pty || !tmux) {
        ws.send('\r\nKairos needs tmux and the Claude Code CLI — install them from Settings → Integrations → Kairos.\r\n');
        ws.close();
        return;
      }
      const cfg = readConfig();
      const kairosDir = (cfg.kairos && cfg.kairos.dir) || path.join(dataDir, 'kairos');
      fs.mkdirSync(kairosDir, { recursive: true });
      const env = {
        ...process.env,
        TERM: 'xterm-256color',
        LANG: process.env.LANG || 'en_US.UTF-8',
        PATH: widenedPath(),
      };
      delete env.ELECTRON_RUN_AS_NODE;
      let p;
      try {
        // Plain shell in the Kairos workspace — the UI's ▶ Claude button types
        // the claude command; nothing autostarts.
        p = pty.spawn(tmux,
          ['new-session', '-A', '-s', 'kairos', '-c', kairosDir],
          { name: 'xterm-256color', cols: 100, rows: 30, cwd: kairosDir, env });
      } catch (e) {
        ws.send(`\r\nfailed to start terminal: ${e}\r\n`);
        ws.close();
        return;
      }
      p.onData((d) => { if (ws.readyState === 1) ws.send(d); });
      p.onExit(() => ws.close());
      ws.on('message', (raw) => {
        try {
          const m = JSON.parse(raw.toString());
          if (m.t === 'i') p.write(m.d);
          else if (m.t === 'r' && m.cols > 0 && m.rows > 0) p.resize(m.cols, m.rows);
        } catch { /* ignore malformed frames */ }
      });
      // Kills only the tmux client (detach) — the kairos session survives.
      ws.on('close', () => { try { p.kill(); } catch { /* already gone */ } });
    });
  });

  server.listen(port, host, () => console.log(`life-os ready on http://${host}:${port}`));
});
