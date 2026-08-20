import fs from 'fs';
import { randomBytes, generateKeyPairSync } from 'crypto';
import { configPath, kairosDefaultDir } from './paths';

// Runtime configuration. Everything the old app read from .env now lives in
// <dataDir>/config.json, written by the setup wizard and Settings → Integrations.
// Environment variables still override file values (handy for development).

export type AiProvider = 'ollama' | 'anthropic';

export interface AppConfig {
  core: {
    authSecret: string;
    cronSecret: string;
    vapidPublicKey: string;
    vapidPrivateKey: string;
    vapidSubject: string;
    allowedEmail: string;        // bound to the first Google account that signs in
    tz: string;
    port: number;
    setupCompletedAt: string;    // ISO; empty until the wizard finishes
    aboutMe: string;             // free text given to the AI prompts (optional)
  };
  google: { clientId: string; clientSecret: string };
  ai: { provider: AiProvider };
  anthropic: { apiKey: string };
  ollama: { url: string; tasksModel: string; recipesModel: string; passwordsModel: string };
  canvas: { baseUrl: string; token: string };
  spotify: { clientId: string; clientSecret: string };
  obsidian: { vault: string };
  passwords: { vault: string };
  fitness: { appUrl: string; allowedOrigin: string; ingestKey: string };
  fencing: { enabled: boolean; homeStates: string[]; trackerProfileUrl: string };
  kairos: { enabled: boolean; dir: string; tmuxPath: string };
  quickLinks: { label: string; url: string }[];
}

export const DEFAULT_PORT = 3210;

export function defaultConfig(): AppConfig {
  return {
    core: {
      authSecret: '', cronSecret: '', vapidPublicKey: '', vapidPrivateKey: '',
      vapidSubject: 'mailto:life-os@localhost', allowedEmail: '', tz: '',
      port: DEFAULT_PORT, setupCompletedAt: '', aboutMe: '',
    },
    google: { clientId: '', clientSecret: '' },
    ai: { provider: 'ollama' },
    anthropic: { apiKey: '' },
    ollama: { url: 'http://localhost:11434', tasksModel: 'qwen3.5:9b', recipesModel: 'qwen3.5:9b', passwordsModel: 'llama3.2' },
    canvas: { baseUrl: '', token: '' },
    spotify: { clientId: '', clientSecret: '' },
    obsidian: { vault: '' },
    passwords: { vault: '' },
    fitness: { appUrl: '', allowedOrigin: '', ingestKey: '' },
    fencing: { enabled: false, homeStates: [], trackerProfileUrl: '' },
    kairos: { enabled: false, dir: '', tmuxPath: '' },
    quickLinks: [],
  };
}

type Obj = Record<string, unknown>;
function deepMerge<T extends Obj>(base: T, patch: Obj): T {
  const out: Obj = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v)
      && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k] as Obj, v as Obj);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}

// .env overrides — keeps the developer workflow (and old .env.local files) working.
const ENV_MAP: [string, (c: AppConfig, v: string) => void][] = [
  ['AUTH_SECRET', (c, v) => { c.core.authSecret = v; }],
  ['CRON_SECRET', (c, v) => { c.core.cronSecret = v; }],
  ['VAPID_PUBLIC_KEY', (c, v) => { c.core.vapidPublicKey = v; }],
  ['VAPID_PRIVATE_KEY', (c, v) => { c.core.vapidPrivateKey = v; }],
  ['VAPID_SUBJECT', (c, v) => { c.core.vapidSubject = v; }],
  ['ALLOWED_EMAIL', (c, v) => { c.core.allowedEmail = v; }],
  ['APP_TZ', (c, v) => { c.core.tz = v; }],
  ['PORT', (c, v) => { c.core.port = parseInt(v, 10) || DEFAULT_PORT; }],
  ['AUTH_GOOGLE_ID', (c, v) => { c.google.clientId = v; }],
  ['AUTH_GOOGLE_SECRET', (c, v) => { c.google.clientSecret = v; }],
  ['ANTHROPIC_API_KEY', (c, v) => { c.anthropic.apiKey = v; }],
  ['AI_PROVIDER', (c, v) => { if (v === 'ollama' || v === 'anthropic') c.ai.provider = v; }],
  ['OLLAMA_URL', (c, v) => { c.ollama.url = v; }],
  ['TASKS_MODEL', (c, v) => { c.ollama.tasksModel = v; }],
  ['RECIPES_MODEL', (c, v) => { c.ollama.recipesModel = v; }],
  ['PASSWORDS_MODEL', (c, v) => { c.ollama.passwordsModel = v; }],
  ['CANVAS_BASE_URL', (c, v) => { c.canvas.baseUrl = v; }],
  ['CANVAS_API_TOKEN', (c, v) => { c.canvas.token = v; }],
  ['SPOTIFY_CLIENT_ID', (c, v) => { c.spotify.clientId = v; }],
  ['SPOTIFY_CLIENT_SECRET', (c, v) => { c.spotify.clientSecret = v; }],
  ['OBSIDIAN_VAULT', (c, v) => { c.obsidian.vault = v; }],
  ['PASSWORDS_VAULT', (c, v) => { c.passwords.vault = v; }],
  ['FITNESS_INGEST_KEY', (c, v) => { c.fitness.ingestKey = v; }],
  ['FITNESS_APP_URL', (c, v) => { c.fitness.appUrl = v; }],
];

