// Dark-update art: the wandering trader, night shades, the Gloom King boss,
// the ancient altar, fences, and their icons. Small sprites are hand-authored
// grids; the 48x48 boss and 32x32 altar are painted programmatically at
// import (same pattern as objectsArt.ts).

import type { SpriteSheet } from '../engine/sprites';

// ---- tiny painter (runs once at import) ----
type M = string[][];
const mk = (w: number, h: number): M =>
  Array.from({ length: h }, () => new Array(w).fill('.'));
const put = (m: M, x: number, y: number, ch: string) => {
  if (y >= 0 && y < m.length && x >= 0 && x < m[0].length) m[y][x] = ch;
};
const rect = (m: M, x: number, y: number, w: number, h: number, ch: string) => {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(m, i, j, ch);
};
const frame = (m: M, x: number, y: number, w: number, h: number, ch: string) => {
  for (let i = x; i < x + w; i++) { put(m, i, y, ch); put(m, i, y + h - 1, ch); }
  for (let j = y; j < y + h; j++) { put(m, x, j, ch); put(m, x + w - 1, j, ch); }
};
const ell = (m: M, cx: number, cy: number, rx: number, ry: number, ch: string, onlyOn?: string) => {
  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < m[0].length; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1 && (!onlyOn || m[y][x] === onlyOn)) m[y][x] = ch;
    }
  }
};
// turn every colored cell that touches transparency into outline
const outline = (m: M) => {
  const h = m.length, w = m[0].length;
  const copy = m.map((r) => [...r]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (copy[y][x] === '.' || copy[y][x] === '0') continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ny = y + dy, nx = x + dx;
        if (ny < 0 || nx < 0 || ny >= h || nx >= w || copy[ny][nx] === '.') { m[y][x] = '0'; break; }
      }
    }
  }
};
const rows = (m: M) => m.map((r) => r.join(''));

// ---- THE GLOOM KING (48x48, 2 frames) ----
const CROWN = [
  'Y....W.....Y',
  'YY..YYY...YY',
  'YYYYYYYYYYYY',
  'YYYRYYYYRYYY',
  'yyyyyyyyyyyy',
];
function makeBoss(squash: boolean): string[] {
  const m = mk(48, 48);
  const cy = squash ? 29 : 28;
  const rx = squash ? 20 : 19;
  const ry = squash ? 12 : 13;
  ell(m, 24, cy, rx, ry, 'v');
  ell(m, 24, cy + ry * 0.55, rx * 0.82, ry * 0.5, 'n', 'v');   // belly shadow
  ell(m, 16, cy - ry * 0.5, 7, 4, 'V', 'v');                    // sheen
  // drips off the bottom edge
  for (const [dx, wdt] of [[13, 1], [23, 2], [35, 1]] as const) {
    let yb = 0;
    for (let y = 47; y >= 0; y--) if (m[y][dx] !== '.') { yb = y; break; }
    for (let k = 1; k <= (wdt === 2 ? 4 : 2); k++) {
      for (let w2 = 0; w2 < wdt; w2++) put(m, dx + w2, yb + k, 'v');
    }
  }
  outline(m);
  // eyes: big glowing whites with dark pupils, ringed + angry brows
  for (const ex of [15, 28]) {
    rect(m, ex, cy - 7, 5, 7, 'W');
    frame(m, ex - 1, cy - 8, 7, 9, '0');
    rect(m, ex + 1, cy - 3, 2, 3, 'n');
  }
  for (let i = 0; i < 5; i++) {
    put(m, 14 + i, cy - 10 + (i >> 1), '0');       // left brow slants down-right
    put(m, 33 - i, cy - 10 + (i >> 1), '0');       // right brow mirrored
  }
  // wavy mouth
  for (let i = 0; i < 9; i++) put(m, 20 + i, cy + 5 + (i % 2), '0');
  // crown, tilted when squashed
  const cx0 = squash ? 19 : 18, cy0 = squash ? 9 : 8;
  CROWN.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      if (ch !== '.') put(m, cx0 + i + (squash ? (j === 0 ? 1 : 0) : 0), cy0 + j, ch);
    });
  });
  return rows(m);
}

