'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { QRScanner } from '@/components/missions';
import { Card, Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { ScanLine, ArrowLeft, CheckCircle } from 'lucide-react';

export default function ScanPage() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const { success, error: showError, warning } = useToast();

  const [isScanning, setIsScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<{
    success: boolean;
    message: string;
    xp?: number;
  } | null>(null);

  const handleScan = async (code: string) => {
    if (!profile) return;

    setIsScanning(false);

    // Znajdź misję z tym kodem QR
    const { data: mission, error: missionError } = await supabase
      .from('missions')
      .select('*')
      .eq('qr_code_value', code)
      .eq('status', 'active')
      .single();

    if (missionError || !mission) {
      setLastScanResult({
        success: false,
        message: 'Nieznany kod QR. Upewnij się, że skanujesz właściwy kod.',
      });
      showError('Nieznany kod', 'Ten kod QR nie jest przypisany do żadnej misji');
      return;
    }

    // Sprawdź czy użytkownik już wykonał tę misję
    const { data: existingSubmission } = await supabase
      .from('submissions')
      .select('id, status')
      .eq('user_id', profile.id)
      .eq('mission_id', mission.id)
      .single();

    if (existingSubmission?.status === 'approved') {
      setLastScanResult({
        success: false,
        message: 'Ta misja została już przez Ciebie ukończona.',
      });
      warning('Misja ukończona', 'Już wykonałeś tę misję wcześniej');
      return;
    }

    if (existingSubmission?.status === 'pending') {
      setLastScanResult({
        success: false,
        message: 'Twoje poprzednie zgłoszenie czeka na weryfikację.',
      });
      warning('Oczekuje', 'Twoje zgłoszenie jest w trakcie weryfikacji');
      return;
    }

    // Utwórz zgłoszenie
    const { error: submitError } = await supabase.from('submissions').insert({
      user_id: profile.id,
      mission_id: mission.id,
      status: 'approved', // QR automatycznie zatwierdzane
      xp_awarded: mission.xp_reward,
    });

    if (submitError) {
      setLastScanResult({
        success: false,
        message: 'Wystąpił błąd podczas zapisywania. Spróbuj ponownie.',
      });
      showError('Błąd', 'Nie udało się zapisać ukończenia misji');
      return;
    }

    // Dodaj XP użytkownikowi
    await supabase.rpc('add_user_xp', {
      p_user_id: profile.id,
      p_xp_amount: mission.xp_reward,
    });

    // Odśwież profil
    refreshProfile();

    setLastScanResult({
      success: true,
      message: `Ukończono misję: ${mission.title}`,
      xp: mission.xp_reward,
    });

    success('Misja ukończona!', `Zdobyłeś +${mission.xp_reward} XP`);
  };

  const handleClose = () => {
    setIsScanning(false);
    router.push('/dashboard');
  };

  if (isScanning) {
    return <QRScanner onScan={handleScan} onClose={handleClose} />;
  }

  return (
    <div className="py-4 min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center">
      {/* Back Button */}
      <button
        onClick={() => router.push('/dashboard')}
        className="absolute top-20 left-4 flex items-center text-dark-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-5 h-5 mr-1" />
        Powrót
      </button>

      {/* Main Content */}
      <div className="text-center w-full max-w-sm">
        {lastScanResult ? (
          <Card className="mb-6">
            <div
              className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
                lastScanResult.success
                  ? 'bg-green-500/20'
                  : 'bg-red-500/20'
              }`}
            >
              {lastScanResult.success ? (
                <CheckCircle className="w-8 h-8 text-green-500" />
              ) : (
                <ScanLine className="w-8 h-8 text-red-500" />
              )}
            </div>

            <p
              className={`text-lg font-medium mb-2 ${
                lastScanResult.success ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {lastScanResult.success ? 'Sukces!' : 'Ups!'}
            </p>

            <p className="text-dark-300 mb-4">{lastScanResult.message}</p>

            {lastScanResult.xp && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-turbo-500/20 rounded-full">
                <span className="text-turbo-400 font-bold">
                  +{lastScanResult.xp} XP
                </span>
              </div>
            )}
          </Card>
        ) : (
          <>
            <div className="w-24 h-24 rounded-full bg-turbo-500/20 flex items-center justify-center mx-auto mb-6">
              <ScanLine className="w-12 h-12 text-turbo-500" />
            </div>

            <h1 className="text-2xl font-bold text-white mb-2">Skanuj kod QR</h1>
            <p className="text-dark-400 mb-8">
              Znajdź kod QR w lokalizacji misji i zeskanuj go, aby zdobyć punkty XP
            </p>
          </>
        )}

        <Button size="lg" fullWidth onClick={() => setIsScanning(true)}>
          <ScanLine className="w-5 h-5 mr-2" />
          {lastScanResult ? 'Skanuj kolejny kod' : 'Rozpocznij skanowanie'}
        </Button>

        {lastScanResult && (
          <Button
            variant="ghost"
            fullWidth
            onClick={() => router.push('/missions')}
            className="mt-3"
          >
            Zobacz wszystkie misje
          </Button>
        )}
      </div>
    </div>
  );
}
