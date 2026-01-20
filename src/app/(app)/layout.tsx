'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Header, BottomNav, LoadingScreen } from '@/components/layout';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, hasProfile, profile, loading, refreshProfile } = useAuth();
  const hasTriedRefresh = useRef(false);

  useEffect(() => {
    // Czekaj aż loading się zakończy
    if (loading) return;

    // Nie zalogowany -> login
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    // Zalogowany ale bez profilu -> spróbuj odświeżyć raz, potem onboarding
    if (!hasProfile) {
      if (!hasTriedRefresh.current) {
        hasTriedRefresh.current = true;
        refreshProfile();
      } else {
        router.replace('/onboarding');
      }
    }
  }, [isAuthenticated, hasProfile, loading, router, refreshProfile]);

  // Pokaż loading tylko gdy rzeczywiście się ładuje
  if (loading) {
    return <LoadingScreen message="Ładowanie..." />;
  }

  // Nie zalogowany - pokaż loading (zaraz nastąpi redirect)
  if (!isAuthenticated) {
    return <LoadingScreen message="Przekierowywanie..." />;
  }

  // Brak profilu - pokaż loading (zaraz nastąpi redirect lub refresh)
  if (!hasProfile) {
    return <LoadingScreen message="Sprawdzanie profilu..." />;
  }

  return (
    <div className="min-h-screen">
      <Header user={profile} />
      <main className="pt-16 pb-20 px-4 max-w-lg mx-auto">{children}</main>
      <BottomNav />
    </div>
  );
}
