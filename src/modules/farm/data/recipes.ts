// Crafting recipes. A recipe is discovered the moment its `unlockOn` item
// first enters your inventory ('start' = known from day one). Tool recipes
// raise that tool's tier; the better the tier, the rarer the key ingredient.

import type { Recipe } from '../types';

export const RECIPES: Recipe[] = [
  // ---- hand (anywhere) ----
  { id: 'r_bench', name: 'Crafting Bench', station: 'hand', out: 'bench_kit', mats: [{ id: 'branch', qty: 8 }, { id: 'stone', qty: 4 }], unlockOn: 'start', desc: 'Where everything begins.' },
  { id: 'r_campfire', name: 'Campfire', station: 'hand', out: 'campfire_kit', mats: [{ id: 'branch', qty: 5 }, { id: 'stone', qty: 5 }], unlockOn: 'start', desc: 'Cook forage into real meals.' },

  // ---- bench: crude tools bootstrap ----
  { id: 'r_axe0', name: 'Crude Axe', station: 'bench', out: { tool: 'axe', tier: 0 }, mats: [{ id: 'branch', qty: 5 }, { id: 'stone', qty: 3 }, { id: 'fiber', qty: 2 }], unlockOn: 'start' },
  { id: 'r_pickaxe0', name: 'Crude Pickaxe', station: 'bench', out: { tool: 'pickaxe', tier: 0 }, mats: [{ id: 'branch', qty: 5 }, { id: 'stone', qty: 5 }, { id: 'fiber', qty: 2 }], unlockOn: 'start' },
  { id: 'r_hoe0', name: 'Crude Hoe', station: 'bench', out: { tool: 'hoe', tier: 0 }, mats: [{ id: 'branch', qty: 4 }, { id: 'stone', qty: 2 }, { id: 'fiber', qty: 2 }], unlockOn: 'start' },
  { id: 'r_can0', name: 'Bark Watering Can', station: 'bench', out: { tool: 'can', tier: 0 }, mats: [{ id: 'wood', qty: 6 }, { id: 'fiber', qty: 4 }], unlockOn: 'start' },
  { id: 'r_scythe0', name: 'Crude Scythe', station: 'bench', out: { tool: 'scythe', tier: 0 }, mats: [{ id: 'branch', qty: 4 }, { id: 'stone', qty: 3 }], unlockOn: 'start' },
  { id: 'r_sword0', name: 'Wooden Sword', station: 'bench', out: { tool: 'sword', tier: 0 }, mats: [{ id: 'wood', qty: 8 }, { id: 'fiber', qty: 3 }], unlockOn: 'wood' },
  { id: 'r_rod', name: 'Fishing Rod', station: 'bench', out: { tool: 'rod', tier: 0 }, mats: [{ id: 'wood', qty: 8 }, { id: 'fiber', qty: 5 }], unlockOn: 'wood', desc: 'Cast at any water.' },
  { id: 'r_scarecrow', name: 'Scarecrow', station: 'bench', out: 'scarecrow', mats: [{ id: 'wood', qty: 10 }, { id: 'fiber', qty: 8 }], unlockOn: 'wood' },
  { id: 'r_furnace', name: 'Furnace', station: 'bench', out: 'furnace', mats: [{ id: 'stone', qty: 20 }, { id: 'copper_ore', qty: 5 }], unlockOn: 'copper_ore', desc: '5 ore + 1 coal → a bar, overnight.' },
  { id: 'r_anvil', name: 'Anvil', station: 'bench', out: 'anvil_kit', mats: [{ id: 'stone', qty: 10 }, { id: 'copper_bar', qty: 5 }], unlockOn: 'copper_bar', desc: 'Forge metal tools.' },

  // ---- anvil: metal tool tiers (each needs a special ingredient) ----
  { id: 'r_axe1', name: 'Copper Axe', station: 'anvil', out: { tool: 'axe', tier: 1 }, mats: [{ id: 'copper_bar', qty: 5 }, { id: 'hardwood', qty: 2 }], unlockOn: 'copper_bar' },
  { id: 'r_pickaxe1', name: 'Copper Pickaxe', station: 'anvil', out: { tool: 'pickaxe', tier: 1 }, mats: [{ id: 'copper_bar', qty: 5 }, { id: 'hardwood', qty: 2 }], unlockOn: 'copper_bar' },
  { id: 'r_hoe1', name: 'Copper Hoe', station: 'anvil', out: { tool: 'hoe', tier: 1 }, mats: [{ id: 'copper_bar', qty: 5 }, { id: 'hardwood', qty: 1 }], unlockOn: 'copper_bar' },
  { id: 'r_can1', name: 'Copper Can', station: 'anvil', out: { tool: 'can', tier: 1 }, mats: [{ id: 'copper_bar', qty: 5 }, { id: 'hardwood', qty: 1 }], unlockOn: 'copper_bar' },
  { id: 'r_sword1', name: 'Copper Sword', station: 'anvil', out: { tool: 'sword', tier: 1 }, mats: [{ id: 'copper_bar', qty: 5 }, { id: 'slime_goo', qty: 3 }], unlockOn: 'copper_bar' },
  { id: 'r_pail', name: 'Milk Pail', station: 'anvil', out: { tool: 'pail', tier: 0 }, mats: [{ id: 'copper_bar', qty: 3 }], unlockOn: 'copper_bar' },
  { id: 'r_sprinkler', name: 'Sprinkler', station: 'anvil', out: 'sprinkler', mats: [{ id: 'copper_bar', qty: 2 }, { id: 'quartz', qty: 1 }], unlockOn: 'quartz', desc: 'Waters a 3×3 patch each morning.' },

  { id: 'r_axe2', name: 'Iron Axe', station: 'anvil', out: { tool: 'axe', tier: 2 }, mats: [{ id: 'iron_bar', qty: 5 }, { id: 'quartz', qty: 1 }], unlockOn: 'iron_bar' },
  { id: 'r_pickaxe2', name: 'Iron Pickaxe', station: 'anvil', out: { tool: 'pickaxe', tier: 2 }, mats: [{ id: 'iron_bar', qty: 5 }, { id: 'quartz', qty: 1 }], unlockOn: 'iron_bar' },
  { id: 'r_hoe2', name: 'Iron Hoe', station: 'anvil', out: { tool: 'hoe', tier: 2 }, mats: [{ id: 'iron_bar', qty: 5 }], unlockOn: 'iron_bar' },
  { id: 'r_can2', name: 'Iron Can', station: 'anvil', out: { tool: 'can', tier: 2 }, mats: [{ id: 'iron_bar', qty: 5 }], unlockOn: 'iron_bar' },
  { id: 'r_sword2', name: 'Iron Sword', station: 'anvil', out: { tool: 'sword', tier: 2 }, mats: [{ id: 'iron_bar', qty: 5 }, { id: 'slime_goo', qty: 5 }], unlockOn: 'iron_bar' },

  { id: 'r_axe3', name: 'Golden Axe', station: 'anvil', out: { tool: 'axe', tier: 3 }, mats: [{ id: 'gold_bar', qty: 5 }, { id: 'emerald', qty: 1 }], unlockOn: 'gold_bar' },
  { id: 'r_pickaxe3', name: 'Golden Pickaxe', station: 'anvil', out: { tool: 'pickaxe', tier: 3 }, mats: [{ id: 'gold_bar', qty: 5 }, { id: 'emerald', qty: 1 }], unlockOn: 'gold_bar' },
  { id: 'r_hoe3', name: 'Golden Hoe', station: 'anvil', out: { tool: 'hoe', tier: 3 }, mats: [{ id: 'gold_bar', qty: 5 }, { id: 'emerald', qty: 1 }], unlockOn: 'gold_bar' },
  { id: 'r_can3', name: 'Golden Can', station: 'anvil', out: { tool: 'can', tier: 3 }, mats: [{ id: 'gold_bar', qty: 5 }, { id: 'emerald', qty: 1 }], unlockOn: 'gold_bar' },
  { id: 'r_sword3', name: 'Golden Sword', station: 'anvil', out: { tool: 'sword', tier: 3 }, mats: [{ id: 'gold_bar', qty: 5 }, { id: 'diamond', qty: 1 }], unlockOn: 'gold_bar' },
  { id: 'r_sword4', name: '????????', station: 'anvil', out: { tool: 'sword', tier: 4 }, mats: [{ id: 'void_heart', qty: 1 }, { id: 'gold_bar', qty: 5 }, { id: 'shade_essence', qty: 3 }], unlockOn: 'void_heart', desc: 'It remembers the dark.' },

  // ---- campfire cooking ----
  { id: 'r_roast', name: 'Campfire Roast', station: 'campfire', out: 'roast', mats: [{ id: 'mushroom', qty: 1 }, { id: 'berries', qty: 1 }], unlockOn: 'start' },
  { id: 'r_omelet', name: 'Omelet', station: 'campfire', out: 'omelet', mats: [{ id: 'egg', qty: 2 }], unlockOn: 'egg' },
  { id: 'r_grilled_fish', name: 'Grilled Fish', station: 'campfire', out: 'grilled_fish', mats: [{ id: 'chub', qty: 1 }], unlockOn: 'chub', desc: 'Any small fish works over a fire.' },

  // ---- bench: buildings (kits — place them wherever you like) ----
  { id: 'r_bridge', name: 'Bridge Planks', station: 'bench', out: 'bridge_kit', outQty: 1, mats: [{ id: 'wood', qty: 8 }, { id: 'stone', qty: 2 }], unlockOn: 'wood', desc: 'One walkable tile, laid on water.' },
  { id: 'r_coop_kit', name: 'Coop Kit', station: 'bench', out: 'coop_kit', mats: [{ id: 'wood', qty: 40 }, { id: 'stone', qty: 15 }, { id: 'fiber', qty: 10 }], unlockOn: 'wood', desc: 'A home for chickens & ducks. Place it anywhere open.' },
  { id: 'r_house_kit', name: 'Cabin Kit', station: 'bench', out: 'house_kit', mats: [{ id: 'wood', qty: 60 }, { id: 'stone', qty: 30 }, { id: 'hardwood', qty: 5 }], unlockOn: 'hardwood', desc: 'A real roof instead of canvas — with a proper bed.' },
  { id: 'r_barn_kit', name: 'Barn Kit', station: 'bench', out: 'barn_kit', mats: [{ id: 'wood', qty: 80 }, { id: 'stone', qty: 30 }, { id: 'hardwood', qty: 3 }], unlockOn: 'hardwood', desc: 'Big enough for cows and goats.' },

  // ---- bench: defense & storage ----
  { id: 'r_fence', name: 'Fences ×4', station: 'bench', out: 'fence', outQty: 4, mats: [{ id: 'wood', qty: 2 }], unlockOn: 'wood', desc: 'Keeps things out (and in). Some nights you’ll be glad you did.' },
  { id: 'r_gate', name: 'Gate', station: 'bench', out: 'gate', mats: [{ id: 'wood', qty: 4 }, { id: 'stone', qty: 1 }], unlockOn: 'wood', desc: 'A fence only YOU can walk through.' },
  { id: 'r_chest', name: 'Storage Chest', station: 'bench', out: 'chest', mats: [{ id: 'wood', qty: 15 }], unlockOn: 'wood', desc: 'Keep your treasures somewhere safer than your pockets…' },

  // ---- bench: quality of life ----
  { id: 'r_backpack', name: 'Big Backpack', station: 'bench', out: 'backpack_upgrade', mats: [{ id: 'fiber', qty: 20 }, { id: 'hardwood', qty: 4 }], unlockOn: 'hardwood', desc: '+12 inventory slots.' },
];

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

