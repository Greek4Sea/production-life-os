import { ensureCoreSecrets } from '@/lib/config';
import { migrateDb } from '@/db';
import { startScheduler } from '@/lib/scheduler';
import { setTZ } from '@/lib/dates';
import { ensureOllamaRunning } from '@/lib/ollamaStart';

// One-time process boot: secrets, timezone, migrations, scheduler.
export async function boot() {
  const c = ensureCoreSecrets();
  setTZ(c.core.tz);
  await migrateDb();
  startScheduler();
  // Local AI: bring Ollama up in the background if the user chose it.
  if (c.ai.provider === 'ollama') void ensureOllamaRunning(c.ollama.url).catch(() => {});
}
