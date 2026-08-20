// Fish behavior table for the bobber minigame. difficulty drives dart
// speed/frequency; waters gates where each fish bites.

import type { FishDef } from '../types';

export const FISH: FishDef[] = [
  { id: 'chub',    seasons: [0, 1, 2, 3], difficulty: 0.5, waters: ['pond', 'river'] },
  { id: 'carp',    seasons: [0, 1, 2, 3], difficulty: 0.6, waters: ['pond'] },
  { id: 'sunfish', seasons: [0, 1],       difficulty: 0.7, waters: ['river'] },
  { id: 'perch',   seasons: [0, 2],       difficulty: 0.8, waters: ['pond', 'river'] },
  { id: 'trout',   seasons: [0, 1],       difficulty: 1.0, waters: ['river'] },
  { id: 'bass',    seasons: [1, 2],       difficulty: 1.2, waters: ['pond', 'river'] },
  { id: 'catfish', seasons: [2],          difficulty: 1.5, waters: ['river'] },
  { id: 'icefish', seasons: [3],          difficulty: 1.1, waters: ['pond', 'river'] },
];

export const TRASH_CHANCE = 0.12; // old boot
export const BOTTLE_CHANCE = 0.03;  // a corked bottle with… something inside
export const KOI_CHANCE = 0.006;    // the golden koi — patience

export function rollFish(rng: () => number, season: number, water: 'pond' | 'river'): string {
  if (rng() < KOI_CHANCE) return 'golden_koi';
  if (rng() < BOTTLE_CHANCE) return 'old_bottle';
  if (rng() < TRASH_CHANCE) return 'old_boot';
  const pool = FISH.filter((f) => f.seasons.includes(season as 0) && f.waters.includes(water));
  // weight easier fish heavier so early fishing is kind
  const weights = pool.map((f) => 2 - f.difficulty + 0.4);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i].id;
  }
  return pool[pool.length - 1]?.id ?? 'chub';
}
