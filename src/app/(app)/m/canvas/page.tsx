import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { BottomNav } from '@/ui/Shell';
import { CanvasView } from '@/modules/canvas/CanvasView';

export const dynamic = 'force-dynamic';

export default async function CanvasPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  return (
    <main className="app">
      <CanvasView />
      <BottomNav />
    </main>
  );
}
