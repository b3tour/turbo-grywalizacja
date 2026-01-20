'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui';
import { Camera, X, ScanLine } from 'lucide-react';

interface QRScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
  expectedCode?: string;
}

export function QRScanner({ onScan, onClose, expectedCode }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'qr-reader';

  useEffect(() => {
    // Sprawdź uprawnienia do kamery
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then(() => setHasPermission(true))
      .catch(() => {
        setHasPermission(false);
        setError('Brak dostępu do kamery. Proszę udzielić uprawnień.');
      });

    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async () => {
    if (!hasPermission) return;

    setError(null);
    setIsScanning(true);

    try {
      scannerRef.current = new Html5Qrcode(containerId);

      await scannerRef.current.start(
        { facingMode: 'environment' }, // Tylna kamera
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText) => {
          // Kod został zeskanowany
          if (expectedCode && decodedText !== expectedCode) {
            setError('Zeskanowano nieprawidłowy kod QR');
            return;
          }

          stopScanning();
          onScan(decodedText);
        },
        () => {
          // Błąd skanowania (normalne gdy nie ma kodu w kadrze)
        }
      );
    } catch (err) {
      setError('Nie udało się uruchomić skanera. Spróbuj ponownie.');
      setIsScanning(false);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        // Ignoruj błędy przy zatrzymywaniu
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-dark-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-dark-800">
        <h2 className="text-lg font-semibold text-white">Skanuj kod QR</h2>
        <button
          onClick={() => {
            stopScanning();
            onClose();
          }}
          className="p-2 text-dark-400 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      {/* Scanner Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {hasPermission === false && (
          <div className="text-center">
            <Camera className="w-16 h-16 text-dark-500 mx-auto mb-4" />
            <p className="text-dark-300 mb-4">
              Potrzebujesz dostępu do kamery, aby skanować kody QR.
            </p>
            <Button onClick={() => window.location.reload()}>
              Spróbuj ponownie
            </Button>
          </div>
        )}

        {hasPermission && !isScanning && (
          <div className="text-center">
            <div className="w-64 h-64 border-2 border-dashed border-dark-600 rounded-2xl flex items-center justify-center mb-6">
              <ScanLine className="w-16 h-16 text-turbo-500" />
            </div>
            <p className="text-dark-300 mb-4">
              Naciśnij przycisk, aby uruchomić skaner
            </p>
            <Button onClick={startScanning} size="lg">
              <Camera className="w-5 h-5 mr-2" />
              Uruchom skaner
            </Button>
          </div>
        )}

        {isScanning && (
          <div className="w-full max-w-sm">
            <div
              id={containerId}
              className="w-full rounded-2xl overflow-hidden border-2 border-turbo-500"
            />
            <p className="text-center text-dark-300 mt-4">
              Skieruj kamerę na kod QR
            </p>
            <Button
              onClick={stopScanning}
              variant="secondary"
              fullWidth
              className="mt-4"
            >
              Zatrzymaj skanowanie
            </Button>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-red-400 text-center">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
