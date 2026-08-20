import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ExternalLinkRouter } from '@/ui/ExternalLinks';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Life OS',
  description: 'One dashboard that runs your life',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Life OS' },
  icons: { apple: '/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#020617',
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Timezone from Settings → System, injected before hydration so every
  // client-side date format uses it.
  let tz = 'UTC';
  try {
    const { getConfig } = await import('@/lib/config');
    tz = getConfig().core.tz || tz;
    const { getSettings } = await import('@/lib/settings');
    const sys = await getSettings<{ tz?: string }>('system');
    if (sys.tz) tz = sys.tz;
  } catch { /* db not up yet — default stands */ }
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <script dangerouslySetInnerHTML={{ __html: `window.__TZ=${JSON.stringify(tz)};` }} />
        <ExternalLinkRouter />
        {children}
      </body>
    </html>
  );
}
