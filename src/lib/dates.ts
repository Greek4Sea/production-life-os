// App timezone: settable at runtime (Settings → System → timezone toggle).
// Server: tick.ts refreshes it from settings each cron pass. Client: layout
// injects window.__TZ before hydration.
declare global {
  // eslint-disable-next-line no-var
  var __TZ: string | undefined;
}

export let TZ: string =
  (typeof globalThis !== 'undefined' && globalThis.__TZ) || process.env.APP_TZ || 'UTC';

export function setTZ(tz: string) {
  TZ = tz;
  globalThis.__TZ = tz;
}

// YYYY-MM-DD in the user's timezone (day rollover follows the user's timezone).
export function localDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}

export function localTime(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour: 'numeric', minute: '2-digit',
  }).format(d);
}
