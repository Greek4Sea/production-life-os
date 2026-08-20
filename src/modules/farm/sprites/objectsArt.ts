// Objects & buildings, hand-pixeled small sprites + painter-built large ones.
// All grids index PALETTE ('.' = transparent). Anchored bottom-center by the
// renderer. Trees/weeds use grass greens so seasons recolor them for free.

import type { SpriteSheet } from '../engine/sprites';

// ---- tiny painter for the big structures (runs once at import) ----
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
const blob = (m: M, cx: number, cy: number, r: number, ch: string) => {
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++)
    if (i * i + j * j <= r * r) put(m, cx + i, cy + j, ch);
};
const grid = (m: M): string[] => m.map((r) => r.join(''));

function houseExt(): string[] {
  const m = mk(80, 64);
  // chimney
  rect(m, 57, 0, 10, 1, '0'); rect(m, 57, 1, 1, 3, '0'); rect(m, 66, 1, 1, 3, '0');
  rect(m, 58, 1, 8, 3, 'S');
  // roof trapezoid
  for (let k = 0; k <= 23; k++) {
    const y = 4 + k, inset = 24 - k;
    if (k === 0) rect(m, inset, y, 80 - inset * 2, 1, '0');
    else {
      put(m, inset, y, '0'); put(m, 79 - inset, y, '0');
      rect(m, inset + 1, y, 78 - inset * 2, 1, 'r');
    }
  }
  for (let y = 7; y <= 13; y++) rect(m, 27 - y + 4, y, 12, 1, 'R'); // glossy highlight
  rect(m, 0, 28, 80, 1, '0'); rect(m, 1, 29, 78, 1, '1');           // eaves
  // walls
  rect(m, 0, 30, 80, 33, 'E');
  rect(m, 0, 30, 1, 33, '0'); rect(m, 79, 30, 1, 33, '0'); rect(m, 0, 63, 80, 1, '0');
  rect(m, 1, 44, 78, 1, 'D'); rect(m, 26, 30, 1, 14, 'D'); rect(m, 53, 30, 1, 14, 'D');
  // windows
  for (const wx of [8, 60]) {
    frame(m, wx, 34, 12, 10, '0'); rect(m, wx + 1, 35, 10, 8, 'Y');
    rect(m, wx + 5, 35, 2, 8, 'w'); rect(m, wx + 1, 38, 10, 1, 'w');
    rect(m, wx - 1, 44, 14, 2, 'g'); // flower box greens
    put(m, wx + 2, 44, 'p'); put(m, wx + 6, 44, 'R'); put(m, wx + 10, 44, 'p');
  }
  // door (aligns with the walk tile two tiles from the left of the footprint)
  frame(m, 32, 44, 16, 20, '0'); rect(m, 33, 45, 14, 19, 'd');
  rect(m, 35, 47, 10, 14, 'D'); put(m, 44, 54, 'Y');
  return grid(m);
}

function storeExt(): string[] {
  const m = mk(80, 64);
  for (let k = 0; k <= 17; k++) {                 // shallow roof
    const y = 2 + k, inset = 18 - k;
    put(m, inset, y, '0'); put(m, 79 - inset, y, '0');
    rect(m, inset + 1, y, 78 - inset * 2, 1, k < 2 ? '0' : 'D');
  }
  rect(m, 0, 20, 80, 1, '0');
  rect(m, 0, 21, 80, 42, 'w');                    // plaster walls
  rect(m, 0, 21, 1, 42, '0'); rect(m, 79, 21, 1, 42, '0'); rect(m, 0, 63, 80, 1, '0');
  // striped awning
  for (let x = 2; x < 78; x++) {
    const ch = Math.floor(x / 6) % 2 ? 'w' : 'g';
    rect(m, x, 24, 1, 7, ch);
    if (x % 6 === 3) put(m, x, 31, ch === 'g' ? 'g' : 'w'); // scallop hint
  }
  rect(m, 2, 23, 76, 1, '0'); rect(m, 2, 31, 76, 1, '0');
  // big shop window + door
  frame(m, 8, 36, 26, 20, '0'); rect(m, 9, 37, 24, 18, 'c');
  rect(m, 9, 40, 24, 1, 'B'); rect(m, 20, 37, 2, 18, 'B');
  put(m, 12, 50, 'o'); put(m, 16, 51, 'G'); put(m, 26, 50, 'Y'); // produce in window
  frame(m, 48, 40, 16, 24, '0'); rect(m, 49, 41, 14, 22, 'D');
  rect(m, 51, 43, 10, 12, 'E'); put(m, 60, 52, 'Y');
  return grid(m);
}

