'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTeams } from '@/hooks/useTeams';
import { TeamMembersList } from '@/components/teams';
import { Team, TeamMember } from '@/types';
import { ArrowLeft, Users, Trophy, Zap, Target } from 'lucide-react';

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.id as string;

  const { getTeam, getTeamMembers, getTeamRank } = useTeams();

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [rank, setRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const [teamData, membersData, rankData] = await Promise.all([
        getTeam(teamId),
        getTeamMembers(teamId),
        getTeamRank(teamId),
      ]);

      setTeam(teamData);
      setMembers(membersData);
      setRank(rankData);
      setLoading(false);
    };

    if (teamId) {
      fetchData();
    }
  }, [teamId, getTeam, getTeamMembers, getTeamRank]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-turbo-500" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
        <p className="text-gray-400 mb-4">Druzyna nie zostala znaleziona</p>
        <button
          onClick={() => router.push('/teams')}
          className="text-turbo-400 hover:text-turbo-300"
        >
          Wroc do listy druzyn
        </button>
      </div>
    );
  }

  const totalMissions = members.reduce((sum, m) => sum + m.missions_completed, 0);

  return (
    <div className="min-h-screen bg-gray-900 pb-24">
      {/* Header */}
      <div
        className="relative px-4 pt-6 pb-8"
        style={{
          background: `linear-gradient(180deg, ${team.color}30 0%, transparent 100%)`,
        }}
      >
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Powrot</span>
        </button>

        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl"
            style={{ backgroundColor: `${team.color}30` }}
          >
            {team.emoji}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{team.name}</h1>
            {team.description && (
              <p className="text-gray-400 text-sm">{team.description}</p>
            )}
            {rank && (
              <div
                className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: `${team.color}30`,
                  color: team.color,
                }}
              >
                <Trophy size={12} />
                {rank}. miejsce
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 -mt-4 mb-6">
        <div className="grid grid-cols-4 gap-2">
          <div
            className="rounded-xl p-3 text-center"
            style={{ backgroundColor: `${team.color}15`, border: `1px solid ${team.color}30` }}
          >
            <Zap className="mx-auto mb-1" size={18} style={{ color: team.color }} />
            <div className="font-bold text-white text-lg">{team.total_xp.toLocaleString()}</div>
            <div className="text-xs text-gray-400">XP</div>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-3 text-center">
            <Users className="mx-auto text-blue-400 mb-1" size={18} />
            <div className="font-bold text-white text-lg">{team.member_count}</div>
            <div className="text-xs text-gray-400">Czlonkow</div>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-3 text-center">
            <Target className="mx-auto text-green-400 mb-1" size={18} />
            <div className="font-bold text-white text-lg">{totalMissions}</div>
            <div className="text-xs text-gray-400">Misji</div>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-3 text-center">
            <Trophy className="mx-auto text-yellow-400 mb-1" size={18} />
            <div className="font-bold text-white text-lg">{Math.round(team.avg_xp_per_member)}</div>
            <div className="text-xs text-gray-400">Srednia</div>
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="px-4">
        <h2 className="text-lg font-semibold text-white mb-3">
          Czlonkowie druzyny ({members.length})
        </h2>
        <TeamMembersList members={members} teamColor={team.color} />
      </div>
    </div>
  );
}
