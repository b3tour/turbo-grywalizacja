'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button, Input, Card } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { LoadingScreen } from '@/components/layout';
import { isValidNick, isValidPhone } from '@/lib/utils';
import { User, Phone, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { LogoCircle } from '@/components/ui';

export default function OnboardingPage() {
  const router = useRouter();
  const {
    user,
    hasProfile,
    loading,
    createProfile,
    checkNickAvailable,
  } = useAuth();
  const { error: showError, success: showSuccess } = useToast();

  const [nick, setNick] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nickStatus, setNickStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [nickError, setNickError] = useState<string | null>(null);

  // Przekieruj jeśli użytkownik ma już profil
  useEffect(() => {
    if (!loading && hasProfile) {
      router.push('/dashboard');
    }
  }, [loading, hasProfile, router]);

  // Przekieruj jeśli użytkownik nie jest zalogowany
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  // Sprawdzaj dostępność nicka z debounce
  useEffect(() => {
    if (!nick) {
      setNickStatus('idle');
      setNickError(null);
      return;
    }

    if (!isValidNick(nick)) {
      setNickStatus('idle');
      setNickError('Nick może zawierać tylko litery, cyfry, _ i - (3-20 znaków)');
      return;
    }

    setNickError(null);
    setNickStatus('checking');
    console.log('Onboarding: Checking nick availability for:', nick);

    const timeoutId = setTimeout(async () => {
      try {
        const isAvailable = await checkNickAvailable(nick);
        console.log('Onboarding: Nick', nick, 'available:', isAvailable);
        setNickStatus(isAvailable ? 'available' : 'taken');
      } catch (error) {
        console.error('Onboarding: Nick check error:', error);
        // Przy błędzie pozwól użytkownikowi kontynuować
        setNickStatus('available');
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [nick, checkNickAvailable]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Onboarding: Submit clicked, nick:', nick, 'nickStatus:', nickStatus);

    if (!nick || !isValidNick(nick)) {
      showError('Błąd', 'Podaj prawidłowy nick');
      return;
    }

    if (nickStatus !== 'available') {
      showError('Błąd', 'Ten nick jest już zajęty');
      return;
    }

    if (phone && !isValidPhone(phone)) {
      showError('Błąd', 'Podaj prawidłowy numer telefonu');
      return;
    }

    setIsSubmitting(true);
    console.log('Onboarding: Creating profile...');

    const { success, error } = await createProfile(nick, phone || undefined);
    console.log('Onboarding: createProfile result:', success, error);

    if (!success) {
      showError('Błąd', error || 'Nie udało się utworzyć profilu');
    } else {
      showSuccess('Witaj w grze!', `Twój nick: ${nick}`);
      router.push('/dashboard');
    }

    setIsSubmitting(false);
  };

  if (loading || hasProfile) {
    return <LoadingScreen message="Przygotowywanie..." />;
  }

  const getNickIcon = () => {
    switch (nickStatus) {
      case 'checking':
        return <Loader2 className="w-5 h-5 text-dark-400 animate-spin" />;
      case 'available':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'taken':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <User className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      {/* Logo */}
      <div className="mb-8">
        <LogoCircle size="lg" />
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-white mb-2">Prawie gotowe!</h1>
      <p className="text-dark-400 mb-8 text-center">
        Wybierz nick, który będzie widoczny w rankingu
      </p>

      {/* Form */}
      <Card className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="text"
              label="Nick *"
              placeholder="TurboRacer2024"
              value={nick}
              onChange={e => setNick(e.target.value)}
              icon={getNickIcon()}
              error={nickError || (nickStatus === 'taken' ? 'Ten nick jest już zajęty' : undefined)}
              helperText={
                nickStatus === 'available'
                  ? 'Nick jest dostępny!'
                  : 'Będzie widoczny w rankingu i dla innych graczy'
              }
              disabled={isSubmitting}
            />
          </div>

          <Input
            type="tel"
            label="Numer telefonu (opcjonalnie)"
            placeholder="+48 123 456 789"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            icon={<Phone className="w-5 h-5" />}
            helperText="Do kontaktu w sprawie nagród"
            disabled={isSubmitting}
          />

          <div className="pt-4">
            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={isSubmitting}
              disabled={nickStatus !== 'available'}
            >
              Rozpocznij grę!
            </Button>
          </div>
        </form>
      </Card>

      {/* Info */}
      <div className="mt-8 text-center">
        <p className="text-dark-500 text-sm">
          Zalogowano jako: <span className="text-dark-300">{user?.email}</span>
        </p>
      </div>
    </div>
  );
}
