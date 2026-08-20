import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { BottomNav } from '@/ui/Shell';
import { BackIcon } from '@/ui/icons';
import { SettingsClient } from '@/ui/SettingsClient';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  return (
    <main className="app">
      <header className="page-header">
        <Link href="/" className="back-btn" aria-label="Back to dashboard"><BackIcon /></Link>
        <h1>Settings</h1>
      </header>
      <SettingsClient email={session.user.email ?? ''} />
      <BottomNav />
    </main>
  );
}
