import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Dashboard } from '@/ui/Dashboard';
import { BottomNav, RegisterSW } from '@/ui/Shell';

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  return (
    <main className="app">
      <RegisterSW />
      <Dashboard />
      <BottomNav />
    </main>
  );
}
