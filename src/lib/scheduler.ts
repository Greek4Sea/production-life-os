import { runSyncs, sendDueNotifications } from '@/lib/tick';

// In-process heartbeat: replaces the external cron/launchd pinger. Runs due
// module syncs and sends due notifications. Survives dev HMR via globalThis.
const EVERY_MS = 5 * 60_000;
const FIRST_DELAY_MS = 20_000;

type State = { timer: NodeJS.Timeout | null; inFlight: boolean; lastRun: number; lastReport: Record<string, string> | null };
const g = globalThis as unknown as { __lifeosScheduler?: State };

export function schedulerState(): State {
  return (g.__lifeosScheduler ??= { timer: null, inFlight: false, lastRun: 0, lastReport: null });
}

export async function tickNow(force = false) {
  const s = schedulerState();
  if (s.inFlight) return s.lastReport;
  s.inFlight = true;
  try {
    const report = await runSyncs(force);
    report._notifications = `${await sendDueNotifications()} sent`;
    s.lastReport = report;
    s.lastRun = Date.now();
    return report;
  } catch (e) {
    s.lastReport = { scheduler: `error: ${String(e).slice(0, 300)}` };
    return s.lastReport;
  } finally {
    s.inFlight = false;
  }
}

export function startScheduler() {
  const s = schedulerState();
  if (s.timer) return;
  const loop = () => { tickNow().catch(() => {}); };
  s.timer = setTimeout(() => {
    loop();
    s.timer = setInterval(() => {
      // After sleep/wake the interval fires late — the "due" checks inside
      // runSyncs handle catch-up automatically, nothing else to do.
      loop();
    }, EVERY_MS);
  }, FIRST_DELAY_MS);
  console.log('[life-os] scheduler started (every 5 min)');
}
