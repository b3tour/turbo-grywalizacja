'use client';

import { Team } from '@/types';

interface TeamBadgeProps {
  team: Team;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
}

export function TeamBadge({ team, size = 'md', showName = true }: TeamBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  const emojiSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClasses[size]}`}
      style={{
        backgroundColor: `${team.color}20`,
        color: team.color,
        border: `1px solid ${team.color}40`,
      }}
    >
      <span className={emojiSizes[size]}>{team.emoji}</span>
      {showName && <span>{team.name}</span>}
    </span>
  );
}