function smithExt(): string[] {
  const m = mk(64, 64);
  rect(m, 46, 0, 8, 1, '0'); rect(m, 46, 1, 1, 5, '0'); rect(m, 53, 1, 1, 5, '0');
  rect(m, 47, 1, 6, 5, 's');
  put(m, 48, 0, 'R'); put(m, 51, 1, 'Y'); put(m, 50, 2, 'R'); // forge sparks
  for (let k = 0; k <= 15; k++) {
    const y = 6 + k, inset = 16 - k;
    put(m, inset, y, '0'); put(m, 63 - inset, y, '0');
    rect(m, inset + 1, y, 62 - inset * 2, 1, k < 2 ? '0' : '1');
  }
  rect(m, 0, 22, 64, 1, '0');
  rect(m, 0, 23, 64, 40, 'S');
  rect(m, 0, 23, 1, 40, '0'); rect(m, 63, 23, 1, 40, '0'); rect(m, 0, 63, 64, 1, '0');
  for (let j = 26; j < 62; j += 5) rect(m, 1, j, 62, 1, 's');   // stone courses
  for (let j = 26; j < 62; j += 5) for (let i = (j % 2 ? 6 : 10); i < 60; i += 9) put(m, i, j + 2, 's');
  frame(m, 24, 36, 16, 28, '0'); rect(m, 25, 37, 14, 27, 'n');  // dark doorway
  rect(m, 27, 40, 2, 24, '1'); put(m, 33, 46, 'R'); put(m, 34, 47, 'Y'); // forge glow
  frame(m, 6, 34, 10, 8, '0'); rect(m, 7, 35, 8, 6, 'Y');       // small warm window
  return grid(m);
}

function ranchExt(): string[] {
  const m = mk(80, 48);
  for (let k = 0; k <= 11; k++) {
    const y = 2 + k, inset = 12 - k;
    put(m, inset, y, '0'); put(m, 79 - inset, y, '0');
    rect(m, inset + 1, y, 78 - inset * 2, 1, k < 2 ? '0' : 'd');
  }
  rect(m, 0, 14, 80, 1, '0');
  rect(m, 0, 15, 80, 32, 'D');
  rect(m, 0, 15, 1, 32, '0'); rect(m, 79, 15, 1, 32, '0'); rect(m, 0, 47, 80, 1, '0');
  for (let j = 20; j < 46; j += 6) rect(m, 1, j, 78, 1, 'd');   // planks
  // horseshoe sign
  frame(m, 34, 17, 12, 10, '0'); rect(m, 35, 18, 10, 8, 'w');
  rect(m, 37, 20, 2, 5, 't'); rect(m, 41, 20, 2, 5, 't'); rect(m, 38, 19, 4, 1, 't');
  // wide door + window
  frame(m, 32, 30, 16, 18, '0'); rect(m, 33, 31, 14, 16, 'E');
  rect(m, 39, 31, 2, 16, 'd');
  frame(m, 10, 30, 12, 10, '0'); rect(m, 11, 31, 10, 8, 'Y');
  frame(m, 58, 30, 12, 10, '0'); rect(m, 59, 31, 10, 8, 'Y');
  return grid(m);
}

