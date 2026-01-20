'use client';

import { Team, TeamContributor } from '@/types';
import { Trophy, Users, Zap } from 'lucide-react';
import Link from 'next/link';

interface TeamCardProps {
  team: Team;
  rank?: number;
  topContributors?: TeamContributor[];
  showLink?: boolean;
}

export function TeamCard({ team, rank, topContributors = [], showLink = true }: TeamCardProps) {
  const content = (
    <div
      className="relative overflow-hidden rounded-2xl p-4 transition-all duration-300 hover:scale-[1.02]"
      style={{
        background: `linear-gradient(135deg, ${team.color}15 0%, ${team.color}05 100%)`,
        border: `1px solid ${team.color}30`,
      }}
    >
      {/* Rank badge */}
      {rank && (
        <div
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
          style={{
            backgroundColor: rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : `${team.color}30`,
            color: rank <= 3 ? '#000' : team.color,
          }}
        >
          {rank}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{team.emoji}</span>
        <div>
          <h3 className="font-bold text-white text-lg">{team.name}</h3>
          {team.description && (
            <p className="text-gray-400 text-xs">{team.description}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-black/20 rounded-lg p-2 text-center">
          <div className="flex items-center justify-center gap-1 text-yellow-400 mb-1">
            <Zap size={14} />
          </div>
          <div className="font-bold text-white">{team.total_xp.toLocaleString()}</div>
          <div className="text-gray-400 text-xs">XP</div>
        </div>
        <div className="bg-black/20 rounded-lg p-2 text-center">
          <div className="flex items-center justify-center gap-1 text-blue-400 mb-1">
            <Users size={14} />
          </div>
          <div className="font-bold text-white">{team.member_count}</div>
          <div className="text-gray-400 text-xs">Czlonkow</div>
        </div>
        <div className="bg-black/20 rounded-lg p-2 text-center">
          <div className="flex items-center justify-center gap-1 text-green-400 mb-1">
            <Trophy size={14} />
          </div>
          <div className="font-bold text-white">{Math.round(team.avg_xp_per_member)}</div>
          <div className="text-gray-400 text-xs">Srednia XP</div>
        </div>
      </div>

      {/* Top contributors */}
      {topContributors.length > 0 && (
        <div className="border-t border-white/10 pt-3">
          <div className="text-xs text-gray-400 mb-2">Top czlonkowie:</div>
          <div className="flex items-center gap-2">
            {topContributors.slice(0, 3).map((contributor, index) => (
              <div key={contributor.id} className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs font-medium overflow-hidden">
                  {contributor.avatar_url ? (
                    <img src={contributor.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    contributor.nick.charAt(0).toUpperCase()
                  )}
                </div>
                <span className="text-xs text-gray-300">{contributor.nick}</span>
                {index === 0 && <span className="text-yellow-400 text-xs">👑</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (showLink) {
    return (
      <Link href={`/teams/${team.id}`}>
        {content}
      </Link>
    );
  }

  return content;
}
