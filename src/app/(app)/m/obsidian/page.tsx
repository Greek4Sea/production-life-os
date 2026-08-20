import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { BottomNav } from '@/ui/Shell';
import { ObsidianView } from '@/modules/obsidian/ObsidianView';

export default async function ObsidianPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  return (
    <main className="app">
      <ObsidianView />
      <BottomNav />
    </main>
  );
}
