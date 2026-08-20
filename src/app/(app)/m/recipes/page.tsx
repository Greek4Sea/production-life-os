import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { BottomNav } from '@/ui/Shell';
import { RecipesView } from '@/modules/recipes/RecipesView';

export default async function RecipesPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  return (
    <main className="app">
      <RecipesView />
      <BottomNav />
    </main>
  );
}
