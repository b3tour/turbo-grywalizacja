'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Header, BottomNav, LoadingScreen } from '@/components/layout';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, hasProfile, profile, loading, refreshProfile, user } = useAuth();
  const refreshAttempts = useRef(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const maxRetries = 3;

  useEffect(() => {
    // Czekaj aż loading się zakończy
    if (loading || isRefreshing) return;

    // Nie zalogowany -> login
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    // Zalogowany ale bez profilu -> spróbuj odświeżyć kilka razy
    if (!hasProfile && user) {
      if (refreshAttempts.current < maxRetries) {
        refreshAttempts.current += 1;
        console.log(`Profile refresh attempt ${refreshAttempts.current}/${maxRetries}`);
        setIsRefreshing(true);

        // Czekaj chwilę przed próbą
        setTimeout(async () => {
          await refreshProfile();
          setIsRefreshing(false);
        }, 1000 * refreshAttempts.current); // 1s, 2s, 3s
      } else {
        // Po 3 nieudanych próbach - przekieruj do onboarding
        console.log('All refresh attempts failed, redirecting to onboarding');
        router.replace('/onboarding');
      }
    }
  }, [isAuthenticated, hasProfile, loading, router, refreshProfile, user, isRefreshing]);

  // Reset prób przy zmianie użytkownika
  useEffect(() => {
    if (user?.id) {
      refreshAttempts.current = 0;
    }
  }, [user?.id]);

  // Pokaż loading gdy się ładuje lub odświeża
  if (loading || isRefreshing) {
    return <LoadingScreen message={isRefreshing ? "Ładowanie profilu..." : "Ładowanie..."} />;
  }

  // Nie zalogowany - pokaż loading (zaraz nastąpi redirect)
  if (!isAuthenticated) {
    return <LoadingScreen message="Przekierowywanie..." />;
  }

  // Brak profilu ale mamy użytkownika - jeszcze próbujemy
  if (!hasProfile && user && refreshAttempts.current < maxRetries) {
    return <LoadingScreen message="Ładowanie profilu..." />;
  }

  // Brak profilu i brak użytkownika lub wyczerpane próby
  if (!hasProfile) {
    return <LoadingScreen message="Przekierowywanie do rejestracji..." />;
  }

  return (
    <div className="min-h-screen">
      <Header user={profile} />
      <main className="pt-16 pb-20 px-4 max-w-lg mx-auto">{children}</main>
      <BottomNav />
    </div>
  );
}
