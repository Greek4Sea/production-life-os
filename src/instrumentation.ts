// Next.js startup hook. The NEXT_RUNTIME check is a compile-time constant, so
// the edge bundle drops the Node-only imports below.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { boot } = await import('./lib/boot');
    await boot();
  }
}
