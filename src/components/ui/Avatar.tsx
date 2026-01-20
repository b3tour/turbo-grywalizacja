'use client';

import { HTMLAttributes, forwardRef } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showBorder?: boolean;
  borderColor?: string;
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      className,
      src,
      alt = 'Avatar',
      fallback,
      size = 'md',
      showBorder = false,
      borderColor = 'border-turbo-500',
      ...props
    },
    ref
  ) => {
    const sizes = {
      sm: 'w-8 h-8 text-xs',
      md: 'w-10 h-10 text-sm',
      lg: 'w-14 h-14 text-base',
      xl: 'w-20 h-20 text-xl',
    };

    const imageSizes = {
      sm: 32,
      md: 40,
      lg: 56,
      xl: 80,
    };

    // Generuj inicjały z fallback
    const getInitials = (text?: string) => {
      if (!text) return '?';
      const words = text.split(' ').filter(Boolean);
      if (words.length === 1) {
        return words[0].substring(0, 2).toUpperCase();
      }
      return words
        .slice(0, 2)
        .map(w => w[0])
        .join('')
        .toUpperCase();
    };

    return (
      <div
        ref={ref}
        className={cn(
          'relative rounded-full overflow-hidden bg-dark-700 flex items-center justify-center font-semibold text-dark-300',
          sizes[size],
          showBorder && `ring-2 ${borderColor}`,
          className
        )}
        {...props}
      >
        {src ? (
          <Image
            src={src}
            alt={alt}
            width={imageSizes[size]}
            height={imageSizes[size]}
            className="object-cover w-full h-full"
          />
        ) : (
          <span>{getInitials(fallback)}</span>
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';
