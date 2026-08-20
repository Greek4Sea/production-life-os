import { runSyncs } from '@/lib/tick';

// A "Sync all" pressed in Settings runs here on the server, detached from the
// request — leaving the page doesn't stop it, and re-opening Settings finds it
// still running. Stored on globalThis so dev hot-reload keeps the same job.
type SyncJob = {
  running: boolean;
  startedAt: number | null;
  finishedAt: number | null;
  report: Record<string, string> | null;
};

const g = globalThis as unknown as { __lifeosSyncJob?: SyncJob };
const job: SyncJob = (g.__lifeosSyncJob ??= {
  running: false, startedAt: null, finishedAt: null, report: null,
});

export function syncStatus(): SyncJob {
  return job;
}

// Kick off a full sync in the background. Returns false if one is already going.
export function startBackgroundSync(force = true): boolean {
  if (job.running) return false;
  job.running = true;
  job.startedAt = Date.now();
  job.finishedAt = null;
  job.report = null;
  runSyncs(force)
    .then((r) => { job.report = r; })
    .catch((e) => { job.report = { sync: `error: ${String(e).slice(0, 300)}` }; })
    .finally(() => { job.running = false; job.finishedAt = Date.now(); });
  return true;
}
