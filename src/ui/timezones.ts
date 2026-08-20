// IANA timezone list for pickers. Intl.supportedValuesOf exists in every
// modern runtime; the fallback keeps old browsers usable.
const FALLBACK = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Athens',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
];
export const TIMEZONES: string[] = (() => {
  try {
    const all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone');
    if (all?.length) return all;
  } catch { /* old runtime */ }
  return FALLBACK;
})();
