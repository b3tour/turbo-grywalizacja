'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { LeaderboardEntry } from '@/types';
import { LEVELS } from '@/lib/utils';

interface UseLeaderboardOptions {
  limit?: number;
  realtime?: boolean;
}

export function useLeaderboard(options: UseLeaderboardOptions = {}) {
  const { limit = 100, realtime = true } = options;

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalParticipants, setTotalParticipants] = useState(0);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Pobierz użytkowników z ich XP
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, nick, avatar_url, total_xp, level')
      .order('total_xp', { ascending: false })
      .limit(limit);

    if (usersError) {
      setError(usersError.message);
      setLoading(false);
      return;
    }

    // Pobierz liczbę ukończonych misji dla każdego użytkownika
    const userIds = users?.map(u => u.id) || [];

    const { data: submissions } = await supabase
      .from('submissions')
      .select('user_id')
      .eq('status', 'approved')
      .in('user_id', userIds);

    // Zlicz misje na użytkownika
    const missionCounts: Record<string, number> = {};
    submissions?.forEach(s => {
      missionCounts[s.user_id] = (missionCounts[s.user_id] || 0) + 1;
    });

    // Zbuduj leaderboard
    const leaderboardData: LeaderboardEntry[] = (users || []).map((user, index) => {
      const level = LEVELS.find(l => l.id === user.level) || LEVELS[0];
      return {
        rank: index + 1,
        user_id: user.id,
        nick: user.nick,
        avatar_url: user.avatar_url,
        total_xp: user.total_xp,
        level: user.level,
        level_name: level.name,
        missions_completed: missionCounts[user.id] || 0,
      };
    });

    setLeaderboard(leaderboardData);

    // Pobierz całkowitą liczbę uczestników
    const { count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    setTotalParticipants(count || 0);
    setLoading(false);
  }, [limit]);

  // Pobierz pozycję konkretnego użytkownika
  const getUserRank = useCallback(async (userId: string): Promise<number | null> => {
    const { data, error: rankError } = await supabase
      .from('users')
      .select('id')
      .order('total_xp', { ascending: false });

    if (rankError || !data) return null;

    const index = data.findIndex(u => u.id === userId);
    return index >= 0 ? index + 1 : null;
  }, []);

  // Pobierz ranking z okolic użytkownika (+/- 5 pozycji)
  const getUserNeighbors = useCallback(async (userId: string, range: number = 5): Promise<LeaderboardEntry[]> => {
    const rank = await getUserRank(userId);
    if (!rank) return [];

    const startRank = Math.max(1, rank - range);

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, nick, avatar_url, total_xp, level')
      .order('total_xp', { ascending: false })
      .range(startRank - 1, startRank + range * 2 - 1);

    if (usersError || !users) return [];

    return users.map((user, index) => {
      const level = LEVELS.find(l => l.id === user.level) || LEVELS[0];
      return {
        rank: startRank + index,
        user_id: user.id,
        nick: user.nick,
        avatar_url: user.avatar_url,
        total_xp: user.total_xp,
        level: user.level,
        level_name: level.name,
        missions_completed: 0, // Można dodać później
      };
    });
  }, [getUserRank]);

  // Setup real-time subscription
  useEffect(() => {
    fetchLeaderboard();

    if (!realtime) return;

    // Nasłuchuj zmian w tabeli users (update XP)
    const subscription = supabase
      .channel('leaderboard-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
        },
        () => {
          // Odśwież leaderboard gdy zmieni się XP użytkownika
          fetchLeaderboard();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'users',
        },
        () => {
          // Odśwież gdy dojdzie nowy użytkownik
          fetchLeaderboard();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchLeaderboard, realtime]);

  // Statystyki ogólne
  const getStats = useCallback(() => {
    if (leaderboard.length === 0) {
      return {
        totalXP: 0,
        avgXP: 0,
        topScore: 0,
        totalMissions: 0,
      };
    }

    const totalXP = leaderboard.reduce((sum, entry) => sum + entry.total_xp, 0);
    const totalMissions = leaderboard.reduce((sum, entry) => sum + entry.missions_completed, 0);

    return {
      totalXP,
      avgXP: Math.round(totalXP / leaderboard.length),
      topScore: leaderboard[0]?.total_xp || 0,
      totalMissions,
    };
  }, [leaderboard]);

  // Ranking speedrun dla konkretnego quizu
  interface SpeedrunEntry {
    rank: number;
    user_id: string;
    nick: string;
    avatar_url?: string;
    time_ms: number;
    created_at: string;
  }

  const getSpeedrunLeaderboard = useCallback(async (missionId: string, topN: number = 10): Promise<SpeedrunEntry[]> => {
    // Pobierz submissions dla tego quizu gdzie quiz_time_ms nie jest null (tylko speedrun z 100%)
    const { data, error: fetchError } = await supabase
      .from('submissions')
      .select('user_id, quiz_time_ms, created_at, user:users!submissions_user_id_fkey(nick, avatar_url)')
      .eq('mission_id', missionId)
      .eq('status', 'approved')
      .not('quiz_time_ms', 'is', null)
      .order('quiz_time_ms', { ascending: true })
      .limit(topN);

    if (fetchError || !data) return [];

    return data.map((entry, index) => {
      // Supabase zwraca relację jako obiekt lub null
      const userInfo = entry.user as unknown as { nick: string; avatar_url?: string } | null;
      return {
        rank: index + 1,
        user_id: entry.user_id,
        nick: userInfo?.nick || 'Nieznany',
        avatar_url: userInfo?.avatar_url,
        time_ms: entry.quiz_time_ms!,
        created_at: entry.created_at,
      };
    });
  }, []);

  // Pobierz pozycję użytkownika w rankingu speedrun
  const getUserSpeedrunRank = useCallback(async (missionId: string, userId: string): Promise<{ rank: number; time_ms: number } | null> => {
    // Pobierz wszystkie wyniki dla tego quizu
    const { data, error: fetchError } = await supabase
      .from('submissions')
      .select('user_id, quiz_time_ms')
      .eq('mission_id', missionId)
      .eq('status', 'approved')
      .not('quiz_time_ms', 'is', null)
      .order('quiz_time_ms', { ascending: true });

    if (fetchError || !data) return null;

    const userEntry = data.find(e => e.user_id === userId);
    if (!userEntry) return null;

    const rank = data.findIndex(e => e.user_id === userId) + 1;
    return { rank, time_ms: userEntry.quiz_time_ms! };
  }, []);

  return {
    leaderboard,
    loading,
    error,
    totalParticipants,
    refetch: fetchLeaderboard,
    getUserRank,
    getUserNeighbors,
    getStats,
    getSpeedrunLeaderboard,
    getUserSpeedrunRank,
  };
}
