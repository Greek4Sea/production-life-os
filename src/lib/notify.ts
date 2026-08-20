import { randomUUID } from 'crypto';
import { db, t } from '@/db';

// One-liner for modules to raise an in-app + push notification.
// Deduped by key (default: once per module+slug per day).
export async function notify(opts: {
  moduleId: string; title: string; body?: string; url?: string; dedupe?: string;
}) {
  const day = new Date().toISOString().slice(0, 10);
  await db().insert(t.notifications).values({
    id: randomUUID(),
    moduleId: opts.moduleId,
    title: opts.title,
    body: opts.body ?? null,
    url: opts.url ?? null,
    scheduledFor: new Date(),
    dedupeKey: opts.dedupe ?? `${opts.moduleId}:${opts.title.slice(0, 40)}:${day}`,
  }).onConflictDoNothing();
}
