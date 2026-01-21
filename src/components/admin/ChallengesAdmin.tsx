'use client';

import { useState, useEffect } from 'react';
import { Card, Button, Badge, Input, Modal, AlertDialog } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useChallenges, useChallenge } from '@/hooks/useChallenges';
import { useTeams } from '@/hooks/useTeams';
import { supabase } from '@/lib/supabase';
import {
  Challenge,
  ChallengeType,
  ChallengeStatus,
  PointsMode,
  ChallengeLeaderboardEntry,
  Team,
  User,
  formatTime,
  parseTime,
} from '@/types';
import {
  Trophy,
  Clock,
  Users,
  User as UserIcon,
  Plus,
  Edit2,
  Trash2,
  Play,
  Pause,
  CheckCircle,
  Calculator,
  Award,
  Timer,
  Target,
  Gavel,
} from 'lucide-react';

const challengeTypeLabels: Record<ChallengeType, { label: string; icon: React.ReactNode; color: string }> = {
  team_timed: { label: 'Drużynowe na czas', icon: <Users className="w-4 h-4" />, color: 'text-blue-400' },
  individual_timed: { label: 'Indywidualne na czas', icon: <Timer className="w-4 h-4" />, color: 'text-green-400' },
  team_task: { label: 'Zadanie drużynowe', icon: <Target className="w-4 h-4" />, color: 'text-purple-400' },
  individual_task: { label: 'Zadanie indywidualne', icon: <UserIcon className="w-4 h-4" />, color: 'text-yellow-400' },
  auction: { label: 'Licytacja', icon: <Gavel className="w-4 h-4" />, color: 'text-orange-400' },
};

const statusLabels: Record<ChallengeStatus, { label: string; variant: 'default' | 'warning' | 'success' | 'turbo' }> = {
  pending: { label: 'Oczekuje', variant: 'default' },
  active: { label: 'W trakcie', variant: 'turbo' },
  scoring: { label: 'Punktowanie', variant: 'warning' },
  completed: { label: 'Zakończone', variant: 'success' },
};

