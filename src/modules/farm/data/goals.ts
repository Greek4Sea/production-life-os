// Journal goals — the start-from-nothing progression ladder. Cumulative
// stats-driven (no baselines): a goal shows once its prereq is done and
// completes when stats[stat] >= n.

import type { GoalDef } from '../types';

export const GOALS: GoalDef[] = [
  { id: 'g_gather', title: 'Sticks & Stones', text: 'Gather 8 branches and some loose stone from the forest floor.', stat: 'gathered', n: 12, hint: 'Tap fallen branches, stone piles, and weeds — no tools needed.' },
  { id: 'g_bench', title: 'A Place to Work', text: 'Craft and place a Crafting Bench.', stat: 'built_bench', n: 1, prereq: 'g_gather', hint: 'Craft it straight from your backpack, then place it near the tent.' },
  { id: 'g_tools', title: 'Crude but Honest', text: 'Craft an axe, a pickaxe, and a hoe at the bench.', stat: 'toolsCrafted', n: 3, prereq: 'g_bench' },
  { id: 'g_farm', title: 'First Sprouts', text: 'Till soil and plant 3 seeds.', stat: 'planted', n: 3, prereq: 'g_tools', hint: 'Weeds and bushes drop seeds. Water daily!' },
  { id: 'g_harvest', title: 'First Harvest', text: 'Harvest 3 crops.', stat: 'cropsHarvested', n: 3, prereq: 'g_farm' },
  { id: 'g_bridge', title: 'Across the River', text: 'Lay bridge planks across the river.', stat: 'built_bridge', n: 1, prereq: 'g_tools', hint: 'Craft Bridge Planks at the bench, hold them, and tap the water — one tile at a time, wherever you like.' },
  { id: 'g_mine', title: 'Into the Dark', text: 'Break open the boarded cave on the east ridge.', stat: 'mineOpened', n: 1, prereq: 'g_bridge', hint: 'A pickaxe will do it.' },
  { id: 'g_smelt', title: 'First Metal', text: 'Smelt a copper bar.', stat: 'barsSmelted', n: 1, prereq: 'g_mine', hint: 'Craft a furnace (needs copper ore), feed it 5 ore + 1 coal.' },
  { id: 'g_anvil', title: 'Ring of the Anvil', text: 'Build an anvil and forge a copper tool.', stat: 'metalToolsCrafted', n: 1, prereq: 'g_smelt' },
  { id: 'g_house', title: 'No More Tent', text: 'Build a cabin.', stat: 'built_house', n: 1, prereq: 'g_harvest', hint: 'Craft the Cabin Kit at the bench (hardwood comes from old stumps), then place it anywhere — the tile you tap becomes the front door.' },
  { id: 'g_coop', title: 'Feathered Friends', text: 'Build a coop wherever you like.', stat: 'built_coop', n: 1, prereq: 'g_house' },
  { id: 'g_tame', title: 'A New Friend', text: 'Tame a wild animal by feeding it.', stat: 'tamed', n: 1, prereq: 'g_coop', hint: 'Wild animals wander the meadows. Hold food they like and tap them.' },
  { id: 'g_barn', title: 'Raise the Barn', text: 'Build a barn.', stat: 'built_barn', n: 1, prereq: 'g_tame' },
  { id: 'g_breed', title: 'The More the Merrier', text: 'Have a baby animal born on the farm.', stat: 'born', n: 1, prereq: 'g_tame', hint: 'Two happy, well-fed animals of the same kind…' },
  { id: 'g_fish', title: 'Gone Fishing', text: 'Craft a rod and catch 5 fish.', stat: 'fishCaught', n: 5, prereq: 'g_bench' },
  { id: 'g_deep', title: 'The Deep Seam', text: 'Reach floor 10 of the mine.', stat: 'floorReached', n: 10, prereq: 'g_smelt' },
  { id: 'g_iron', title: 'Iron Age', text: 'Forge an iron tool.', stat: 'ironToolsCrafted', n: 1, prereq: 'g_deep' },
  { id: 'g_gold', title: 'Golden Touch', text: 'Forge a golden tool.', stat: 'goldToolsCrafted', n: 1, prereq: 'g_iron' },
  { id: 'g_starfruit', title: 'The Legendary Fruit', text: 'Grow a starfruit.', stat: 'harvested_starfruit', n: 1, prereq: 'g_harvest', hint: 'Rumor says its seeds hide in gem veins below floor 15…' },
  { id: 'g_fence', title: 'My Kingdom', text: 'Fence in your homestead — place 20 fences.', stat: 'fencesPlaced', n: 20, prereq: 'g_house', hint: 'The nights have been getting… restless.' },
  { id: 'g_nightwatch', title: 'Night Watch', text: 'Survive to see what the dark brings — and drive 10 of them off.', stat: 'shadesSlain', n: 10, prereq: 'g_fence' },
  { id: 'g_trade', title: 'Strange Company', text: 'Do business with a wandering trader.', stat: 'trades', n: 1, prereq: 'g_harvest', hint: 'They say someone with a heavy pack roams the meadows some mornings.' },
  { id: 'g_rich', title: 'Full Purse', text: 'Hold 5,000 gold at once.', stat: 'goldPeak', n: 5000, prereq: 'g_trade' },
  { id: 'g_skilled', title: 'Jack of All Trades', text: 'Reach level 5 in every skill.', stat: 'allSkills5', n: 1, prereq: 'g_smelt' },
  { id: 'g_deep30', title: 'The Long Dark', text: 'Reach floor 30 of the mine.', stat: 'floorReached', n: 30, prereq: 'g_deep' },
  // ——— the ??? goals: the game knows. you don't. yet. ———
  { id: 's_koi', title: '???', text: 'Something golden moves beneath the water.', stat: 'caught_golden_koi', n: 1, secret: true },
  { id: 's_bottle', title: '???', text: 'The river keeps old secrets.', stat: 'bottlesRead', n: 1, secret: true },
  { id: 's_shard', title: '???', text: 'Three of a kind, scattered far.', stat: 'shardsFound', n: 3, secret: true },
  { id: 's_altar', title: '???', text: 'Old stones remember old doors.', stat: 'altarFound', n: 1, secret: true },
  { id: 's_below', title: '???', text: 'Something below the below is waiting.', stat: 'bossKills', n: 1, secret: true },
];

export const GOAL_BY_ID: Record<string, GoalDef> = Object.fromEntries(GOALS.map((g) => [g.id, g]));
