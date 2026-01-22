'use client';

import { useState } from 'react';
import { Card, Button, Badge, Input, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useAnnouncementsAdmin, Announcement } from '@/hooks/useAnnouncements';
import { formatDateTime } from '@/lib/utils';
import {
  Bell,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  Info,
  CheckCircle,
  AlertTriangle,
  Send,
  Clock,
} from 'lucide-react';

const typeConfig: Record<Announcement['type'], { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  info: { label: 'Informacja', icon: Info, color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  success: { label: 'Sukces', icon: CheckCircle, color: 'text-green-400', bgColor: 'bg-green-500/20' },
  warning: { label: 'Ostrzeżenie', icon: AlertTriangle, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
  urgent: { label: 'Pilne!', icon: AlertCircle, color: 'text-red-400', bgColor: 'bg-red-500/20' },
};

export default function AnnouncementsAdmin() {
  const { success, error: showError } = useToast();
  const { announcements, loading, createAnnouncement, deleteAnnouncement, toggleActive } = useAnnouncementsAdmin();

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    title: '',
    message: '',
    type: 'info' as Announcement['type'],
    expiresIn: '', // puste = nie wygasa, lub minuty
  });
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      showError('Błąd', 'Wypełnij tytuł i treść');
      return;
    }

    setSending(true);

    let expiresAt: Date | undefined;
    if (form.expiresIn) {
      const minutes = parseInt(form.expiresIn, 10);
      if (!isNaN(minutes) && minutes > 0) {
        expiresAt = new Date(Date.now() + minutes * 60 * 1000);
      }
    }

    const result = await createAnnouncement(form.title, form.message, form.type, expiresAt);

    setSending(false);

    if (result.success) {
      success('Wysłano!', 'Ogłoszenie zostało wysłane do wszystkich graczy');
      setShowModal(false);
      setForm({ title: '', message: '', type: 'info', expiresIn: '' });
    } else {
      showError('Błąd', result.error || 'Nie udało się wysłać ogłoszenia');
    }
  };

  const handleDelete = async (id: string) => {
    const result = await deleteAnnouncement(id);
    if (result.success) {
      success('Usunięto', 'Ogłoszenie zostało usunięte');
    } else {
      showError('Błąd', result.error || 'Nie udało się usunąć');
    }
  };

  const handleToggle = async (id: string, currentState: boolean) => {
    const result = await toggleActive(id, !currentState);
    if (result.success) {
      success(currentState ? 'Wyłączono' : 'Włączono', `Ogłoszenie jest teraz ${currentState ? 'nieaktywne' : 'aktywne'}`);
    } else {
      showError('Błąd', result.error || 'Nie udało się zmienić statusu');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Bell className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="font-bold text-white">Ogłoszenia</h2>
            <p className="text-sm text-dark-400">Wysyłaj powiadomienia do graczy</p>
          </div>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nowe ogłoszenie
        </Button>
      </div>

      {/* Quick send buttons */}
      <Card className="p-4">
        <p className="text-sm text-dark-400 mb-3">Szybkie ogłoszenia:</p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setForm({
                title: '🏁 Wyścig startuje!',
                message: 'Nowy wyścig właśnie się rozpoczął! Wejdź w zakładkę Wyścigi i weź udział!',
                type: 'urgent',
                expiresIn: '30'
              });
              setShowModal(true);
            }}
          >
            🏁 Wyścig startuje
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setForm({
                title: '🎯 Nowa misja dostępna!',
                message: 'Dodaliśmy nową misję bonusową. Sprawdź w zakładce Misje!',
                type: 'success',
                expiresIn: '60'
              });
              setShowModal(true);
            }}
          >
            🎯 Nowa misja
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setForm({
                title: '⏰ Przerwa',
                message: 'Czas na przerwę! Wracamy za 30 minut.',
                type: 'info',
                expiresIn: '30'
              });
              setShowModal(true);
            }}
          >
            ⏰ Przerwa
          </Button>
        </div>
      </Card>

      {/* Announcements list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="h-24 animate-pulse bg-dark-700" />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <Card className="text-center py-12">
          <Bell className="w-16 h-16 text-dark-600 mx-auto mb-4" />
          <p className="text-dark-400">Brak ogłoszeń</p>
          <p className="text-sm text-dark-500">Kliknij "Nowe ogłoszenie" aby wysłać pierwsze</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map(announcement => {
            const config = typeConfig[announcement.type];
            const Icon = config.icon;
            const isExpired = announcement.expires_at && new Date(announcement.expires_at) < new Date();

            return (
              <Card
                key={announcement.id}
                className={`p-4 ${!announcement.is_active || isExpired ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${config.bgColor}`}>
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-white">{announcement.title}</h3>
                      <Badge variant={announcement.is_active && !isExpired ? 'success' : 'default'} size="sm">
                        {isExpired ? 'Wygasło' : announcement.is_active ? 'Aktywne' : 'Wyłączone'}
                      </Badge>
                    </div>
                    <p className="text-sm text-dark-300 mb-2">{announcement.message}</p>
                    <div className="flex items-center gap-4 text-xs text-dark-500">
                      <span>{formatDateTime(announcement.created_at)}</span>
                      {announcement.expires_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Wygasa: {formatDateTime(announcement.expires_at)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleToggle(announcement.id, announcement.is_active)}
                    >
                      {announcement.is_active ? (
                        <ToggleRight className="w-4 h-4" />
                      ) : (
                        <ToggleLeft className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDelete(announcement.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Nowe ogłoszenie"
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Tytuł"
            value={form.title}
            onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
            placeholder="np. Wyścig startuje za 5 minut!"
          />

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-1.5">Treść</label>
            <textarea
              value={form.message}
              onChange={e => setForm(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Treść ogłoszenia..."
              className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-2.5 text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-turbo-500 min-h-[100px] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-1.5">Typ</label>
              <select
                value={form.type}
                onChange={e => setForm(prev => ({ ...prev, type: e.target.value as Announcement['type'] }))}
                className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-2.5 text-white"
              >
                <option value="info">ℹ️ Informacja</option>
                <option value="success">✅ Sukces</option>
                <option value="warning">⚠️ Ostrzeżenie</option>
                <option value="urgent">🚨 Pilne!</option>
              </select>
            </div>

            <Input
              label="Wygasa po (minuty)"
              type="number"
              value={form.expiresIn}
              onChange={e => setForm(prev => ({ ...prev, expiresIn: e.target.value }))}
              placeholder="puste = nie wygasa"
              min={1}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowModal(false)}
              className="flex-1"
            >
              Anuluj
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={sending}
              className="flex-1"
            >
              {sending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Wysyłanie...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Wyślij do wszystkich
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