function coopExt(): string[] {
  const m = mk(48, 48);
  for (let k = 0; k <= 17; k++) {                  // pointy roof
    const y = 2 + k, inset = Math.max(1, 20 - k);
    put(m, inset, y, '0'); put(m, 47 - inset, y, '0');
    rect(m, inset + 1, y, 46 - inset * 2, 1, k < 2 ? '0' : 'D');
  }
  rect(m, 0, 20, 48, 1, '0');
  rect(m, 0, 21, 48, 26, 'r');
  rect(m, 0, 21, 1, 26, '0'); rect(m, 47, 21, 1, 26, '0'); rect(m, 0, 47, 48, 1, '0');
  rect(m, 1, 21, 46, 1, 'R');
  blob(m, 24, 26, 4, 'Y'); frame(m, 20, 22, 9, 9, '0');          // round window
  frame(m, 18, 34, 12, 14, '0'); rect(m, 19, 35, 10, 13, 'n');   // hen door
  rect(m, 16, 44, 16, 4, 'E'); rect(m, 16, 44, 16, 1, 'd');      // ramp
  return grid(m);
}

function barnExt(): string[] {
  const m = mk(64, 48);
  for (let k = 0; k <= 5; k++) {                   // gambrel top
    const y = k, inset = 22 - k * 3;
    put(m, inset, y, '0'); put(m, 63 - inset, y, '0');
    rect(m, inset + 1, y, 62 - inset * 2, 1, k === 0 ? '0' : 'r');
  }
  for (let k = 0; k <= 9; k++) {
    const y = 6 + k, inset = Math.max(1, 7 - k);
    put(m, inset, y, '0'); put(m, 63 - inset, y, '0');
    rect(m, inset + 1, y, 62 - inset * 2, 1, 'r');
  }
  rect(m, 1, 16, 62, 1, 'w'); rect(m, 0, 17, 64, 1, '0');
  rect(m, 0, 18, 64, 29, 'r');
  rect(m, 0, 18, 1, 29, '0'); rect(m, 63, 18, 1, 29, '0'); rect(m, 0, 47, 64, 1, '0');
  blob(m, 32, 10, 4, 'y'); frame(m, 28, 6, 9, 9, '0');           // hayloft window
  frame(m, 24, 28, 16, 20, '0'); rect(m, 25, 29, 14, 19, 'D');   // big doors
  rect(m, 31, 29, 2, 19, 'w');
  for (let k = 0; k < 7; k++) {                                   // white X braces
    put(m, 26 + k, 30 + k * 2, 'w'); put(m, 37 - k, 30 + k * 2, 'w');
    put(m, 26 + k, 31 + k * 2, 'w'); put(m, 37 - k, 31 + k * 2, 'w');
  }
  return grid(m);
}

function caveExt(open: boolean): string[] {
  const m = mk(64, 48);
  blob(m, 32, 34, 30, 's');                        // hillside mound
  blob(m, 30, 30, 24, 'S');
  blob(m, 20, 16, 8, 's'); blob(m, 45, 14, 9, 's');
  rect(m, 0, 47, 64, 1, '1');
  for (const [gx, gy] of [[10, 20], [50, 24], [16, 34], [46, 38], [30, 12]] as const)
    put(m, gx, gy, 't');
  blob(m, 8, 44, 5, 'g'); blob(m, 56, 44, 5, 'g'); // grassy toes
  // mouth
  frame(m, 24, 24, 16, 24, '0'); rect(m, 25, 25, 14, 23, 'n');
  put(m, 24, 23, '0'); put(m, 39, 23, '0'); rect(m, 26, 23, 12, 1, '0');
  if (open) {
    put(m, 28, 30, 'c'); put(m, 35, 38, 'c');
  } else {
    for (let j = 27; j < 47; j += 5) { rect(m, 25, j, 14, 3, 'D'); rect(m, 25, j + 1, 14, 1, 'd'); }
    rect(m, 30, 25, 2, 22, 'D');
  }
  return grid(m);
}

const BIG: SpriteSheet = {
  house_ext: houseExt(),
  store_ext: storeExt(),
  smith_ext: smithExt(),
  ranch_ext: ranchExt(),
  coop_ext: coopExt(),
  barn_ext: barnExt(),
  cave_ext_closed: caveExt(false),
  cave_ext_open: caveExt(true),
};

