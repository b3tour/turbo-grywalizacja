'use client';

import { useState, useEffect } from 'react';
import { Card, Badge } from '@/components/ui';
import { useChallenges } from '@/hooks/useChallenges';
import { useTeams } from '@/hooks/useTeams';
import { supabase } from '@/lib/supabase';
import {
  Challenge,
  ChallengeType,
  ChallengeStatus,
  ChallengeLeaderboardEntry,
  formatTime,
} from '@/types';
import {
  Trophy,
  Clock,
  Users,
  User as UserIcon,
  Timer,
  Target,
  ChevronRight,
  Medal,
  Flame,
  Gavel,
} from 'lucide-react';
import Link from 'next/link';

const challengeTypeLabels: Record<ChallengeType, { label: string; icon: React.ReactNode; color: string }> = {
  team_timed: { label: 'Drużynowe na czas', icon: <Users className="w-4 h-4" />, color: 'text-blue-400' },
  individual_timed: { label: 'Indywidualne na czas', icon: <Timer className="w-4 h-4" />, color: 'text-green-400' },
  team_task: { label: 'Zadanie drużynowe', icon: <Target className="w-4 h-4" />, color: 'text-purple-400' },
  individual_task: { label: 'Zadanie indywidualne', icon: <UserIcon className="w-4 h-4" />, color: 'text-yellow-400' },
  auction: { label: 'Licytacja', icon: <Trophy className="w-4 h-4" />, color: 'text-orange-400' },
};

const statusLabels: Record<ChallengeStatus, { label: string; variant: 'default' | 'warning' | 'success' | 'turbo' }> = {
  pending: { label: 'Wkrótce', variant: 'default' },
  active: { label: 'W trakcie', variant: 'turbo' },
  scoring: { label: 'Punktowanie', variant: 'warning' },
  completed: { label: 'Zakończone', variant: 'success' },
};

