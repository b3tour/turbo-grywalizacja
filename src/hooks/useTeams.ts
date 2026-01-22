'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Team, TeamMember, TeamLeaderboardEntry } from '@/types';

interface UseTeamsOptions {
  realtime?: boolean;
}

// GLOBALNY CACHE - współdzielony między wszystkimi komponentami
const globalCache = {
  teams: null as Team[] | null,
  leaderboard: null as TeamLeaderboardEntry[] | null,
  lastFetch: 0,
  isFetching: false,
  CACHE_TTL: 30000, // 30 sekund
};

export function useTeams(options: UseTeamsOptions = {}) {
  const { realtime = true } = options;

  const [teams, setTeams] = useState<Team[]>(globalCache.teams || []);
  const [leaderboard, setLeaderboard] = useState<TeamLeaderboardEntry[]>(globalCache.leaderboard || []);
  const [loading, setLoading] = useState(!globalCache.teams);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // Główna funkcja pobierająca WSZYSTKIE dane na raz
  const fetchAllTeamData = useCallback(async (force = false) => {
    const now = Date.now();

    // Użyj cache jeśli świeży
    if (!force && globalCache.teams && (now - globalCache.lastFetch) < globalCache.CACHE_TTL) {
      if (mountedRef.current) {
        setTeams(globalCache.teams);
        setLeaderboard(globalCache.leaderboard || []);
        setLoading(false);
      }
      return;
    }

    // Zapobiegaj równoległym zapytaniom
    if (globalCache.isFetching) {
      // Czekaj na zakończenie innego fetch
      await new Promise(resolve => setTimeout(resolve, 100));
      if (globalCache.teams && mountedRef.current) {
        setTeams(globalCache.teams);
        setLeaderboard(globalCache.leaderboard || []);
        setLoading(false);
      }
      return;
    }

    globalCache.isFetching = true;

    try {
      // 1. Pobierz drużyny
      const { data: teamsData, error: teamsError } = await supabase
        .from('team_leaderboard')
        .select('*')
        .order('total_xp', { ascending: false });

      if (teamsError) throw teamsError;

      // 2. Pobierz WSZYSTKICH użytkowników z drużyn w JEDNYM zapytaniu
      const teamIds = (teamsData || []).map(t => t.id);

      let allMembers: { id: string; nick: string; avatar_url: string | null; total_xp: number; level: number; team_id: string }[] = [];

      if (teamIds.length > 0) {
        const { data: membersData } = await supabase
          .from('users')
          .select('id, nick, avatar_url, total_xp, level, team_id')
          .in('team_id', teamIds)
          .order('total_xp', { ascending: false });

        allMembers = membersData || [];
      }

      // 3. Zbuduj leaderboard z już pobranych danych
      const leaderboardData: TeamLeaderboardEntry[] = (teamsData || []).map((team, index) => {
        const teamMembers = allMembers
          .filter(m => m.team_id === team.id)
          .slice(0, 3) // top 3
          .map(m => ({
            id: m.id,
            nick: m.nick,
            avatar_url: m.avatar_url || undefined,
            total_xp: m.total_xp,
            level: m.level,
          }));

        return {
          rank: index + 1,
          team: team,
          top_contributors: teamMembers,
        };
      });

      // Zapisz do cache
      globalCache.teams = teamsData || [];
      globalCache.leaderboard = leaderboardData;
      globalCache.lastFetch = Date.now();

      if (mountedRef.current) {
        setTeams(teamsData || []);
        setLeaderboard(leaderboardData);
        setError(null);
      }
    } catch (e: any) {
      console.error('Error fetching team data:', e);
      if (mountedRef.current) {
        setError(e.message);
      }
    } finally {
      globalCache.isFetching = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Pobierz drużynę po ID - z cache
  const getTeam = useCallback((teamId: string): Team | null => {
    if (globalCache.teams) {
      return globalCache.teams.find(t => t.id === teamId) || null;
    }
    return teams.find(t => t.id === teamId) || null;
  }, [teams]);

  // Pobierz pozycję drużyny - z cache
  const getTeamRank = useCallback((teamId: string): number | null => {
    const teamsToUse = globalCache.teams || teams;
    const index = teamsToUse.findIndex(t => t.id === teamId);
    return index >= 0 ? index + 1 : null;
  }, [teams]);

  // Pobierz leaderboard - z cache
  const getTeamLeaderboard = useCallback((): TeamLeaderboardEntry[] => {
    return globalCache.leaderboard || leaderboard;
  }, [leaderboard]);

  // Pobierz członków drużyny - osobne zapytanie (używane rzadko)
  const getTeamMembers = useCallback(async (teamId: string): Promise<TeamMember[]> => {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, nick, avatar_url, total_xp, level')
      .eq('team_id', teamId)
      .order('total_xp', { ascending: false });

    if (usersError || !users) return [];

    const userIds = users.map(u => u.id);
    const { data: submissions } = await supabase
      .from('submissions')
      .select('user_id')
      .eq('status', 'approved')
      .in('user_id', userIds);

    const missionCounts: Record<string, number> = {};
    submissions?.forEach(s => {
      missionCounts[s.user_id] = (missionCounts[s.user_id] || 0) + 1;
    });

    return users.map(user => ({
      id: user.id,
      nick: user.nick,
      avatar_url: user.avatar_url,
      total_xp: user.total_xp,
      level: user.level,
      missions_completed: missionCounts[user.id] || 0,
    }));
  }, []);

  // Przypisz użytkownika do drużyny (admin)
  const assignUserToTeam = useCallback(async (userId: string, teamId: string): Promise<boolean> => {
    const { error: updateError } = await supabase.rpc('assign_user_to_team', {
      p_user_id: userId,
      p_team_id: teamId,
    });

    if (updateError) {
      console.error('Błąd przypisywania do drużyny:', updateError);
      return false;
    }

    await fetchAllTeamData(true);
    return true;
  }, [fetchAllTeamData]);

  // Usuń użytkownika z drużyny
  const removeUserFromTeam = useCallback(async (userId: string): Promise<boolean> => {
    const { error: updateError } = await supabase
      .from('users')
      .update({ team_id: null })
      .eq('id', userId);

    if (updateError) {
      console.error('Błąd usuwania z drużyny:', updateError);
      return false;
    }

    await fetchAllTeamData(true);
    return true;
  }, [fetchAllTeamData]);

  // Pobierz użytkowników bez drużyny
  const getUnassignedUsers = useCallback(async (): Promise<TeamMember[]> => {
    const { data, error: fetchError } = await supabase
      .from('users')
      .select('id, nick, avatar_url, total_xp, level')
      .is('team_id', null)
      .order('nick');

    if (fetchError || !data) return [];

    return data.map(user => ({
      id: user.id,
      nick: user.nick,
      avatar_url: user.avatar_url,
      total_xp: user.total_xp,
      level: user.level,
      missions_completed: 0,
    }));
  }, []);

  // Inicjalizacja i real-time
  useEffect(() => {
    mountedRef.current = true;
    fetchAllTeamData();

    if (!realtime) return;

    let debounceTimer: NodeJS.Timeout | null = null;

    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchAllTeamData(true);
      }, 1000);
    };

    const subscription = supabase
      .channel('teams-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, debouncedFetch)
      .subscribe();

    return () => {
      mountedRef.current = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      subscription.unsubscribe();
    };
  }, [fetchAllTeamData, realtime]);

  return {
    teams,
    leaderboard,
    loading,
    error,
    refetch: () => fetchAllTeamData(true),
    getTeam,
    getTeamMembers,
    getTeamLeaderboard,
    getTeamRank,
    assignUserToTeam,
    removeUserFromTeam,
    getUnassignedUsers,
  };
}