function tree2(): string[] {
  const m = mk(32, 32);
  rect(m, 14, 18, 4, 13, 'd'); rect(m, 15, 18, 1, 12, 'D');       // trunk
  rect(m, 12, 30, 3, 1, 'd'); rect(m, 18, 30, 2, 1, 'd');         // roots
  blob(m, 16, 13, 8, 'h');                                        // under-canopy
  blob(m, 10, 11, 7, 'g'); blob(m, 22, 11, 7, 'g'); blob(m, 16, 7, 8, 'g');
  blob(m, 10, 9, 5, 'G'); blob(m, 20, 7, 5, 'G'); blob(m, 15, 5, 4, 'G');
  for (const [hx, hy] of [[8, 6], [13, 3], [19, 4], [24, 8], [11, 12], [21, 12]] as const)
    put(m, hx, hy, 'H');
  return grid(m);
}

const SMALL: SpriteSheet = {
  tree0: [
    '................',
    '................',
    '................',
    '......GGG.......',
    '.....GGGGG......',
    '....GGgHGGg.....',
    '....gGGGGGg.....',
    '.....gGGGg......',
    '......ggg.......',
    '.......d........',
    '......dd........',
    '......dd........',
    '......dd........',
    '......dd........',
    '.....dddd.......',
    '................',
  ],
  tree1: [
    '................',
    '................',
    '......GGG.......',
    '....GGGGGGG.....',
    '...GGGGGGGGG....',
    '...GgGGHGGGg....',
    '..gGGGGGGGGGg...',
    '..gGGGGGGGGgg...',
    '...gGGGGGGgg....',
    '...ggGGGGggg....',
    '....ggggggg.....',
    '.....ggggg......',
    '......ggg.......',
    '......dd........',
    '......dd........',
    '......dd........',
    '......dd........',
    '......dd........',
    '......dd........',
    '......dd........',
    '......dd........',
    '......dd........',
    '.....dddd.......',
    '................',
  ],
  tree2: tree2(),
  stump: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '....0DDDD0......',
    '...0DEEEED0.....',
    '...0DEeeED0.....',
    '...0DDDDDD0.....',
    '..0dDDDDDDd0....',
    '..0dddddddd0....',
    '...00000000.....',
    '................',
  ],
  rock: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....0000.......',
    '....0SttS0......',
    '...0StSSSS0.....',
    '...0SSSSSs0.....',
    '..0SSSSSSss0....',
    '..0sSSSSssss0...',
    '..0ssssssssss0..',
    '...0ssssssss0...',
    '....00000000....',
    '................',
  ],
  bigrock: [
    '................',
    '................',
    '................',
    '....00000.......',
    '...0SttSS0......',
    '..0SSSSSSS0.....',
    '..0SSSSSSSS0....',
    '.0SSSSSSSSss0...',
    '.0SSSSSSssss0...',
    '.0sSSSSssss1s0..',
    '.0ssssssss11s0..',
    '.0sssssss111s0..',
    '.0sssssssssss0..',
    '..0sssssssss0...',
    '...000000000....',
    '................',
  ],
  weed: [
    '................',
    '......Y..Y......',
    '.....0Y00Y0.....',
    '..Y..0Y00Y0..Y..',
    '.0Y0.0g00g0.0Y0.',
    '.0Y0..0gg0..0Y0.',
    '..0g0.0gg0.0g0..',
    '...0g00gg00g0...',
    '....0ggGGgg0....',
    '...0gGgGgGgg0...',
    '...0ggGgGggg0...',
    '....0gGgGgg0....',
    '.....0ggGg0.....',
    '......0gg0......',
    '.......00.......',
    '................',
  ],
  bin: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..000000000000..',
    '.0EEEEEEEEEEEE0.',
    '.0E1111111111E0.',
    '.0DDDDDDDDDDDD0.',
    '.0DdDDdDDdDDdD0.',
    '.0DDDDDDDDDDDD0.',
    '.0DdDDdDDdDDdD0.',
    '.0DDDDDDDDDDDD0.',
    '..000000000000..',
    '................',
  ],
  bed: [
    '................',
    '..000000000000..',
    '.0DDDDDDDDDDDD0.',
    '.0DEEEEEEEEEED0.',
    '.0wwwwwwwwwwww0.',
    '.0wWWwwwwwWWww0.',
    '.0wwwwwwwwwwww0.',
    '.0rrrrrrrrrrrr0.',
    '.0rRRRRRRRRRRr0.',
    '.0rrrrrrrrrrrr0.',
    '.0rrrrrrrrrrrr0.',
    '.0rRrrRrrRrrRr0.',
    '.0rrrrrrrrrrrr0.',
    '.0rrrrrrrrrrrr0.',
    '.0rRrrRrrRrrRr0.',
    '.0rrrrrrrrrrrr0.',
    '.0rrrrrrrrrrrr0.',
    '.0rRrrRrrRrrRr0.',
    '.0rrrrrrrrrrrr0.',
    '.0rrrrrrrrrrrr0.',
    '.0rRrrRrrRrrRr0.',
    '.0rrrrrrrrrrrr0.',
    '.0rrrrrrrrrrrr0.',
    '.0rrrrrrrrrrrr0.',
    '.0wwwwwwwwwwww0.',
    '.0rrrrrrrrrrrr0.',
    '.0rrrrrrrrrrrr0.',
    '.0rrrrrrrrrrrr0.',
    '.0rrrrrrrrrrrr0.',
    '.0dDDDDDDDDDDd0.',
    '..000000000000..',
    '................',
  ],
  board: [
    '................',
    '................',
    '................',
    '.000000000000...',
    '.0DDDDDDDDDD0...',
    '.0DwwDDDwwDD0...',
    '.0DwwDDDwwDD0...',
    '.0DDDDwwDDDD0...',
    '.0DDDDwwDDDD0...',
    '.000000000000...',
    '......dd........',
    '......dd........',
    '......dd........',
    '......dd........',
    '.....dddd.......',
    '................',
  ],
  trough: (() => {
    const m = mk(32, 16);
    rect(m, 1, 7, 30, 1, '0');
    rect(m, 1, 8, 30, 6, 'D'); rect(m, 1, 8, 1, 6, '0'); rect(m, 30, 8, 1, 6, '0');
    rect(m, 2, 8, 28, 1, 'E');
    rect(m, 4, 5, 24, 3, 'Y'); rect(m, 6, 4, 8, 1, 'Y'); rect(m, 18, 4, 6, 1, 'y');
    rect(m, 4, 7, 24, 1, 'y');
    rect(m, 1, 14, 30, 1, '0'); rect(m, 2, 12, 28, 1, 'd');
    return grid(m);
  })(),
  furnace: [
    '................',
    '................',
    '................',
    '................',
    '....000000......',
    '...0SSSSSS0.....',
    '..0SSSSSSSS0....',
    '..0StSSSSsS0....',
    '..0S000000S0....',
    '..0S0nnnn0S0....',
    '..0S0nnnn0S0....',
    '..0Ss0000sS0....',
    '..0SSSSSSSS0....',
    '..0ssssssss0....',
    '..0000000000....',
    '................',
  ],
  furnace_lit: [
    '................',
    '................',
    '......R.........',
    '........Y.......',
    '....000000......',
    '...0SSSSSS0.....',
    '..0SSSSSSSS0....',
    '..0StSSSSsS0....',
    '..0S000000S0....',
    '..0S0YRRY0S0....',
    '..0S0RYYR0S0....',
    '..0Ss0000sS0....',
    '..0SSSSSSSS0....',
    '..0ssssssss0....',
    '..0000000000....',
    '................',
  ],
  sprinkler: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.......q........',
    '......ttt.......',
    '....t0EEE0t.....',
    '.....0EtE0......',
    '......0E0.......',
    '......0E0.......',
    '.....00E00......',
    '.....0EEE0......',
    '.....00000......',
    '................',
    '................',
  ],
  scarecrow: [
    '................',
    '......0000......',
    '.....0YYYY0.....',
    '....0YYYYYY0....',
    '..0000000000....',
    '.....0wwww0.....',
    '....0w0ww0w0....',
    '....0wwwwww0....',
    '.....0wwww0.....',
    '..Yd00rrrr00dY..',
    '..YY0rrRRr0YY...',
    '....0rrrrr0.....',
    '....0rr0rr0.....',
    '.....0rrr0......',
    '......0r0.......',
    '......0d0.......',
    '......0d0.......',
    '......0d0.......',
    '......0d0.......',
    '......0d0.......',
    '......0d0.......',
    '......0d0.......',
    '.....0ddd0......',
    '................',
  ],
  ladder: [
    '................',
    '................',
    '................',
    '................',
    '...0000000000...',
    '..0nnnnnnnnnn0..',
    '..0nDnnnnnnDn0..',
    '..0nDDDDDDDDn0..',
    '..0nDnnnnnnDn0..',
    '..0nDDDDDDDDn0..',
    '..0nDnnnnnnDn0..',
    '..0nnnnnnnnnn0..',
    '...0000000000...',
    '................',
    '................',
    '................',
  ],
  elevator: [
    '................',
    '................',
    '..000000000000..',
    '.0tttttttttttt0.',
    '.0S1S1S1S1S1SS0.',
    '.0S1S1S1S1S1SS0.',
    '.0SSSSSSSSSSSS0.',
    '.0S1S1S1S1S1SS0.',
    '.0S1S1S1S1S1SS0.',
    '.0SSSSSSSSSSSS0.',
    '.0S1S1S1S1S1SS0.',
    '.0S1S1S1S1S1SS0.',
    '.0ssssssssssss0.',
    '..000000000000..',
    '................',
    '................',
  ],
  mrock: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....00000......',
    '....0SttSS0.....',
    '...0SSSSSSS0....',
    '..0SSSSSSSSs0...',
    '..0SSSSSSsss0...',
    '..0sSSSSssss0...',
    '..0sssssssss0...',
    '...0ssssssss0...',
    '....00000000....',
    '................',
    '................',
  ],
};

