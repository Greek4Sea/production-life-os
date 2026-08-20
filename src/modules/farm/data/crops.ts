// Crop table. Field sprites are `${spriteBase}${stage}` with stage
// 0..stageDays.length (the last one = ready-to-harvest). Sum of stageDays =
// days from planting to harvest (watered days only).

import type { CropDef, Season } from '../types';

export const CROPS: Record<string, CropDef> = {
  // ---- spring/summer/fall staple: the animal-feed crop ----
  wheat:       { id: 'wheat',       seedId: 'wheat_seeds',       seasons: [0, 1, 2], stageDays: [1, 2, 1], spriteBase: 'c_wheat' },
  // ---- spring ----
  turnip:      { id: 'turnip',      seedId: 'turnip_seeds',      seasons: [0],    stageDays: [1, 1, 2],       spriteBase: 'c_turnip' },
  potato:      { id: 'potato',      seedId: 'potato_seeds',      seasons: [0],    stageDays: [1, 2, 3],       spriteBase: 'c_potato' },
  strawberry:  { id: 'strawberry',  seedId: 'strawberry_seeds',  seasons: [0],    stageDays: [2, 2, 2, 2],    regrowDays: 4, spriteBase: 'c_strawberry' },
  cauliflower: { id: 'cauliflower', seedId: 'cauliflower_seeds', seasons: [0],    stageDays: [2, 3, 3, 4],    spriteBase: 'c_cauliflower' },
  // ---- summer ----
  melon:       { id: 'melon',       seedId: 'melon_seeds',       seasons: [1],    stageDays: [2, 3, 3, 4],    spriteBase: 'c_melon' },
  tomato:      { id: 'tomato',      seedId: 'tomato_seeds',      seasons: [1],    stageDays: [2, 2, 3, 4],    regrowDays: 4, spriteBase: 'c_tomato' },
  blueberry:   { id: 'blueberry',   seedId: 'blueberry_seeds',   seasons: [1],    stageDays: [3, 3, 4, 3],    regrowDays: 4, yield: 3, spriteBase: 'c_blueberry' },
  pepper:      { id: 'pepper',      seedId: 'pepper_seeds',      seasons: [1],    stageDays: [1, 1, 1, 2],    regrowDays: 3, spriteBase: 'c_pepper' },
  starfruit:   { id: 'starfruit',   seedId: 'starfruit_seeds',   seasons: [1],    stageDays: [3, 3, 3, 4],    spriteBase: 'c_starfruit' },
  // ---- summer + fall ----
  corn:        { id: 'corn',        seedId: 'corn_seeds',        seasons: [1, 2], stageDays: [2, 3, 4, 5],    regrowDays: 4, spriteBase: 'c_corn' },
  // ---- fall ----
  pumpkin:     { id: 'pumpkin',     seedId: 'pumpkin_seeds',     seasons: [2],    stageDays: [3, 3, 3, 4],    spriteBase: 'c_pumpkin' },
  eggplant:    { id: 'eggplant',    seedId: 'eggplant_seeds',    seasons: [2],    stageDays: [1, 1, 1, 2],    regrowDays: 5, spriteBase: 'c_eggplant' },
  cranberry:   { id: 'cranberry',   seedId: 'cranberry_seeds',   seasons: [2],    stageDays: [1, 2, 2, 2],    regrowDays: 5, yield: 2, spriteBase: 'c_cranberry' },
  yam:         { id: 'yam',         seedId: 'yam_seeds',         seasons: [2],    stageDays: [2, 3, 5],       spriteBase: 'c_yam' },
  // ---- winter (one hardy flower so winter isn't crop-dead) ----
  frostlily:   { id: 'frostlily',   seedId: 'frostlily_seeds',   seasons: [3],    stageDays: [3, 3, 4],       spriteBase: 'c_frostlily' },
};

export const cropTotalDays = (c: CropDef) => c.stageDays.reduce((a, b) => a + b, 0);

export function cropStage(c: CropDef, daysGrown: number): number {
  let acc = 0, stage = 0;
  for (const d of c.stageDays) {
    acc += d;
    if (daysGrown >= acc) stage++;
    else break;
  }
  return stage; // stageDays.length = ready
}

export const cropsForSeason = (s: Season) =>
  Object.values(CROPS).filter((c) => c.seasons.includes(s));
