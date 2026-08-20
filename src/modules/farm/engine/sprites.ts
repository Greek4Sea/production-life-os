// String-grid sprite decoder + per-season atlas cache. Sprites are arrays of
// equal-length rows; each char indexes PALETTE (with the season's substitutions
// applied). Decoded onto one canvas per sprite, cached by (name, season).

import { PALETTE, SEASON_SWAPS } from '../data/palette';
import type { Season } from '../types';

export type SpriteGrid = string[];
export type SpriteSheet = Record<string, SpriteGrid>;

const cache = new Map<string, HTMLCanvasElement>();
let sheets: SpriteSheet = {};

export function registerSheets(...s: SpriteSheet[]) {
  sheets = Object.assign({}, ...s);
  cache.clear();
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function decode(grid: SpriteGrid, swaps: Record<string, string>): HTMLCanvasElement {
  const h = grid.length, w = grid[0]?.length ?? 0;
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, w); cv.height = Math.max(1, h);
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(cv.width, cv.height);
  for (let y = 0; y < h; y++) {
    const row = grid[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      const hex = swaps[ch] ?? PALETTE[ch];
      if (!hex) continue;
      const [r, g, b] = hexToRgb(hex);
      const o = (y * cv.width + x) * 4;
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// Missing-art fallback so a bad name renders loudly instead of crashing.
const MISSING: SpriteGrid = Array.from({ length: 16 }, (_, y) =>
  Array.from({ length: 16 }, (_, x) => ((x + y) % 2 ? 'V' : '0')).join(''));

export function sprite(name: string, season: Season = 0): HTMLCanvasElement {
  const key = `${name}#${season}`;
  let cv = cache.get(key);
  if (!cv) {
    cv = decode(sheets[name] ?? MISSING, SEASON_SWAPS[season] ?? {});
    cache.set(key, cv);
  }
  return cv;
}

export function hasSprite(name: string): boolean {
  return !!sheets[name];
}

// data-URL cache for DOM <img> icons (hotbar, dialogs)
const urlCache = new Map<string, string>();
export function spriteUrl(name: string): string {
  let u = urlCache.get(name);
  if (!u) {
    u = sprite(name).toDataURL();
    urlCache.set(name, u);
  }
  return u;
}

// tiny deterministic hash for per-tile variety
export function hash2(x: number, y: number, salt = 0): number {
  let n = x * 374761393 + y * 668265263 + salt * 2246822519;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967296;
}
