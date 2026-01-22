'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card, Button, Badge } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import { Mission, Submission, formatRaceTime } from '@/types';
import { uploadFile } from '@/lib/supabase';
import {
  Flag,
  Trophy,
  Clock,
  Camera,
  Send,
  CheckCircle,
  Timer,
  Medal,
  Users,
  ChevronRight,
  Target,
  Flame,
  Gavel,
} from 'lucide-react';
import Link from 'next/link';

interface RaceWithSubmission extends Mission {
  user_submission?: Submission | null;
  total_submissions?: number;
  leaderboard?: {
    placement: number;
    team_name: string;
    team_emoji: string;
    user_nick: string;
    race_time_ms: number;
    points: number;
  }[];
}

export default function RacesPage() {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const { profile } = useAuth();

  const [races, setRaces] = useState<RaceWithSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRace, setSelectedRace] = useState<RaceWithSubmission | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Fetch active races
  const fetchRaces = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    try {
      // Get all race missions that are active
      const { data: racesData, error: racesError } = await supabase
        .from('missions')
        .select('*')
        .eq('is_race', true)
        .eq('race_active', true)
        .order('race_started_at', { ascending: false });

      if (racesError) throw racesError;

      // For each race, get user's submission and leaderboard
      const racesWithData = await Promise.all(
        (racesData || []).map(async (race) => {
          // Get user's submission
          const { data: submission } = await supabase
            .from('submissions')
            .select('*')
            .eq('mission_id', race.id)
            .eq('user_id', profile.id)
            .maybeSingle();

          // Get approved submissions count
          const { count } = await supabase
            .from('submissions')
            .select('*', { count: 'exact', head: true })
            .eq('mission_id', race.id)
            .eq('status', 'approved');

          // Get leaderboard (top 5 approved)
          const { data: leaderboardData } = await supabase
            .from('submissions')
            .select(`
              placement,
              race_time_ms,
              xp_awarded,
              user:users(nick, team:teams(name, emoji))
            `)
            .eq('mission_id', race.id)
            .eq('status', 'approved')
            .not('placement', 'is', null)
            .order('placement', { ascending: true })
            .limit(5);

          const leaderboard = (leaderboardData || []).map((item: any) => ({
            placement: item.placement,
            team_name: item.user?.team?.name || 'Brak drużyny',
            team_emoji: item.user?.team?.emoji || '👤',
            user_nick: item.user?.nick || 'Nieznany',
            race_time_ms: item.race_time_ms || 0,
            points: item.xp_awarded || 0,
          }));

          return {
            ...race,
            user_submission: submission,
            total_submissions: count || 0,
            leaderboard,
          };
        })
      );

      setRaces(racesWithData);
    } catch (e) {
      console.error('Error fetching races:', e);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchRaces();

    // Refresh every 10 seconds
    const interval = setInterval(fetchRaces, 10000);
    return () => clearInterval(interval);
  }, [fetchRaces]);

  // Handle photo selection
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit race entry
  const handleSubmit = async () => {
    if (!selectedRace || !profile) return;

    if (selectedRace.type === 'photo' && !photoFile) {
      showError('Błąd', 'Musisz dodać zdjęcie');
      return;
    }

    setUploading(true);
    try {
      let photoUrl = null;

      // Upload photo if needed
      if (photoFile) {
        const fileName = `race_${selectedRace.id}_${profile.id}_${Date.now()}`;
        const { url, error: uploadError } = await uploadFile('mission-photos', fileName, photoFile);
        if (uploadError) throw new Error(uploadError);
        photoUrl = url;
      }

      // Create submission
      const { error: submitError } = await supabase
        .from('submissions')
        .insert({
          user_id: profile.id,
          mission_id: selectedRace.id,
          status: 'pending',
          photo_url: photoUrl,
        });

      if (submitError) throw submitError;

      success('Wysłano!', 'Twoje zgłoszenie czeka na zatwierdzenie');
      setSelectedRace(null);
      setPhotoFile(null);
      setPhotoPreview(null);
      fetchRaces();
    } catch (e: any) {
      console.error('Error submitting:', e);
      showError('Błąd', e.message || 'Nie udało się wysłać zgłoszenia');
    } finally {
      setUploading(false);
    }
  };

  // Get elapsed time since race started
  const getElapsedTime = (startedAt: string) => {
    const start = new Date(startedAt).getTime();
    const now = Date.now();
    return now - start;
  };

  // Medal colors
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

  if (!profile) return null;

  // Detail view
  if (selectedRace) {
    const hasSubmitted = !!selectedRace.user_submission;
    const submissionStatus = selectedRace.user_submission?.status;

    return (
      <div className="py-4">
        {/* Back button */}
        <button
          onClick={() => { setSelectedRace(null); setPhotoFile(null); setPhotoPreview(null); }}
          className="flex items-center gap-2 text-dark-400 hover:text-white mb-4 transition-colors"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Wróć do listy
        </button>

        {/* Race header */}
        <Card className="mb-4 border-green-500/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 rounded-xl bg-green-500/20">
              <Flag className="w-6 h-6 text-green-400" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">{selectedRace.title}</h1>
              <Badge variant="success" className="animate-pulse">
                <span className="w-2 h-2 rounded-full bg-green-400 mr-1" />
                WYŚCIG TRWA
              </Badge>
            </div>
          </div>

          {selectedRace.description && (
            <p className="text-dark-300 mb-4">{selectedRace.description}</p>
          )}

          {/* Timer */}
          {selectedRace.race_started_at && (
            <div className="bg-dark-700 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-dark-400">Czas od startu:</span>
                <span className="text-2xl font-mono text-turbo-400">
                  <LiveTimer startedAt={selectedRace.race_started_at} />
                </span>
              </div>
            </div>
          )}

          {/* Points distribution */}
          {selectedRace.race_points_distribution && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-dark-400 mb-2">Punkty za miejsca:</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(selectedRace.race_points_distribution).slice(0, 5).map(([place, points]) => (
                  <div key={place} className={`flex items-center gap-2 px-3 py-1 rounded-lg ${getMedalBg(parseInt(place))}`}>
                    <span className="font-bold">{place}.</span>
                    <span>{points} pkt</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Submission form */}
        {!hasSubmitted ? (
          <Card className="mb-4">
            <h3 className="font-medium text-white mb-4 flex items-center gap-2">
              <Send className="w-5 h-5 text-turbo-400" />
              Wyślij zgłoszenie
            </h3>

            {selectedRace.type === 'photo' && (
              <div className="mb-4">
                {selectedRace.photo_requirements && (
                  <p className="text-sm text-dark-400 mb-3">{selectedRace.photo_requirements}</p>
                )}

                {photoPreview ? (
                  <div className="relative">
                    <img
                      src={photoPreview}
                      alt="Podgląd"
                      className="w-full rounded-xl max-h-64 object-cover"
                    />
                    <button
                      onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                      className="absolute top-2 right-2 p-2 bg-red-500 rounded-full text-white"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-dark-600 rounded-xl cursor-pointer hover:border-turbo-500 transition-colors">
                    <Camera className="w-10 h-10 text-dark-500 mb-2" />
                    <span className="text-dark-400">Kliknij aby dodać zdjęcie</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            )}

            <Button
              fullWidth
              onClick={handleSubmit}
              disabled={uploading || (selectedRace.type === 'photo' && !photoFile)}
            >
              {uploading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Wysyłanie...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Wyślij zgłoszenie
                </>
              )}
            </Button>
          </Card>
        ) : (
          <Card className={`mb-4 ${
            submissionStatus === 'approved' ? 'border-green-500/50' :
            submissionStatus === 'rejected' ? 'border-red-500/50' :
            'border-yellow-500/50'
          }`}>
            <div className="flex items-center gap-3">
              {submissionStatus === 'approved' ? (
                <>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    getMedalBg(selectedRace.user_submission?.placement || 99)
                  }`}>
                    {selectedRace.user_submission?.placement || '?'}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">
                      {selectedRace.user_submission?.placement}. miejsce!
                    </p>
                    <p className="text-green-400">
                      +{selectedRace.user_submission?.xp_awarded} punktów
                    </p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </>
              ) : submissionStatus === 'rejected' ? (
                <>
                  <div className="p-3 rounded-xl bg-red-500/20">
                    <Flag className="w-6 h-6 text-red-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">Zgłoszenie odrzucone</p>
                    <p className="text-sm text-dark-400">Spróbuj ponownie</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-3 rounded-xl bg-yellow-500/20">
                    <Clock className="w-6 h-6 text-yellow-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">Czeka na zatwierdzenie</p>
                    <p className="text-sm text-dark-400">Admin sprawdzi Twoje zgłoszenie</p>
                  </div>
                </>
              )}
            </div>
          </Card>
        )}

        {/* Leaderboard */}
        {selectedRace.leaderboard && selectedRace.leaderboard.length > 0 && (
          <Card>
            <h3 className="font-medium text-white mb-3 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Ranking ({selectedRace.total_submissions} ukończonych)
            </h3>
            <div className="space-y-2">
              {selectedRace.leaderboard.map((entry) => (
                <div
                  key={entry.placement}
                  className={`flex items-center gap-3 p-3 rounded-xl ${
                    entry.placement <= 3 ? 'bg-dark-700' : 'bg-dark-800/50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    getMedalBg(entry.placement)
                  }`}>
                    {entry.placement}
                  </div>
                  <span className="text-lg">{entry.team_emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{entry.team_name}</p>
                    <p className="text-xs text-dark-400">{entry.user_nick}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${getMedalColor(entry.placement)}`}>
                      {entry.points} pkt
                    </p>
                    {entry.race_time_ms > 0 && (
                      <p className="text-xs text-dark-500">{formatRaceTime(entry.race_time_ms)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
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
          const isActive = tab.href === '/races';
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
        <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
          <Flag className="w-6 h-6 text-green-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Wyścigi</h1>
          <p className="text-sm text-dark-400">Aktywne wyścigi drużynowe</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <Card key={i} className="h-24 animate-pulse bg-dark-700" />
          ))}
        </div>
      ) : races.length === 0 ? (
        <Card className="text-center py-12">
          <Flag className="w-16 h-16 text-dark-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Brak aktywnych wyścigów</h3>
          <p className="text-dark-400">Wyścigi pojawią się tutaj gdy admin je rozpocznie</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {races.map(race => {
            const hasSubmitted = !!race.user_submission;
            const isApproved = race.user_submission?.status === 'approved';

            return (
              <Card
                key={race.id}
                hover
                onClick={() => setSelectedRace(race)}
                className="border-green-500/30"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <Flag className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{race.title}</p>
                    <div className="flex items-center gap-2 text-sm text-dark-400">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {race.total_submissions} ukończonych
                      </span>
                    </div>
                  </div>
                  {hasSubmitted ? (
                    isApproved ? (
                      <Badge variant="success">
                        {race.user_submission?.placement}. miejsce
                      </Badge>
                    ) : (
                      <Badge variant="warning">Czeka</Badge>
                    )
                  ) : (
                    <Badge variant="success" className="animate-pulse">WEŹUDZIAŁ</Badge>
                  )}
                  <ChevronRight className="w-5 h-5 text-dark-400" />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Live timer component
function LiveTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const updateElapsed = () => {
      const start = new Date(startedAt).getTime();
      setElapsed(Date.now() - start);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 100);
    return () => clearInterval(interval);
  }, [startedAt]);

  return <>{formatRaceTime(elapsed)}</>;
}
