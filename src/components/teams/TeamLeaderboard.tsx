'use client';

import { TeamLeaderboardEntry } from '@/types';
import { TeamCard } from './TeamCard';
import { Trophy } from 'lucide-react';

interface TeamLeaderboardProps {
  entries: TeamLeaderboardEntry[];
  loading?: boolean;
}

export function TeamLeaderboard({ entries, loading }: TeamLeaderboardProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-32 bg-gray-800/50 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <Trophy className="mx-auto text-gray-600 mb-4" size={48} />
        <p className="text-gray-400">Brak druzyn w rankingu</p>
      </div>
    );
  }

  // Top 3 na podium
  const topThree = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="space-y-6">
      {/* Podium */}
      {topThree.length >= 3 && (
        <div className="flex items-end justify-center gap-2 mb-8">
          {/* 2nd place */}
          <div className="w-1/3 max-w-[140px]">
            <div className="text-center mb-2">
              <span className="text-3xl">{topThree[1].team.emoji}</span>
            </div>
            <div
              className="rounded-t-xl p-3 text-center"
              style={{
                backgroundColor: `${topThree[1].team.color}30`,
                height: '100px',
              }}
            >
              <div className="text-2xl font-bold text-gray-300">2</div>
              <div className="text-sm font-medium text-white truncate">{topThree[1].team.name}</div>
              <div className="text-xs text-gray-400">{topThree[1].team.total_xp.toLocaleString()} XP</div>
            </div>
          </div>

          {/* 1st place */}
          <div className="w-1/3 max-w-[160px]">
            <div className="text-center mb-2">
              <span className="text-4xl">{topThree[0].team.emoji}</span>
              <span className="block text-yellow-400">👑</span>
            </div>
            <div
              className="rounded-t-xl p-3 text-center"
              style={{
                backgroundColor: `${topThree[0].team.color}40`,
                height: '130px',
                boxShadow: `0 0 30px ${topThree[0].team.color}40`,
              }}
            >
              <div className="text-3xl font-bold text-yellow-400">1</div>
              <div className="text-base font-bold text-white truncate">{topThree[0].team.name}</div>
              <div className="text-sm text-gray-300">{topThree[0].team.total_xp.toLocaleString()} XP</div>
            </div>
          </div>

          {/* 3rd place */}
          <div className="w-1/3 max-w-[140px]">
            <div className="text-center mb-2">
              <span className="text-3xl">{topThree[2].team.emoji}</span>
            </div>
            <div
              className="rounded-t-xl p-3 text-center"
              style={{
                backgroundColor: `${topThree[2].team.color}25`,
                height: '80px',
              }}
            >
              <div className="text-2xl font-bold text-amber-600">3</div>
              <div className="text-sm font-medium text-white truncate">{topThree[2].team.name}</div>
              <div className="text-xs text-gray-400">{topThree[2].team.total_xp.toLocaleString()} XP</div>
            </div>
          </div>
        </div>
      )}

      {/* Top 3 cards (gdy mniej niz 3 druzyny lub jako alternatywa) */}
      {topThree.length < 3 && (
        <div className="space-y-3">
          {topThree.map((entry) => (
            <TeamCard
              key={entry.team.id}
              team={entry.team}
              rank={entry.rank}
              topContributors={entry.top_contributors}
            />
          ))}
        </div>
      )}

      {/* Pozostale druzyny */}
      {rest.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-gray-400 text-sm font-medium px-1">Pozostale druzyny</h3>
          {rest.map((entry) => (
            <TeamCard
              key={entry.team.id}
              team={entry.team}
              rank={entry.rank}
              topContributors={entry.top_contributors}
            />
          ))}
        </div>
      )}
    </div>
  );
}
