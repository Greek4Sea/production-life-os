import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { BottomNav } from '@/ui/Shell';
import { SpotifyView } from '@/modules/spotify/SpotifyView';

export default async function SpotifyPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  return (
    <main className="app">
      <SpotifyView />
      <BottomNav />
    </main>
  );
}
