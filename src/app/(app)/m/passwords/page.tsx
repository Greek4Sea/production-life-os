import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { BottomNav } from '@/ui/Shell';
import { PasswordsView } from '@/modules/passwords/PasswordsView';

export default async function PasswordsPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  return (
    <main className="app">
      <PasswordsView />
      <BottomNav />
    </main>
  );
}
