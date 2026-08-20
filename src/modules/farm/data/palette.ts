// Life OS Farm — the one global palette every sprite is authored against.
// Sprites are 16x16 (or listed multiples) string grids; each char is a key here.
// '.' = transparent. Keep art warm, rounded, and cute: thick '0' outlines,
// 2-tone shading, big highlights.

export const PALETTE: Record<string, string> = {
  '.': '',
  // outlines & neutrals
  '0': '#2a1e2e', // warm near-black outline
  '1': '#54405c', // soft inner outline / dark shadow
  '2': '#8a7490', // mid neutral
  '3': '#c9bccf', // light neutral
  'w': '#fdf3e0', // warm white
  'W': '#ffffff', // pure white (highlights, eyes)
  // greens (grass / leaves)
  'g': '#3e8948', // leaf dark
  'G': '#63c74d', // leaf light
  'h': '#265c42', // leaf deepest / bush shadow
  'H': '#99e65f', // leaf highlight
  // browns (soil / wood / trunks)
  'd': '#6e4a2f', // dirt dark / trunk
  'D': '#9c6b3f', // dirt light / wood
  'e': '#4a3126', // soil deepest / tilled dark
  'E': '#c8925a', // wood light / path
  // blues (water / sky)
  'b': '#2e6f8e', // water dark
  'B': '#4fa4c7', // water light
  'c': '#8fd3e8', // water sparkle / ice
  // reds / pinks
  'r': '#a8353a', // red dark (barn, fruit)
  'R': '#e8574f', // red light
  'p': '#f2a5b1', // pink (blossom, pig-cute accents)
  // yellows / oranges
  'y': '#b8862d', // gold dark / straw shadow
  'Y': '#f4c542', // gold light / straw
  'o': '#d97e28', // orange (pumpkin, autumn)
  'O': '#f2a65e', // orange light / skin warm
  // purples
  'v': '#5d3a6e', // purple dark (eggplant, gems)
  'V': '#9e6ac9', // purple light
  // greys (stone / metal)
  's': '#5a5a6e', // stone dark
  'S': '#8b8ba3', // stone light
  't': '#c2c2d1', // stone highlight / metal shine
  // skin / hair for the avatar & NPC bits
  'f': '#f0c8a0', // skin
  'F': '#d99e6a', // skin shadow
  'k': '#3d2a20', // hair dark
  // specials
  'q': '#7fe0d8', // teal gem / sprinkler water
  'n': '#173753', // night/cave deep blue
};

// Seasonal looks = char substitutions applied when building that season's atlas.
// Only terrain/tree-ish chars shift; everything else stays stable.
export const SEASON_SWAPS: Record<string, string>[] = [
  // 0 spring — base palette, untouched
  {},
  // 1 summer — deeper lush greens
  { 'g': '#35803f', 'G': '#54b84a', 'H': '#8ede55', 'h': '#1f5238' },
  // 2 fall — golds and browns
  { 'g': '#8a6a2a', 'G': '#c79a3e', 'H': '#e8c46a', 'h': '#6b4d24' },
  // 3 winter — snow and cold shadow
  { 'g': '#b9c7d4', 'G': '#e6edf4', 'H': '#ffffff', 'h': '#8fa3b5' },
];
