'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui';
import { LoadingScreen } from '@/components/layout';
import { Trophy, Target, Users, Heart, ChevronRight } from 'lucide-react';
import { Logo } from '@/components/ui';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, hasProfile, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (isAuthenticated && hasProfile) {
        router.push('/dashboard');
      } else if (isAuthenticated && !hasProfile) {
        router.push('/onboarding');
      }
    }
  }, [isAuthenticated, hasProfile, loading, router]);

  if (loading) {
    return <LoadingScreen />;
  }

  const features = [
    {
      icon: Target,
      title: 'Misje do wykonania',
      description: 'Skanuj kody QR, rób zdjęcia, odpowiadaj na quizy',
      color: 'text-accent-400', // cyjan
    },
    {
      icon: Users,
      title: 'Rywalizacja',
      description: 'Rywalizuj z innymi i zdobywaj miejsce w rankingu',
      color: 'text-purple-500', // fioletowy
    },
    {
      icon: Heart,
      title: 'Punkty XP',
      description: 'Zbieraj doświadczenie i awansuj na wyższe poziomy',
      color: 'text-red-500', // czerwony
    },
    {
      icon: Trophy,
      title: 'Nagrody',
      description: 'Najlepsi gracze zdobywają atrakcyjne nagrody',
      color: 'text-amber-400', // złoty
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        {/* Logo */}
        <div className="mb-8">
          <Logo size="xxl" />
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Turbo <span className="gradient-text">Challenge</span>
        </h1>

        <p className="text-lg text-dark-300 max-w-md mb-8">
          Dołącz do rywalizacji, wykonuj misje i zdobywaj nagrody!
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm mb-12">
          <Link href="/login" className="flex-1">
            <Button fullWidth size="lg">
              Zaloguj się
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          </Link>
          <Link href="/register" className="flex-1">
            <Button variant="secondary" fullWidth size="lg">
              Zarejestruj się
            </Button>
          </Link>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 gap-4 w-full max-w-lg">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-4 rounded-xl bg-dark-800/50 border border-dark-700 text-left"
            >
              <feature.icon className={`w-8 h-8 ${feature.color} mb-2`} />
              <h3 className="font-semibold text-white text-sm mb-1">
                {feature.title}
              </h3>
              <p className="text-xs text-dark-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 text-center text-dark-500 text-sm">
        <p>&copy; 2026 Turbo Challenge. Wszystkie prawa zastrzeżone.</p>
      </footer>
    </div>
  );
}
