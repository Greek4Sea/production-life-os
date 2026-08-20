import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { localDate } from '@/lib/dates';
import { BottomNav } from '@/ui/Shell';
import { BackIcon } from '@/ui/icons';

export const dynamic = 'force-dynamic';

const fmtRange = (start: string, end: string) => {
  const s = new Date(start + 'T12:00:00'), e = new Date(end + 'T12:00:00');
  const so = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (start === end) return so;
  const eo = e.toLocaleDateString('en-US', {
    month: s.getMonth() === e.getMonth() ? undefined : 'short', day: 'numeric',
  });
  return `${so}–${eo}`;
};

export default async function CompetitionsPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');

  const today = localDate();
  const [events, results, ratings] = await Promise.all([
    db().query.compEvents.findMany({
      orderBy: (e, { asc }) => [asc(e.startDate)],
    }),
    db().query.fencingResults.findMany({
      orderBy: (r, { desc }) => [desc(r.date)],
      limit: 15,
    }),
    db().query.fencingRatings.findMany(),
  ]);
  const upcoming = events.filter((e) => e.endDate >= today);
  const past = events.filter((e) => e.endDate < today).reverse();

  const byMonth = new Map<string, typeof upcoming>();
  for (const e of upcoming) {
    const key = new Date(e.startDate + 'T12:00:00')
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(e);
  }

  return (
    <main className="app">
      <header className="page-header">
        <Link href="/" className="back-btn" aria-label="Back to dashboard"><BackIcon /></Link>
        <h1>Competitions</h1>
        <span className="pill-note" style={{ marginLeft: 'auto' }}>
          {ratings.map((r) => `${r.weapon} ${r.rating}`).join(' · ') || null}
          {ratings.length > 0 && ' · '}🤺 {upcoming.length} upcoming
        </span>
      </header>

      {results.length > 0 && (
        <section className="section">
          <h2 className="section-title">My results</h2>
          <div className="card accent-orange">
            {results.map((r) => (
              <div className="tile-row" key={r.uid}>
                <div className="what">
                  <div className="t">{r.event}</div>
                  <div className="s">
                    {r.tournament}
                    {r.ratingEarned ? ` · earned ${r.ratingEarned}` : ''}
                    {r.eventClass ? ` · ${r.eventClass}` : ''}
                  </div>
                </div>
                <span className={`count-pill ${r.place != null && r.place <= 3 ? 'ok' : ''}`}>
                  {r.place ?? '—'}{r.fieldSize ? `/${r.fieldSize}` : ''}
                  {' · '}
                  {new Date(r.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {upcoming.length === 0 && (
        <div className="card"><div className="tile-empty">
          Nothing synced yet — the tracker checks askFRED + USA Fencing twice a day.
        </div></div>
      )}

      {[...byMonth.entries()].map(([month, evs]) => (
        <section className="section" key={month}>
          <h2 className="section-title">{month}</h2>
          <div className="card accent-orange">
            {evs.map((e) => (
              <a className="tile-row" key={e.uid} href={e.url ?? '#'} target="_blank" rel="noreferrer">
                <div className="what">
                  <div className="t">{e.name}</div>
                  <div className="s">
                    {e.kind}{e.ageCategory ? ` · ${e.ageCategory}` : ''} · {e.city}{e.state ? `, ${e.state}` : ''}
                    {e.regCloses && ` · reg closes ${new Date(e.regCloses).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                  </div>
                </div>
                <span className="count-pill">{fmtRange(e.startDate, e.endDate)}</span>
              </a>
            ))}
          </div>
        </section>
      ))}

      {past.length > 0 && (
        <section className="section">
          <h2 className="section-title">Past</h2>
          <div className="card" style={{ opacity: 0.6 }}>
            {past.slice(0, 10).map((e) => (
              <div className="tile-row" key={e.uid}>
                <div className="what"><div className="t">{e.name}</div><div className="s">{e.kind} · {e.city}</div></div>
                <span className="count-pill">{fmtRange(e.startDate, e.endDate)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      <BottomNav />
    </main>
  );
}
