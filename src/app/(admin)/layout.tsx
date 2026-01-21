'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { LoadingScreen } from '@/components/layout';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, hasProfile, profile, loading, refreshProfile } = useAuth();
  const hasTriedRefresh = useRef(false);

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    if (!hasProfile) {
      if (!hasTriedRefresh.current) {
        hasTriedRefresh.current = true;
        refreshProfile();
      } else {
        router.replace('/onboarding');
      }
    }
  }, [isAuthenticated, hasProfile, loading, router, refreshProfile]);

  // Sprawdź czy admin
  useEffect(() => {
    if (!loading && profile && !profile.is_admin) {
      router.replace('/dashboard');
    }
  }, [loading, profile, router]);

  if (loading) {
    return <LoadingScreen message="Ładowanie..." />;
  }

  if (!isAuthenticated) {
    return <LoadingScreen message="Przekierowywanie..." />;
  }

  if (!hasProfile) {
    return <LoadingScreen message="Sprawdzanie profilu..." />;
  }

  if (!profile?.is_admin) {
    return <LoadingScreen message="Sprawdzanie uprawnień..." />;
  }

  // Admin layout - pełna szerokość, bez ograniczeń mobilnych
  return (
    <div className="min-h-screen bg-dark-900">
      {children}
    </div>
  );
}
