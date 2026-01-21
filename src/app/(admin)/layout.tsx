'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { LoadingScreen } from '@/components/layout';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, hasProfile, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    if (!hasProfile) {
      router.replace('/onboarding');
      return;
    }

    if (profile && !profile.is_admin) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, hasProfile, profile, loading, router]);

  if (loading) {
    return <LoadingScreen message="Ładowanie..." />;
  }

  if (!isAuthenticated || !hasProfile) {
    return <LoadingScreen message="Przekierowywanie..." />;
  }

  if (!profile?.is_admin) {
    return <LoadingScreen message="Sprawdzanie uprawnień..." />;
  }

  return (
    <div className="min-h-screen bg-dark-900">
      {children}
    </div>
  );
}
