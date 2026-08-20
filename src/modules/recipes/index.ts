import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { db, t } from '@/db';
import type { ModuleManifest } from '../types';

// Recipe box with a local-AI assistant: describe a dish in plain words and it
// gets saved structured — ingredients, steps, estimated kcal/serving, and
// "lighter" swaps for cutting calories. Same chat pattern as tasks/passwords.

import { chatJson } from '@/lib/llm';

type Parsed = {
  title?: string; servings?: number; timeMin?: number; calories?: number;
  tags?: string[]; ingredients?: string[]; steps?: string[]; lighter?: string[];
};

async function parseRecipe(text: string): Promise<Parsed> {
  return chatJson<Parsed>({
    slot: 'recipesModel',
    user: text,
    system: `You structure recipes. From the user's description reply with ONLY JSON:
{"title":"...","servings":2,"timeMin":30,"calories":420,"tags":["greek","high-protein"],
"ingredients":["500g chicken breast","2 tbsp olive oil",...],
"steps":["Marinate the chicken...","Grill 4 min per side...",...],
"lighter":["Use 1 tbsp oil instead of 2 (-60 kcal)","Swap rice for cauliflower rice (-120 kcal)"]}
Rules: calories = your best ESTIMATE per serving (integer). Fill missing amounts sensibly from context. "lighter" = 2-4 concrete calorie-cutting swaps with rough savings. Keep steps clear and short. Tags: cuisine/diet/meal-type, max 4. If the text isn't a recipe at all, reply {"title":null}.`,
  });
}

async function api(req: Request, p: string[]): Promise<Response | null> {
  if (req.method === 'POST' && p[0] === 'chat') {
    const { text } = await req.json();
    if (!text?.trim()) return Response.json({ error: 'empty' }, { status: 400 });
    let r: Parsed;
    try {
      r = await parseRecipe(text);
    } catch (e) {
      const { notify } = await import('@/lib/notify');
      await notify({ moduleId: 'recipes', title: '🤖 Recipes AI is not responding', body: String(e).slice(0, 140) }).catch(() => {});
      return Response.json({ reply: `The local AI isn’t responding (${String(e).slice(0, 80)})` });
    }
    if (!r.title || !r.ingredients?.length) {
      return Response.json({ reply: 'That didn’t look like a recipe — give me a dish with some ingredients.' });
    }
    const id = randomUUID();
    await db().insert(t.recipes).values({
      id,
      title: r.title,
      servings: r.servings ?? null,
      timeMin: r.timeMin ?? null,
      calories: r.calories ?? null,
      tags: (r.tags ?? []).slice(0, 4),
      ingredients: r.ingredients,
      steps: r.steps ?? [],
      lighter: r.lighter ?? [],
    });
    return Response.json({
      reply: `✓ saved “${r.title}” — ${r.calories ? `~${r.calories} kcal/serving · ` : ''}${r.timeMin ? `${r.timeMin} min · ` : ''}${r.ingredients.length} ingredients${r.lighter?.length ? `\n💡 ${r.lighter.length} lighter swaps included` : ''}`,
      id,
    });
  }

  if (req.method === 'GET' && p[0] === 'list') {
    const rows = await db().query.recipes.findMany({
      orderBy: (x, { desc }) => [desc(x.createdAt)],
    });
    return Response.json(rows.map((x) => ({
      id: x.id, title: x.title, calories: x.calories, timeMin: x.timeMin,
      servings: x.servings, tags: x.tags ?? [],
    })));
  }

  if (req.method === 'GET' && p[0] === 'recipe' && p[1]) {
    const row = await db().query.recipes.findFirst({ where: eq(t.recipes.id, p[1]) });
    return row ? Response.json(row) : Response.json({ error: 'not found' }, { status: 404 });
  }

  if (req.method === 'DELETE' && p[0] === 'recipe' && p[1]) {
    await db().delete(t.recipes).where(eq(t.recipes.id, p[1]));
    return Response.json({ ok: true });
  }

  return null;
}

export const recipesModule: ModuleManifest = {
  id: 'recipes',
  name: 'Recipes',
  tileSize: 'sm',
  api,
};
