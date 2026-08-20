// Characters & critters. Chibi proportions, thick '0' outlines, 'W' shines.
// All sprites anchor bottom-center; light comes from top-left.
// (500-line rule waived for sprite data files.)

import type { SpriteSheet } from '../engine/sprites';

const mirror = (g: string[]) => g.map((r) => [...r].reverse().join(''));

// ---- player: 16 x 24, farmer kid ----
const P_HEAD = [
  '....00000000....',
  '...0kkkkkkkk0...',
  '..0kkkkkkkkkk0..',
  '.0kkkkkkkkkkkk0.',
  '.0kkkkkkkkkkkk0.',
];
const P_FACE_D = [
  '.0kkffffffffkk0.',
  '.0kffffffffffk0.',
  '.0ffffffffffff0.',
  '.0ff0Wfff0Wfff0.',
  '.0ff00fff00fff0.',
  '.0fpfffffffpff0.',
  '.0ffffFFffffff0.',
  '.0ffffffffffff0.',
  '..0ffffffffff0..',
];
const P_FACE_U = [
  '.0kkkkkkkkkkkk0.',
  '.0kkkk1kkkkkkk0.',
  '.0kkkkkkkkkkkk0.',
  '.0kk1kkkkkk1kk0.',
  '.0kkkkkkkkkkkk0.',
  '.0kkkkkkkkkkkk0.',
  '.0kkkkkkk1kkkk0.',
  '.0kkkkkkkkkkkk0.',
  '..0kkkkkkkkkk0..',
];
const P_FACE_L = [
  '.0kfffkkkkkkkk0.',
  '.0ffffffkkkkkk0.',
  '.0fffffffkkkkk0.',
  '.0f0Wffffkkkkk0.',
  '.0f00ffffkkkkk0.',
  '.0fpffffffkkkk0.',
  '.0FFffffffkkkk0.',
  '.0ffffffffkkkk0.',
  '..0ffffffffkk0..',
];
const P_TORSO = [
  '..0BBBBBBBBBB0..',
  '.0fBBBBBBBBBBf0.',
  '.0fbBBBBBBBBbf0.',
  '..0bbbbbbbbbb0..',
  '..0dddddddddd0..',
  '..0dddddddddd0..',
];
const LEGS_STAND = [
  '..0ddd0..0ddd0..',
  '..0ddd0..0ddd0..',
  '..0eee0..0eee0..',
  '..00000..00000..',
];
const LEGS_STEP_L = [
  '..0ddd0..0ddd0..',
  '..0eee0..0ddd0..',
  '..00000..0eee0..',
  '.........00000..',
];
const LEGS_STEP_R = [
  '..0ddd0..0ddd0..',
  '..0ddd0..0eee0..',
  '..0eee0..00000..',
  '..00000.........',
];
const LEGS_SIDE_0 = [
  '....0dddddd0....',
  '....0dddddd0....',
  '....0eeeeee0....',
  '....00000000....',
];
const LEGS_SIDE_1 = [
  '...0ddd0dddd0...',
  '..0ddd0..0ddd0..',
  '..0eee0..0eee0..',
  '..00000..00000..',
];
const LEGS_SIDE_2 = [
  '....0dddddd0....',
  '.....0dddd0.....',
  '.....0eeee0.....',
  '.....000000.....',
];
const pl = (face: string[], legs: string[]) => [...P_HEAD, ...face, ...P_TORSO, ...legs];
const player_l0 = pl(P_FACE_L, LEGS_SIDE_0);
const player_l1 = pl(P_FACE_L, LEGS_SIDE_1);
const player_l2 = pl(P_FACE_L, LEGS_SIDE_2);

// ---- chicken 16x16 ----
const chicken0 = [
  '................',
  '......0R0.......',
  '.....0RRR0......',
  '....00www00.....',
  '...0wwwwwww0....',
  '..0w0Wwwwwww0...',
  '.YY0wwwwwwww0...',
  '..R0wwwwwwwww0..',
  '..0wwwwwwwwww0..',
  '..0www33wwwww0..',
  '..0www33wwwww0..',
  '..0wwwwwwwwww0..',
  '...0wwwwwwww0...',
  '....00000000....',
  '......Y..Y......',
  '.....YY..YY.....',
];
const chicken1 = [
  '................',
  '................',
  '................',
  '......0R0.......',
  '.....0RRR0......',
  '....00www00.....',
  '...0wwwwwww0....',
  '.YY0w0Wwwwww0...',
  '..R0wwwwwwwww0..',
  '..0www33wwwww0..',
  '..0www33wwwww0..',
  '..0wwwwwwwwww0..',
  '...0wwwwwwww0...',
  '....00000000....',
  '......Y..Y......',
  '.....YY..YY.....',
];