// Shown AFTER a tool is crafted (never spoiled beforehand): what it's for.
export const TOOL_INFO: Record<string, string> = {
  hoe: 'Tills grass into farmable soil — tap open ground while holding it, then plant seeds in the tilled earth.',
  can: 'Waters your crops. Refill it at the lake or river; crops only grow on days they were watered (rain helps!).',
  axe: 'Chops trees into wood. Keep chopping the old stumps left behind — that’s where hardwood comes from.',
  pickaxe: 'Breaks rocks for stone and ore, clears tilled soil… and it’s strong enough to pry the boards off that cave.',
  scythe: 'Swipes weeds into hay for feeding animals — and gives sheep a very fashionable haircut (+wool).',
  sword: 'For the slimes in the mine. Poke them before they hug you.',
  pail: 'Milks cows and goats in the barn — walk up with it and tap them when they have milk ready.',
  rod: 'Cast at any water, wait for the ❗, tap, then hold to keep the fish inside the green bar.',
};
export const TIER_NAMES = ['Crude', 'Copper', 'Iron', 'Golden', 'Void'];
export const TIER_FLAVOR = [
  'It’s not pretty, but it works.',
  'Lighter swings, less energy — and it can crack the big boulders.',
  'Serious tools for serious work. Costs almost nothing to swing.',
  'The finest tool a homestead has ever seen. ✨',
  'It drinks the light. It is very, very sharp.',
];

// items that also unlock recipes when a similar fish is caught
export const FISH_FOR_GRILL = new Set(['chub', 'sunfish', 'carp', 'perch', 'trout']);
