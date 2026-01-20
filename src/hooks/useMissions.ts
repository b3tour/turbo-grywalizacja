'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Mission, Submission, MissionType } from '@/types';

interface UseMissionsOptions {
  type?: MissionType;
  activeOnly?: boolean;
  userId?: string;
}

export function useMissions(options: UseMissionsOptions = {}) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [userSubmissions, setUserSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMissions = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('missions')
      .select('*')
      .order('created_at', { ascending: false });

    if (options.type) {
      query = query.eq('type', options.type);
    }

    if (options.activeOnly !== false) {
      query = query.eq('status', 'active');
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
      setMissions([]);
    } else {
      setMissions(data as Mission[]);
    }

    setLoading(false);
  }, [options.type, options.activeOnly]);

  const fetchUserSubmissions = useCallback(async () => {
    if (!options.userId) return;

    const { data, error: fetchError } = await supabase
      .from('submissions')
      .select('*, mission:missions(*)')
      .eq('user_id', options.userId)
      .order('created_at', { ascending: false });

    if (!fetchError && data) {
      setUserSubmissions(data as Submission[]);
    }
  }, [options.userId]);

  useEffect(() => {
    fetchMissions();
    fetchUserSubmissions();
  }, [fetchMissions, fetchUserSubmissions]);

  // Sprawdź czy użytkownik może wykonać misję
  const canCompleteMission = (mission: Mission): { canComplete: boolean; reason?: string } => {
    // Sprawdź czy misja jest aktywna
    if (mission.status !== 'active') {
      return { canComplete: false, reason: 'Misja nie jest aktywna' };
    }

    // Sprawdź daty
    if (mission.start_date && new Date(mission.start_date) > new Date()) {
      return { canComplete: false, reason: 'Misja jeszcze się nie rozpoczęła' };
    }

    if (mission.end_date && new Date(mission.end_date) < new Date()) {
      return { canComplete: false, reason: 'Misja się zakończyła' };
    }

    // Quiz - jednorazowy, nie można powtarzać (nawet po oblaniu)
    if (mission.type === 'quiz') {
      const anyQuizAttempt = userSubmissions.find(
        s => s.mission_id === mission.id
      );
      if (anyQuizAttempt) {
        if (anyQuizAttempt.status === 'approved') {
          return { canComplete: false, reason: 'Quiz już zaliczony' };
        }
        if (anyQuizAttempt.status === 'rejected') {
          return { canComplete: false, reason: 'Quiz już rozwiązany (niezaliczony)' };
        }
        if (anyQuizAttempt.status === 'pending') {
          return { canComplete: false, reason: 'Quiz oczekuje na weryfikację' };
        }
      }
    }

    // Sprawdź czy użytkownik już wykonał
    const userCompletions = userSubmissions.filter(
      s => s.mission_id === mission.id && s.status === 'approved'
    ).length;

    if (mission.max_completions && userCompletions >= mission.max_completions) {
      return { canComplete: false, reason: 'Osiągnięto limit wykonań' };
    }

    // Sprawdź czy jest pending submission
    const pendingSubmission = userSubmissions.find(
      s => s.mission_id === mission.id && s.status === 'pending'
    );

    if (pendingSubmission) {
      return { canComplete: false, reason: 'Oczekujesz na weryfikację' };
    }

    return { canComplete: true };
  };

  // Wykonaj misję QR
  const completeMissionQR = async (
    missionId: string,
    scannedCode: string,
    userId: string
  ): Promise<{ success: boolean; xp?: number; error?: string }> => {
    const mission = missions.find(m => m.id === missionId);

    if (!mission) {
      return { success: false, error: 'Nie znaleziono misji' };
    }

    if (mission.qr_code_value !== scannedCode) {
      return { success: false, error: 'Nieprawidłowy kod QR' };
    }

    const { canComplete, reason } = canCompleteMission(mission);
    if (!canComplete) {
      return { success: false, error: reason };
    }

    const { data, error: submitError } = await supabase
      .from('submissions')
      .insert({
        user_id: userId,
        mission_id: missionId,
        status: 'approved', // QR automatycznie zatwierdzane
        xp_awarded: mission.xp_reward,
      })
      .select()
      .single();

    if (submitError) {
      return { success: false, error: submitError.message };
    }

    // Aktualizuj XP użytkownika
    await supabase.rpc('add_user_xp', {
      p_user_id: userId,
      p_xp_amount: mission.xp_reward
    });

    await fetchUserSubmissions();
    return { success: true, xp: mission.xp_reward };
  };

  // Wykonaj misję Photo
  const completeMissionPhoto = async (
    missionId: string,
    photoUrl: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const mission = missions.find(m => m.id === missionId);

    if (!mission) {
      return { success: false, error: 'Nie znaleziono misji' };
    }

    const { canComplete, reason } = canCompleteMission(mission);
    if (!canComplete) {
      return { success: false, error: reason };
    }

    const { error: submitError } = await supabase
      .from('submissions')
      .insert({
        user_id: userId,
        mission_id: missionId,
        status: 'pending', // Photo wymaga moderacji
        photo_url: photoUrl,
        xp_awarded: 0, // Zostanie ustawione po akceptacji
      });

    if (submitError) {
      return { success: false, error: submitError.message };
    }

    await fetchUserSubmissions();
    return { success: true };
  };

  // Wykonaj misję Quiz
  const completeMissionQuiz = async (
    missionId: string,
    answers: Record<string, string>,
    userId: string,
    timeMs?: number // czas ukończenia dla trybu speedrun
  ): Promise<{ success: boolean; score?: number; passed?: boolean; xp?: number; error?: string }> => {
    const mission = missions.find(m => m.id === missionId);

    if (!mission || !mission.quiz_data) {
      return { success: false, error: 'Nie znaleziono quizu' };
    }

    const { canComplete, reason } = canCompleteMission(mission);
    if (!canComplete) {
      return { success: false, error: reason };
    }

    // Oblicz wynik
    let correctAnswers = 0;
    const totalQuestions = mission.quiz_data.questions.length;

    for (const question of mission.quiz_data.questions) {
      const userAnswer = answers[question.id];
      const correctAnswer = question.answers.find(a => a.is_correct);

      if (userAnswer === correctAnswer?.id) {
        correctAnswers++;
      }
    }

    const score = Math.round((correctAnswers / totalQuestions) * 100);
    const passed = score >= mission.quiz_data.passing_score;
    const xpAwarded = passed ? mission.xp_reward : 0;

    // Dla speedrun zapisujemy czas tylko gdy wszystkie odpowiedzi są poprawne
    const isSpeedrun = mission.quiz_data.mode === 'speedrun';
    const allCorrect = correctAnswers === totalQuestions;
    const saveTime = isSpeedrun && allCorrect && timeMs ? timeMs : null;

    const { error: submitError } = await supabase
      .from('submissions')
      .insert({
        user_id: userId,
        mission_id: missionId,
        status: passed ? 'approved' : 'rejected',
        quiz_score: score,
        quiz_time_ms: saveTime,
        xp_awarded: xpAwarded,
      });

    if (submitError) {
      return { success: false, error: submitError.message };
    }

    // Dodaj XP jeśli zdał
    if (passed) {
      await supabase.rpc('add_user_xp', {
        p_user_id: userId,
        p_xp_amount: xpAwarded
      });
    }

    await fetchUserSubmissions();
    return { success: true, score, passed, xp: xpAwarded };
  };

  // Wykonaj misję GPS
  const completeMissionGPS = async (
    missionId: string,
    lat: number,
    lng: number,
    userId: string
  ): Promise<{ success: boolean; xp?: number; error?: string }> => {
    const mission = missions.find(m => m.id === missionId);

    if (!mission || !mission.location_lat || !mission.location_lng) {
      return { success: false, error: 'Nie znaleziono lokalizacji misji' };
    }

    const { canComplete, reason } = canCompleteMission(mission);
    if (!canComplete) {
      return { success: false, error: reason };
    }

    // Sprawdź odległość (używamy importowanej funkcji z utils)
    const { isWithinRadius } = await import('@/lib/utils');
    const isInRange = isWithinRadius(
      lat,
      lng,
      mission.location_lat,
      mission.location_lng,
      mission.location_radius || 50
    );

    if (!isInRange) {
      return { success: false, error: 'Nie jesteś wystarczająco blisko lokalizacji' };
    }

    const { error: submitError } = await supabase
      .from('submissions')
      .insert({
        user_id: userId,
        mission_id: missionId,
        status: 'approved',
        gps_lat: lat,
        gps_lng: lng,
        xp_awarded: mission.xp_reward,
      });

    if (submitError) {
      return { success: false, error: submitError.message };
    }

    // Dodaj XP
    await supabase.rpc('add_user_xp', {
      p_user_id: userId,
      p_xp_amount: mission.xp_reward
    });

    await fetchUserSubmissions();
    return { success: true, xp: mission.xp_reward };
  };

  // Pobierz statystyki misji
  const getMissionStats = (missionId: string) => {
    const submissions = userSubmissions.filter(s => s.mission_id === missionId);
    return {
      attempts: submissions.length,
      completed: submissions.filter(s => s.status === 'approved').length,
      pending: submissions.filter(s => s.status === 'pending').length,
      rejected: submissions.filter(s => s.status === 'rejected').length,
    };
  };

  return {
    missions,
    userSubmissions,
    loading,
    error,
    refetch: fetchMissions,
    canCompleteMission,
    completeMissionQR,
    completeMissionPhoto,
    completeMissionQuiz,
    completeMissionGPS,
    getMissionStats,
  };
}
