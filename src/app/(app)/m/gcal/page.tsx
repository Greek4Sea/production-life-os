import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { BottomNav } from '@/ui/Shell';
import { MonthView } from '@/modules/gcal/MonthView';

export default async function GcalPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  return (
    <main className="app">
      <MonthView />
      <BottomNav />
    </main>
  );
}
