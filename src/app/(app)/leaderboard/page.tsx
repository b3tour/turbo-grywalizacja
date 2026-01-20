'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useMissions } from '@/hooks/useMissions';
import { Card, Avatar, Badge } from '@/components/ui';
import { formatNumber, LEVELS } from '@/lib/utils';
import { Trophy, Medal, Crown, TrendingUp, Users, Zap, Timer, ChevronDown, ChevronUp } from 'lucide-react';
import { Mission } from '@/types';

type LeaderboardTab = 'xp' | 'speedrun';

interface SpeedrunEntry {
  rank: number;
  user_id: string;
  nick: string;
  avatar_url?: string;
  time_ms: number;
  created_at: string;
}

export default function LeaderboardPage() {
  const { profile } = useAuth();
  const {
    leaderboard,
    loading,
    totalParticipants,
    getUserRank,
    getStats,
    getSpeedrunLeaderboard,
  } = useLeaderboard({ limit: 100 });

  const { missions } = useMissions({ activeOnly: false });

  const [userRank, setUserRank] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('xp');
  const [speedrunData, setSpeedrunData] = useState<Record<string, SpeedrunEntry[]>>({});
  const [expandedQuiz, setExpandedQuiz] = useState<string | null>(null);
  const [loadingSpeedrun, setLoadingSpeedrun] = useState(false);
  const stats = getStats();

  // Filtruj quizy speedrun
  const speedrunQuizzes = missions.filter(
    m => m.type === 'quiz' && m.quiz_data?.mode === 'speedrun'
  );

  useEffect(() => {
    if (profile?.id) {
      getUserRank(profile.id).then(setUserRank);
    }
  }, [profile?.id, getUserRank]);

  // Załaduj dane speedrun dla rozwiniętego quizu
  useEffect(() => {
    if (expandedQuiz && !speedrunData[expandedQuiz]) {
      setLoadingSpeedrun(true);
      getSpeedrunLeaderboard(expandedQuiz, 20).then(data => {
        setSpeedrunData(prev => ({ ...prev, [expandedQuiz]: data }));
        setLoadingSpeedrun(false);
      });
    }
  }, [expandedQuiz, speedrunData, getSpeedrunLeaderboard]);

  const formatTimeMs = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const centisecs = Math.floor((ms % 1000) / 10);
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}.${centisecs.toString().padStart(2, '0')}`;
    }
    return `${secs}.${centisecs.toString().padStart(2, '0')}s`;
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-400" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-300" />;
      case 3:
        return <Medal className="w-6 h-6 text-amber-600" />;
      default:
        return null;
    }
  };

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/30';
      case 2:
        return 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400/30';
      case 3:
        return 'bg-gradient-to-r from-amber-600/20 to-amber-700/20 border-amber-600/30';
      default:
        return '';
    }
  };

  return (
    <div className="py-4">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-500/20 mb-3">
          <Trophy className="w-8 h-8 text-yellow-500" />
        </div>
        <h1 className="text-2xl font-bold text-white">Ranking</h1>
        <p className="text-dark-400 mt-1">
          {totalParticipants} uczestników w rywalizacji
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('xp')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors ${
            activeTab === 'xp'
              ? 'bg-turbo-500 text-white'
              : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
          }`}
        >
          <Zap className="w-5 h-5" />
          Ranking XP
        </button>
        <button
          onClick={() => setActiveTab('speedrun')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors ${
            activeTab === 'speedrun'
              ? 'bg-turbo-500 text-white'
              : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
          }`}
        >
          <Timer className="w-5 h-5" />
          Speedrun
          {speedrunQuizzes.length > 0 && (
            <span className="bg-yellow-500 text-black text-xs px-1.5 py-0.5 rounded-full">
              {speedrunQuizzes.length}
            </span>
          )}
        </button>
      </div>

      {/* Stats - tylko dla XP tab */}
      {activeTab === 'xp' && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card padding="sm" className="text-center">
            <Users className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <div className="text-lg font-bold text-white">{totalParticipants}</div>
            <div className="text-xs text-dark-400">Graczy</div>
          </Card>

          <Card padding="sm" className="text-center">
            <Zap className="w-5 h-5 text-turbo-500 mx-auto mb-1" />
            <div className="text-lg font-bold text-white">{formatNumber(stats.totalXP)}</div>
            <div className="text-xs text-dark-400">Łączne XP</div>
          </Card>

          <Card padding="sm" className="text-center">
            <TrendingUp className="w-5 h-5 text-green-500 mx-auto mb-1" />
            <div className="text-lg font-bold text-white">{formatNumber(stats.avgXP)}</div>
            <div className="text-xs text-dark-400">Średnie XP</div>
          </Card>
        </div>
      )}

      {/* === XP TAB CONTENT === */}
      {activeTab === 'xp' && (
        <>
          {/* User's Position */}
          {userRank && profile && (
            <Card variant="glass" className="mb-6 border-turbo-500/30">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-turbo-500 flex items-center justify-center text-xl font-bold text-white">
                  #{userRank}
                </div>
                <Avatar
                  src={profile.avatar_url}
                  fallback={profile.nick}
                  size="md"
                  showBorder
                />
                <div className="flex-1">
                  <p className="font-semibold text-white">{profile.nick}</p>
                  <p className="text-sm text-turbo-400">Twoja pozycja w rankingu</p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-turbo-400">
                    {formatNumber(profile.total_xp)}
                  </div>
                  <div className="text-xs text-dark-400">XP</div>
                </div>
              </div>
            </Card>
          )}

      {/* Top 3 Podium */}
      {!loading && leaderboard.length >= 3 && (
        <div className="flex items-end justify-center gap-2 mb-6 h-40">
          {/* 2nd place */}
          <div className="flex flex-col items-center w-24">
            <Avatar
              src={leaderboard[1].avatar_url}
              fallback={leaderboard[1].nick}
              size="lg"
              showBorder
              borderColor="border-gray-400"
            />
            <div className="mt-2 text-center">
              <p className="text-sm font-semibold text-white truncate w-full">
                {leaderboard[1].nick}
              </p>
              <p className="text-xs text-gray-400">{formatNumber(leaderboard[1].total_xp)} XP</p>
            </div>
            <div className="w-full h-20 bg-gradient-to-t from-gray-500/30 to-gray-400/10 rounded-t-lg mt-2 flex items-center justify-center">
              <span className="text-2xl font-bold text-gray-300">2</span>
            </div>
          </div>

          {/* 1st place */}
          <div className="flex flex-col items-center w-28">
            <Crown className="w-8 h-8 text-yellow-400 mb-1" />
            <Avatar
              src={leaderboard[0].avatar_url}
              fallback={leaderboard[0].nick}
              size="xl"
              showBorder
              borderColor="border-yellow-400"
            />
            <div className="mt-2 text-center">
              <p className="text-sm font-semibold text-white truncate w-full">
                {leaderboard[0].nick}
              </p>
              <p className="text-xs text-yellow-400">{formatNumber(leaderboard[0].total_xp)} XP</p>
            </div>
            <div className="w-full h-28 bg-gradient-to-t from-yellow-500/30 to-yellow-400/10 rounded-t-lg mt-2 flex items-center justify-center">
              <span className="text-3xl font-bold text-yellow-400">1</span>
            </div>
          </div>

          {/* 3rd place */}
          <div className="flex flex-col items-center w-24">
            <Avatar
              src={leaderboard[2].avatar_url}
              fallback={leaderboard[2].nick}
              size="lg"
              showBorder
              borderColor="border-amber-600"
            />
            <div className="mt-2 text-center">
              <p className="text-sm font-semibold text-white truncate w-full">
                {leaderboard[2].nick}
              </p>
              <p className="text-xs text-amber-600">{formatNumber(leaderboard[2].total_xp)} XP</p>
            </div>
            <div className="w-full h-16 bg-gradient-to-t from-amber-600/30 to-amber-500/10 rounded-t-lg mt-2 flex items-center justify-center">
              <span className="text-2xl font-bold text-amber-600">3</span>
            </div>
          </div>
        </div>
      )}

      {/* Full Leaderboard */}
      <Card>
        <h2 className="text-lg font-semibold text-white mb-4">Pełny ranking</h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-dark-700 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {leaderboard.map(entry => {
              const isCurrentUser = entry.user_id === profile?.id;
              const level = LEVELS.find(l => l.id === entry.level) || LEVELS[0];

              return (
                <div
                  key={entry.user_id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    isCurrentUser
                      ? 'bg-turbo-500/10 border-turbo-500/30'
                      : `border-transparent ${getRankStyle(entry.rank)}`
                  }`}
                >
                  {/* Rank */}
                  <div className="w-8 flex items-center justify-center">
                    {getRankIcon(entry.rank) || (
                      <span className="text-lg font-bold text-dark-400">
                        {entry.rank}
                      </span>
                    )}
                  </div>

                  {/* Avatar */}
                  <Avatar
                    src={entry.avatar_url}
                    fallback={entry.nick}
                    size="sm"
                    showBorder={entry.rank <= 3}
                    borderColor={
                      entry.rank === 1
                        ? 'border-yellow-400'
                        : entry.rank === 2
                        ? 'border-gray-400'
                        : entry.rank === 3
                        ? 'border-amber-600'
                        : undefined
                    }
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium truncate ${isCurrentUser ? 'text-turbo-400' : 'text-white'}`}>
                        {entry.nick}
                      </p>
                      {isCurrentUser && (
                        <Badge variant="turbo" size="sm">Ty</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-dark-400">
                      <span>{level.badge_icon}</span>
                      <span>{level.name}</span>
                      <span className="mx-1">•</span>
                      <span>{entry.missions_completed} misji</span>
                    </div>
                  </div>

                  {/* XP */}
                  <div className="text-right">
                    <div className={`font-bold ${entry.rank <= 3 ? 'text-turbo-400' : 'text-white'}`}>
                      {formatNumber(entry.total_xp)}
                    </div>
                    <div className="text-xs text-dark-500">XP</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
        </>
      )}

      {/* === SPEEDRUN TAB CONTENT === */}
      {activeTab === 'speedrun' && (
        <div className="space-y-4">
          {speedrunQuizzes.length === 0 ? (
            <Card className="text-center py-12">
              <Timer className="w-12 h-12 text-dark-600 mx-auto mb-3" />
              <p className="text-dark-400 font-medium">Brak quizów speedrun</p>
              <p className="text-sm text-dark-500 mt-1">
                Quizy z trybem na czas pojawią się tutaj
              </p>
            </Card>
          ) : (
            speedrunQuizzes.map(quiz => (
              <Card key={quiz.id} className="overflow-hidden">
                {/* Quiz header - kliknij aby rozwinąć */}
                <button
                  onClick={() => setExpandedQuiz(expandedQuiz === quiz.id ? null : quiz.id)}
                  className="w-full flex items-center gap-3 text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                    <Timer className="w-5 h-5 text-yellow-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{quiz.title}</p>
                    <p className="text-sm text-dark-400">
                      {quiz.quiz_data?.questions.length || 0} pytań • {quiz.xp_reward} XP
                    </p>
                  </div>
                  {expandedQuiz === quiz.id ? (
                    <ChevronUp className="w-5 h-5 text-dark-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-dark-400" />
                  )}
                </button>

                {/* Ranking dla tego quizu */}
                {expandedQuiz === quiz.id && (
                  <div className="mt-4 pt-4 border-t border-dark-700">
                    {loadingSpeedrun ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-12 bg-dark-700 rounded-lg animate-pulse" />
                        ))}
                      </div>
                    ) : speedrunData[quiz.id]?.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-dark-400">Brak wyników</p>
                        <p className="text-sm text-dark-500">Bądź pierwszy!</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {speedrunData[quiz.id]?.map((entry, index) => {
                          const isCurrentUser = entry.user_id === profile?.id;
                          return (
                            <div
                              key={entry.user_id}
                              className={`flex items-center gap-3 p-2 rounded-lg ${
                                isCurrentUser ? 'bg-turbo-500/10' : index < 3 ? 'bg-dark-700/50' : ''
                              }`}
                            >
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                                index === 0
                                  ? 'bg-yellow-500 text-black'
                                  : index === 1
                                  ? 'bg-gray-400 text-black'
                                  : index === 2
                                  ? 'bg-amber-700 text-white'
                                  : 'bg-dark-700 text-dark-300'
                              }`}>
                                {entry.rank}
                              </div>
                              <Avatar
                                src={entry.avatar_url}
                                fallback={entry.nick}
                                size="sm"
                              />
                              <div className="flex-1 min-w-0">
                                <p className={`font-medium truncate ${isCurrentUser ? 'text-turbo-400' : 'text-white'}`}>
                                  {entry.nick}
                                </p>
                              </div>
                              <div className={`font-mono font-bold ${
                                index === 0 ? 'text-yellow-400' : 'text-turbo-400'
                              }`}>
                                {formatTimeMs(entry.time_ms)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
