'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Challenge,
  ChallengeResult,
  ChallengeLeaderboardEntry,
  CreateChallengeInput,
  AddChallengeResultInput,
  ChallengeStatus,
} from '@/types';

interface UseChallengesReturn {
  challenges: Challenge[];
  loading: boolean;
  error: string | null;
  // CRUD
  createChallenge: (input: CreateChallengeInput) => Promise<{ success: boolean; error: string | null }>;
  updateChallenge: (id: string, updates: Partial<Challenge>) => Promise<{ success: boolean; error: string | null }>;
  deleteChallenge: (id: string) => Promise<{ success: boolean; error: string | null }>;
  // Status
  setStatus: (id: string, status: ChallengeStatus) => Promise<{ success: boolean; error: string | null }>;
  // Wyniki
  addResult: (input: AddChallengeResultInput) => Promise<{ success: boolean; error: string | null }>;
  updateResult: (id: string, updates: Partial<ChallengeResult>) => Promise<{ success: boolean; error: string | null }>;
  deleteResult: (id: string) => Promise<{ success: boolean; error: string | null }>;
  getResults: (challengeId: string) => Promise<ChallengeLeaderboardEntry[]>;
  // Obliczenia
  calculatePlacements: (challengeId: string) => Promise<{ success: boolean; error: string | null }>;
  awardPoints: (challengeId: string) => Promise<{ success: boolean; error: string | null }>;
  // Odswiezanie
  refresh: () => Promise<void>;
}

export function useChallenges(): UseChallengesReturn {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pobierz wszystkie zadania
  const fetchChallenges = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('challenges')
        .select('*')
        .order('order_index', { ascending: true });

      if (fetchError) throw fetchError;
      setChallenges(data || []);
      setError(null);
    } catch (e) {
      console.error('Error fetching challenges:', e);
      setError('Nie udało się pobrać zadań');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  // Utworz nowe zadanie
  const createChallenge = async (input: CreateChallengeInput) => {
    try {
      const { error: insertError } = await supabase
        .from('challenges')
        .insert({
          ...input,
          points_distribution: input.points_distribution || { '1': 100, '2': 75, '3': 50, '4': 25, '5': 10 },
        });

      if (insertError) throw insertError;
      await fetchChallenges();
      return { success: true, error: null };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Błąd tworzenia zadania';
      return { success: false, error: message };
    }
  };

  // Aktualizuj zadanie
  const updateChallenge = async (id: string, updates: Partial<Challenge>) => {
    try {
      const { error: updateError } = await supabase
        .from('challenges')
        .update(updates)
        .eq('id', id);

      if (updateError) throw updateError;
      await fetchChallenges();
      return { success: true, error: null };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Błąd aktualizacji zadania';
      return { success: false, error: message };
    }
  };

  // Usun zadanie
  const deleteChallenge = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('challenges')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      await fetchChallenges();
      return { success: true, error: null };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Błąd usuwania zadania';
      return { success: false, error: message };
    }
  };

  // Zmien status zadania
  const setStatus = async (id: string, status: ChallengeStatus) => {
    return updateChallenge(id, { status });
  };

  // Dodaj wynik
  const addResult = async (input: AddChallengeResultInput) => {
    try {
      const { error: insertError } = await supabase
        .from('challenge_results')
        .insert(input);

      if (insertError) throw insertError;
      return { success: true, error: null };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Błąd dodawania wyniku';
      return { success: false, error: message };
    }
  };

  // Aktualizuj wynik
  const updateResult = async (id: string, updates: Partial<ChallengeResult>) => {
    try {
      const { error: updateError } = await supabase
        .from('challenge_results')
        .update(updates)
        .eq('id', id);

      if (updateError) throw updateError;
      return { success: true, error: null };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Błąd aktualizacji wyniku';
      return { success: false, error: message };
    }
  };

  // Usun wynik
  const deleteResult = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('challenge_results')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      return { success: true, error: null };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Błąd usuwania wyniku';
      return { success: false, error: message };
    }
  };

  // Pobierz wyniki zadania
  const getResults = async (challengeId: string): Promise<ChallengeLeaderboardEntry[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('challenge_leaderboard')
        .select('*')
        .eq('challenge_id', challengeId)
        .order('placement', { ascending: true, nullsFirst: false })
        .order('time_ms', { ascending: true, nullsFirst: false });

      if (fetchError) throw fetchError;
      return data || [];
    } catch (e) {
      console.error('Error fetching results:', e);
      return [];
    }
  };

  // Oblicz miejsca i punkty
  const calculatePlacements = async (challengeId: string) => {
    try {
      const { error: rpcError } = await supabase
        .rpc('calculate_challenge_placements', { p_challenge_id: challengeId });

      if (rpcError) throw rpcError;
      return { success: true, error: null };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Błąd obliczania miejsc';
      return { success: false, error: message };
    }
  };

  // Przyznaj punkty druzynom
  const awardPoints = async (challengeId: string) => {
    try {
      const { error: rpcError } = await supabase
        .rpc('award_challenge_points', { p_challenge_id: challengeId });

      if (rpcError) throw rpcError;
      await fetchChallenges();
      return { success: true, error: null };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Błąd przyznawania punktów';
      return { success: false, error: message };
    }
  };

  return {
    challenges,
    loading,
    error,
    createChallenge,
    updateChallenge,
    deleteChallenge,
    setStatus,
    addResult,
    updateResult,
    deleteResult,
    getResults,
    calculatePlacements,
    awardPoints,
    refresh: fetchChallenges,
  };
}

// Hook do pojedynczego zadania
export function useChallenge(challengeId: string | null) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [results, setResults] = useState<ChallengeLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChallenge = useCallback(async () => {
    if (!challengeId) {
      setChallenge(null);
      setResults([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Pobierz zadanie
      const { data: challengeData, error: challengeError } = await supabase
        .from('challenges')
        .select('*')
        .eq('id', challengeId)
        .single();

      if (challengeError) throw challengeError;
      setChallenge(challengeData);

      // Pobierz wyniki
      const { data: resultsData, error: resultsError } = await supabase
        .from('challenge_leaderboard')
        .select('*')
        .eq('challenge_id', challengeId)
        .order('placement', { ascending: true, nullsFirst: false })
        .order('time_ms', { ascending: true, nullsFirst: false });

      if (resultsError) throw resultsError;
      setResults(resultsData || []);

      setError(null);
    } catch (e) {
      console.error('Error fetching challenge:', e);
      setError('Nie udało się pobrać zadania');
    } finally {
      setLoading(false);
    }
  }, [challengeId]);

  useEffect(() => {
    fetchChallenge();
  }, [fetchChallenge]);

  return {
    challenge,
    results,
    loading,
    error,
    refresh: fetchChallenge,
  };
}