// ---- the ancient altar (32x32, dormant + active) ----
function makeAltar(active: boolean): string[] {
  const m = mk(32, 32);
  if (active) {
    // swirling portal behind the stone
    ell(m, 16, 9, 11, 7, 'v');
    ell(m, 16, 9, 8, 5, 'V', 'v');
    ell(m, 16, 9, 5, 3, 'v', 'V');
    ell(m, 16, 9, 2, 1.4, 'q', 'v');
    put(m, 9, 5, 'W'); put(m, 23, 12, 'W');
  }
  // monolith with rounded shoulders
  rect(m, 11, 4, 10, 2, 'S');
  rect(m, 10, 6, 12, 18, 'S');
  rect(m, 19, 6, 3, 18, 's');
  rect(m, 11, 5, 2, 13, 't');
  // faint runes / moss
  for (const [x, y] of [[13, 8], [17, 9], [15, 6], [18, 17], [13, 19], [20, 20]]) put(m, x, y, 'v');
  // three diamond notches
  [13, 16, 19].forEach((cx2, ci) => {
    const ch = active ? ['q', 'V', 'W'][ci] : 'n';
    put(m, cx2, 12, ch); put(m, cx2 - 1, 13, ch); put(m, cx2 + 1, 13, ch);
    put(m, cx2, 13, ch); put(m, cx2, 14, ch);
  });
  // stepped base
  rect(m, 8, 24, 16, 3, 'S');
  rect(m, 8, 26, 16, 1, 's');
  rect(m, 6, 27, 20, 3, 'S');
  rect(m, 6, 29, 20, 1, 's');
  put(m, 7, 26, 'g'); put(m, 24, 26, 'g'); put(m, 10, 23, 'g');
  outline(m);
  return rows(m);
}

