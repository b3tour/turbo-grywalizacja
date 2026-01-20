'use client';

import Image from 'next/image';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Ładowanie...' }: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-dark-950">
      {/* Logo animowane */}
      <div className="relative mb-8">
        <div className="w-20 h-20 flex items-center justify-center">
          <Image
            src="/heart-icon.png"
            alt="Turbo Challenge"
            width={64}
            height={64}
            className="object-contain animate-pulse drop-shadow-[0_0_20px_rgba(217,70,239,0.6)]"
            priority
          />
        </div>
        {/* Orbiting dots */}
        <div className="absolute inset-0 animate-spin" style={{ animationDuration: '3s' }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-turbo-400" />
        </div>
        <div className="absolute inset-0 animate-spin" style={{ animationDuration: '3s', animationDelay: '1s' }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-purple-500" />
        </div>
        <div className="absolute inset-0 animate-spin" style={{ animationDuration: '3s', animationDelay: '2s' }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-accent-400" />
        </div>
      </div>

      {/* Nazwa */}
      <h1 className="text-2xl font-bold gradient-text mb-2">Turbo Challenge</h1>

      {/* Komunikat */}
      <p className="text-dark-400 animate-pulse">{message}</p>
    </div>
  );
}
