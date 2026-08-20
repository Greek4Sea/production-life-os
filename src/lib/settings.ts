import { eq } from 'drizzle-orm';
import { db, t } from '@/db';
import { getModule } from '@/modules/registry';

type Obj = Record<string, unknown>;

// Deep-merge semantics: defaults + saved patch on top.
export function deepMerge<T extends Obj>(base: T, patch: Obj): T {
  const out: Obj = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v)
      && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k] as Obj, v as Obj);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

export async function getSettings<T extends Obj = Obj>(moduleId: string): Promise<T> {
  const defaults = (getModule(moduleId)?.defaultSettings ?? {}) as T;
  const row = await db().query.moduleSettings.findFirst({
    where: eq(t.moduleSettings.moduleId, moduleId),
  });
  return row ? deepMerge(defaults, row.data as Obj) : defaults;
}

export async function patchSettings(moduleId: string, patch: Obj) {
  const row = await db().query.moduleSettings.findFirst({
    where: eq(t.moduleSettings.moduleId, moduleId),
  });
  const data = row ? deepMerge(row.data as Obj, patch) : patch;
  await db().insert(t.moduleSettings)
    .values({ moduleId, data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: t.moduleSettings.moduleId,
      set: { data, updatedAt: new Date() },
    });
  return data;
}
