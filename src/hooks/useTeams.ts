'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Team, TeamMember, TeamLeaderboardEntry } from '@/types';
import { LEVELS } from '@/lib/utils';

interface UseTeamsOptions {
  realtime?: boolean;
}

export function useTeams(options: UseTeamsOptions = {}) {
  const { realtime = true } = options;

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isInitialLoad = useRef(true);
  const isFetching = useRef(false);

  // Pobierz wszystkie druzyny
  const fetchTeams = useCallback(async (showLoading = false) => {
    // Zapobiegaj równoległym zapytaniom
    if (isFetching.current) return;
    isFetching.current = true;

    // Tylko przy pierwszym ładowaniu pokazuj loading
    if (showLoading || isInitialLoad.current) {
      setLoading(true);
    }
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('team_leaderboard')
      .select('*')
      .order('total_xp', { ascending: false });

    isFetching.current = false;

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      isInitialLoad.current = false;
      return;
    }

    setTeams(data || []);
    setLoading(false);
    isInitialLoad.current = false;
  }, []);

  // Pobierz szczegoly druzyny po ID
  const getTeam = useCallback(async (teamId: string): Promise<Team | null> => {
    const { data, error: fetchError } = await supabase
      .from('team_leaderboard')
      .select('*')
      .eq('id', teamId)
      .single();

    if (fetchError || !data) return null;
    return data;
  }, []);

  // Pobierz czlonkow druzyny
  const getTeamMembers = useCallback(async (teamId: string): Promise<TeamMember[]> => {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, nick, avatar_url, total_xp, level')
      .eq('team_id', teamId)
      .order('total_xp', { ascending: false });

    if (usersError || !users) return [];

    // Pobierz liczbe ukonczonych misji dla kazdego czlonka
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

  // Pobierz ranking druzynowy z top 3 contributorami
  const getTeamLeaderboard = useCallback(async (): Promise<TeamLeaderboardEntry[]> => {
    const { data: teamsData, error: teamsError } = await supabase
      .from('team_leaderboard')
      .select('*')
      .order('total_xp', { ascending: false });

    if (teamsError || !teamsData) return [];

    // Dla kazdej druzyny pobierz top 3 czlonkow
    const leaderboard: TeamLeaderboardEntry[] = await Promise.all(
      teamsData.map(async (team, index) => {
        const { data: topMembers } = await supabase
          .from('users')
          .select('id, nick, avatar_url, total_xp, level')
          .eq('team_id', team.id)
          .order('total_xp', { ascending: false })
          .limit(3);

        return {
          rank: index + 1,
          team: team,
          top_contributors: (topMembers || []).map(m => ({
            id: m.id,
            nick: m.nick,
            avatar_url: m.avatar_url,
            total_xp: m.total_xp,
            level: m.level,
          })),
        };
      })
    );

    return leaderboard;
  }, []);

  // Pobierz pozycje druzyny
  const getTeamRank = useCallback(async (teamId: string): Promise<number | null> => {
    const { data, error: fetchError } = await supabase
      .from('team_leaderboard')
      .select('id')
      .order('total_xp', { ascending: false });

    if (fetchError || !data) return null;

    const index = data.findIndex(t => t.id === teamId);
    return index >= 0 ? index + 1 : null;
  }, []);

  // Przypisz uzytkownika do druzyny (tylko admin)
  const assignUserToTeam = useCallback(async (userId: string, teamId: string): Promise<boolean> => {
    const { error: updateError } = await supabase.rpc('assign_user_to_team', {
      p_user_id: userId,
      p_team_id: teamId,
    });

    if (updateError) {
      console.error('Blad przypisywania do druzyny:', updateError);
      return false;
    }

    // Odswiez liste druzyn
    await fetchTeams();
    return true;
  }, [fetchTeams]);

  // Usun uzytkownika z druzyny (ustaw team_id na null)
  const removeUserFromTeam = useCallback(async (userId: string): Promise<boolean> => {
    const { error: updateError } = await supabase
      .from('users')
      .update({ team_id: null })
      .eq('id', userId);

    if (updateError) {
      console.error('Blad usuwania z druzyny:', updateError);
      return false;
    }

    await fetchTeams();
    return true;
  }, [fetchTeams]);

  // Pobierz uzytkownikow bez druzyny
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

  // Real-time subscription
  useEffect(() => {
    fetchTeams(true); // Przy pierwszym ładowaniu pokaż loading

    if (!realtime) return;

    // Debounce dla real-time updates - zapobiega wielu szybkim odświeżeniom
    let debounceTimer: NodeJS.Timeout | null = null;

    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchTeams(false); // Real-time update bez loading state
      }, 500); // Czekaj 500ms przed odświeżeniem
    };

    const subscription = supabase
      .channel('teams-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'teams',
        },
        () => {
          debouncedFetch();
        }
      )
      .subscribe();

    // NIE subskrybujemy do users - za dużo eventów
    // Dane drużyn będą odświeżane tylko gdy zmieni się sama drużyna

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      subscription.unsubscribe();
    };
  }, [fetchTeams, realtime]);

  return {
    teams,
    loading,
    error,
    refetch: fetchTeams,
    getTeam,
    getTeamMembers,
    getTeamLeaderboard,
    getTeamRank,
    assignUserToTeam,
    removeUserFromTeam,
    getUnassignedUsers,
  };
}
