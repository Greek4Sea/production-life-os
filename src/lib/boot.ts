import { ensureCoreSecrets } from '@/lib/config';
import { migrateDb } from '@/db';
import { startScheduler } from '@/lib/scheduler';
import { setTZ } from '@/lib/dates';

// One-time process boot: secrets, timezone, migrations, scheduler.
export async function boot() {
  const c = ensureCoreSecrets();
  setTZ(c.core.tz);
  await migrateDb();
  startScheduler();
}
