// Journal goals engine — cumulative-stat driven, linear reveals via prereq.

import { GOALS, GOAL_BY_ID } from '../data/goals';
import type { GoalDef } from '../types';
import { toast, type Game } from './runtime';

export function visibleGoals(g: Game): GoalDef[] {
  return GOALS.filter((d) =>
    !g.save.goalsDone.includes(d.id) &&
    (!d.prereq || g.save.goalsDone.includes(d.prereq)));
}

export function goalProgress(g: Game, id: string): { have: number; need: number } {
  const def = GOAL_BY_ID[id];
  return { have: Math.min(def.n, g.save.stats[def.stat] ?? 0), need: def.n };
}

// call after any stats change
export function checkGoals(g: Game) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const d of visibleGoals(g)) {
      if ((g.save.stats[d.stat] ?? 0) >= d.n) {
        g.save.goalsDone.push(d.id);
        toast(g, `Goal complete: ${d.title} ⭐`, '📜');
        changed = true; // may reveal a chained goal that's already satisfied
      }
    }
  }
  g.dirty = true;
}

export function bump(g: Game, stat: string, n = 1) {
  g.save.stats[stat] = (g.save.stats[stat] ?? 0) + n;
  checkGoals(g);
}
