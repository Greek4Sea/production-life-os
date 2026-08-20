'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HomeIcon, SettingsIcon } from './icons';
import { SettingsClient } from './SettingsClient';

export function BottomNav() {
  const path = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Close the drawer when navigating.
  useEffect(() => { setSettingsOpen(false); }, [path]);

  return (
    <>
      <nav className="bottom-nav" aria-label="Main">
        <Link href="/" className={path === '/' ? 'active' : ''} aria-label="Dashboard">
          <HomeIcon /><span>Home</span>
        </Link>
        <button
          className={settingsOpen ? 'active' : ''}
          onClick={() => setSettingsOpen(!settingsOpen)}
          aria-label="Settings"
        >
          <SettingsIcon /><span>Settings</span>
        </button>
      </nav>

      {settingsOpen && (
        <>
          <div className="drawer-backdrop" onClick={() => setSettingsOpen(false)} aria-hidden />
          <aside className="settings-drawer" aria-label="Settings">
            <div className="drawer-head">
              <h2>Settings</h2>
              <button className="back-btn" onClick={() => setSettingsOpen(false)} aria-label="Close settings">✕</button>
            </div>
            <div className="drawer-body">
              <SettingsClient />
            </div>
          </aside>
        </>
      )}
    </>
  );
}

export function RegisterSW() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
