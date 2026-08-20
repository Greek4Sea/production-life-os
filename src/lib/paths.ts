import fs from 'fs';
import os from 'os';
import path from 'path';

// Where Life OS keeps everything that belongs to the user: the embedded
// database, config.json (secrets, 0600), and the Kairos workspace.
//   Electron:  <userData>/   (set via LIFEOS_DATA_DIR by electron/main)
//   Dev/CLI:   ~/.life-os/   (override with LIFEOS_DATA_DIR)
let cached: string | null = null;

export function dataDir(): string {
  if (cached) return cached;
  const dir = process.env.LIFEOS_DATA_DIR || path.join(os.homedir(), '.life-os');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  cached = dir;
  return dir;
}

export const dbDir = () => path.join(dataDir(), 'db');
export const configPath = () => path.join(dataDir(), 'config.json');
export const kairosDefaultDir = () => path.join(dataDir(), 'kairos');

// Where the drizzle migrations live (Electron ships them outside asar).
export const migrationsDir = () =>
  process.env.LIFEOS_MIGRATIONS_DIR || path.join(process.cwd(), 'drizzle');
