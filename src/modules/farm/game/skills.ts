// Skill levels: xp per action, level = sqrt curve, passive perks per level.

import type { Skill } from '../types';
import { checkGoals } from './goals';
import { toast, type Game } from './runtime';

export const SKILLS: Skill[] = ['farming', 'mining', 'foraging', 'fishing', 'combat'];
export const SKILL_ICON: Record<Skill, string> = { farming: '🌾', mining: '⛏️', foraging: '🌲', fishing: '🎣', combat: '⚔️' };

export const skillLevel = (xp: number) => Math.min(10, Math.floor(Math.sqrt(Math.max(0, xp) / 40)));
export const xpIntoLevel = (xp: number) => {
  const l = skillLevel(xp);
  const base = 40 * l * l, next = 40 * (l + 1) * (l + 1);
  return { have: xp - base, need: next - base, level: l };
};

const PERK_TEXT: Record<Skill, string> = {
  farming: 'better crop quality',
  mining: 'more ore per rock',
  foraging: 'chance of double gathers',
  fishing: 'a bigger catch bar',
  combat: 'harder hits',
};

export function addXp(g: Game, skill: Skill, n: number) {
  const s = g.save;
  const before = skillLevel(s.player.skills[skill] ?? 0);
  s.player.skills[skill] = (s.player.skills[skill] ?? 0) + n;
  const after = skillLevel(s.player.skills[skill]);
  if (after > before) {
    toast(g, `${SKILL_ICON[skill]} ${skill} level ${after} — ${PERK_TEXT[skill]}!`, '✨');
    if (SKILLS.every((k) => skillLevel(s.player.skills[k] ?? 0) >= 5)) s.stats.allSkills5 = 1;
    checkGoals(g);
  }
  g.dirty = true;
}

// passive perks
export const qualityBonus = (g: Game) => skillLevel(g.save.player.skills.farming) * 0.015;
export const oreBonus = (g: Game) => skillLevel(g.save.player.skills.mining) * 0.02;
export const doubleForageChance = (g: Game) => skillLevel(g.save.player.skills.foraging) * 0.03;
export const fishBarBonus = (g: Game) => skillLevel(g.save.player.skills.fishing) * 0.015;
export const combatBonus = (g: Game) => Math.floor(skillLevel(g.save.player.skills.combat) / 3);
