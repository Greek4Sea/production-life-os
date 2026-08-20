import { redirect } from 'next/navigation';
import { auth, signIn } from '@/lib/auth';
import { isSetupDone } from '@/lib/config';

export default async function SignIn() {
  const session = await auth();
  if (session?.user) redirect('/');
  if (!isSetupDone()) redirect('/setup');
  return (
    <main className="signin">
      <h1>Life OS</h1>
      <p>One dashboard that runs your life. Sign in with your Google account to continue.</p>
      <form action={async () => { 'use server'; await signIn('google', { redirectTo: '/' }); }}>
        <button type="submit" className="btn primary">Sign in with Google</button>
      </form>
    </main>
  );
}