// counters + ore rocks derive from a base via char tweaks
function counter(awning: string): string[] {
  return [
    '................',
    '................',
    '................',
    '.00000000000000.',
    `.0${awning}w${awning}w${awning}w${awning}w${awning}w${awning}w0.`,
    '.00000000000000.',
    '..0DDDDDDDDDD0..',
    '..0DEEEEEEEED0..',
    '..0DEwYwEwpED0..',
    '..0DEEEEEEEED0..',
    '..0DDDDDDDDDD0..',
    '..0dDDDDDDDDd0..',
    '..000000000000..',
    '................',
    '................',
    '................',
  ];
}
function oreRock(fleck: string, fleck2 = fleck): string[] {
  const g = SMALL.mrock.map((r) => r.split(''));
  for (const [x, y, ch] of [[6, 8, fleck], [9, 9, fleck2], [5, 11, fleck], [10, 11, fleck2], [7, 12, fleck]] as const)
    if (g[y as number][x as number] !== '0' && g[y as number][x as number] !== '.') g[y as number][x as number] = ch as string;
  return g.map((r) => r.join(''));
}

export const OBJECTS_ART: SpriteSheet = {
  ...SMALL,
  ...BIG,
  counter_store: counter('g'),
  counter_smith: counter('S'),
  counter_ranch: counter('D'),
  rock_copper: oreRock('O'),
  rock_iron: oreRock('t'),
  rock_gold: oreRock('Y'),
  rock_gem: oreRock('V', 'q'),
};

// dev sanity: all rows in a grid must be the same length
for (const [k, g] of Object.entries(OBJECTS_ART)) {
  const w = g[0]?.length ?? 0;
  if (g.some((r) => r.length !== w))
    console.warn(`[farm art] ragged sprite: ${k}`);
}