export default function ChallengesPage() {
  const { challenges, loading } = useChallenges();
  const { teams } = useTeams();
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [results, setResults] = useState<ChallengeLeaderboardEntry[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);

  // Filter challenges by status
  const activeChallenges = challenges.filter(c => c.status === 'active' || c.status === 'scoring');
  const completedChallenges = challenges.filter(c => c.status === 'completed');
  const upcomingChallenges = challenges.filter(c => c.status === 'pending');

  // Fetch results when challenge is selected
  useEffect(() => {
    if (!selectedChallenge) {
      setResults([]);
      return;
    }

    const fetchResults = async () => {
      setLoadingResults(true);
      const { data } = await supabase
        .from('challenge_leaderboard')
        .select('*')
        .eq('challenge_id', selectedChallenge.id)
        .order('placement', { ascending: true, nullsFirst: false })
        .order('time_ms', { ascending: true, nullsFirst: false });
      setResults(data || []);
      setLoadingResults(false);
    };

    fetchResults();
  }, [selectedChallenge]);

  const getMedalColor = (place: number) => {
    switch (place) {
      case 1: return 'text-yellow-500';
      case 2: return 'text-gray-400';
      case 3: return 'text-amber-700';
      default: return 'text-dark-400';
    }
  };

  const getMedalBg = (place: number) => {
    switch (place) {
      case 1: return 'bg-yellow-500 text-black';
      case 2: return 'bg-gray-400 text-black';
      case 3: return 'bg-amber-700 text-white';
      default: return 'bg-dark-700 text-dark-300';
    }
  };

  if (loading) {
    return (
      <div className="py-4 space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="h-24 animate-pulse bg-dark-700" />
        ))}
      </div>
    );
  }

  // Detail view
  if (selectedChallenge) {
    return (
      <div className="py-4">
        {/* Back button */}
        <button
          onClick={() => setSelectedChallenge(null)}
          className="flex items-center gap-2 text-dark-400 hover:text-white mb-4 transition-colors"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Wróć do listy
        </button>

        {/* Challenge header */}
        <Card className="mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-3 rounded-xl bg-dark-700 ${challengeTypeLabels[selectedChallenge.type].color}`}>
              {challengeTypeLabels[selectedChallenge.type].icon}
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">{selectedChallenge.title}</h1>
              <p className="text-sm text-dark-400">{challengeTypeLabels[selectedChallenge.type].label}</p>
            </div>
            <Badge variant={statusLabels[selectedChallenge.status].variant}>
              {statusLabels[selectedChallenge.status].label}
            </Badge>
          </div>
          {selectedChallenge.description && (
            <p className="text-dark-300">{selectedChallenge.description}</p>
          )}
        </Card>

        {/* Points distribution */}
        <Card className="mb-4">
          <h3 className="font-medium text-white mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-turbo-400" />
            Punktacja
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(selectedChallenge.points_distribution).map(([place, points]) => (
              <div key={place} className="flex items-center gap-2 bg-dark-700 rounded-lg px-3 py-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${getMedalBg(parseInt(place))}`}>
                  {place}
                </span>
                <span className="text-turbo-400 font-medium">{points} pkt</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Results */}
        <Card>
          <h3 className="font-medium text-white mb-3 flex items-center gap-2">
            <Medal className="w-4 h-4 text-yellow-500" />
            Wyniki
          </h3>

          {loadingResults ? (
            <div className="text-center py-8 text-dark-400">Ładowanie wyników...</div>
          ) : results.length === 0 ? (
            <div className="text-center py-8 text-dark-400">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Brak wyników</p>
              <p className="text-sm">Wyniki pojawią się po zakończeniu zadania</p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((result) => (
                <div
                  key={result.id}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    result.placement && result.placement <= 3 ? 'bg-dark-700' : 'bg-dark-800/50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${getMedalBg(result.placement || 99)}`}>
                    {result.placement || '-'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{result.team_emoji}</span>
                      <span className="font-medium text-white truncate">{result.team_name}</span>
                    </div>
                    {result.user_nick && (
                      <span className="text-sm text-dark-400">{result.user_nick}</span>
                    )}
                  </div>
                  <div className="text-right">
                    {result.time_ms && (
                      <div className="text-white font-mono">{formatTime(result.time_ms)}</div>
                    )}
                    {result.points_awarded > 0 && (
                      <div className="text-turbo-400 font-bold">+{result.points_awarded} pkt</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  const activityTabs = [
    { href: '/missions', label: 'Misje', icon: Target, color: 'text-turbo-500', bgActive: 'bg-turbo-500/20' },
    { href: '/races', label: 'Wyścigi', icon: Flame, color: 'text-green-500', bgActive: 'bg-green-500/20' },
    { href: '/challenges', label: 'Zadania', icon: Trophy, color: 'text-yellow-500', bgActive: 'bg-yellow-500/20' },
    { href: '/auctions', label: 'Licytacje', icon: Gavel, color: 'text-orange-500', bgActive: 'bg-orange-500/20' },
  ];

  // List view
  return (
    <div className="py-4">
      {/* Activity Navigation Tabs */}
      <div className="flex gap-2 mb-4 -mx-4 px-4 overflow-x-auto pb-2">
        {activityTabs.map(tab => {
          const isActive = tab.href === '/challenges';
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                isActive
                  ? `${tab.bgActive} ${tab.color} border border-current`
                  : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
          <Trophy className="w-6 h-6 text-yellow-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Zadania</h1>
          <p className="text-sm text-dark-400">Wyzwania eventowe</p>
        </div>
      </div>

      {/* Active challenges */}
      {activeChallenges.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-dark-400 mb-3 flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            AKTYWNE ({activeChallenges.length})
          </h2>
          <div className="space-y-3">
            {activeChallenges.map(challenge => (
              <Card
                key={challenge.id}
                hover
                onClick={() => setSelectedChallenge(challenge)}
                className="border-turbo-500/30"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-dark-700 ${challengeTypeLabels[challenge.type].color}`}>
                    {challengeTypeLabels[challenge.type].icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{challenge.title}</p>
                    <p className="text-sm text-dark-400">{challengeTypeLabels[challenge.type].label}</p>
                  </div>
                  <Badge variant={statusLabels[challenge.status].variant}>
                    {statusLabels[challenge.status].label}
                  </Badge>
                  <ChevronRight className="w-5 h-5 text-dark-400" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming challenges */}
      {upcomingChallenges.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-dark-400 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            NADCHODZĄCE ({upcomingChallenges.length})
          </h2>
          <div className="space-y-3">
            {upcomingChallenges.map(challenge => (
              <Card
                key={challenge.id}
                hover
                onClick={() => setSelectedChallenge(challenge)}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-dark-700 ${challengeTypeLabels[challenge.type].color}`}>
                    {challengeTypeLabels[challenge.type].icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{challenge.title}</p>
                    <p className="text-sm text-dark-400">{challengeTypeLabels[challenge.type].label}</p>
                  </div>
                  <Badge variant="default">Wkrótce</Badge>
                  <ChevronRight className="w-5 h-5 text-dark-400" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Completed challenges */}
      {completedChallenges.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-dark-400 mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-green-500" />
            ZAKOŃCZONE ({completedChallenges.length})
          </h2>
          <div className="space-y-3">
            {completedChallenges.map(challenge => (
              <Card
                key={challenge.id}
                hover
                onClick={() => setSelectedChallenge(challenge)}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-dark-700 ${challengeTypeLabels[challenge.type].color}`}>
                    {challengeTypeLabels[challenge.type].icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{challenge.title}</p>
                    <p className="text-sm text-dark-400">{challengeTypeLabels[challenge.type].label}</p>
                  </div>
                  <Badge variant="success">Zakończone</Badge>
                  <ChevronRight className="w-5 h-5 text-dark-400" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {challenges.length === 0 && (
        <Card className="text-center py-12">
          <Trophy className="w-16 h-16 text-dark-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Brak zadań</h3>
          <p className="text-dark-400">Zadania pojawią się tutaj gdy admin je doda</p>
        </Card>
      )}
    </div>
  );
}