// ---- duck 16x16 ----
const duck0 = [
  '................',
  '.....000........',
  '...00qqq00......',
  '..0qqqqqqq0.....',
  '..0q0Wqqqq0.....',
  'YY0qqqqqqq0.....',
  'YY0qqqqqqq0.....',
  '..0qqqqqq0......',
  '..0wwwwwww000...',
  '.0wwwwwqqwwww0..',
  '.0wwwwqqqwwww00.',
  '.0wwwwwwwwwwww0.',
  '..0wwwwwwwwww0..',
  '...00wwwwww00...',
  '.....O..O.......',
  '....OO..OO......',
];
const duck1 = [
  '................',
  '................',
  '.....000........',
  '...00qqq00......',
  '..0qqqqqqq0.....',
  '..0q0Wqqqq0.....',
  'YY0qqqqqqq0.....',
  '..0qqqqqq0......',
  '..0wwwwwww0000..',
  '.0wwwwwqqwwwww0.',
  '.0wwwwqqqwwww0..',
  '.0wwwwwwwwwww0..',
  '..0wwwwwwwww0...',
  '...00wwwww00....',
  '.....O..O.......',
  '....OO..OO......',
];

// ---- cow 32x24: big front-facing chibi head + round body ----
const cow0 = [
  '................................',
  '................................',
  '..tt.........tt.................',
  '.0tt0.......0tt0................',
  '..000000000000..................',
  '.0wwwwwwwwwwww0.................',
  '0pwwwwwwwwwwwwp000000000........',
  '0pwwwwwwwwwwwwp0wwwwwwww00......',
  '.0ww00www00www0wwww11wwwww00....',
  '.0ww00www00www0www111wwwww0w0...',
  '.0wwwwwwwwwwww0wwwwwwwwwww0w0...',
  '.0wpppppppppww0wwwwwwwwwww0w0...',
  '.0wpp1ppp1ppww0wwwwwwwwww0011...',
  '.0wpppppppppww0wwww11wwww00.....',
  '.00wwwwwwwwww00www111wwww0......',
  '..0wwwwwwwwww0wwwwwwwwww00......',
  '...0wwwwwwwwwwwwwwwwwww00.......',
  '....00000000000000000000........',
  '.....0ww0.0ww0..0ww0.0ww0.......',
  '.....0ww0.0ww0..0ww0.0ww0.......',
  '.....0ww0.0ww0..0ww0.0ww0.......',
  '.....0110.0110..0110.0110.......',
  '.....0000.0000..0000.0000.......',
  '................................',
];
const cow1 = cow0.map((r, i) => {
  if (i === 2) return '..tt..........tt................';
  if (i === 3) return '.0tt0........0tt0...............';
  if (i === 9) return '.0ww00www00www0www111wwwww0.w0..';
  if (i === 10) return '.0wwwwwwwwwwww0wwwwwwwwwww0.w0..';
  if (i === 11) return '.0wpppppppppww0wwwwwwwwwww0.w0..';
  if (i === 12) return '.0wpp1ppp1ppww0wwwwwwwwww00.11..';
  return r;
});

// ---- goat 32x24: cream chibi, curved horns, beard ----
const goat0 = [
  '................................',
  '................................',
  '.tt............tt...............',
  '.0tt0.........0tt0..............',
  '..000000000000..................',
  '.0wwwwwwwwwwww0.................',
  '03wwwwwwwwwwww3000000...........',
  '03wwwwwwwwwwww30wwwww00.........',
  '.0ww00www00www0ww33wwww00.......',
  '.0ww00www00www0w333wwwww0w0.....',
  '.0wwwwwwwwwwww0wwwwwwwww00......',
  '.0w333333333ww0wwwwwwwww0.......',
  '.0w331333133ww0wwwwwww000.......',
  '.0w333333333ww0www33www0........',
  '.00wwwww33www00ww333www0........',
  '..0wwwwwwwwww0wwwwwwwww0........',
  '...0wwwwwwwwwwwwwwwww00.........',
  '....0000000000000000000.........',
  '.....0w0.0w0..0w0..0w0..........',
  '.....0w0.0w0..0w0..0w0..........',
  '.....0w0.0w0..0w0..0w0..........',
  '.....010.010..010..010..........',
  '.....000.000..000..000..........',
  '................................',
];
const goat1 = goat0.map((r, i) => {
  if (i === 2) return '..tt............tt..............';
  if (i === 3) return '.0tt0.........0tt0..............';
  if (i === 9) return '.0ww00www00www0w333wwwww0.w0....';
  if (i === 10) return '.0wwwwwwwwwwww0wwwwwwwww00w.....';
  return r;
});

