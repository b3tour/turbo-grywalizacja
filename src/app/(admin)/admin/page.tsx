'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Card, Button, Badge, Input, Modal, AlertDialog } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { Mission, MissionStatus, Submission, User, QuizData, QuizQuestion, QuizMode } from '@/types';
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
  UserPlus,
  UserMinus,
  Trophy,
  Gavel,
  Menu,
  X,
  ChevronRight,
  Flag,
  Bell,
} from 'lucide-react';
import { useTeams } from '@/hooks/useTeams';
import { Team, TeamMember } from '@/types';
import { ChallengesAdmin, AuctionsAdmin, RacesAdmin, AnnouncementsAdmin } from '@/components/admin';
import QRCodeGenerator from '@/components/admin/QRCodeGenerator';

type AdminTab = 'overview' | 'announcements' | 'races' | 'challenges' | 'auctions' | 'submissions' | 'missions' | 'teams' | 'users';

const tabs: { id: AdminTab; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'overview', label: 'Przegląd', icon: BarChart3, description: 'Statystyki i podsumowanie' },
  { id: 'announcements', label: 'Ogłoszenia', icon: Bell, description: 'Powiadomienia dla graczy' },
  { id: 'races', label: 'Wyścigi', icon: Flag, description: 'Wyścigi drużynowe' },
  { id: 'challenges', label: 'Zadania', icon: Trophy, description: 'Zadania eventowe' },
  { id: 'auctions', label: 'Licytacje', icon: Gavel, description: 'Zarządzaj licytacjami' },
  { id: 'submissions', label: 'Zgłoszenia', icon: Clock, description: 'Weryfikuj zgłoszenia' },
  { id: 'missions', label: 'Misje', icon: Target, description: 'Zarządzaj misjami' },
  { id: 'teams', label: 'Drużyny', icon: Users, description: 'Przypisuj graczy' },
  { id: 'users', label: 'Gracze', icon: Users, description: 'Lista wszystkich graczy' },
];

