import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { KairosTerm } from '@/modules/kairos/KairosTerm';

export default async function KairosPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  return (
    <main className="app kterm-page">
      <KairosTerm />
    </main>
  );
}
