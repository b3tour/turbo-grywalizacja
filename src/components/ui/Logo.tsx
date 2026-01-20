'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  className?: string;
  showGlow?: boolean;
}

const sizes = {
  sm: { width: 32, height: 32 },
  md: { width: 40, height: 40 },
  lg: { width: 56, height: 56 },
  xl: { width: 72, height: 72 },
  xxl: { width: 96, height: 96 },
};

export function Logo({ size = 'md', className, showGlow = false }: LogoProps) {
  const sizeConfig = sizes[size];

  return (
    <Image
      src="/heart-icon.png"
      alt="Turbo Challenge"
      width={sizeConfig.width}
      height={sizeConfig.height}
      className={cn(
        'object-contain',
        showGlow && 'drop-shadow-[0_0_15px_rgba(217,70,239,0.6)]',
        className
      )}
      priority
    />
  );
}

// Alias dla kompatybilności wstecznej - teraz też bez tła
export function LogoCircle({ size = 'md', className, showGlow = true }: LogoProps) {
  return <Logo size={size} className={className} showGlow={showGlow} />;
}
