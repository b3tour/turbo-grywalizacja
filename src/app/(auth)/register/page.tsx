'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button, Input, Card } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { isValidEmail, isValidPhone } from '@/lib/utils';
import { Mail, Lock, Phone, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { LogoCircle } from '@/components/ui';

export default function RegisterPage() {
  const router = useRouter();
  const { signUpWithEmail, signInWithGoogle, loading } = useAuth();
  const { error: showError, success: showSuccess } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): string | null => {
    if (!email || !password || !confirmPassword) {
      return 'Wypełnij wszystkie wymagane pola';
    }

    if (!isValidEmail(email)) {
      return 'Podaj prawidłowy adres email';
    }

    if (password.length < 8) {
      return 'Hasło musi mieć minimum 8 znaków';
    }

    if (password !== confirmPassword) {
      return 'Hasła nie są identyczne';
    }

    if (phone && !isValidPhone(phone)) {
      return 'Podaj prawidłowy numer telefonu';
    }

    return null;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      showError('Błąd', validationError);
      return;
    }

    setIsSubmitting(true);

    const { success, error } = await signUpWithEmail(email, password);

    if (!success) {
      showError('Błąd rejestracji', error || 'Nie udało się utworzyć konta');
    } else {
      showSuccess(
        'Konto utworzone!',
        'Sprawdź swoją skrzynkę email, aby potwierdzić rejestrację'
      );
      // Po rejestracji przekieruj do onboardingu (utworzenie profilu)
      router.push('/onboarding');
    }

    setIsSubmitting(false);
  };

  const handleGoogleRegister = async () => {
    await signInWithGoogle();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      {/* Back button */}
      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center text-dark-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-5 h-5 mr-1" />
        Powrót
      </Link>

      {/* Logo */}
      <div className="mb-8">
        <LogoCircle size="lg" />
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-white mb-2">Dołącz do gry!</h1>
      <p className="text-dark-400 mb-8">Utwórz konto i zacznij rywalizację</p>

      {/* Register Form */}
      <Card className="w-full max-w-sm">
        <form onSubmit={handleRegister} className="space-y-4">
          <Input
            type="email"
            label="Email *"
            placeholder="twoj@email.pl"
            value={email}
            onChange={e => setEmail(e.target.value)}
            icon={<Mail className="w-5 h-5" />}
            disabled={isSubmitting || loading}
          />

          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              label="Hasło *"
              placeholder="Minimum 8 znaków"
              value={password}
              onChange={e => setPassword(e.target.value)}
              icon={<Lock className="w-5 h-5" />}
              disabled={isSubmitting || loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-9 text-dark-400 hover:text-white"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <Input
            type={showPassword ? 'text' : 'password'}
            label="Powtórz hasło *"
            placeholder="Powtórz hasło"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            icon={<Lock className="w-5 h-5" />}
            disabled={isSubmitting || loading}
          />

          <Input
            type="tel"
            label="Numer telefonu (opcjonalnie)"
            placeholder="+48 123 456 789"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            icon={<Phone className="w-5 h-5" />}
            helperText="Opcjonalnie - do kontaktu w sprawie nagród"
            disabled={isSubmitting || loading}
          />

          <Button
            type="submit"
            fullWidth
            loading={isSubmitting}
            disabled={loading}
          >
            Zarejestruj się
          </Button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-dark-700" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-dark-800 text-dark-400">lub</span>
          </div>
        </div>

        {/* Google Register */}
        <Button
          type="button"
          variant="secondary"
          fullWidth
          onClick={handleGoogleRegister}
          disabled={loading || isSubmitting}
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Kontynuuj z Google
        </Button>

        {/* Login link */}
        <p className="mt-6 text-center text-sm text-dark-400">
          Masz już konto?{' '}
          <Link href="/login" className="text-turbo-400 hover:text-turbo-300">
            Zaloguj się
          </Link>
        </p>
      </Card>

      {/* Terms */}
      <p className="mt-6 text-xs text-dark-500 text-center max-w-sm">
        Rejestrując się, akceptujesz{' '}
        <Link href="/terms" className="text-turbo-400 hover:underline">
          regulamin
        </Link>{' '}
        oraz{' '}
        <Link href="/privacy" className="text-turbo-400 hover:underline">
          politykę prywatności
        </Link>
        .
      </p>
    </div>
  );
}
