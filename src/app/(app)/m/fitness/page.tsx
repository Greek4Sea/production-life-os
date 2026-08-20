import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { BackIcon } from '@/ui/icons';
import { getConfig } from '@/lib/config';

// Your fitness web app (Settings → Fitness) embedded in-app.
export default async function FitnessPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  const url = getConfig().fitness.appUrl;
  return (
    <main className="app kterm-page">
      <header className="page-header">
        <Link href="/" className="back-btn" aria-label="Back to dashboard"><BackIcon /></Link>
        <h1>Fitness</h1>
      </header>
      {url
        ? <iframe src={url} className="fit-frame" title="Fitness" />
        : <p className="pill-note" style={{ margin: 16 }}>No fitness app configured — add its URL in Settings → Integrations → Fitness.</p>}
    </main>
  );
}
