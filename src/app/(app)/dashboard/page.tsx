'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useMissions } from '@/hooks/useMissions';
import { useTeams } from '@/hooks/useTeams';
import { Card, Badge, Button, ProgressBar, Avatar } from '@/components/ui';
import { MissionCard } from '@/components/missions';
import { TeamCard, TeamBadge } from '@/components/teams';
import {
  calculateLevel,
  calculateLevelProgress,
  xpToNextLevel,
  formatNumber,
  LEVELS,
} from '@/lib/utils';
import {
  Target,
  Trophy,
  Heart,
  ChevronRight,
  Zap,
  Medal,
  Users,
  AlertCircle,
} from 'lucide-react';
import { Team, TeamLeaderboardEntry } from '@/types';

export default function DashboardPage() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const { missions, userSubmissions, loading: missionsLoading } = useMissions({
    userId: profile?.id,
    activeOnly: true,
  });
  const { teams, getTeam, getTeamLeaderboard, getTeamRank } = useTeams();

  const [userTeam, setUserTeam] = useState<Team | null>(null);
  const [teamRank, setTeamRank] = useState<number | null>(null);
  const [topTeams, setTopTeams] = useState<TeamLeaderboardEntry[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(true);

  useEffect(() => {
    const fetchTeamData = async () => {
      setLoadingTeam(true);

      // Pobierz druzyne uzytkownika
      if (profile?.team_id) {
        const team = await getTeam(profile.team_id);
        setUserTeam(team);

        if (team) {
          const rank = await getTeamRank(team.id);
          setTeamRank(rank);
        }
      }

      // Pobierz top 3 druzyny
      const leaderboard = await getTeamLeaderboard();
      setTopTeams(leaderboard.slice(0, 3));

      setLoadingTeam(false);
    };

    if (profile) {
      fetchTeamData();
    }
  }, [profile, getTeam, getTeamRank, getTeamLeaderboard]);

  if (!profile) return null;

  const level = calculateLevel(profile.total_xp);
  const progress = calculateLevelProgress(profile.total_xp);
  const xpNeeded = xpToNextLevel(profile.total_xp);
  const nextLevel = LEVELS.find(l => l.id === level.id + 1);

  // Dostepne misje (nie ukonczone)
  const completedMissionIds = userSubmissions
    .filter(s => s.status === 'approved')
    .map(s => s.mission_id);

  const availableMissions = missions.filter(
    m => !completedMissionIds.includes(m.id)
  );

  const completedCount = completedMissionIds.length;
  const totalXpEarned = userSubmissions
    .filter(s => s.status === 'approved')
    .reduce((sum, s) => sum + (s.xp_awarded || 0), 0);

  return (
    <div className="space-y-6 py-4">
      {/* Welcome Card */}
      <Card variant="glass" className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-turbo-500/10 rounded-full blur-3xl" />

        <div className="flex items-center gap-4 mb-4">
          <Avatar
            src={profile.avatar_url}
            fallback={profile.nick}
            size="lg"
            showBorder
          />
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">{profile.nick}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-lg">{level.badge_icon}</span>
              <span className="text-dark-300">{level.name}</span>
            </div>
            {userTeam && (
              <div className="mt-1">
                <TeamBadge team={userTeam} size="sm" />
              </div>
            )}
          </div>
          {teamRank && (
            <div className="text-center">
              <div className="text-2xl font-bold text-turbo-400">#{teamRank}</div>
              <div className="text-xs text-dark-400">Druzyna</div>
            </div>
          )}
        </div>

        {/* XP Progress */}
        <div className="mb-2">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-dark-400">Poziom {level.id}</span>
            <span className="text-turbo-400 font-medium">
              {formatNumber(profile.total_xp)} XP
            </span>
          </div>
          <ProgressBar value={progress} animated />
          <div className="flex justify-between text-xs mt-1">
            <span className="text-dark-500">
              {nextLevel ? `${formatNumber(xpNeeded)} XP do poziomu ${nextLevel.id}` : 'Maksymalny poziom!'}
            </span>
            <span className="text-dark-500">{progress}%</span>
          </div>
        </div>
      </Card>

      {/* Team Status */}
      {!profile.team_id ? (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
            <div>
              <p className="text-white font-medium">Nie jestes przypisany do druzyny</p>
              <p className="text-sm text-dark-400 mt-1">
                Poczekaj az administrator przypisze Cie do jednej z druzyn.
              </p>
            </div>
          </div>
        </Card>
      ) : userTeam && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-500" />
              Twoja druzyna
            </h2>
            <Link
              href={`/teams/${userTeam.id}`}
              className="text-sm text-accent-400 flex items-center"
            >
              Szczegoly
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <TeamCard team={userTeam} rank={teamRank || undefined} showLink={true} />
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card padding="sm" className="text-center">
          <Target className="w-6 h-6 text-turbo-500 mx-auto mb-1" />
          <div className="text-xl font-bold text-white">{completedCount}</div>
          <div className="text-xs text-dark-400">Misji</div>
        </Card>

        <Card padding="sm" className="text-center">
          <Heart className="w-6 h-6 text-red-500 mx-auto mb-1" />
          <div className="text-xl font-bold text-white">{formatNumber(totalXpEarned)}</div>
          <div className="text-xs text-dark-400">XP zdobyte</div>
        </Card>

        <Card padding="sm" className="text-center">
          <Medal className="w-6 h-6 text-blue-500 mx-auto mb-1" />
          <div className="text-xl font-bold text-white">{level.id}</div>
          <div className="text-xs text-dark-400">Poziom</div>
        </Card>
      </div>

      {/* Available Missions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-turbo-500" />
            Dostepne misje
          </h2>
          <Link
            href="/missions"
            className="text-sm text-accent-400 flex items-center"
          >
            Zobacz wszystkie
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {missionsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="h-24 animate-pulse bg-dark-700" />
            ))}
          </div>
        ) : availableMissions.length > 0 ? (
          <div className="space-y-3">
            {availableMissions.slice(0, 3).map(mission => (
              <MissionCard
                key={mission.id}
                mission={mission}
                compact
                onClick={() => router.push('/missions')}
              />
            ))}
          </div>
        ) : (
          <Card className="text-center py-8">
            <Target className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-400">Wszystkie misje ukonczone!</p>
            <p className="text-sm text-dark-500 mt-1">
              Sprawdz pozniej - nowe misje wkrotce!
            </p>
          </Card>
        )}
      </div>

      {/* Top Teams Preview */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Ranking druzyn
          </h2>
          <Link
            href="/teams"
            className="text-sm text-accent-400 flex items-center"
          >
            Pelny ranking
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {loadingTeam ? (
          <Card className="animate-pulse h-32 bg-dark-700" />
        ) : (
          <Card padding="sm">
            <div className="space-y-2">
              {topTeams.map((entry) => (
                <Link
                  key={entry.team.id}
                  href={`/teams/${entry.team.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-dark-700/50 transition-colors"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      entry.rank === 1
                        ? 'bg-yellow-500 text-black'
                        : entry.rank === 2
                        ? 'bg-gray-400 text-black'
                        : 'bg-amber-700 text-white'
                    }`}
                  >
                    {entry.rank}
                  </div>
                  <span className="text-xl">{entry.team.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{entry.team.name}</p>
                    <p className="text-xs text-dark-400">{entry.team.member_count} czlonkow</p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-turbo-400">
                      {formatNumber(entry.team.total_xp)}
                    </div>
                    <div className="text-xs text-dark-500">XP</div>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
