import { Button } from '@/components/ui/button';

import { useAuth } from '../auth/useAuth.js';

export default function HomePage() {
  const { user, logout } = useAuth();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold text-[#1F1F1F]">
        What product do you want to analyze?
      </h1>
      <p className="text-sm text-[#6B6B6B]">Signed in as {user.email}</p>
      <div>
        <Button variant="outline" className="h-10 px-4" onClick={() => logout()}>
          Sign out
        </Button>
      </div>
    </main>
  );
}
