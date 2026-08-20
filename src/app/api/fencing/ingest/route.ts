import { db, t } from '@/db';
import { requireCronSecret } from '@/lib/requireAuth';

// scripts/fencingtracker_scrape.py (monthly GitHub Action) pushes scraped
// fencingtracker.com results + ratings here. Auth: x-cron-secret.

type ResultIn = {
  uid: string; date: string; tournament: string; event: string;
  place?: number | null; fieldSize?: number | null;
  ratingEarned?: string | null; eventClass?: string | null;
};
type RatingIn = { weapon: string; rating: string; earnedAt?: string | null };

const isDate = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function POST(req: Request) {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const results: ResultIn[] = Array.isArray(body?.results) ? body.results : [];
  const ratings: RatingIn[] = Array.isArray(body?.ratings) ? body.ratings : [];

  let upserted = 0;
  for (const r of results) {
    if (!r.uid || !isDate(r.date) || !r.tournament || !r.event) continue;
    await db().insert(t.fencingResults)
      .values({
        uid: r.uid, date: r.date, tournament: r.tournament, event: r.event,
        place: r.place ?? null, fieldSize: r.fieldSize ?? null,
        ratingEarned: r.ratingEarned ?? null, eventClass: r.eventClass ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: t.fencingResults.uid,
        set: {
          place: r.place ?? null, fieldSize: r.fieldSize ?? null,
          ratingEarned: r.ratingEarned ?? null, eventClass: r.eventClass ?? null,
          updatedAt: new Date(),
        },
      });
    upserted++;
  }

  for (const r of ratings) {
    if (!r.weapon || !r.rating) continue;
    await db().insert(t.fencingRatings)
      .values({
        weapon: r.weapon, rating: r.rating,
        earnedAt: isDate(r.earnedAt) ? r.earnedAt! : null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: t.fencingRatings.weapon,
        set: {
          rating: r.rating,
          earnedAt: isDate(r.earnedAt) ? r.earnedAt! : null,
          updatedAt: new Date(),
        },
      });
  }

  return Response.json({ ok: true, results: upserted, ratings: ratings.length });
}
