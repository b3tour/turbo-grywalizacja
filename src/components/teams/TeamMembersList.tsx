'use client';

import { TeamMember } from '@/types';
import { LEVELS } from '@/lib/utils';
import { Target, Zap } from 'lucide-react';

interface TeamMembersListProps {
  members: TeamMember[];
  loading?: boolean;
  teamColor?: string;
}

export function TeamMembersList({ members, loading, teamColor = '#A855F7' }: TeamMembersListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-gray-800/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">Brak czlonkow w druzynie</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {members.map((member, index) => {
        const level = LEVELS.find(l => l.id === member.level) || LEVELS[0];
        const isTop = index < 3;

        return (
          <div
            key={member.id}
            className="flex items-center gap-3 p-3 rounded-xl transition-all"
            style={{
              backgroundColor: isTop ? `${teamColor}15` : 'rgba(31, 41, 55, 0.5)',
              border: isTop ? `1px solid ${teamColor}30` : '1px solid transparent',
            }}
          >
            {/* Rank */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
              style={{
                backgroundColor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : 'rgba(75, 85, 99, 0.5)',
                color: index < 3 ? '#000' : '#9CA3AF',
              }}
            >
              {index + 1}
            </div>

            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
              {member.avatar_url ? (
                <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-medium text-gray-300">
                  {member.nick.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white truncate">{member.nick}</span>
                {index === 0 && <span className="text-yellow-400">👑</span>}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>{level.badge_icon} Poz. {member.level}</span>
              </div>
            </div>

            {/* Stats */}
            <div className="text-right">
              <div className="flex items-center gap-1 text-yellow-400 font-medium">
                <Zap size={14} />
                <span>{member.total_xp.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1 text-gray-400 text-xs">
                <Target size={12} />
                <span>{member.missions_completed} misji</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
