// Item registry. Inventory icons are `i_<id>` in the atlas (16x16).
// No shops in homestead mode — `sell` is a legacy value used only for sorting.

import type { AnimalDef, ItemDef } from '../types';

const I = (id: string, name: string, sell: number, extra: Partial<ItemDef> = {}): ItemDef =>
  ({ id, name, sell, sprite: `i_${id}`, ...extra });

export const ITEMS: Record<string, ItemDef> = Object.fromEntries([
  // ---- gathering basics ----
  I('branch', 'Branch', 1),
  I('fiber', 'Plant Fiber', 1),
  I('wood', 'Wood', 2),
  I('hardwood', 'Hardwood', 8),
  I('stone', 'Stone', 2),
  I('acorn', 'Acorn', 2),
  I('hay', 'Hay', 1),
  // ---- forage ----
  I('berries', 'Wild Berries', 12, { edible: 12, feed: true }),
  I('mushroom', 'Mushroom', 15, { edible: 15 }),
  I('mixed_seeds', 'Mixed Seeds', 5, { seedOf: 'mixed' }),
  // ---- seeds ----
  I('wheat_seeds', 'Wheat Seeds', 8, { seedOf: 'wheat' }),
  I('turnip_seeds', 'Turnip Seeds', 10, { seedOf: 'turnip' }),
  I('potato_seeds', 'Potato Seeds', 25, { seedOf: 'potato' }),
  I('strawberry_seeds', 'Strawberry Seeds', 50, { seedOf: 'strawberry' }),
  I('cauliflower_seeds', 'Cauliflower Seeds', 40, { seedOf: 'cauliflower' }),
  I('melon_seeds', 'Melon Seeds', 40, { seedOf: 'melon' }),
  I('tomato_seeds', 'Tomato Seeds', 25, { seedOf: 'tomato' }),
  I('blueberry_seeds', 'Blueberry Seeds', 40, { seedOf: 'blueberry' }),
  I('pepper_seeds', 'Pepper Seeds', 20, { seedOf: 'pepper' }),
  I('starfruit_seeds', 'Starfruit Seeds', 200, { seedOf: 'starfruit' }),
  I('corn_seeds', 'Corn Seeds', 75, { seedOf: 'corn' }),
  I('pumpkin_seeds', 'Pumpkin Seeds', 50, { seedOf: 'pumpkin' }),
  I('eggplant_seeds', 'Eggplant Seeds', 10, { seedOf: 'eggplant' }),
  I('cranberry_seeds', 'Cranberry Seeds', 120, { seedOf: 'cranberry' }),
  I('yam_seeds', 'Yam Seeds', 30, { seedOf: 'yam' }),
  I('frostlily_seeds', 'Frost Lily Seeds', 30, { seedOf: 'frostlily' }),
  // ---- produce (all feedable to wild animals) ----
  I('wheat', 'Wheat', 25, { edible: 8, feed: true }),
  I('turnip', 'Turnip', 40, { edible: 12, feed: true }),
  I('potato', 'Potato', 90, { edible: 18, feed: true }),
  I('strawberry', 'Strawberry', 65, { edible: 14, feed: true }),
  I('cauliflower', 'Cauliflower', 200, { edible: 30, feed: true }),
  I('melon', 'Melon', 275, { edible: 40, feed: true }),
  I('tomato', 'Tomato', 70, { edible: 14, feed: true }),
  I('blueberry', 'Blueberry', 60, { edible: 12, feed: true }),
  I('pepper', 'Hot Pepper', 45, { edible: 10 }),
  I('starfruit', 'Starfruit', 750, { edible: 60, feed: true }),
  I('corn', 'Corn', 60, { edible: 14, feed: true }),
  I('pumpkin', 'Pumpkin', 320, { edible: 45, feed: true }),
  I('eggplant', 'Eggplant', 65, { edible: 14, feed: true }),
  I('cranberry', 'Cranberries', 80, { edible: 12, feed: true }),
  I('yam', 'Yam', 160, { edible: 25, feed: true }),
  I('frostlily', 'Frost Lily', 180),
  // ---- mining ----
  I('coal', 'Coal', 15),
  I('copper_ore', 'Copper Ore', 8),
  I('iron_ore', 'Iron Ore', 15),
  I('gold_ore', 'Gold Ore', 35),
  I('copper_bar', 'Copper Bar', 60),
  I('iron_bar', 'Iron Bar', 120),
  I('gold_bar', 'Gold Bar', 250),
  I('quartz', 'Quartz', 60),
  I('emerald', 'Emerald', 280),
  I('diamond', 'Diamond', 750),
  I('slime_goo', 'Slime Goo', 6),
  I('shade_essence', 'Shade Essence', 40),
  I('rune_shard', 'Rune Shard', 0),
  I('void_heart', 'Void Heart', 0),
  I('gloom_crown', 'Gloom Crown', 0),
  I('star_metal', 'Star Metal', 300),
  // ---- animal products ----
  I('egg', 'Egg', 50, { edible: 15 }),
  I('duck_egg', 'Duck Egg', 95, { edible: 20 }),
  I('milk', 'Milk', 125, { edible: 25 }),
  I('goat_milk', 'Goat Milk', 225, { edible: 35 }),
  I('wool', 'Wool', 150),
  // ---- cooked meals (campfire) ----
  I('roast', 'Campfire Roast', 60, { edible: 55 }),
  I('omelet', 'Omelet', 80, { edible: 70 }),
  I('grilled_fish', 'Grilled Fish', 75, { edible: 65 }),
  // ---- fish ----
  I('chub', 'Chub', 30, { edible: 15 }),
  I('sunfish', 'Sunfish', 35, { edible: 15 }),
  I('carp', 'Carp', 30, { edible: 15 }),
  I('perch', 'Perch', 55, { edible: 18 }),
  I('trout', 'Trout', 65, { edible: 18 }),
  I('bass', 'Bass', 100, { edible: 22 }),
  I('catfish', 'Catfish', 200, { edible: 25 }),
  I('icefish', 'Icefish', 120, { edible: 20 }),
  I('old_boot', 'Old Boot', 5),
  I('golden_koi', 'Golden Koi', 500),
  I('old_bottle', 'Old Bottle', 0),
  I('golden_egg', 'Golden Egg', 400),
  // ---- craftable placeables ----
  I('sprinkler', 'Sprinkler', 100, { placeable: 'sprinkler' }),
  I('furnace', 'Furnace', 100, { placeable: 'furnace' }),
  I('scarecrow', 'Scarecrow', 50, { placeable: 'scarecrow' }),
  I('campfire_kit', 'Campfire', 20, { placeable: 'campfire', sprite: 'campfire' }),
  I('fence', 'Fence', 4, { placeable: 'fence', sprite: 'i_fence' }),
  I('gate', 'Gate', 10, { placeable: 'gate', sprite: 'i_gate' }),
  I('chest', 'Storage Chest', 25, { placeable: 'chest', sprite: 'chest' }),
  I('bench_kit', 'Crafting Bench', 30, { placeable: 'bench', sprite: 'bench' }),
  I('anvil_kit', 'Anvil', 150, { placeable: 'anvil', sprite: 'anvil' }),
  // building kits — place anywhere on open ground (tapped tile = the door)
  I('house_kit', 'Cabin Kit', 300, { sprite: 'i_house_kit' }),
  I('coop_kit', 'Coop Kit', 150, { sprite: 'i_coop_kit' }),
  I('barn_kit', 'Barn Kit', 250, { sprite: 'i_barn_kit' }),
  I('bridge_kit', 'Bridge Planks', 15, { sprite: 'bridge' }),
  I('tent_kit', 'Tent', 50, { sprite: 'i_tent_kit' }),
].map((d) => [d.id, d]));

export const ANIMALS: Record<string, AnimalDef> = {
  chicken: { kind: 'chicken', home: 'coop', produce: 'egg',       everyDays: 1, minDay: 0,  sprite: 'chicken' },
  duck:    { kind: 'duck',    home: 'coop', produce: 'duck_egg',  everyDays: 2, minDay: 0,  sprite: 'duck' },
  sheep:   { kind: 'sheep',   home: 'barn', produce: 'wool',      everyDays: 3, viaTool: 'scythe', minDay: 10, sprite: 'sheep' },
  cow:     { kind: 'cow',     home: 'barn', produce: 'milk',      everyDays: 1, viaTool: 'pail', minDay: 10, sprite: 'cow' },
  goat:    { kind: 'goat',    home: 'barn', produce: 'goat_milk', everyDays: 2, viaTool: 'pail', minDay: 20, sprite: 'goat' },
};

export const QUALITY_MULT = [1, 1.25, 1.5];

export const ANIMAL_NAMES = ['Pearl', 'Clover', 'Waffles', 'Biscuit', 'Maple', 'Pepper', 'Mochi', 'Juno', 'Ollie', 'Poppy', 'Nugget', 'Daisy'];
