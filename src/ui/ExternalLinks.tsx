'use client';
import { useEffect } from 'react';

// External links open outside the app window (new tab in a browser; Electron
// routes window.open for non-localhost URLs to the system browser).
export function ExternalLinkRouter() {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest?.('button, [role="button"], input, select, textarea, label')) return;
      const a = t.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.href;
      if (!/^https?:\/\//.test(href) || href.startsWith(location.origin)) return;
      e.preventDefault();
      e.stopPropagation();
      window.open(href, '_blank', 'noopener');
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);
  return null;
}