type Cache = { cfg: AppConfig; mtime: number };
const g = globalThis as unknown as { __lifeosConfig?: Cache | null };

function readFile(): { cfg: AppConfig; mtime: number } {
  const p = configPath();
  let raw: Obj = {};
  let mtime = 0;
  try {
    mtime = fs.statSync(p).mtimeMs;
    raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch { /* first run */ }
  const cfg = deepMerge(defaultConfig() as unknown as Obj, raw) as unknown as AppConfig;
  for (const [key, apply] of ENV_MAP) {
    const v = process.env[key];
    if (v) apply(cfg, v);
  }
  return { cfg, mtime };
}

export function getConfig(): AppConfig {
  const p = configPath();
  let mtime = 0;
  try { mtime = fs.statSync(p).mtimeMs; } catch { /* missing */ }
  if (g.__lifeosConfig && g.__lifeosConfig.mtime === mtime) return g.__lifeosConfig.cfg;
  g.__lifeosConfig = readFile();
  return g.__lifeosConfig.cfg;
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K] };

export function patchConfig(patch: DeepPartial<AppConfig>): AppConfig {
  const p = configPath();
  let raw: Obj = {};
  try { raw = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { /* first write */ }
  const next = deepMerge(raw, patch as Obj);
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, p);
  try { fs.chmodSync(p, 0o600); } catch { /* windows */ }
  g.__lifeosConfig = null;
  return getConfig();
}

// Same output as web-push's generateVAPIDKeys(), without importing web-push
// (its deps pull Node's http into the edge bundle).
function generateVapidKeys() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pub = publicKey.export({ format: 'jwk' }) as { x: string; y: string };
  const priv = privateKey.export({ format: 'jwk' }) as { d: string };
  const raw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]);
  return { publicKey: raw.toString('base64url'), privateKey: priv.d };
}

// Generate anything that can be generated, once. Idempotent; called at boot.
export function ensureCoreSecrets(): AppConfig {
  const c = getConfig();
  const patch: DeepPartial<AppConfig> = { core: {}, fitness: {}, kairos: {} };
  if (!c.core.authSecret) patch.core!.authSecret = randomBytes(32).toString('base64');
  if (!c.core.cronSecret) patch.core!.cronSecret = randomBytes(24).toString('hex');
  if (!c.core.vapidPublicKey || !c.core.vapidPrivateKey) {
    const k = generateVapidKeys();
    patch.core!.vapidPublicKey = k.publicKey;
    patch.core!.vapidPrivateKey = k.privateKey;
  }
  if (!c.core.tz) {
    patch.core!.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }
  if (!c.fitness.ingestKey) patch.fitness!.ingestKey = randomBytes(24).toString('hex');
  if (!c.kairos.dir) patch.kairos!.dir = kairosDefaultDir();
  const changed = Object.values(patch).some((v) => Object.keys(v as Obj).length);
  return changed ? patchConfig(patch) : c;
}

export const appOrigin = () => process.env.AUTH_URL || `http://localhost:${getConfig().core.port}`;

export const isSetupDone = () => {
  const c = getConfig();
  return Boolean(c.core.setupCompletedAt && c.core.allowedEmail && c.google.clientId);
};

// Non-secret view for the UI (booleans where the value is secret).
export function getPublicConfig() {
  const c = getConfig();
  return {
    core: {
      tz: c.core.tz, port: c.core.port, allowedEmail: c.core.allowedEmail,
      setupCompletedAt: c.core.setupCompletedAt, aboutMe: c.core.aboutMe,
      vapidPublicKey: c.core.vapidPublicKey,
    },
    origin: appOrigin(),
    google: { clientId: c.google.clientId, hasSecret: Boolean(c.google.clientSecret) },
    ai: c.ai,
    anthropic: { hasKey: Boolean(c.anthropic.apiKey) },
    ollama: c.ollama,
    canvas: { baseUrl: c.canvas.baseUrl, hasToken: Boolean(c.canvas.token) },
    spotify: { clientId: c.spotify.clientId, hasSecret: Boolean(c.spotify.clientSecret) },
    obsidian: c.obsidian,
    passwords: { vault: c.passwords.vault },
    fitness: { appUrl: c.fitness.appUrl, allowedOrigin: c.fitness.allowedOrigin, ingestKey: c.fitness.ingestKey },
    fencing: c.fencing,
    kairos: c.kairos,
    quickLinks: c.quickLinks,
    setupDone: isSetupDone(),
  };
}
export type PublicConfig = ReturnType<typeof getPublicConfig>;