export default function AdminPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const { success, error: showError } = useToast();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
  const [loadingTeams, setLoadingTeams] = useState(false);

  const [missionForm, setMissionForm] = useState({
    title: '',
    description: '',
    xp_reward: 50,
    type: 'photo' as Mission['type'],
    location_name: '',
    qr_code_value: '',
    status: 'active' as MissionStatus,
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

  // === USER DETAILS ===
  const openUserDetails = async (user: User) => {
    setSelectedUser(user);
    setShowUserModal(true);
    setLoadingUserDetails(true);

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

  // Teams data
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
      success('Przypisano!', 'Użytkownik został przypisany do drużyny');
      await fetchTeamsData();
      await refetchTeams();
      fetchData();
    } else {
      showError('Błąd', 'Nie udało się przypisać użytkownika');
    }
  };

  const handleRemoveFromTeam = async (userId: string) => {
    const result = await removeUserFromTeam(userId);
    if (result) {
      success('Usunięto!', 'Użytkownik został usunięty z drużyny');
      await fetchTeamsData();
      await refetchTeams();
      fetchData();
    } else {
      showError('Błąd', 'Nie udało się usunąć użytkownika z drużyny');
    }
  };

  if (!profile?.is_admin) {
    return null;
  }

  const currentTab = tabs.find(t => t.id === activeTab);

  return (
    <div className="min-h-screen bg-dark-900 lg:flex">
      {/* Mobile Header */}
      <div className="lg:hidden sticky top-0 z-40 bg-dark-900/95 backdrop-blur-lg border-b border-dark-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg bg-dark-800 text-white"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-bold text-white">{currentTab?.label}</h1>
              <p className="text-xs text-dark-400">{currentTab?.description}</p>
            </div>
          </div>
          {activeTab === 'submissions' && stats.pendingSubmissions > 0 && (
            <Badge variant="danger">{stats.pendingSubmissions}</Badge>
          )}
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-72 bg-dark-850 border-r border-dark-800
        transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0 lg:flex-shrink-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Sidebar Header */}
        <div className="p-6 border-b border-dark-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-turbo-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-turbo-500" />
              </div>
              <div>
                <h1 className="font-bold text-white">Panel Admina</h1>
                <p className="text-xs text-dark-400">Turbo Grywalizacja</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-dark-700 text-dark-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 pb-40 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 100px)' }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const badge = tab.id === 'submissions' ? stats.pendingSubmissions : null;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSidebarOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all
                  ${isActive
                    ? 'bg-turbo-500 text-white shadow-lg shadow-turbo-500/20'
                    : 'text-dark-300 hover:bg-dark-700 hover:text-white'
                  }
                `}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{tab.label}</p>
                  <p className={`text-xs truncate ${isActive ? 'text-white/70' : 'text-dark-500'}`}>
                    {tab.description}
                  </p>
                </div>
                {badge !== null && badge > 0 && (
                  <span className={`
                    px-2 py-0.5 text-xs font-bold rounded-full
                    ${isActive ? 'bg-white/20 text-white' : 'bg-red-500 text-white'}
                  `}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-dark-800 bg-dark-850">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-4 py-2 mb-2 rounded-xl bg-accent-500/10 hover:bg-accent-500/20 text-accent-400 transition-colors"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            <span className="text-sm font-medium">Panel gracza</span>
          </Link>
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center text-sm font-bold text-white">
              {profile.nick?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{profile.nick}</p>
              <p className="text-xs text-dark-400">Administrator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {/* Desktop Header */}
        <div className="hidden lg:block sticky top-0 z-40 bg-dark-900/95 backdrop-blur-lg border-b border-dark-800 px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{currentTab?.label}</h1>
              <p className="text-dark-400">{currentTab?.description}</p>
            </div>
            {activeTab === 'submissions' && stats.pendingSubmissions > 0 && (
              <Badge variant="danger" size="lg">{stats.pendingSubmissions} oczekujących</Badge>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 lg:p-8 overflow-x-hidden">
          {loading && activeTab === 'overview' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <Card key={i} className="h-32 animate-pulse bg-dark-700" />
              ))}
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="text-center p-6">
                      <Users className="w-10 h-10 text-blue-500 mx-auto mb-3" />
                      <div className="text-3xl font-bold text-white">{stats.totalUsers}</div>
                      <div className="text-dark-400">Graczy</div>
                    </Card>

                    <Card className="text-center p-6">
                      <Target className="w-10 h-10 text-turbo-500 mx-auto mb-3" />
                      <div className="text-3xl font-bold text-white">
                        {stats.activeMissions}/{stats.totalMissions}
                      </div>
                      <div className="text-dark-400">Aktywnych misji</div>
                    </Card>

                    <Card className="text-center p-6">
                      <Clock className="w-10 h-10 text-yellow-500 mx-auto mb-3" />
                      <div className="text-3xl font-bold text-white">{stats.pendingSubmissions}</div>
                      <div className="text-dark-400">Do weryfikacji</div>
                    </Card>

                    <Card className="text-center p-6">
                      <BarChart3 className="w-10 h-10 text-green-500 mx-auto mb-3" />
                      <div className="text-3xl font-bold text-white">{formatNumber(stats.totalXP)}</div>
                      <div className="text-dark-400">Łączne XP</div>
                    </Card>
                  </div>

                  {stats.pendingSubmissions > 0 && (
                    <Card className="border-yellow-500/30 bg-yellow-500/5 p-6">
                      <div className="flex items-center gap-4">
                        <Clock className="w-8 h-8 text-yellow-500" />
                        <div className="flex-1">
                          <p className="font-medium text-white text-lg">Oczekujące zgłoszenia</p>
                          <p className="text-dark-400">
                            {stats.pendingSubmissions} zgłoszeń wymaga weryfikacji
                          </p>
                        </div>
                        <Button onClick={() => setActiveTab('submissions')}>
                          Sprawdź teraz
                        </Button>
                      </div>
                    </Card>
                  )}

                  {/* Quick Actions */}
                  <Card className="p-6">
                    <h3 className="font-semibold text-white text-lg mb-4">Szybkie akcje</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <Button variant="secondary" onClick={openCreateMission}>
                        <Plus className="w-4 h-4 mr-2" />
                        Nowa misja
                      </Button>
                      <Button variant="secondary" onClick={() => setActiveTab('challenges')}>
                        <Trophy className="w-4 h-4 mr-2" />
                        Zadania
                      </Button>
                      <Button variant="secondary" onClick={() => setActiveTab('auctions')}>
                        <Gavel className="w-4 h-4 mr-2" />
                        Licytacje
                      </Button>
                      <Button variant="secondary" onClick={() => setActiveTab('teams')}>
                        <Users className="w-4 h-4 mr-2" />
                        Drużyny
                      </Button>
                    </div>
                  </Card>
                </div>
              )}

              {/* Announcements Tab */}
              {activeTab === 'announcements' && (
                <div>
                  <AnnouncementsAdmin />
                </div>
              )}

              {/* Races Tab */}
              {activeTab === 'races' && (
                <div>
                  <RacesAdmin />
                </div>
              )}

              {/* Challenges Tab */}
              {activeTab === 'challenges' && (
                <div>
                  <ChallengesAdmin />
                </div>
              )}

              {/* Auctions Tab */}
              {activeTab === 'auctions' && (
                <div>
                  <AuctionsAdmin />
                </div>
              )}

              {/* Submissions Tab */}
              {activeTab === 'submissions' && (
                <div className="space-y-4">
                  {pendingSubmissions.length === 0 ? (
                    <Card className="text-center py-12">
                      <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                      <p className="text-white font-medium text-lg">Wszystko sprawdzone!</p>
                      <p className="text-dark-400">Brak oczekujących zgłoszeń</p>
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
                        className="p-4"
                      >
                        <div className="flex items-center gap-4">
                          {submission.photo_url && (
                            <div className="w-20 h-20 rounded-lg bg-dark-700 overflow-hidden flex-shrink-0">
                              <img
                                src={submission.photo_url}
                                alt="Zgłoszenie"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white text-lg truncate">
                              {submission.mission?.title}
                            </p>
                            <p className="text-dark-400">
                              od: <span className="text-accent-400">{submission.user?.nick}</span>
                            </p>
                            <p className="text-sm text-dark-500">
                              {formatDateTime(submission.created_at)}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant="warning">Oczekuje</Badge>
                            <span className="text-turbo-400 font-medium">
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
                  <Button onClick={openCreateMission}>
                    <Plus className="w-5 h-5 mr-2" />
                    Dodaj nową misję
                  </Button>

                  {missions.length === 0 ? (
                    <Card className="text-center py-12">
                      <Target className="w-16 h-16 text-dark-600 mx-auto mb-4" />
                      <p className="text-dark-400">Brak misji</p>
                      <p className="text-sm text-dark-500">Dodaj pierwszą misję powyżej</p>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {missions.map(mission => (
                        <Card key={mission.id} className="p-4">
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

                          <p className="text-sm text-dark-300 mb-4 line-clamp-2">{mission.description}</p>

                          <div className="flex flex-wrap gap-2">
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
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Teams Tab */}
              {activeTab === 'teams' && (
                <div className="space-y-4">
                  {/* Unassigned Users */}
                  {unassignedUsers.length > 0 && (
                    <Card className="border-yellow-500/30 bg-yellow-500/5 p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <UserPlus className="w-6 h-6 text-yellow-500" />
                        <span className="font-medium text-white text-lg">
                          Nieprzypisani użytkownicy ({unassignedUsers.length})
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {unassignedUsers.map(user => (
                          <div key={user.id} className="flex items-center gap-3 p-3 bg-dark-800/50 rounded-xl">
                            <div className="w-10 h-10 rounded-full bg-dark-700 flex items-center justify-center text-sm font-medium overflow-hidden">
                              {user.avatar_url ? (
                                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                user.nick.charAt(0).toUpperCase()
                              )}
                            </div>
                            <span className="flex-1 text-white">{user.nick}</span>
                            <select
                              className="bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white"
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
                        <Card key={i} className="h-40 animate-pulse bg-dark-700" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {teams.map(team => (
                        <Card key={team.id} className="p-5">
                          <div className="flex items-center gap-3 mb-4">
                            <span className="text-3xl">{team.emoji}</span>
                            <div className="flex-1">
                              <h3 className="font-bold text-white text-lg">{team.name}</h3>
                              <p className="text-sm text-dark-400">
                                {team.member_count} członków • {formatNumber(team.total_xp)} XP
                              </p>
                            </div>
                            <div
                              className="w-5 h-5 rounded-full"
                              style={{ backgroundColor: team.color }}
                            />
                          </div>

                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {(teamMembers[team.id] || []).length === 0 ? (
                              <p className="text-sm text-dark-400 text-center py-3">
                                Brak członków
                              </p>
                            ) : (
                              (teamMembers[team.id] || []).map(member => (
                                <div
                                  key={member.id}
                                  className="flex items-center gap-3 p-2 bg-dark-800/50 rounded-lg"
                                >
                                  <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center text-xs font-medium overflow-hidden">
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
                                    title="Usuń z drużyny"
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
                    <Card key={user.id} hover onClick={() => openUserDetails(user)} className="p-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0 ? 'bg-yellow-500 text-black' :
                          index === 1 ? 'bg-gray-400 text-black' :
                          index === 2 ? 'bg-amber-700 text-white' :
                          'bg-dark-700 text-dark-300'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="w-12 h-12 rounded-full bg-dark-700 flex items-center justify-center text-white font-bold overflow-hidden">
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
                        <div className="text-right mr-3">
                          <div className="font-bold text-turbo-400 text-lg">{formatNumber(user.total_xp)}</div>
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
        </div>
      </main>

      {/* Mission Modal */}
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
                <option value="photo">Zdjęcie</option>
                <option value="qr_code">Kod QR</option>
                <option value="quiz">Quiz</option>
                <option value="gps">Lokalizacja GPS</option>
                <option value="manual">Ręczna weryfikacja</option>
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
                <option value="active">Aktywna</option>
                <option value="inactive">Nieaktywna</option>
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
            <div className="border-t border-dark-700 pt-4">
              <h4 className="text-sm font-medium text-dark-200 mb-3">Kod QR dla misji</h4>
              <QRCodeGenerator
                value={missionForm.qr_code_value}
                missionTitle={missionForm.title}
                size={200}
                onValueChange={(newValue) => setMissionForm(prev => ({ ...prev, qr_code_value: newValue }))}
              />
            </div>
          )}

          {/* Quiz Editor - Simplified for space */}
          {missionForm.type === 'quiz' && (
            <div className="space-y-4 border-t border-dark-700 pt-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-white flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-turbo-500" />
                  Edytor Quizu ({missionForm.quiz_questions.length} pytań)
                </h4>
                <Button size="sm" onClick={addQuestion}>
                  <Plus className="w-4 h-4 mr-1" />
                  Dodaj pytanie
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Próg zaliczenia (%)"
                  type="number"
                  value={missionForm.quiz_passing_score}
                  onChange={e => setMissionForm(prev => ({
                    ...prev,
                    quiz_passing_score: Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                  }))}
                  min={0}
                  max={100}
                />
                <div>
                  <label className="block text-sm font-medium text-dark-200 mb-1.5">Tryb</label>
                  <select
                    value={missionForm.quiz_mode}
                    onChange={e => setMissionForm(prev => ({ ...prev, quiz_mode: e.target.value as QuizMode }))}
                    className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-2.5 text-white"
                  >
                    <option value="classic">Classic (z limitem czasu)</option>
                    <option value="speedrun">Speedrun (mierzy czas)</option>
                  </select>
                </div>
              </div>

              {missionForm.quiz_questions.length > 0 && (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {missionForm.quiz_questions.map((question, qIndex) => (
                    <Card key={question.id} variant="outlined" className="p-3">
                      <div className="flex items-start gap-2 mb-2">
                        <span className="bg-turbo-500 text-white text-xs font-bold px-2 py-1 rounded">
                          {qIndex + 1}
                        </span>
                        <input
                          type="text"
                          value={question.question}
                          onChange={e => updateQuestion(question.id, 'question', e.target.value)}
                          placeholder="Treść pytania..."
                          className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm"
                        />
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => removeQuestion(question.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="space-y-1 ml-8">
                        {question.answers.map((answer, aIndex) => (
                          <div key={answer.id} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct_${question.id}`}
                              checked={answer.is_correct}
                              onChange={() => setCorrectAnswer(question.id, answer.id)}
                              className="w-4 h-4 text-turbo-500"
                            />
                            <input
                              type="text"
                              value={answer.text}
                              onChange={e => updateAnswer(question.id, answer.id, 'text', e.target.value)}
                              placeholder={`Odpowiedź ${aIndex + 1}...`}
                              className={`flex-1 bg-dark-700 border rounded-lg px-3 py-1.5 text-sm ${
                                answer.is_correct ? 'border-green-500 text-green-400' : 'border-dark-600 text-white'
                              }`}
                            />
                            {question.answers.length > 2 && (
                              <button
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
                      <p className="text-sm text-dark-400">Czas</p>
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
                              {submission.mission ? missionTypeIcons[submission.mission.type] : '?'}
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
