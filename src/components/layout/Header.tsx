'use client';

import Link from 'next/link';
import Image from 'next/image';
import { User } from '@/types';
import { Avatar } from '@/components/ui';
import { calculateLevel, calculateLevelProgress } from '@/lib/utils';

interface HeaderProps {
  user?: User | null;
}

export function Header({ user }: HeaderProps) {
  const level = user ? calculateLevel(user.total_xp) : null;
  const progress = user ? calculateLevelProgress(user.total_xp) : 0;

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-dark-900/95 backdrop-blur-lg border-b border-dark-800 pt-safe">
      <div className="flex items-center justify-between h-16 px-4 max-w-lg mx-auto">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src="/heart-icon.png"
            alt="Turbo Grywalizacja"
            width={30}
            height={30}
            className="object-contain"
            priority
          />
          <div className="flex items-center gap-1">
            <span className="text-xl font-bold text-white">TURBO</span>
            <span className="text-xl font-bold gradient-text">GRYWALIZACJA</span>
          </div>
        </Link>

        {/* User info */}
        {user && (
          <div className="flex items-center gap-3">
            {/* XP i Level */}
            <div className="text-right mr-2">
              <div className="flex items-center gap-1">
                <span className="text-xs">{level?.badge_icon}</span>
                <span className="text-sm font-medium text-white">
                  Lvl {level?.id}
                </span>
              </div>
              <div className="w-16 h-1.5 bg-dark-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-turbo-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>


            {/* Avatar */}
            <Link href="/profile">
              <Avatar
                src={user.avatar_url}
                fallback={user.nick}
                size="sm"
                showBorder
              />
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
