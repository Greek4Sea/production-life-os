// Lucide-style inline SVG icons — one consistent 2px-stroke family.
const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" {...p} aria-hidden>
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

export const BookIcon = () => (
  <svg viewBox="0 0 24 24" {...p} aria-hidden>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

export const SproutIcon = () => (
  <svg viewBox="0 0 24 24" {...p} aria-hidden>
    <path d="M12 21V10" />
    <path d="M12 10C12 6 9.5 4 5 4c0 4.5 2.5 6.5 7 6" />
    <path d="M12 12c0-3.5 2.2-5.5 6.5-5.5C18.5 10.5 16.3 12.5 12 12" />
  </svg>
);

export const CartIcon = () => (
  <svg viewBox="0 0 24 24" {...p} aria-hidden>
    <circle cx="9" cy="20" r="1.6" /><circle cx="17.5" cy="20" r="1.6" />
    <path d="M2.5 3.5h3l2.6 12h10.6l2.3-8.5H6.4" />
  </svg>
);

export const BowlIcon = () => (
  <svg viewBox="0 0 24 24" {...p} aria-hidden>
    <path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0z" />
    <path d="M8 8c0-1.6 1.4-1.6 1.4-3.2M13 8c0-1.6 1.4-1.6 1.4-3.2" />
  </svg>
);

export const CheckIcon = () => (
  <svg viewBox="0 0 24 24" {...p} aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <path d="m8.5 12.5 2.5 2.5 5-5.5" />
  </svg>
);

export const LockIcon = () => (
  <svg viewBox="0 0 24 24" {...p} aria-hidden>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

export const NoteIcon = () => (
  <svg viewBox="0 0 24 24" {...p} aria-hidden>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

export const MailIcon = () => (
  <svg viewBox="0 0 24 24" {...p} aria-hidden>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-10 6L2 7" />
  </svg>
);

export const DumbbellIcon = () => (
  <svg viewBox="0 0 24 24" {...p} aria-hidden>
    <path d="M6.5 6.5 17.5 17.5" /><path d="M21 21l-1-1" /><path d="M3 3l1 1" />
    <path d="M18 22l4-4" /><path d="M2 6l4-4" /><path d="M3 10l7-7" /><path d="M14 21l7-7" />
  </svg>
);

export const TrophyIcon = () => (
  <svg viewBox="0 0 24 24" {...p} aria-hidden>
    <path d="M6 9a6 6 0 0 0 12 0V3H6z" />
    <path d="M6 5H3v2a4 4 0 0 0 4 4" /><path d="M18 5h3v2a4 4 0 0 1-4 4" />
    <path d="M12 15v3" /><path d="M8 21h8" /><path d="M12 18a2 2 0 0 0-2 3h4a2 2 0 0 0-2-3" />
  </svg>
);

export const MusicIcon = () => (
  <svg viewBox="0 0 24 24" {...p} aria-hidden>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
  </svg>
);

export const HomeIcon = () => (
  <svg viewBox="0 0 24 24" {...p} aria-hidden>
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

export const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" {...p} aria-hidden>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const BackIcon = () => (
  <svg viewBox="0 0 24 24" {...p} aria-hidden>
    <path d="m15 18-6-6 6-6" />
  </svg>
);