export const DARK_ART: SpriteSheet = {
  // ---- the wandering trader (16x24, 2 frames) ----
  trader0: [
    '................',
    '.....00000......',
    '....0vvvvv0.....',
    '...0vvVvvvv0....',
    '...0vvvvvvv0....',
    '..0vv00000vv0...',
    '..0v0fffff0v0...',
    '..0v00Wf0W0v0...',
    '..0v0fFfFf0v0...',
    '...0v00000v0....',
    '...0vvvvvv0.00..',
    '..0vvvvvvv00DD0.',
    '..0vVvvvvv0DDE0.',
    '..0vvvvvvv0DDE0.',
    '..0vvvvvvv0DDD0.',
    '..0vVvvvvv0DDE0.',
    '..0vvvvvvv00000.',
    '..0vvvvvvv00Y0..',
    '...0vvvvv0.0R0..',
    '...0000000......',
    '....0dd0dd0.....',
    '....000.000.....',
    '................',
    '................',
  ],
  trader1: [
    '................',
    '....00000.......',
    '....0vvvvv0.....',
    '...0vvVvvvv0....',
    '...0vvvvvvv0....',
    '..0vv00000vv0...',
    '..0v0fffff0v0...',
    '..0v0W0fW00v0...',
    '..0v0fFfFf0v0...',
    '...0v00000v0....',
    '...0vvvvvv0.00..',
    '..0vvvvvvv00DD0.',
    '..0vVvvvvv0DDE0.',
    '..0vvvvvvv0DDE0.',
    '..0vvvvvvv0DDD0.',
    '..0vVvvvvv0DDE0.',
    '..0vvvvvvv00000.',
    '..0vvvvvvv00R0..',
    '...0vvvvv0.0Y0..',
    '...0000000......',
    '....0dd0dd0.....',
    '....000.000.....',
    '................',
    '................',
  ],
  // ---- night shade (16x16, 2 frames) ----
  shade0: [
    '................',
    '......0000......',
    '....00nnnn00....',
    '...0nnnnnnnn0...',
    '..0nnvnnnnvnn0..',
    '..0nWWnnnnWWn0..',
    '..0nWWnnnnWWn0..',
    '..0nnnnnnnnnn0..',
    '..0nn1nnnn1nn0..',
    '..0nnnnvnnnnn0..',
    '...0nnnnnnnn0...',
    '..0nn0nnn0nnn0..',
    '.0nn0.0nn0.0n0..',
    '.0n0...0n0..00..',
    '..00....00......',
    '................',
  ],
  shade1: [
    '................',
    '......0000......',
    '....00nnnn00....',
    '...0nnvnnnnn0...',
    '..0nnnnnnvnnn0..',
    '..0nWWnnnnWWn0..',
    '..0nWWnnnnWWn0..',
    '..0nnnnnnnnnn0..',
    '..0nnnn1nnnnn0..',
    '..0nvnnnnnvnn0..',
    '...0nnnnnnnn0...',
    '..0nnn0nnn0nn0..',
    '..0n0.0nn0.0n0..',
    '...00..0n0.0n0..',
    '........00..0...',
    '................',
  ],
  boss_gloom0: makeBoss(false),
  boss_gloom1: makeBoss(true),
  altar: makeAltar(false),
  altar_active: makeAltar(true),
  // ---- fence & gate (16x16, tile horizontally) ----
  fence: [
    '................',
    '................',
    '...00......00...',
    '..0DD0....0DD0..',
    '..0DE0....0DE0..',
    '..0DE0....0DE0..',
    '0000000000000000',
    'EEEEEEEEEEEEEEEE',
    'DDDDDDDDDDDDDDDD',
    '0000000000000000',
    '..0DE0....0DE0..',
    '0000000000000000',
    'EEEEEEEEEEEEEEEE',
    '0000000000000000',
    '..0dd0....0dd0..',
    '...00......00...',
  ],
  gate: [
    '................',
    '................',
    '.00000000000000.',
    '.0EDdEDdEDdEDd0.',
    '.0EDdEDdEDdEDd0.',
    '.0EDdEDdEDdEDd0.',
    '.00000000000000.',
    '.tEDdEDdEDdEDd0.',
    '.0EDdEDdEDdEDd0.',
    '.0EDdEDdEDdEDd0.',
    '.tEDdEDdEDdEDd0.',
    '.0EDdEDdEDdEDd0.',
    '.00000000000000.',
    '..0..........0..',
    '................',
    '................',
  ],
  gravestone: [
    '................',
    '................',
    '................',
    '.....0000.......',
    '....0SSSS0......',
    '...0SttSSS0.....',
    '...0SSSSsS0.....',
    '...0S0SSss0.....',
    '...0SS0Sss0.....',
    '...0SSS0ss0.....',
    '...0SSSSss0.....',
    '...0sSSsss0.....',
    '..0ssssssss0....',
    '.g0000000000g...',
    '.gg........gg...',
    '................',
  ],
  starstone_obj: [
    '................',
    '.......W........',
    '................',
    '....000000......',
    '...0ssssss0.....',
    '..0ssYYssss0....',
    '..0sYssYsss0....',
    '.0ssYssYYsss0...',
    '.0sssWssYsss0...',
    '.0ssssssssss0...',
    '..0sssYsssss0...',
    '..0ssssssss0....',
    '...00000000.....',
    '..Y.........Y...',
    '................',
    '................',
  ],
  voidfloor: [
    'nnnnnnnnnnnnnnnn',
    'nnnvnnnnnnnnnnnn',
    'nnnnnnnnnnvvnnnn',
    'nnnnnnnnnnnnnnnn',
    'nnnnnnvnnnnnnnnn',
    'nnnnnnnvnnnnnnnn',
    'nnnnnnnnnnnnnvnn',
    'nnVnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnnnn',
    'nnnnnvvnnnnnnnnn',
    'nnnnnnnnnnnnnnnn',
    'nnnnnnnnnnvnnnnn',
    'nnnnnnnnnnnnnnnn',
    'nnvnnnnnnnnnnVnn',
    'nnnnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnnnn',
  ],
  // ---- icons ----
  i_shade_essence: [
    '................',
    '................',
    '.....00000......',
    '....0nnnnn0.....',
    '...0nnvnnnn0....',
    '..0nnWnnnnnn0...',
    '..0nnnnnvnnn0...',
    '..0nvnnnnnnn0...',
    '..0nnnnnnvnn0...',
    '...0nnvnnnn0....',
    '....0nnnnn0.....',
    '...00n000n00....',
    '...0n0...0n0....',
    '....0.....0.....',
    '................',
    '................',
  ],
  i_rune_shard: [
    '................',
    '.......0........',
    '......0V0.......',
    '......0V0.......',
    '.....0VVv0......',
    '.....0VvV0......',
    '....0VWVvv0.....',
    '....0VvVvv0.....',
    '...0VvVvvvv0....',
    '...0Vvvvvvv0....',
    '...0vvvvvvv0....',
    '....0vvvvv0.....',
    '.....0vvv0......',
    '......0v0.......',
    '.......0........',
    '................',
  ],
  i_void_heart: [
    '................',
    '................',
    '...00.....00....',
    '..0nn0...0nn0...',
    '.0nnnn0.0nnnn0..',
    '.0nvnnn0nnnnn0..',
    '.0nnnnqnnnnnn0..',
    '.0nnnnqWnnnnn0..',
    '..0nnnqnnnnn0...',
    '...0nnnqnnn0....',
    '....0nnqnn0.....',
    '.....0nqn0......',
    '......0n0.......',
    '.......0........',
    '................',
    '................',
  ],
  i_gloom_crown: [
    '................',
    '................',
    '................',
    '................',
    '..0....0....0...',
    '..0Y..0Y0..Y0...',
    '..0Y0.0Y0.0Y0...',
    '..0YY00Y00YY0...',
    '..0YYYYYYYYY0...',
    '..0YWYYyYYYY0...',
    '..0YYYRYYYYY0...',
    '..0yyyyyyyyy0...',
    '...000000000....',
    '................',
    '................',
    '................',
  ],
  i_golden_koi: [
    '................',
    '................',
    '................',
    '................',
    '......00........',
    '..00.0YY00...00.',
    '.0YY0YYYYY0.0Y0.',
    '0YYYYYWYYYY0YY0.',
    '0YyYYYYYYYYYY0..',
    '.0YY0YYYyYY0Y0..',
    '..00.0YYYY0.00..',
    '......0000......',
    '........0.......',
    '................',
    '................',
    '................',
  ],
  i_golden_egg: [
    '................',
    '................',
    '................',
    '......000.......',
    '.....0YYY0......',
    '....0YWYYY0.....',
    '...0YWYYYYY0....',
    '...0YYYYYyY0....',
    '..0YYYYYYYyY0...',
    '..0YYYYYYYyY0...',
    '..0yYYYYYyyY0...',
    '...0yYYYyyy0....',
    '....0yyyyy0.....',
    '.....00000......',
    '................',
    '................',
  ],
  i_star_metal: [
    '................',
    '................',
    '..........W.....',
    '................',
    '....000000000...',
    '...0Wsssqsss0...',
    '..0ssqssssss0...',
    '..0sssssqsss0...',
    '.0sqsssssssss0..',
    '.0ssssssqssss0..',
    '.00000000000000.',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  i_fence: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '...00.....00....',
    '..0DD0...0DD0...',
    '.0000000000000..',
    '.0EEEEEEEEEEE0..',
    '.0000000000000..',
    '..0DD0...0DD0...',
    '.0000000000000..',
    '.0EEEEEEEEEEE0..',
    '.0000000000000..',
    '..000.....000...',
    '................',
  ],
  i_gate: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '..00000000000...',
    '..0DDDDDDDDD0...',
    '..0D0.....0D0...',
    '..0D00....0D0...',
    '..0D.00...0D0...',
    '..0t...00.0D0...',
    '..0DDDDDDDDD0...',
    '..00000000000...',
    '...0.......0....',
    '................',
    '................',
  ],
  i_old_bottle: [
    '................',
    '......000.......',
    '.....0DDD0......',
    '.....0ddd0......',
    '.....0cBc0......',
    '.....0cBc0......',
    '....0cBBBc0.....',
    '...0cBwwBBc0....',
    '..0cBwwwBBBc0...',
    '..0cBwwwBBWc0...',
    '..0cBBwwBBBc0...',
    '..0ccBBBBBcc0...',
    '...0ccccccc0....',
    '....0000000.....',
    '................',
    '................',
  ],
};
