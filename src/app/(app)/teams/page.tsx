'use client';

import { useTeams } from '@/hooks/useTeams';
import { TeamLeaderboard } from '@/components/teams';
import { Users, Trophy, Zap } from 'lucide-react';

export default function TeamsPage() {
  const { teams, leaderboard, loading } = useTeams();

  // Statystyki
  const totalMembers = teams.reduce((sum, t) => sum + t.member_count, 0);
  const totalXP = teams.reduce((sum, t) => sum + t.total_xp, 0);

  return (
    <div className="min-h-screen bg-gray-900 pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-white mb-1">Druzyny</h1>
        <p className="text-gray-400 text-sm">Ranking druzynowy Turbo Grywalizacja</p>
      </div>

      {/* Statystyki */}
      <div className="px-4 mb-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-800/50 rounded-xl p-3 text-center">
            <Users className="mx-auto text-blue-400 mb-1" size={20} />
            <div className="font-bold text-white">{teams.length}</div>
            <div className="text-xs text-gray-400">Druzyn</div>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-3 text-center">
            <Trophy className="mx-auto text-purple-400 mb-1" size={20} />
            <div className="font-bold text-white">{totalMembers}</div>
            <div className="text-xs text-gray-400">Graczy</div>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-3 text-center">
            <Zap className="mx-auto text-yellow-400 mb-1" size={20} />
            <div className="font-bold text-white">{totalXP.toLocaleString()}</div>
            <div className="text-xs text-gray-400">Laczne XP</div>
          </div>
        </div>
      </div>

      {/* Ranking */}
      <div className="px-4">
        <TeamLeaderboard entries={leaderboard} loading={loading} />
      </div>
    </div>
  );
}
