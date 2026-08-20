import { db, t } from '@/db';

// Append to the event log — the future AI's poll bus. Never throws.
export async function emit(moduleId: string, type: string, payload?: unknown) {
  try {
    await db().insert(t.events).values({ moduleId, type, payload: payload ?? null });
  } catch (e) {
    console.error('emit failed', type, e);
  }
}