// ---- slime 16x16 ----
const slime0 = [
  '................',
  '................',
  '................',
  '................',
  '.....000000.....',
  '...00GGGGGG00...',
  '..0GGGGGGGGGG0..',
  '..0GWWGGGGGGG0..',
  '.0GWWGGGGGGGGG0.',
  '.0GGGGGGGGGGGG0.',
  '.0G00GGGGG00GG0.',
  '.0G00GGGGG00GG0.',
  '.0GGGG11GGGGGG0.',
  '.0gGGGGGGGGGGg0.',
  '..0gggggggggg0..',
  '...0000000000...',
];
const slime1 = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '....00000000....',
  '..00GGGGGGGG00..',
  '.0GWWGGGGGGGGG0.',
  '0GGWGGGGGGGGGGG0',
  '0GG00GGGGG00GGG0',
  '0GG00GGGGG00GGG0',
  '0GGGGG11GGGGGGG0',
  '0gGGGGGGGGGGGGg0',
  '0gggggggggggggg0',
  '0000000000000000',
];

export const CHARS_ART: SpriteSheet = {
  player_d0: pl(P_FACE_D, LEGS_STAND),
  player_d1: pl(P_FACE_D, LEGS_STEP_L),
  player_d2: pl(P_FACE_D, LEGS_STEP_R),
  player_u0: pl(P_FACE_U, LEGS_STAND),
  player_u1: pl(P_FACE_U, LEGS_STEP_L),
  player_u2: pl(P_FACE_U, LEGS_STEP_R),
  player_l0, player_l1, player_l2,
  player_r0: mirror(player_l0),
  player_r1: mirror(player_l1),
  player_r2: mirror(player_l2),
  chicken0, chicken1, duck0, duck1, cow0, cow1, goat0, goat1, slime0, slime1,
  fish_shadow: [
    '................',
    '.....nnnnn......',
    '...nnnnnnnnn....',
    '..nnnnnnnnnn.n..',
    '..nnnnnnnnnnnn..',
    '...nnnnnnnnn.n..',
    '.....nnnnn......',
    '................',
  ],
  bobber: [
    '...t....',
    '...t....',
    '...t....',
    '..0000..',
    '.0RRRR0.',
    '0RWRRRR0',
    '0RRRRRR0',
    '0wwwwww0',
    '0wwwwww0',
    '.0wwww0.',
    '..0000..',
    '........',
    '........',
    '........',
    '........',
    '........',
  ],
  exclaim: [
    '....00000000....',
    '...0wwwwwwww0...',
    '..0wwwwwwwwww0..',
    '..0www0RR0www0..',
    '..0www0RR0www0..',
    '..0www0RR0www0..',
    '..0wwww00wwww0..',
    '..0wwwwwwwwww0..',
    '..0www0RR0www0..',
    '..0wwww00wwww0..',
    '...0wwwwwwww0...',
    '....0www0000....',
    '.....0w0........',
    '......0.........',
    '................',
    '................',
  ],
  heart: [
    '.00..00.',
    '0pRRRRR0',
    '0RRRRRR0',
    '0RRRRRR0',
    '.0RRRR0.',
    '..0RR0..',
    '...00...',
    '........',
  ],
  star_s: [
    '...t....',
    '..ttt...',
    '.ttttt..',
    'ttt3ttt.',
    '.ttttt..',
    '..ttt...',
    '...t....',
    '........',
  ],
  star_g: [
    '...Y....',
    '..YYY...',
    '.YYYYY..',
    'YYYWYYY.',
    '.YYYYY..',
    '..YYY...',
    '...Y....',
    '........',
  ],
  sparkle0: [
    '...W....',
    '...W....',
    '...W....',
    'WWWYWWW.',
    '...W....',
    '...W....',
    '...W....',
    '........',
  ],
  sparkle1: [
    '........',
    '.W...W..',
    '..W.W...',
    '...Y....',
    '..W.W...',
    '.W...W..',
    '........',
    '........',
  ],
  zzz: [
    '..BBBBB.........',
    '.....B..........',
    '....B...........',
    '..BBBBB.........',
    '................',
    '........BBBB....',
    '..........B.....',
    '.........B......',
    '........BBBB....',
    '................',
    '...........BBB..',
    '............B...',
    '...........BBB..',
    '................',
    '................',
    '................',
  ],
};
