'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMissions } from '@/hooks/useMissions';
import { Card, Badge, Button, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { MissionCard, QRScanner, PhotoUpload, Quiz, GPSChecker } from '@/components/missions';
import { Mission, MissionType } from '@/types';
import { missionTypeIcons, missionTypeNames } from '@/lib/utils';
import { Target, Filter, X } from 'lucide-react';

type FilterType = 'all' | MissionType;

export default function MissionsPage() {
  const { profile } = useAuth();
  const {
    missions,
    userSubmissions,
    loading,
    completeMissionQR,
    completeMissionPhoto,
    completeMissionQuiz,
    completeMissionGPS,
  } = useMissions({ userId: profile?.id });
  const { success, error: showError, info } = useToast();

  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [showMissionModal, setShowMissionModal] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);

  if (!profile) return null;

  const filters: { value: FilterType; label: string; icon?: string }[] = [
    { value: 'all', label: 'Wszystkie' },
    { value: 'qr_code', label: 'QR', icon: missionTypeIcons.qr_code },
    { value: 'photo', label: 'Zdjęcie', icon: missionTypeIcons.photo },
    { value: 'quiz', label: 'Quiz', icon: missionTypeIcons.quiz },
    { value: 'gps', label: 'GPS', icon: missionTypeIcons.gps },
  ];

  const filteredMissions = missions.filter(
    m => filter === 'all' || m.type === filter
  );

  const getUserSubmission = (missionId: string) => {
    return userSubmissions.find(s => s.mission_id === missionId) || null;
  };

  const handleMissionClick = (mission: Mission) => {
    const submission = getUserSubmission(mission.id);

    if (submission?.status === 'approved') {
      info('Misja ukończona', 'Ta misja została już przez Ciebie wykonana');
      return;
    }

    if (submission?.status === 'pending') {
      info('Oczekuje na weryfikację', 'Twoje zgłoszenie jest weryfikowane');
      return;
    }

    setSelectedMission(mission);
    setShowMissionModal(true);
  };

  const handleStartMission = () => {
    if (!selectedMission) return;

    setShowMissionModal(false);

    switch (selectedMission.type) {
      case 'qr_code':
        setShowQRScanner(true);
        break;
      case 'photo':
        // PhotoUpload będzie w modalu
        setShowMissionModal(true);
        break;
      case 'quiz':
        // Quiz będzie w modalu
        setShowMissionModal(true);
        break;
      case 'gps':
        // GPS będzie w modalu
        setShowMissionModal(true);
        break;
    }
  };

  const handleQRScan = async (code: string) => {
    if (!selectedMission) return;

    const result = await completeMissionQR(selectedMission.id, code, profile.id);

    setShowQRScanner(false);
    setSelectedMission(null);

    if (result.success) {
      success('Misja ukończona!', `Zdobyłeś +${result.xp} XP`);
    } else {
      showError('Błąd', result.error || 'Nie udało się ukończyć misji');
    }
  };

  const handlePhotoUpload = async (url: string) => {
    if (!selectedMission) return;

    const result = await completeMissionPhoto(selectedMission.id, url, profile.id);

    setShowMissionModal(false);
    setSelectedMission(null);

    if (result.success) {
      info('Zgłoszenie wysłane!', 'Twoje zdjęcie czeka na weryfikację');
    } else {
      showError('Błąd', result.error || 'Nie udało się wysłać zdjęcia');
    }
  };

  const handleQuizComplete = async (answers: Record<string, string>, timeMs?: number) => {
    if (!selectedMission) return;

    const isSpeedrun = selectedMission.quiz_data?.mode === 'speedrun';
    const result = await completeMissionQuiz(selectedMission.id, answers, profile.id, timeMs);

    setShowMissionModal(false);
    setSelectedMission(null);

    if (result.success) {
      if (result.passed) {
        if (isSpeedrun && timeMs) {
          const seconds = (timeMs / 1000).toFixed(2);
          success('Quiz zaliczony!', `Czas: ${seconds}s - Zdobyłeś +${result.xp} XP`);
        } else {
          success('Quiz zaliczony!', `Wynik: ${result.score}% - Zdobyłeś +${result.xp} XP`);
        }
      } else {
        showError('Quiz niezaliczony', `Wynik: ${result.score}% - Wymagane: ${selectedMission.quiz_data?.passing_score}%`);
      }
    } else {
      showError('Błąd', result.error || 'Nie udało się ukończyć quizu');
    }
  };

  const handleGPSSuccess = async (lat: number, lng: number) => {
    if (!selectedMission) return;

    const result = await completeMissionGPS(selectedMission.id, lat, lng, profile.id);

    setShowMissionModal(false);
    setSelectedMission(null);

    if (result.success) {
      success('Lokalizacja potwierdzona!', `Zdobyłeś +${result.xp} XP`);
    } else {
      showError('Błąd', result.error || 'Nie udało się potwierdzić lokalizacji');
    }
  };

  const renderMissionContent = () => {
    if (!selectedMission) return null;

    switch (selectedMission.type) {
      case 'photo':
        return (
          <PhotoUpload
            onUpload={handlePhotoUpload}
            onCancel={() => {
              setShowMissionModal(false);
              setSelectedMission(null);
            }}
            requirements={selectedMission.photo_requirements}
            userId={profile.id}
            missionId={selectedMission.id}
          />
        );

      case 'quiz':
        if (!selectedMission.quiz_data) return null;
        return (
          <Quiz
            quizData={selectedMission.quiz_data}
            onComplete={handleQuizComplete}
            onCancel={() => {
              setShowMissionModal(false);
              setSelectedMission(null);
            }}
          />
        );

      case 'gps':
        if (!selectedMission.location_lat || !selectedMission.location_lng) return null;
        return (
          <GPSChecker
            targetLat={selectedMission.location_lat}
            targetLng={selectedMission.location_lng}
            targetRadius={selectedMission.location_radius || 50}
            locationName={selectedMission.location_name}
            onSuccess={handleGPSSuccess}
            onCancel={() => {
              setShowMissionModal(false);
              setSelectedMission(null);
            }}
          />
        );

      default:
        // Domyślny widok szczegółów misji
        return (
          <div className="p-4">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">{missionTypeIcons[selectedMission.type]}</div>
              <h3 className="text-xl font-bold text-white">{selectedMission.title}</h3>
              <Badge variant="turbo" className="mt-2">
                +{selectedMission.xp_reward} XP
              </Badge>
            </div>

            <p className="text-dark-300 mb-6">{selectedMission.description}</p>

            {selectedMission.location_name && (
              <div className="mb-4 p-3 bg-dark-700 rounded-xl">
                <p className="text-sm text-dark-400">Lokalizacja</p>
                <p className="text-white">{selectedMission.location_name}</p>
              </div>
            )}

            <Button fullWidth size="lg" onClick={handleStartMission}>
              Rozpocznij misję
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Target className="w-7 h-7 text-turbo-500" />
          Misje
        </h1>
        <Badge variant="default">
          {filteredMissions.length} dostępnych
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4">
        {filters.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f.value
                ? 'bg-turbo-500 text-white'
                : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
            }`}
          >
            {f.icon && <span>{f.icon}</span>}
            {f.label}
          </button>
        ))}
      </div>

      {/* Missions List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="h-32 animate-pulse bg-dark-700" />
          ))}
        </div>
      ) : filteredMissions.length > 0 ? (
        <div className="space-y-3">
          {filteredMissions.map(mission => (
            <MissionCard
              key={mission.id}
              mission={mission}
              userSubmission={getUserSubmission(mission.id)}
              onClick={() => handleMissionClick(mission)}
            />
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <Filter className="w-12 h-12 text-dark-600 mx-auto mb-3" />
          <p className="text-dark-400">Brak misji dla wybranych filtrów</p>
        </Card>
      )}

      {/* Mission Modal */}
      <Modal
        isOpen={showMissionModal && selectedMission !== null && selectedMission.type !== 'qr_code'}
        onClose={() => {
          setShowMissionModal(false);
          setSelectedMission(null);
        }}
        title={selectedMission?.type === 'qr_code' ? undefined : selectedMission?.title}
        size="lg"
      >
        {renderMissionContent()}
      </Modal>

      {/* QR Scanner (full screen) */}
      {showQRScanner && selectedMission && (
        <QRScanner
          expectedCode={selectedMission.qr_code_value}
          onScan={handleQRScan}
          onClose={() => {
            setShowQRScanner(false);
            setSelectedMission(null);
          }}
        />
      )}
    </div>
  );
}
