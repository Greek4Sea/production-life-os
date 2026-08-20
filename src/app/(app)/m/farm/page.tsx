import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { BottomNav } from '@/ui/Shell';
import { FarmView } from '@/modules/farm/FarmView';

export default async function FarmPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  return (
    <main className="app farm-app">
      <FarmView />
      <BottomNav />
    </main>
  );
}
