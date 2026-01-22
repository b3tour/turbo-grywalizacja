'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAnnouncements, Announcement } from '@/hooks/useAnnouncements';
import { Card, Badge } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import {
  Bell,
  Info,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Filter,
  CheckCheck,
  Clock,
  Megaphone,
} from 'lucide-react';

const typeConfig: Record<Announcement['type'], { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
  info: { icon: Info, color: 'text-blue-400', bgColor: 'bg-blue-500/20', label: 'Informacja' },
  success: { icon: CheckCircle, color: 'text-green-400', bgColor: 'bg-green-500/20', label: 'Sukces' },
  warning: { icon: AlertTriangle, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', label: 'Ostrzeżenie' },
  urgent: { icon: AlertCircle, color: 'text-red-400', bgColor: 'bg-red-500/20', label: 'Pilne' },
};

type FilterType = 'all' | 'unread' | 'read';

export default function AnnouncementsPage() {
  const { profile } = useAuth();
  const { announcements, unreadCount, loading, markAsRead, markAllAsRead } = useAnnouncements(profile?.id);
  const [filter, setFilter] = useState<FilterType>('all');

  if (!profile) return null;

  const filters: { value: FilterType; label: string; icon: React.ElementType }[] = [
    { value: 'all', label: 'Wszystkie', icon: Megaphone },
    { value: 'unread', label: 'Nieprzeczytane', icon: Bell },
    { value: 'read', label: 'Przeczytane', icon: CheckCheck },
  ];

  const filteredAnnouncements = announcements.filter(a => {
    if (filter === 'unread') return !a.is_read;
    if (filter === 'read') return a.is_read;
    return true;
  });

  const handleAnnouncementClick = (announcement: Announcement) => {
    if (!announcement.is_read) {
      markAsRead(announcement.id);
    }
  };

  return (
    <div className="py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Megaphone className="w-7 h-7 text-turbo-500" />
          Ogłoszenia
        </h1>
        {unreadCount > 0 && (
          <Badge variant="turbo">
            {unreadCount} nowych
          </Badge>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {filters.map(f => {
          const Icon = f.icon;
          const count = f.value === 'all'
            ? announcements.length
            : f.value === 'unread'
              ? unreadCount
              : announcements.length - unreadCount;

          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                filter === f.value
                  ? 'bg-turbo-500 text-white'
                  : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {f.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                filter === f.value ? 'bg-white/20' : 'bg-dark-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Mark all as read button */}
      {unreadCount > 0 && filter !== 'read' && (
        <button
          onClick={markAllAsRead}
          className="flex items-center gap-2 text-sm text-turbo-400 hover:text-turbo-300 mb-4"
        >
          <CheckCheck className="w-4 h-4" />
          Oznacz wszystkie jako przeczytane
        </button>
      )}

      {/* Announcements List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="h-24 animate-pulse bg-dark-700" />
          ))}
        </div>
      ) : filteredAnnouncements.length > 0 ? (
        <div className="space-y-3">
          {filteredAnnouncements.map(announcement => {
            const config = typeConfig[announcement.type];
            const Icon = config.icon;

            return (
              <Card
                key={announcement.id}
                className={`cursor-pointer transition-all hover:border-dark-600 ${
                  !announcement.is_read ? 'border-turbo-500/30 bg-turbo-500/5' : ''
                }`}
                onClick={() => handleAnnouncementClick(announcement)}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`p-3 rounded-xl ${config.bgColor} flex-shrink-0`}>
                    <Icon className={`w-6 h-6 ${config.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`font-semibold ${!announcement.is_read ? 'text-white' : 'text-dark-200'}`}>
                        {announcement.title}
                      </h3>
                      {!announcement.is_read && (
                        <span className="w-2 h-2 bg-turbo-500 rounded-full flex-shrink-0" />
                      )}
                    </div>

                    <p className={`text-sm mb-2 ${!announcement.is_read ? 'text-dark-300' : 'text-dark-400'}`}>
                      {announcement.message}
                    </p>

                    <div className="flex items-center gap-3 text-xs text-dark-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDateTime(announcement.created_at)}
                      </span>
                      <Badge
                        variant="default"
                        className={`text-xs ${config.bgColor} ${config.color} border-0`}
                      >
                        {config.label}
                      </Badge>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="text-center py-12">
          <Bell className="w-12 h-12 text-dark-600 mx-auto mb-3" />
          <p className="text-dark-400">
            {filter === 'unread'
              ? 'Brak nieprzeczytanych ogłoszeń'
              : filter === 'read'
                ? 'Brak przeczytanych ogłoszeń'
                : 'Brak ogłoszeń'
            }
          </p>
          {filter !== 'all' && (
            <button
              onClick={() => setFilter('all')}
              className="text-sm text-turbo-400 hover:text-turbo-300 mt-2"
            >
              Pokaż wszystkie
            </button>
          )}
        </Card>
      )}
    </div>
  );
}
