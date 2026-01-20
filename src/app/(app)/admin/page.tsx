'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Card, Button, Badge, Input, Modal, AlertDialog } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { Mission, MissionStatus, Submission, User, QuizData, QuizQuestion, QuizAnswer, QuizMode } from '@/types';
import {
  formatNumber,
  formatDateTime,
  missionTypeIcons,
  missionTypeNames,
  generateQRCode,
} from '@/lib/utils';
import {
  Shield,
  Users,
  Target,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  BarChart3,
  Eye,
  Mail,
  Phone,
  Calendar,
  Award,
  HelpCircle,
  GripVertical,
  UserPlus,
  UserMinus,
} from 'lucide-react';
import { useTeams } from '@/hooks/useTeams';
import { Team, TeamMember } from '@/types';

type AdminTab = 'overview' | 'submissions' | 'missions' | 'users' | 'teams';

export default function AdminPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const { success, error: showError } = useToast();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [pendingSubmissions, setPendingSubmissions] = useState<Submission[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalMissions: 0,
    activeMissions: 0,
    pendingSubmissions: 0,
    totalXP: 0,
  });

  // Modal states
  const [showMissionModal, setShowMissionModal] = useState(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [missionToDelete, setMissionToDelete] = useState<Mission | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // User details modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSubmissions, setUserSubmissions] = useState<Submission[]>([]);
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);

  // Teams management
  const { teams, getTeamMembers, assignUserToTeam, removeUserFromTeam, getUnassignedUsers, refetch: refetchTeams } = useTeams();
  const [teamMembers, setTeamMembers] = useState<Record<string, TeamMember[]>>({});
  const [unassignedUsers, setUnassignedUsers] = useState<TeamMember[]>([]);
  const [selectedTeamForAssign, setSelectedTeamForAssign] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);

  const [missionForm, setMissionForm] = useState({
    title: '',
    description: '',
    xp_reward: 50,
    type: 'photo' as Mission['type'],
    location_name: '',
    qr_code_value: '',
    status: 'active' as MissionStatus,
    // Quiz data
    quiz_passing_score: 70,
    quiz_time_limit: 0,
    quiz_mode: 'classic' as QuizMode,
    quiz_questions: [] as QuizQuestion[],
  });

  // Sprawdź czy użytkownik jest adminem
  useEffect(() => {
    if (profile && !profile.is_admin) {
      router.push('/dashboard');
    }
  }, [profile, router]);

  // Pobierz dane
  const fetchData = async () => {
    if (!profile?.is_admin) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [usersRes, missionsRes, submissionsRes] = await Promise.all([
        supabase.from('users').select('*').order('total_xp', { ascending: false }),
        supabase.from('missions').select('*').order('created_at', { ascending: false }),
        supabase
          .from('submissions')
          .select('*, user:users!submissions_user_id_fkey(*), mission:missions(*)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
      ]);

      if (usersRes.data) setUsers(usersRes.data as User[]);
      if (missionsRes.data) setMissions(missionsRes.data as Mission[]);
      if (submissionsRes.data) setPendingSubmissions(submissionsRes.data as Submission[]);

      const missionsList = missionsRes.data || [];
      setStats({
        totalUsers: usersRes.data?.length || 0,
        totalMissions: missionsList.length,
        activeMissions: missionsList.filter(m => m.status === 'active').length,
        pendingSubmissions: submissionsRes.data?.length || 0,
        totalXP: usersRes.data?.reduce((sum, u) => sum + (u.total_xp || 0), 0) || 0,
      });
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchData();
    }
  }, [profile]);

  // === SUBMISSION HANDLERS ===
  const handleApproveSubmission = async (submission: Submission) => {
    if (!submission.mission) return;

    const { error } = await supabase
      .from('submissions')
      .update({
        status: 'approved',
        xp_awarded: submission.mission.xp_reward,
        reviewed_by: profile?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', submission.id);

    if (error) {
      showError('Błąd', 'Nie udało się zatwierdzić zgłoszenia');
      return;
    }

    // Dodaj XP użytkownikowi
    await supabase.rpc('add_user_xp', {
      p_user_id: submission.user_id,
      p_xp_amount: submission.mission.xp_reward,
    });

    success('Zatwierdzone!', `Przyznano ${submission.mission.xp_reward} XP`);
    setPendingSubmissions(prev => prev.filter(s => s.id !== submission.id));
    setShowSubmissionModal(false);
    setSelectedSubmission(null);
    fetchData();
  };

  const handleRejectSubmission = async (submission: Submission, reason?: string) => {
    const { error } = await supabase
      .from('submissions')
      .update({
        status: 'rejected',
        admin_notes: reason || 'Zgłoszenie nie spełnia wymagań',
        reviewed_by: profile?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', submission.id);

    if (error) {
      showError('Błąd', 'Nie udało się odrzucić zgłoszenia');
      return;
    }

    success('Odrzucone', 'Zgłoszenie zostało odrzucone');
    setPendingSubmissions(prev => prev.filter(s => s.id !== submission.id));
    setShowSubmissionModal(false);
    setSelectedSubmission(null);
    fetchData();
  };

  // === MISSION HANDLERS ===
  const resetMissionForm = () => {
    setMissionForm({
      title: '',
      description: '',
      xp_reward: 50,
      type: 'photo',
      location_name: '',
      qr_code_value: '',
      status: 'active',
      quiz_passing_score: 70,
      quiz_time_limit: 0,
      quiz_mode: 'classic',
      quiz_questions: [],
    });
    setSelectedMission(null);
    setIsEditing(false);
  };

  const openCreateMission = () => {
    resetMissionForm();
    setShowMissionModal(true);
  };

  const openEditMission = (mission: Mission) => {
    setMissionForm({
      title: mission.title,
      description: mission.description,
      xp_reward: mission.xp_reward,
      type: mission.type,
      location_name: mission.location_name || '',
      qr_code_value: mission.qr_code_value || '',
      status: mission.status,
      quiz_passing_score: mission.quiz_data?.passing_score || 70,
      quiz_time_limit: mission.quiz_data?.time_limit || 0,
      quiz_mode: mission.quiz_data?.mode || 'classic',
      quiz_questions: mission.quiz_data?.questions || [],
    });
    setSelectedMission(mission);
    setIsEditing(true);
    setShowMissionModal(true);
  };

  // === QUIZ HANDLERS ===
  const addQuestion = () => {
    const newQuestion: QuizQuestion = {
      id: `q_${Date.now()}`,
      question: '',
      points: 10,
      answers: [
        { id: `a_${Date.now()}_1`, text: '', is_correct: true },
        { id: `a_${Date.now()}_2`, text: '', is_correct: false },
      ],
    };
    setMissionForm(prev => ({
      ...prev,
      quiz_questions: [...prev.quiz_questions, newQuestion],
    }));
  };

  const removeQuestion = (questionId: string) => {
    setMissionForm(prev => ({
      ...prev,
      quiz_questions: prev.quiz_questions.filter(q => q.id !== questionId),
    }));
  };

  const updateQuestion = (questionId: string, field: string, value: string | number) => {
    setMissionForm(prev => ({
      ...prev,
      quiz_questions: prev.quiz_questions.map(q =>
        q.id === questionId ? { ...q, [field]: value } : q
      ),
    }));
  };

  const addAnswer = (questionId: string) => {
    setMissionForm(prev => ({
      ...prev,
      quiz_questions: prev.quiz_questions.map(q =>
        q.id === questionId
          ? {
              ...q,
              answers: [
                ...q.answers,
                { id: `a_${Date.now()}`, text: '', is_correct: false },
              ],
            }
          : q
      ),
    }));
  };

  const removeAnswer = (questionId: string, answerId: string) => {
    setMissionForm(prev => ({
      ...prev,
      quiz_questions: prev.quiz_questions.map(q =>
        q.id === questionId
          ? { ...q, answers: q.answers.filter(a => a.id !== answerId) }
          : q
      ),
    }));
  };

  const updateAnswer = (questionId: string, answerId: string, field: string, value: string | boolean) => {
    setMissionForm(prev => ({
      ...prev,
      quiz_questions: prev.quiz_questions.map(q =>
        q.id === questionId
          ? {
              ...q,
              answers: q.answers.map(a =>
                a.id === answerId ? { ...a, [field]: value } : a
              ),
            }
          : q
      ),
    }));
  };

  const setCorrectAnswer = (questionId: string, answerId: string) => {
    setMissionForm(prev => ({
      ...prev,
      quiz_questions: prev.quiz_questions.map(q =>
        q.id === questionId
          ? {
              ...q,
              answers: q.answers.map(a => ({
                ...a,
                is_correct: a.id === answerId,
              })),
            }
          : q
      ),
    }));
  };

  const handleSaveMission = async () => {
    if (!missionForm.title || !missionForm.description) {
      showError('Błąd', 'Wypełnij wymagane pola (tytuł i opis)');
      return;
    }

    // Walidacja quizu
    if (missionForm.type === 'quiz') {
      if (missionForm.quiz_questions.length === 0) {
        showError('Błąd', 'Quiz musi mieć co najmniej jedno pytanie');
        return;
      }
      for (const q of missionForm.quiz_questions) {
        if (!q.question.trim()) {
          showError('Błąd', 'Wszystkie pytania muszą mieć treść');
          return;
        }
        if (q.answers.length < 2) {
          showError('Błąd', 'Każde pytanie musi mieć co najmniej 2 odpowiedzi');
          return;
        }
        if (!q.answers.some(a => a.is_correct)) {
          showError('Błąd', 'Każde pytanie musi mieć zaznaczoną poprawną odpowiedź');
          return;
        }
        for (const a of q.answers) {
          if (!a.text.trim()) {
            showError('Błąd', 'Wszystkie odpowiedzi muszą mieć treść');
            return;
          }
        }
      }
    }

    // Przygotuj quiz_data jeśli to quiz
    const quizData: QuizData | null = missionForm.type === 'quiz'
      ? {
          questions: missionForm.quiz_questions,
          passing_score: missionForm.quiz_passing_score,
          time_limit: missionForm.quiz_mode === 'classic' && missionForm.quiz_time_limit > 0
            ? missionForm.quiz_time_limit
            : undefined,
          mode: missionForm.quiz_mode,
        }
      : null;

    const missionData = {
      title: missionForm.title,
      description: missionForm.description,
      xp_reward: missionForm.xp_reward,
      type: missionForm.type,
      location_name: missionForm.location_name || null,
      qr_code_value: missionForm.type === 'qr_code'
        ? (missionForm.qr_code_value || generateQRCode())
        : null,
      status: missionForm.status,
      quiz_data: quizData,
    };

    if (isEditing && selectedMission) {
      // Aktualizacja istniejącej misji
      const { error } = await supabase
        .from('missions')
        .update(missionData)
        .eq('id', selectedMission.id);

      if (error) {
        showError('Błąd', 'Nie udało się zaktualizować misji');
        return;
      }

      success('Zapisano!', 'Misja została zaktualizowana');
    } else {
      // Tworzenie nowej misji
      const { error } = await supabase
        .from('missions')
        .insert(missionData);

      if (error) {
        showError('Błąd', 'Nie udało się utworzyć misji');
        return;
      }

      success('Utworzono!', 'Nowa misja została dodana');
    }

    setShowMissionModal(false);
    resetMissionForm();
    fetchData();
  };

  const handleToggleMissionStatus = async (mission: Mission) => {
    const newStatus = mission.status === 'active' ? 'inactive' : 'active';

    const { error } = await supabase
      .from('missions')
      .update({ status: newStatus })
      .eq('id', mission.id);

    if (error) {
      showError('Błąd', 'Nie udało się zmienić statusu misji');
      return;
    }

    success(
      newStatus === 'active' ? 'Aktywowano!' : 'Dezaktywowano!',
      `Misja "${mission.title}" jest teraz ${newStatus === 'active' ? 'aktywna' : 'nieaktywna'}`
    );
    fetchData();
  };

  const handleDeleteMission = async () => {
    if (!missionToDelete) return;

    const { error } = await supabase
      .from('missions')
      .delete()
      .eq('id', missionToDelete.id);

    if (error) {
      showError('Błąd', 'Nie udało się usunąć misji. Możliwe że są powiązane zgłoszenia.');
      return;
    }

    success('Usunięto!', `Misja "${missionToDelete.title}" została usunięta`);
    setShowDeleteDialog(false);
    setMissionToDelete(null);
    fetchData();
  };

  const handleDuplicateMission = async (mission: Mission) => {
    const { error } = await supabase
      .from('missions')
      .insert({
        title: `${mission.title} (kopia)`,
        description: mission.description,
        xp_reward: mission.xp_reward,
        type: mission.type,
        location_name: mission.location_name,
        qr_code_value: mission.type === 'qr_code' ? generateQRCode() : null,
        status: 'inactive',
      });

    if (error) {
      showError('Błąd', 'Nie udało się zduplikować misji');
      return;
    }

    success('Zduplikowano!', 'Kopia misji została utworzona (nieaktywna)');
    fetchData();
  };

  // === USER DETAILS ===
  const openUserDetails = async (user: User) => {
    setSelectedUser(user);
    setShowUserModal(true);
    setLoadingUserDetails(true);

    // Pobierz wszystkie zgłoszenia użytkownika
    const { data, error } = await supabase
      .from('submissions')
      .select('*, mission:missions(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setUserSubmissions(data as Submission[]);
    }
    setLoadingUserDetails(false);
  };

  const getUserStats = () => {
    const approved = userSubmissions.filter(s => s.status === 'approved').length;
    const pending = userSubmissions.filter(s => s.status === 'pending').length;
    const rejected = userSubmissions.filter(s => s.status === 'rejected').length;
    const totalXpEarned = userSubmissions
      .filter(s => s.status === 'approved')
      .reduce((sum, s) => sum + (s.xp_awarded || 0), 0);
    return { approved, pending, rejected, totalXpEarned };
  };

  if (!profile?.is_admin) {
    return null;
  }

  // Fetch teams data
  const fetchTeamsData = async () => {
    setLoadingTeams(true);
    const membersMap: Record<string, TeamMember[]> = {};
    for (const team of teams) {
      const members = await getTeamMembers(team.id);
      membersMap[team.id] = members;
    }
    setTeamMembers(membersMap);
    const unassigned = await getUnassignedUsers();
    setUnassignedUsers(unassigned);
    setLoadingTeams(false);
  };

  useEffect(() => {
    if (activeTab === 'teams' && teams.length > 0) {
      fetchTeamsData();
    }
  }, [activeTab, teams]);

  const handleAssignUser = async (userId: string, teamId: string) => {
    const result = await assignUserToTeam(userId, teamId);
    if (result) {
      success('Przypisano!', 'Uzytkownik zostal przypisany do druzyny');
      await fetchTeamsData();
      await refetchTeams();
      fetchData();
    } else {
      showError('Blad', 'Nie udalo sie przypisac uzytkownika');
    }
  };

  const handleRemoveFromTeam = async (userId: string) => {
    const result = await removeUserFromTeam(userId);
    if (result) {
      success('Usunieto!', 'Uzytkownik zostal usuniety z druzyny');
      await fetchTeamsData();
      await refetchTeams();
      fetchData();
    } else {
      showError('Blad', 'Nie udalo sie usunac uzytkownika z druzyny');
    }
  };

  const tabs = [
    { id: 'overview', label: 'Przeglad', icon: BarChart3 },
    { id: 'submissions', label: 'Zgloszenia', icon: Clock, badge: stats.pendingSubmissions },
    { id: 'missions', label: 'Misje', icon: Target, badge: stats.totalMissions },
    { id: 'teams', label: 'Druzyny', icon: Users, badge: teams.length },
    { id: 'users', label: 'Gracze', icon: Users, badge: stats.totalUsers },
  ];

  return (
    <div className="py-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-turbo-500/20 flex items-center justify-center">
          <Shield className="w-6 h-6 text-turbo-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Panel Admina</h1>
          <p className="text-sm text-dark-400">Zarzadzaj Turbo Grywalizacja</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-4 px-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as AdminTab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-turbo-500 text-white'
                : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                tab.id === 'submissions' ? 'bg-red-500' : 'bg-dark-600'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="h-24 animate-pulse bg-dark-700" />
          ))}
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Card className="text-center">
                  <Users className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-white">{stats.totalUsers}</div>
                  <div className="text-sm text-dark-400">Graczy</div>
                </Card>

                <Card className="text-center">
                  <Target className="w-8 h-8 text-turbo-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-white">
                    {stats.activeMissions}/{stats.totalMissions}
                  </div>
                  <div className="text-sm text-dark-400">Aktywnych misji</div>
                </Card>

                <Card className="text-center">
                  <Clock className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-white">{stats.pendingSubmissions}</div>
                  <div className="text-sm text-dark-400">Do weryfikacji</div>
                </Card>

                <Card className="text-center">
                  <BarChart3 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-white">{formatNumber(stats.totalXP)}</div>
                  <div className="text-sm text-dark-400">Łączne XP</div>
                </Card>
              </div>

              {stats.pendingSubmissions > 0 && (
                <Card className="border-yellow-500/30 bg-yellow-500/5">
                  <div className="flex items-center gap-3">
                    <Clock className="w-6 h-6 text-yellow-500" />
                    <div className="flex-1">
                      <p className="font-medium text-white">Oczekujące zgłoszenia</p>
                      <p className="text-sm text-dark-400">
                        {stats.pendingSubmissions} zgłoszeń wymaga weryfikacji
                      </p>
                    </div>
                    <Button size="sm" onClick={() => setActiveTab('submissions')}>
                      Sprawdź
                    </Button>
                  </div>
                </Card>
              )}

              {/* Szybkie akcje */}
              <Card>
                <h3 className="font-semibold text-white mb-3">Szybkie akcje</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" size="sm" onClick={openCreateMission}>
                    <Plus className="w-4 h-4 mr-1" />
                    Nowa misja
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setActiveTab('users')}>
                    <Users className="w-4 h-4 mr-1" />
                    Zobacz graczy
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* Submissions Tab */}
          {activeTab === 'submissions' && (
            <div className="space-y-3">
              {pendingSubmissions.length === 0 ? (
                <Card className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-white font-medium">Wszystko sprawdzone!</p>
                  <p className="text-dark-400 text-sm">Brak oczekujących zgłoszeń</p>
                </Card>
              ) : (
                pendingSubmissions.map(submission => (
                  <Card
                    key={submission.id}
                    hover
                    onClick={() => {
                      setSelectedSubmission(submission);
                      setShowSubmissionModal(true);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {submission.photo_url && (
                        <div className="w-16 h-16 rounded-lg bg-dark-700 overflow-hidden flex-shrink-0">
                          <img
                            src={submission.photo_url}
                            alt="Zgłoszenie"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">
                          {submission.mission?.title}
                        </p>
                        <p className="text-sm text-dark-400">
                          od: <span className="text-accent-400">{submission.user?.nick}</span>
                        </p>
                        <p className="text-xs text-dark-500">
                          {formatDateTime(submission.created_at)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="warning">Oczekuje</Badge>
                        <span className="text-xs text-turbo-400">
                          +{submission.mission?.xp_reward} XP
                        </span>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Missions Tab */}
          {activeTab === 'missions' && (
            <div className="space-y-4">
              <Button fullWidth onClick={openCreateMission}>
                <Plus className="w-5 h-5 mr-2" />
                Dodaj nową misję
              </Button>

              <div className="space-y-3">
                {missions.length === 0 ? (
                  <Card className="text-center py-8">
                    <Target className="w-12 h-12 text-dark-600 mx-auto mb-3" />
                    <p className="text-dark-400">Brak misji</p>
                    <p className="text-sm text-dark-500">Dodaj pierwszą misję powyżej</p>
                  </Card>
                ) : (
                  missions.map(mission => (
                    <Card key={mission.id}>
                      {/* Nagłówek misji */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="text-2xl">{missionTypeIcons[mission.type]}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{mission.title}</p>
                          <p className="text-sm text-dark-400">
                            {missionTypeNames[mission.type]} • {mission.xp_reward} XP
                          </p>
                        </div>
                        <Badge variant={mission.status === 'active' ? 'success' : 'default'}>
                          {mission.status === 'active' ? 'Aktywna' : 'Nieaktywna'}
                        </Badge>
                      </div>

                      {/* Opis */}
                      <p className="text-sm text-dark-300 mb-3 line-clamp-2">{mission.description}</p>

                      {mission.location_name && (
                        <p className="text-xs text-dark-400 mb-2">
                          📍 {mission.location_name}
                        </p>
                      )}

                      {/* Przyciski akcji - zawsze widoczne */}
                      <div className="flex flex-wrap gap-2 pt-3 border-t border-dark-700">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openEditMission(mission)}
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          Edytuj
                        </Button>

                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleToggleMissionStatus(mission)}
                        >
                          {mission.status === 'active' ? (
                            <>
                              <ToggleRight className="w-4 h-4 mr-1" />
                              Wyłącz
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-4 h-4 mr-1" />
                              Włącz
                            </>
                          )}
                        </Button>

                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            setMissionToDelete(mission);
                            setShowDeleteDialog(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Usuń
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Teams Tab */}
          {activeTab === 'teams' && (
            <div className="space-y-4">
              {/* Unassigned Users */}
              {unassignedUsers.length > 0 && (
                <Card className="border-yellow-500/30 bg-yellow-500/5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-yellow-500" />
                      <span className="font-medium text-white">
                        Nieprzypisani uzytkownicy ({unassignedUsers.length})
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {unassignedUsers.map(user => (
                      <div key={user.id} className="flex items-center gap-3 p-2 bg-dark-800/50 rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center text-sm font-medium overflow-hidden">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            user.nick.charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="flex-1 text-white text-sm">{user.nick}</span>
                        <select
                          className="bg-dark-700 border border-dark-600 rounded-lg px-2 py-1 text-sm text-white"
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAssignUser(user.id, e.target.value);
                              e.target.value = '';
                            }
                          }}
                          defaultValue=""
                        >
                          <option value="">Przypisz do...</option>
                          {teams.map(team => (
                            <option key={team.id} value={team.id}>
                              {team.emoji} {team.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Teams List */}
              {loadingTeams ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <Card key={i} className="h-32 animate-pulse bg-dark-700" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {teams.map(team => (
                    <Card key={team.id}>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">{team.emoji}</span>
                        <div className="flex-1">
                          <h3 className="font-bold text-white">{team.name}</h3>
                          <p className="text-sm text-dark-400">
                            {team.member_count} czlonkow • {formatNumber(team.total_xp)} XP
                          </p>
                        </div>
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: team.color }}
                        />
                      </div>

                      {/* Team members */}
                      <div className="space-y-1">
                        {(teamMembers[team.id] || []).length === 0 ? (
                          <p className="text-sm text-dark-400 text-center py-2">
                            Brak czlonkow
                          </p>
                        ) : (
                          (teamMembers[team.id] || []).map(member => (
                            <div
                              key={member.id}
                              className="flex items-center gap-2 p-2 bg-dark-800/50 rounded-lg"
                            >
                              <div className="w-7 h-7 rounded-full bg-dark-700 flex items-center justify-center text-xs font-medium overflow-hidden">
                                {member.avatar_url ? (
                                  <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  member.nick.charAt(0).toUpperCase()
                                )}
                              </div>
                              <span className="flex-1 text-sm text-white">{member.nick}</span>
                              <span className="text-xs text-turbo-400">{formatNumber(member.total_xp)} XP</span>
                              <button
                                onClick={() => handleRemoveFromTeam(member.id)}
                                className="p-1 text-dark-400 hover:text-red-400 transition-colors"
                                title="Usun z druzyny"
                              >
                                <UserMinus className="w-4 h-4" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-3">
              {users.map((user, index) => (
                <Card key={user.id} hover onClick={() => openUserDetails(user)}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-yellow-500 text-black' :
                      index === 1 ? 'bg-gray-400 text-black' :
                      index === 2 ? 'bg-amber-700 text-white' :
                      'bg-dark-700 text-dark-300'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-dark-700 flex items-center justify-center text-white font-bold overflow-hidden">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.nick} className="w-full h-full object-cover" />
                      ) : (
                        user.nick.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white truncate">{user.nick}</p>
                        {user.is_admin && (
                          <Badge variant="turbo" size="sm">Admin</Badge>
                        )}
                      </div>
                      <p className="text-sm text-dark-400 truncate">{user.email}</p>
                    </div>
                    <div className="text-right mr-2">
                      <div className="font-bold text-turbo-400">{formatNumber(user.total_xp)}</div>
                      <div className="text-xs text-dark-500">XP</div>
                    </div>
                    <Eye className="w-5 h-5 text-dark-400" />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Mission Modal (Create/Edit) */}
      <Modal
        isOpen={showMissionModal}
        onClose={() => {
          setShowMissionModal(false);
          resetMissionForm();
        }}
        title={isEditing ? 'Edytuj misję' : 'Nowa misja'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Tytuł misji *"
            value={missionForm.title}
            onChange={e => setMissionForm(prev => ({ ...prev, title: e.target.value }))}
            placeholder="np. Selfie z maskotką"
          />

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-1.5">Opis *</label>
            <textarea
              value={missionForm.description}
              onChange={e => setMissionForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Opisz co użytkownik ma zrobić..."
              className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-2.5 text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-turbo-500 min-h-[100px] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1.5">Typ misji</label>
              <select
                value={missionForm.type}
                onChange={e => setMissionForm(prev => ({ ...prev, type: e.target.value as Mission['type'] }))}
                className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-2.5 text-white"
              >
                <option value="photo">📷 Zdjęcie</option>
                <option value="qr_code">📱 Kod QR</option>
                <option value="quiz">❓ Quiz</option>
                <option value="gps">📍 Lokalizacja GPS</option>
                <option value="manual">✋ Ręczna weryfikacja</option>
              </select>
            </div>

            <Input
              label="Nagroda XP"
              type="number"
              value={missionForm.xp_reward}
              onChange={e => setMissionForm(prev => ({ ...prev, xp_reward: parseInt(e.target.value) || 0 }))}
              min={1}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1.5">Status</label>
              <select
                value={missionForm.status}
                onChange={e => setMissionForm(prev => ({ ...prev, status: e.target.value as MissionStatus }))}
                className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-2.5 text-white"
              >
                <option value="active">✅ Aktywna</option>
                <option value="inactive">⏸️ Nieaktywna</option>
              </select>
            </div>

            <Input
              label="Lokalizacja"
              value={missionForm.location_name}
              onChange={e => setMissionForm(prev => ({ ...prev, location_name: e.target.value }))}
              placeholder="np. Hala główna"
            />
          </div>

          {missionForm.type === 'qr_code' && (
            <Input
              label="Wartość kodu QR"
              value={missionForm.qr_code_value}
              onChange={e => setMissionForm(prev => ({ ...prev, qr_code_value: e.target.value }))}
              placeholder="Zostaw puste dla autogeneracji"
              helperText="Unikalny kod który będzie zakodowany w QR"
            />
          )}

          {/* Quiz Editor */}
          {missionForm.type === 'quiz' && (
            <div className="space-y-4 border-t border-dark-700 pt-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-white flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-turbo-500" />
                  Edytor Quizu
                </h4>
                <Button size="sm" onClick={addQuestion}>
                  <Plus className="w-4 h-4 mr-1" />
                  Dodaj pytanie
                </Button>
              </div>

              {/* Tryb quizu */}
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-1.5">
                  Tryb quizu
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMissionForm(prev => ({ ...prev, quiz_mode: 'classic' }))}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      missionForm.quiz_mode === 'classic'
                        ? 'border-turbo-500 bg-turbo-500/10'
                        : 'border-dark-600 hover:border-dark-500'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-turbo-400" />
                      <span className="font-medium text-white">Classic</span>
                    </div>
                    <p className="text-xs text-dark-400">
                      Quiz z limitem czasu, odlicza w dół
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMissionForm(prev => ({ ...prev, quiz_mode: 'speedrun' }))}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      missionForm.quiz_mode === 'speedrun'
                        ? 'border-turbo-500 bg-turbo-500/10'
                        : 'border-dark-600 hover:border-dark-500'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Award className="w-4 h-4 text-yellow-400" />
                      <span className="font-medium text-white">Speedrun</span>
                    </div>
                    <p className="text-xs text-dark-400">
                      Mierzy czas ukończenia, ranking czasowy
                    </p>
                  </button>
                </div>
              </div>

              {/* Ustawienia quizu */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-1.5">
                    Próg zaliczenia (%)
                  </label>
                  <input
                    type="number"
                    value={missionForm.quiz_passing_score}
                    onChange={e => setMissionForm(prev => ({
                      ...prev,
                      quiz_passing_score: Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                    }))}
                    min={0}
                    max={100}
                    className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-2.5 text-white"
                  />
                </div>
                {missionForm.quiz_mode === 'classic' && (
                  <div>
                    <label className="block text-sm font-medium text-dark-200 mb-1.5">
                      Limit czasu (sekundy)
                    </label>
                    <input
                      type="number"
                      value={missionForm.quiz_time_limit}
                      onChange={e => setMissionForm(prev => ({
                        ...prev,
                        quiz_time_limit: Math.max(0, parseInt(e.target.value) || 0)
                      }))}
                      min={0}
                      placeholder="0 = bez limitu"
                      className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-2.5 text-white"
                    />
                    <p className="text-xs text-dark-400 mt-1">0 = bez limitu czasowego</p>
                  </div>
                )}
                {missionForm.quiz_mode === 'speedrun' && (
                  <div className="flex items-center">
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-sm">
                      <p className="text-yellow-400 font-medium">Tryb Speedrun</p>
                      <p className="text-xs text-dark-400 mt-1">
                        Czas będzie mierzony automatycznie. Tylko wyniki z 100% poprawnych odpowiedzi trafią do rankingu.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Lista pytań */}
              {missionForm.quiz_questions.length === 0 ? (
                <Card variant="outlined" className="text-center py-6">
                  <HelpCircle className="w-10 h-10 text-dark-500 mx-auto mb-2" />
                  <p className="text-dark-400">Brak pytań</p>
                  <p className="text-sm text-dark-500">Kliknij "Dodaj pytanie" aby rozpocząć</p>
                </Card>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {missionForm.quiz_questions.map((question, qIndex) => (
                    <Card key={question.id} variant="outlined" className="relative">
                      <div className="flex items-start gap-2 mb-3">
                        <span className="bg-turbo-500 text-white text-xs font-bold px-2 py-1 rounded">
                          {qIndex + 1}
                        </span>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={question.question}
                            onChange={e => updateQuestion(question.id, 'question', e.target.value)}
                            placeholder="Treść pytania..."
                            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => removeQuestion(question.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Odpowiedzi */}
                      <div className="space-y-2 ml-8">
                        <p className="text-xs text-dark-400 mb-1">Odpowiedzi (kliknij radio aby zaznaczyć poprawną):</p>
                        {question.answers.map((answer, aIndex) => (
                          <div key={answer.id} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct_${question.id}`}
                              checked={answer.is_correct}
                              onChange={() => setCorrectAnswer(question.id, answer.id)}
                              className="w-4 h-4 text-turbo-500 bg-dark-700 border-dark-500 focus:ring-turbo-500"
                            />
                            <input
                              type="text"
                              value={answer.text}
                              onChange={e => updateAnswer(question.id, answer.id, 'text', e.target.value)}
                              placeholder={`Odpowiedź ${aIndex + 1}...`}
                              className={`flex-1 bg-dark-700 border rounded-lg px-3 py-1.5 text-sm ${
                                answer.is_correct
                                  ? 'border-green-500 text-green-400'
                                  : 'border-dark-600 text-white'
                              }`}
                            />
                            {question.answers.length > 2 && (
                              <button
                                type="button"
                                onClick={() => removeAnswer(question.id, answer.id)}
                                className="text-dark-400 hover:text-red-400"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        {question.answers.length < 6 && (
                          <button
                            type="button"
                            onClick={() => addAnswer(question.id)}
                            className="text-sm text-turbo-400 hover:text-turbo-300 flex items-center gap-1 mt-1"
                          >
                            <Plus className="w-3 h-3" />
                            Dodaj odpowiedź
                          </button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {missionForm.quiz_questions.length > 0 && (
                <div className="text-sm text-dark-400 bg-dark-800 rounded-lg p-3">
                  <strong>Podsumowanie:</strong> {missionForm.quiz_questions.length} pytań,
                  tryb: {missionForm.quiz_mode === 'speedrun' ? 'Speedrun' : 'Classic'},
                  próg zaliczenia: {missionForm.quiz_passing_score}%
                  {missionForm.quiz_mode === 'classic' && missionForm.quiz_time_limit > 0 && `, limit: ${missionForm.quiz_time_limit}s`}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setShowMissionModal(false);
                resetMissionForm();
              }}
              className="flex-1"
            >
              Anuluj
            </Button>
            <Button onClick={handleSaveMission} className="flex-1">
              {isEditing ? 'Zapisz zmiany' : 'Utwórz misję'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Submission Review Modal */}
      <Modal
        isOpen={showSubmissionModal && selectedSubmission !== null}
        onClose={() => {
          setShowSubmissionModal(false);
          setSelectedSubmission(null);
        }}
        title="Weryfikacja zgłoszenia"
        size="lg"
      >
        {selectedSubmission && (
          <div className="space-y-4">
            <Card variant="outlined">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-dark-400">Misja</p>
                  <p className="font-medium text-white">{selectedSubmission.mission?.title}</p>
                </div>
                <div>
                  <p className="text-dark-400">Nagroda</p>
                  <p className="font-medium text-turbo-400">{selectedSubmission.mission?.xp_reward} XP</p>
                </div>
                <div>
                  <p className="text-dark-400">Gracz</p>
                  <p className="font-medium text-white">{selectedSubmission.user?.nick}</p>
                </div>
                <div>
                  <p className="text-dark-400">Data</p>
                  <p className="text-white">{formatDateTime(selectedSubmission.created_at)}</p>
                </div>
              </div>
            </Card>

            {selectedSubmission.photo_url && (
              <div>
                <p className="text-sm text-dark-400 mb-2">Przesłane zdjęcie:</p>
                <img
                  src={selectedSubmission.photo_url}
                  alt="Zgłoszenie"
                  className="w-full rounded-xl max-h-80 object-contain bg-dark-800"
                />
              </div>
            )}

            {selectedSubmission.quiz_score !== null && (
              <Card variant="outlined">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-dark-400">Wynik quizu</p>
                    <p className="text-2xl font-bold text-white">{selectedSubmission.quiz_score}%</p>
                  </div>
                  {selectedSubmission.quiz_time_ms && (
                    <div className="text-right">
                      <p className="text-sm text-dark-400">Czas (Speedrun)</p>
                      <p className="text-2xl font-bold text-turbo-400">
                        {(selectedSubmission.quiz_time_ms / 1000).toFixed(2)}s
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                variant="danger"
                onClick={() => handleRejectSubmission(selectedSubmission)}
                className="flex-1"
              >
                <XCircle className="w-5 h-5 mr-2" />
                Odrzuć
              </Button>
              <Button
                variant="success"
                onClick={() => handleApproveSubmission(selectedSubmission)}
                className="flex-1"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Zatwierdź
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setMissionToDelete(null);
        }}
        onConfirm={handleDeleteMission}
        title="Usuń misję"
        message={`Czy na pewno chcesz usunąć misję "${missionToDelete?.title}"? Ta operacja jest nieodwracalna.`}
        confirmText="Usuń"
        cancelText="Anuluj"
        variant="danger"
      />

      {/* User Details Modal */}
      <Modal
        isOpen={showUserModal}
        onClose={() => {
          setShowUserModal(false);
          setSelectedUser(null);
          setUserSubmissions([]);
        }}
        title={`Profil: ${selectedUser?.nick || ''}`}
        size="lg"
      >
        {selectedUser && (
          <div className="space-y-4">
            {/* Dane użytkownika */}
            <Card variant="outlined">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-dark-700 flex items-center justify-center text-2xl font-bold text-white overflow-hidden">
                  {selectedUser.avatar_url ? (
                    <img src={selectedUser.avatar_url} alt={selectedUser.nick} className="w-full h-full object-cover" />
                  ) : (
                    selectedUser.nick.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{selectedUser.nick}</h3>
                    {selectedUser.is_admin && <Badge variant="turbo">Admin</Badge>}
                  </div>
                  <p className="text-turbo-400 font-semibold">
                    {formatNumber(selectedUser.total_xp)} XP • Poziom {selectedUser.level}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex items-center gap-2 text-dark-300">
                  <Mail className="w-4 h-4" />
                  <span>{selectedUser.email}</span>
                </div>
                {selectedUser.phone && (
                  <div className="flex items-center gap-2 text-dark-300">
                    <Phone className="w-4 h-4" />
                    <span>{selectedUser.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-dark-300">
                  <Calendar className="w-4 h-4" />
                  <span>Dołączył: {formatDateTime(selectedUser.created_at)}</span>
                </div>
              </div>
            </Card>

            {/* Statystyki misji */}
            {loadingUserDetails ? (
              <div className="text-center py-4 text-dark-400">Ładowanie...</div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2">
                  <Card className="text-center py-3">
                    <div className="text-lg font-bold text-green-400">{getUserStats().approved}</div>
                    <div className="text-xs text-dark-400">Zaliczone</div>
                  </Card>
                  <Card className="text-center py-3">
                    <div className="text-lg font-bold text-yellow-400">{getUserStats().pending}</div>
                    <div className="text-xs text-dark-400">Oczekuje</div>
                  </Card>
                  <Card className="text-center py-3">
                    <div className="text-lg font-bold text-red-400">{getUserStats().rejected}</div>
                    <div className="text-xs text-dark-400">Odrzucone</div>
                  </Card>
                  <Card className="text-center py-3">
                    <div className="text-lg font-bold text-turbo-400">{getUserStats().totalXpEarned}</div>
                    <div className="text-xs text-dark-400">Zdobyte XP</div>
                  </Card>
                </div>

                {/* Lista zgłoszeń */}
                <div>
                  <h4 className="text-sm font-medium text-dark-300 mb-2">
                    Historia zgłoszeń ({userSubmissions.length})
                  </h4>

                  {userSubmissions.length === 0 ? (
                    <Card variant="outlined" className="text-center py-4">
                      <p className="text-dark-400">Brak zgłoszeń</p>
                    </Card>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {userSubmissions.map(submission => (
                        <Card key={submission.id} variant="outlined" padding="sm">
                          <div className="flex items-center gap-3">
                            <div className="text-xl">
                              {submission.mission ? missionTypeIcons[submission.mission.type] : '❓'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">
                                {submission.mission?.title || 'Nieznana misja'}
                              </p>
                              <p className="text-xs text-dark-400">
                                {formatDateTime(submission.created_at)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {submission.status === 'approved' && (
                                <>
                                  <Badge variant="success" size="sm">Zaliczone</Badge>
                                  <span className="text-xs text-turbo-400">+{submission.xp_awarded} XP</span>
                                </>
                              )}
                              {submission.status === 'pending' && (
                                <Badge variant="warning" size="sm">Oczekuje</Badge>
                              )}
                              {submission.status === 'rejected' && (
                                <Badge variant="danger" size="sm">Odrzucone</Badge>
                              )}
                            </div>
                          </div>
                          {submission.photo_url && (
                            <div className="mt-2">
                              <img
                                src={submission.photo_url}
                                alt="Zdjęcie"
                                className="w-full h-32 object-cover rounded-lg"
                              />
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setShowUserModal(false);
                setSelectedUser(null);
                setUserSubmissions([]);
              }}
            >
              Zamknij
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
