'use client';

import { useEffect, useState, useCallback } from 'react';
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

  // Pobierz wszystkie druzyny
  const fetchTeams = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('team_leaderboard')
      .select('*')
      .order('total_xp', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setTeams(data || []);
    setLoading(false);
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
    fetchTeams();

    if (!realtime) return;

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
          fetchTeams();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
        },
        () => {
          // Odswiez gdy zmieni sie team_id lub XP uzytkownika
          fetchTeams();
        }
      )
      .subscribe();

    return () => {
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
