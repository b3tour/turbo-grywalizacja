'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Button, Badge, Input, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import { Mission, Submission, MissionType, formatRaceTime } from '@/types';
import {
  Play,
  Square,
  Trophy,
  Clock,
  Plus,
  CheckCircle,
  XCircle,
  Users,
  Timer,
  Medal,
  Image,
  Eye,
} from 'lucide-react';

interface RaceMission extends Mission {
  submissions_count?: number;
  approved_count?: number;
}

const defaultPointsDistribution: Record<string, number> = {
  '1': 100,
  '2': 75,
  '3': 50,
  '4': 25,
  '5': 10,
};

export default function RacesAdmin() {
  const { success, error: showError } = useToast();
  const { profile } = useAuth();

  const [races, setRaces] = useState<RaceMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedRace, setSelectedRace] = useState<RaceMission | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'photo' as MissionType,
    photo_requirements: '',
    points_distribution: JSON.stringify(defaultPointsDistribution, null, 2),
  });

  // Fetch race missions
  const fetchRaces = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('missions')
        .select('*')
        .eq('is_race', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get submission counts for each race
      const racesWithCounts = await Promise.all(
        (data || []).map(async (race) => {
          const { count: total } = await supabase
            .from('submissions')
            .select('*', { count: 'exact', head: true })
            .eq('mission_id', race.id);

          const { count: approved } = await supabase
            .from('submissions')
            .select('*', { count: 'exact', head: true })
            .eq('mission_id', race.id)
            .eq('status', 'approved');

          return {
            ...race,
            submissions_count: total || 0,
            approved_count: approved || 0,
          };
        })
      );

      setRaces(racesWithCounts);
    } catch (e) {
      console.error('Error fetching races:', e);
      showError('Błąd', 'Nie udało się pobrać wyścigów');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchRaces();
  }, [fetchRaces]);

  // Fetch submissions for a race
  const fetchSubmissions = async (missionId: string) => {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          *,
          user:users(id, nick, avatar_url, team_id, team:teams(id, name, color, emoji))
        `)
        .eq('mission_id', missionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (e) {
      console.error('Error fetching submissions:', e);
    }
  };

  // Create race mission
  const handleCreate = async () => {
    try {
      let pointsDist;
      try {
        pointsDist = JSON.parse(formData.points_distribution);
      } catch {
        showError('Błąd', 'Nieprawidłowy format punktacji');
        return;
      }

      const { error } = await supabase.from('missions').insert({
        title: formData.title,
        description: formData.description,
        type: formData.type,
        photo_requirements: formData.photo_requirements || null,
        xp_reward: 0, // XP będzie z punktacji za miejsce
        status: 'inactive',
        is_race: true,
        race_active: false,
        race_points_distribution: pointsDist,
        required_level: 1,
      });

      if (error) throw error;

      success('Sukces', 'Wyścig utworzony');
      setShowCreateModal(false);
      setFormData({
        title: '',
        description: '',
        type: 'photo',
        photo_requirements: '',
        points_distribution: JSON.stringify(defaultPointsDistribution, null, 2),
      });
      fetchRaces();
    } catch (e) {
      console.error('Error creating race:', e);
      showError('Błąd', 'Nie udało się utworzyć wyścigu');
    }
  };

  // Start race
  const handleStartRace = async (race: RaceMission) => {
    try {
      const { data, error } = await supabase.rpc('start_race', {
        p_mission_id: race.id,
      });

      if (error) throw error;
      if (data && !data.success) {
        showError('Błąd', data.error);
        return;
      }

      success('START!', `Wyścig "${race.title}" rozpoczęty!`);
      fetchRaces();
    } catch (e) {
      console.error('Error starting race:', e);
      showError('Błąd', 'Nie udało się rozpocząć wyścigu');
    }
  };

  // End race
  const handleEndRace = async (race: RaceMission) => {
    try {
      const { data, error } = await supabase.rpc('end_race', {
        p_mission_id: race.id,
      });

      if (error) throw error;
      if (data && !data.success) {
        showError('Błąd', data.error);
        return;
      }

      success('STOP', `Wyścig "${race.title}" zakończony`);
      fetchRaces();
    } catch (e) {
      console.error('Error ending race:', e);
      showError('Błąd', 'Nie udało się zakończyć wyścigu');
    }
  };

  // Approve submission (assigns placement)
  const handleApproveSubmission = async (submission: Submission) => {
    try {
      const { data, error } = await supabase.rpc('approve_race_submission', {
        p_submission_id: submission.id,
        p_admin_id: profile?.id,
      });

      if (error) throw error;
      if (data && !data.success) {
        showError('Błąd', data.error);
        return;
      }

      success(
        `${data.placement}. miejsce!`,
        `Przyznano ${data.points} punktów`
      );

      // Refresh submissions
      if (selectedRace) {
        fetchSubmissions(selectedRace.id);
      }
      fetchRaces();
    } catch (e) {
      console.error('Error approving submission:', e);
      showError('Błąd', 'Nie udało się zatwierdzić zgłoszenia');
    }
  };

  // Reject submission
  const handleRejectSubmission = async (submission: Submission) => {
    try {
      const { error } = await supabase
        .from('submissions')
        .update({
          status: 'rejected',
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', submission.id);

      if (error) throw error;

      success('Odrzucono', 'Zgłoszenie odrzucone');

      if (selectedRace) {
        fetchSubmissions(selectedRace.id);
      }
    } catch (e) {
      console.error('Error rejecting submission:', e);
      showError('Błąd', 'Nie udało się odrzucić zgłoszenia');
    }
  };

  // Open submissions modal
  const openSubmissions = (race: RaceMission) => {
    setSelectedRace(race);
    fetchSubmissions(race.id);
    setShowSubmissionsModal(true);
  };

  // Get medal color
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

  return (
    <div className="space-y-4">
      <Button onClick={() => setShowCreateModal(true)}>
        <Plus className="w-5 h-5 mr-2" />
        Nowy wyścig
      </Button>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="h-24 animate-pulse bg-dark-700" />
          ))}
        </div>
      ) : races.length === 0 ? (
        <Card className="text-center py-8">
          <Trophy className="w-12 h-12 text-dark-600 mx-auto mb-3" />
          <p className="text-dark-400">Brak wyścigów</p>
          <p className="text-sm text-dark-500">Utwórz pierwszy wyścig</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {races.map(race => (
            <Card key={race.id} className={race.race_active ? 'border-green-500/50' : ''}>
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${race.race_active ? 'bg-green-500/20' : 'bg-dark-700'}`}>
                  <Trophy className={`w-6 h-6 ${race.race_active ? 'text-green-400' : 'text-turbo-400'}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-white">{race.title}</h3>
                    {race.race_active && (
                      <Badge variant="success" className="animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-green-400 mr-1 animate-ping" />
                        TRWA
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-dark-400">{race.description}</p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-dark-500">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {race.submissions_count} zgłoszeń
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {race.approved_count} zatwierdzonych
                    </span>
                    {race.race_started_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Start: {new Date(race.race_started_at).toLocaleTimeString('pl-PL')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openSubmissions(race)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Zgłoszenia
                  </Button>

                  {race.race_active ? (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleEndRace(race)}
                    >
                      <Square className="w-4 h-4 mr-1" />
                      STOP
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleStartRace(race)}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      START
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Nowy wyścig"
      >
        <div className="space-y-4">
          <Input
            label="Nazwa wyścigu"
            value={formData.title}
            onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="np. Selfie przy fontannie"
          />

          <Input
            label="Opis"
            value={formData.description}
            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Co drużyny mają zrobić?"
          />

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1">Typ zadania</label>
            <select
              value={formData.type}
              onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as MissionType }))}
              className="w-full px-4 py-2 rounded-xl bg-dark-700 border border-dark-600 text-white"
            >
              <option value="photo">Zdjęcie</option>
              <option value="manual">Ręczne zatwierdzenie</option>
            </select>
          </div>

          {formData.type === 'photo' && (
            <Input
              label="Wymagania zdjęcia"
              value={formData.photo_requirements}
              onChange={e => setFormData(prev => ({ ...prev, photo_requirements: e.target.value }))}
              placeholder="np. Selfie całej drużyny"
            />
          )}

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1">
              Punktacja za miejsca (JSON)
            </label>
            <textarea
              value={formData.points_distribution}
              onChange={e => setFormData(prev => ({ ...prev, points_distribution: e.target.value }))}
              className="w-full px-4 py-2 rounded-xl bg-dark-700 border border-dark-600 text-white font-mono text-sm"
              rows={5}
            />
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)} className="flex-1">
              Anuluj
            </Button>
            <Button onClick={handleCreate} className="flex-1">
              Utwórz wyścig
            </Button>
          </div>
        </div>
      </Modal>

      {/* Submissions Modal */}
      <Modal
        isOpen={showSubmissionsModal}
        onClose={() => { setShowSubmissionsModal(false); setSelectedRace(null); }}
        title={selectedRace ? `Zgłoszenia: ${selectedRace.title}` : 'Zgłoszenia'}
        size="lg"
      >
        {selectedRace && (
          <div className="space-y-4">
            {/* Race info */}
            <Card variant="outlined" padding="sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {selectedRace.race_active ? (
                    <Badge variant="success">TRWA</Badge>
                  ) : (
                    <Badge variant="default">Nieaktywny</Badge>
                  )}
                  {selectedRace.race_started_at && (
                    <span className="text-sm text-dark-400">
                      Start: {new Date(selectedRace.race_started_at).toLocaleTimeString('pl-PL')}
                    </span>
                  )}
                </div>
                <span className="text-sm text-dark-400">
                  {submissions.filter(s => s.status === 'pending').length} oczekujących
                </span>
              </div>
            </Card>

            {/* Submissions list */}
            {submissions.length === 0 ? (
              <div className="text-center py-8 text-dark-400">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Brak zgłoszeń</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {submissions.map((sub, index) => {
                  const user = sub.user as any;
                  const team = user?.team;
                  const isPending = sub.status === 'pending';
                  const isApproved = sub.status === 'approved';

                  return (
                    <div
                      key={sub.id}
                      className={`flex items-center gap-3 p-3 rounded-xl ${
                        isApproved ? 'bg-green-500/10 border border-green-500/30' :
                        isPending ? 'bg-dark-800' : 'bg-dark-800/50 opacity-50'
                      }`}
                    >
                      {/* Placement or pending number */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                        isApproved && sub.placement ? getMedalBg(sub.placement) : 'bg-dark-700 text-dark-400'
                      }`}>
                        {isApproved && sub.placement ? sub.placement : index + 1}
                      </div>

                      {/* Team & user info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{team?.emoji}</span>
                          <span className="font-medium text-white">{team?.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-dark-400">
                          <span>{user?.nick}</span>
                          {sub.race_time_ms && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Timer className="w-3 h-3" />
                                {formatRaceTime(sub.race_time_ms)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Photo preview */}
                      {sub.photo_url && (
                        <a
                          href={sub.photo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-12 h-12 rounded-lg bg-dark-700 overflow-hidden flex-shrink-0"
                        >
                          <img
                            src={sub.photo_url}
                            alt="Zgłoszenie"
                            className="w-full h-full object-cover"
                          />
                        </a>
                      )}

                      {/* Status / Actions */}
                      {isApproved ? (
                        <div className="text-right">
                          <div className={`text-lg font-bold ${getMedalColor(sub.placement || 99)}`}>
                            {sub.xp_awarded} pkt
                          </div>
                          <Badge variant="success" size="sm">Zatwierdzone</Badge>
                        </div>
                      ) : isPending ? (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleRejectSubmission(sub)}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleApproveSubmission(sub)}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Zatwierdź
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="danger" size="sm">Odrzucone</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
