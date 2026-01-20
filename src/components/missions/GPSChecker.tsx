'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { calculateDistance, formatNumber } from '@/lib/utils';
import { MapPin, Navigation, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

interface GPSCheckerProps {
  targetLat: number;
  targetLng: number;
  targetRadius: number; // w metrach
  locationName?: string;
  onSuccess: (lat: number, lng: number) => void;
  onCancel: () => void;
}

type GeoStatus = 'idle' | 'loading' | 'success' | 'error' | 'denied' | 'too_far';

export function GPSChecker({
  targetLat,
  targetLng,
  targetRadius,
  locationName,
  onSuccess,
  onCancel,
}: GPSCheckerProps) {
  const [status, setStatus] = useState<GeoStatus>('idle');
  const [currentPosition, setCurrentPosition] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
  } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkLocation = () => {
    setStatus('loading');
    setError(null);

    if (!navigator.geolocation) {
      setStatus('error');
      setError('Twoja przeglądarka nie obsługuje geolokalizacji.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude, accuracy } = position.coords;
        setCurrentPosition({ lat: latitude, lng: longitude, accuracy });

        const dist = calculateDistance(latitude, longitude, targetLat, targetLng);
        setDistance(dist);

        if (dist <= targetRadius) {
          setStatus('success');
          // Krótkie opóźnienie na animację
          setTimeout(() => {
            onSuccess(latitude, longitude);
          }, 1500);
        } else {
          setStatus('too_far');
        }
      },
      err => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setStatus('denied');
            setError('Brak uprawnień do lokalizacji. Proszę je włączyć w ustawieniach.');
            break;
          case err.POSITION_UNAVAILABLE:
            setStatus('error');
            setError('Lokalizacja jest niedostępna. Sprawdź czy GPS jest włączony.');
            break;
          case err.TIMEOUT:
            setStatus('error');
            setError('Przekroczono limit czasu pobierania lokalizacji.');
            break;
          default:
            setStatus('error');
            setError('Nieznany błąd podczas pobierania lokalizacji.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const openInMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}`;
    window.open(url, '_blank');
  };

  return (
    <div className="p-4">
      {/* Informacja o lokalizacji */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-turbo-500/20 flex items-center justify-center mx-auto mb-4">
          <MapPin className="w-8 h-8 text-turbo-500" />
        </div>

        {locationName && (
          <h3 className="text-lg font-semibold text-white mb-2">{locationName}</h3>
        )}

        <p className="text-dark-300">
          Musisz być w promieniu <span className="font-bold text-turbo-400">{targetRadius}m</span> od lokalizacji
        </p>
      </div>

      {/* Status */}
      {status === 'idle' && (
        <div className="text-center">
          <Button onClick={checkLocation} size="lg" fullWidth>
            <Navigation className="w-5 h-5 mr-2" />
            Sprawdź moją lokalizację
          </Button>
        </div>
      )}

      {status === 'loading' && (
        <div className="text-center py-8">
          <Loader2 className="w-12 h-12 text-turbo-500 animate-spin mx-auto mb-4" />
          <p className="text-dark-300">Pobieranie lokalizacji...</p>
        </div>
      )}

      {status === 'success' && (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="text-xl font-bold text-green-400 mb-2">Jesteś na miejscu!</h3>
          <p className="text-dark-300">
            Odległość: <span className="font-bold text-white">{formatNumber(Math.round(distance || 0))}m</span>
          </p>
        </div>
      )}

      {status === 'too_far' && (
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-yellow-500" />
          </div>
          <h3 className="text-xl font-bold text-yellow-400 mb-2">Za daleko!</h3>
          <p className="text-dark-300 mb-2">
            Twoja odległość: <span className="font-bold text-white">{formatNumber(Math.round(distance || 0))}m</span>
          </p>
          <p className="text-sm text-dark-400 mb-6">
            {currentPosition && `Dokładność GPS: ${Math.round(currentPosition.accuracy)}m`}
          </p>

          <div className="space-y-3">
            <Button onClick={checkLocation} fullWidth>
              Sprawdź ponownie
            </Button>
            <Button variant="secondary" onClick={openInMaps} fullWidth>
              <MapPin className="w-4 h-4 mr-2" />
              Nawiguj do lokalizacji
            </Button>
          </div>
        </div>
      )}

      {(status === 'error' || status === 'denied') && (
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-red-400 mb-2">Błąd lokalizacji</h3>
          <p className="text-dark-300 mb-6">{error}</p>

          <div className="space-y-3">
            <Button onClick={checkLocation} fullWidth>
              Spróbuj ponownie
            </Button>
            <Button variant="secondary" onClick={openInMaps} fullWidth>
              <MapPin className="w-4 h-4 mr-2" />
              Otwórz w Mapach Google
            </Button>
          </div>
        </div>
      )}

      {/* Anuluj */}
      <Button variant="ghost" onClick={onCancel} fullWidth className="mt-4">
        Anuluj
      </Button>
    </div>
  );
}
