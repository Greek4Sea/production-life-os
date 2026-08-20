import { db } from '@/db';
import { localDate } from '@/lib/dates';
import type { ModuleManifest } from '../types';
import { getConfig } from '@/lib/config';

async function dashboardData() {
  const today = localDate();
  const row = await db().query.fitnessDays.findFirst({
    where: (f, { eq }) => eq(f.date, today),
  });
  const latest = row ?? await db().query.fitnessDays.findFirst({
    orderBy: (f, { desc }) => [desc(f.date)],
  });
  if (!latest) return { hasData: false };
  return {
    hasData: true,
    isToday: latest.date === today,
    eaten: latest.eaten,
    burned: latest.burned,
    deficit: latest.burned - latest.eaten,
    streak: latest.streak,
  };
}

export const fitness: ModuleManifest = {
  enabled: () => Boolean(getConfig().fitness.appUrl || getConfig().fitness.allowedOrigin),
  id: 'fitness',
  name: 'Fitness',
  tileSize: 'sm',
  dashboardData,
};