export default function ChallengesAdmin() {
  const { success, error: showError } = useToast();
  const { challenges, loading, createChallenge, updateChallenge, deleteChallenge, setStatus, addResult, deleteResult, calculatePlacements, awardPoints, refresh } = useChallenges();
  const { teams } = useTeams();

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [challengeToDelete, setChallengeToDelete] = useState<Challenge | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Results state
  const [results, setResults] = useState<ChallengeLeaderboardEntry[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [teamUsers, setTeamUsers] = useState<Record<string, User[]>>({});

  // Form state
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'team_timed' as ChallengeType,
    points_mode: 'placement' as PointsMode,
    points_distribution: { '1': 100, '2': 75, '3': 50, '4': 25, '5': 10 } as Record<string, number>,
    fixed_points: 50,
    max_participants_per_team: null as number | null,
  });

  // Result entry form
  const [resultForm, setResultForm] = useState({
    team_id: '',
    user_id: '',
    time_str: '',
    score: '',
  });

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      type: 'team_timed',
      points_mode: 'placement',
      points_distribution: { '1': 100, '2': 75, '3': 50, '4': 25, '5': 10 },
      fixed_points: 50,
      max_participants_per_team: null,
    });
    setIsEditing(false);
    setSelectedChallenge(null);
  };

  const openCreate = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEdit = (challenge: Challenge) => {
    setForm({
      title: challenge.title,
      description: challenge.description || '',
      type: challenge.type,
      points_mode: challenge.points_mode,
      points_distribution: challenge.points_distribution,
      fixed_points: challenge.fixed_points || 50,
      max_participants_per_team: challenge.max_participants_per_team || null,
    });
    setSelectedChallenge(challenge);
    setIsEditing(true);
    setShowCreateModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      showError('Błąd', 'Podaj tytuł zadania');
      return;
    }

    const data = {
      title: form.title,
      description: form.description || undefined,
      type: form.type,
      points_mode: form.points_mode,
      points_distribution: form.points_distribution,
      fixed_points: form.points_mode === 'fixed' ? form.fixed_points : undefined,
      max_participants_per_team: form.max_participants_per_team || undefined,
    };

    let result;
    if (isEditing && selectedChallenge) {
      result = await updateChallenge(selectedChallenge.id, data);
    } else {
      result = await createChallenge(data);
    }

    if (result.success) {
      success(isEditing ? 'Zapisano!' : 'Utworzono!', isEditing ? 'Zadanie zostało zaktualizowane' : 'Nowe zadanie zostało dodane');
      setShowCreateModal(false);
      resetForm();
    } else {
      showError('Błąd', result.error || 'Coś poszło nie tak');
    }
  };

  const handleDelete = async () => {
    if (!challengeToDelete) return;
    const result = await deleteChallenge(challengeToDelete.id);
    if (result.success) {
      success('Usunięto!', 'Zadanie zostało usunięte');
      setShowDeleteDialog(false);
      setChallengeToDelete(null);
    } else {
      showError('Błąd', result.error || 'Nie udało się usunąć');
    }
  };

  const handleStatusChange = async (challenge: Challenge, newStatus: ChallengeStatus) => {
    const result = await setStatus(challenge.id, newStatus);
    if (result.success) {
      success('Status zmieniony', `Zadanie jest teraz: ${statusLabels[newStatus].label}`);
    } else {
      showError('Błąd', result.error || 'Nie udało się zmienić statusu');
    }
  };

  // Fetch results for selected challenge
  const openResults = async (challenge: Challenge) => {
    setSelectedChallenge(challenge);
    setShowResultsModal(true);
    setLoadingResults(true);
    setResultForm({ team_id: '', user_id: '', time_str: '', score: '' });

    try {
      // Fetch results
      const { data: resultsData } = await supabase
        .from('challenge_leaderboard')
        .select('*')
        .eq('challenge_id', challenge.id)
        .order('placement', { ascending: true, nullsFirst: false })
        .order('time_ms', { ascending: true, nullsFirst: false });

      setResults(resultsData || []);

      // Fetch users for each team (for individual challenges)
      if (challenge.type === 'individual_timed' || challenge.type === 'individual_task') {
        const usersMap: Record<string, User[]> = {};
        for (const team of teams) {
          const { data: usersData } = await supabase
            .from('users')
            .select('id, nick, avatar_url')
            .eq('team_id', team.id);
          usersMap[team.id] = (usersData as User[]) || [];
        }
        setTeamUsers(usersMap);
      }
    } catch (e) {
      console.error('Error fetching results:', e);
    } finally {
      setLoadingResults(false);
    }
  };

  const refreshResults = async () => {
    if (!selectedChallenge) return;
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

  const handleAddResult = async () => {
    if (!selectedChallenge || !resultForm.team_id) {
      showError('Błąd', 'Wybierz drużynę');
      return;
    }

    const isIndividual = selectedChallenge.type === 'individual_timed' || selectedChallenge.type === 'individual_task';
    if (isIndividual && !resultForm.user_id) {
      showError('Błąd', 'Wybierz uczestnika');
      return;
    }

    const isTimed = selectedChallenge.type === 'team_timed' || selectedChallenge.type === 'individual_timed';
    let time_ms: number | undefined;
    if (isTimed) {
      if (!resultForm.time_str) {
        showError('Błąd', 'Podaj czas');
        return;
      }
      time_ms = parseTime(resultForm.time_str) || undefined;
      if (!time_ms) {
        showError('Błąd', 'Nieprawidłowy format czasu (użyj mm:ss.ms lub ss.ms)');
        return;
      }
    }

    const score = resultForm.score ? parseInt(resultForm.score, 10) : undefined;

    const result = await addResult({
      challenge_id: selectedChallenge.id,
      team_id: resultForm.team_id,
      user_id: isIndividual ? resultForm.user_id : undefined,
      time_ms,
      score,
    });

    if (result.success) {
      success('Dodano!', 'Wynik został zapisany');
      setResultForm({ team_id: '', user_id: '', time_str: '', score: '' });
      await refreshResults();
    } else {
      showError('Błąd', result.error || 'Nie udało się dodać wyniku');
    }
  };

  const handleDeleteResult = async (resultId: string) => {
    const result = await deleteResult(resultId);
    if (result.success) {
      success('Usunięto!', 'Wynik został usunięty');
      await refreshResults();
    } else {
      showError('Błąd', result.error || 'Nie udało się usunąć');
    }
  };

  const handleCalculatePlacements = async () => {
    if (!selectedChallenge) return;
    const result = await calculatePlacements(selectedChallenge.id);
    if (result.success) {
      success('Obliczono!', 'Miejsca i punkty zostały obliczone');
      await refreshResults();
    } else {
      showError('Błąd', result.error || 'Nie udało się obliczyć');
    }
  };

  const handleAwardPoints = async () => {
    if (!selectedChallenge) return;
    const result = await awardPoints(selectedChallenge.id);
    if (result.success) {
      success('Przyznano!', 'Punkty zostały dodane do drużyn');
      setShowResultsModal(false);
      await refresh();
    } else {
      showError('Błąd', result.error || 'Nie udało się przyznać punktów');
    }
  };

  return (
    <div className="space-y-4">
      <Button fullWidth onClick={openCreate}>
        <Plus className="w-5 h-5 mr-2" />
        Dodaj nowe zadanie
      </Button>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="h-24 animate-pulse bg-dark-700" />
          ))}
        </div>
      ) : challenges.length === 0 ? (
        <Card className="text-center py-8">
          <Trophy className="w-12 h-12 text-dark-600 mx-auto mb-3" />
          <p className="text-dark-400">Brak zadań eventowych</p>
          <p className="text-sm text-dark-500">Dodaj pierwsze zadanie powyżej</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {challenges.map(challenge => (
            <Card key={challenge.id}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg bg-dark-700 ${challengeTypeLabels[challenge.type].color}`}>
                  {challengeTypeLabels[challenge.type].icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{challenge.title}</p>
                  <p className="text-sm text-dark-400">
                    {challengeTypeLabels[challenge.type].label}
                  </p>
                </div>
                <Badge variant={statusLabels[challenge.status].variant}>
                  {statusLabels[challenge.status].label}
                </Badge>
              </div>

              {challenge.description && (
                <p className="text-sm text-dark-300 mb-3 line-clamp-2">{challenge.description}</p>
              )}

              {/* Points distribution preview */}
              <div className="flex flex-wrap gap-1 mb-3">
                {Object.entries(challenge.points_distribution).slice(0, 5).map(([place, points]) => (
                  <span key={place} className="text-xs bg-dark-700 px-2 py-1 rounded">
                    {place}. = {points} pkt
                  </span>
                ))}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-3 border-t border-dark-700">
                {challenge.status === 'pending' && (
                  <Button size="sm" variant="secondary" onClick={() => handleStatusChange(challenge, 'active')}>
                    <Play className="w-4 h-4 mr-1" />
                    Start
                  </Button>
                )}
                {challenge.status === 'active' && (
                  <Button size="sm" variant="secondary" onClick={() => handleStatusChange(challenge, 'scoring')}>
                    <Pause className="w-4 h-4 mr-1" />
                    Zakończ
                  </Button>
                )}
                {(challenge.status === 'scoring' || challenge.status === 'active') && (
                  <Button size="sm" onClick={() => openResults(challenge)}>
                    <Clock className="w-4 h-4 mr-1" />
                    Wyniki
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => openEdit(challenge)}>
                  <Edit2 className="w-4 h-4 mr-1" />
                  Edytuj
                </Button>
                {challenge.status !== 'completed' && (
                  <Button size="sm" variant="danger" onClick={() => { setChallengeToDelete(challenge); setShowDeleteDialog(true); }}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    Usuń
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); resetForm(); }}
        title={isEditing ? 'Edytuj zadanie' : 'Nowe zadanie eventowe'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Tytuł zadania *"
            value={form.title}
            onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
            placeholder="np. Wyścig rowerowy"
          />

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-1.5">Opis</label>
            <textarea
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Opisz zasady zadania..."
              className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-2.5 text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-turbo-500 min-h-[80px] resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-1.5">Typ zadania</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(challengeTypeLabels) as ChallengeType[]).filter(t => t !== 'auction').map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, type }))}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    form.type === type
                      ? 'border-turbo-500 bg-turbo-500/10'
                      : 'border-dark-600 hover:border-dark-500'
                  }`}
                >
                  <div className={`flex items-center gap-2 mb-1 ${challengeTypeLabels[type].color}`}>
                    {challengeTypeLabels[type].icon}
                    <span className="font-medium text-white text-sm">{challengeTypeLabels[type].label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-1.5">Tryb punktowania</label>
            <select
              value={form.points_mode}
              onChange={e => setForm(prev => ({ ...prev, points_mode: e.target.value as PointsMode }))}
              className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-2.5 text-white"
            >
              <option value="placement">Punkty za miejsce (1., 2., 3. ...)</option>
              <option value="top_n">Tylko TOP N dostaje punkty</option>
              <option value="fixed">Stała liczba punktów za wykonanie</option>
            </select>
          </div>

          {form.points_mode === 'fixed' ? (
            <Input
              label="Punkty za wykonanie"
              type="number"
              value={form.fixed_points}
              onChange={e => setForm(prev => ({ ...prev, fixed_points: parseInt(e.target.value) || 0 }))}
              min={1}
            />
          ) : (
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1.5">Rozkład punktów</label>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map(place => (
                  <div key={place}>
                    <label className="text-xs text-dark-400">{place}. miejsce</label>
                    <input
                      type="number"
                      value={form.points_distribution[place.toString()] || 0}
                      onChange={e => setForm(prev => ({
                        ...prev,
                        points_distribution: {
                          ...prev.points_distribution,
                          [place.toString()]: parseInt(e.target.value) || 0,
                        },
                      }))}
                      className="w-full bg-dark-800 border border-dark-600 rounded-lg px-2 py-1.5 text-white text-sm"
                      min={0}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {(form.type === 'individual_timed' || form.type === 'individual_task') && (
            <Input
              label="Maks. uczestników z drużyny"
              type="number"
              value={form.max_participants_per_team || ''}
              onChange={e => setForm(prev => ({ ...prev, max_participants_per_team: e.target.value ? parseInt(e.target.value) : null }))}
              placeholder="Puste = bez limitu"
              min={1}
            />
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setShowCreateModal(false); resetForm(); }} className="flex-1">
              Anuluj
            </Button>
            <Button onClick={handleSave} className="flex-1">
              {isEditing ? 'Zapisz zmiany' : 'Utwórz zadanie'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Results Modal */}
      <Modal
        isOpen={showResultsModal}
        onClose={() => { setShowResultsModal(false); setSelectedChallenge(null); setResults([]); }}
        title={`Wyniki: ${selectedChallenge?.title || ''}`}
        size="lg"
      >
        {selectedChallenge && (
          <div className="space-y-4">
            {/* Add result form */}
            <Card variant="outlined">
              <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Dodaj wynik
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-dark-400">Drużyna</label>
                  <select
                    value={resultForm.team_id}
                    onChange={e => setResultForm(prev => ({ ...prev, team_id: e.target.value, user_id: '' }))}
                    className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="">Wybierz drużynę</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>{team.emoji} {team.name}</option>
                    ))}
                  </select>
                </div>

                {(selectedChallenge.type === 'individual_timed' || selectedChallenge.type === 'individual_task') && (
                  <div>
                    <label className="text-xs text-dark-400">Uczestnik</label>
                    <select
                      value={resultForm.user_id}
                      onChange={e => setResultForm(prev => ({ ...prev, user_id: e.target.value }))}
                      className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                      disabled={!resultForm.team_id}
                    >
                      <option value="">Wybierz uczestnika</option>
                      {(teamUsers[resultForm.team_id] || []).map(user => (
                        <option key={user.id} value={user.id}>{user.nick}</option>
                      ))}
                    </select>
                  </div>
                )}

                {(selectedChallenge.type === 'team_timed' || selectedChallenge.type === 'individual_timed') && (
                  <div>
                    <label className="text-xs text-dark-400">Czas (mm:ss.ms)</label>
                    <input
                      type="text"
                      value={resultForm.time_str}
                      onChange={e => setResultForm(prev => ({ ...prev, time_str: e.target.value }))}
                      placeholder="np. 1:23.45 lub 45.67"
                      className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                )}

                {(selectedChallenge.type === 'team_task' || selectedChallenge.type === 'individual_task') && (
                  <div>
                    <label className="text-xs text-dark-400">Wynik (opcjonalnie)</label>
                    <input
                      type="number"
                      value={resultForm.score}
                      onChange={e => setResultForm(prev => ({ ...prev, score: e.target.value }))}
                      placeholder="np. punkty"
                      className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                )}
              </div>
              <Button size="sm" onClick={handleAddResult} className="mt-3">
                <Plus className="w-4 h-4 mr-1" />
                Dodaj
              </Button>
            </Card>

            {/* Results list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-white">Wyniki ({results.length})</h4>
                {results.length > 0 && selectedChallenge.status !== 'completed' && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={handleCalculatePlacements}>
                      <Calculator className="w-4 h-4 mr-1" />
                      Oblicz miejsca
                    </Button>
                    <Button size="sm" onClick={handleAwardPoints}>
                      <Award className="w-4 h-4 mr-1" />
                      Przyznaj punkty
                    </Button>
                  </div>
                )}
              </div>

              {loadingResults ? (
                <div className="text-center py-4 text-dark-400">Ładowanie...</div>
              ) : results.length === 0 ? (
                <Card variant="outlined" className="text-center py-4">
                  <p className="text-dark-400">Brak wyników</p>
                </Card>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {results.map((result, index) => (
                    <Card key={result.id} variant="outlined" padding="sm">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          result.placement === 1 ? 'bg-yellow-500 text-black' :
                          result.placement === 2 ? 'bg-gray-400 text-black' :
                          result.placement === 3 ? 'bg-amber-700 text-white' :
                          'bg-dark-700 text-dark-300'
                        }`}>
                          {result.placement || '-'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{result.team_emoji}</span>
                            <span className="font-medium text-white">{result.team_name}</span>
                            {result.user_nick && (
                              <span className="text-sm text-dark-400">({result.user_nick})</span>
                            )}
                          </div>
                          {result.time_ms && (
                            <span className="text-sm text-turbo-400">{formatTime(result.time_ms)}</span>
                          )}
                          {result.score && (
                            <span className="text-sm text-dark-400 ml-2">Wynik: {result.score}</span>
                          )}
                        </div>
                        <div className="text-right">
                          {result.points_awarded > 0 && (
                            <span className="text-turbo-400 font-bold">+{result.points_awarded} pkt</span>
                          )}
                        </div>
                        {selectedChallenge.status !== 'completed' && (
                          <button
                            onClick={() => handleDeleteResult(result.id)}
                            className="p-1 text-dark-400 hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <Button variant="secondary" fullWidth onClick={() => { setShowResultsModal(false); setSelectedChallenge(null); }}>
              Zamknij
            </Button>
          </div>
        )}
      </Modal>

      {/* Delete dialog */}
      <AlertDialog
        isOpen={showDeleteDialog}
        onClose={() => { setShowDeleteDialog(false); setChallengeToDelete(null); }}
        onConfirm={handleDelete}
        title="Usuń zadanie"
        message={`Czy na pewno chcesz usunąć zadanie "${challengeToDelete?.title}"? Wszystkie wyniki zostaną usunięte.`}
        confirmText="Usuń"
        cancelText="Anuluj"
        variant="danger"
      />
    </div>
  );
}
