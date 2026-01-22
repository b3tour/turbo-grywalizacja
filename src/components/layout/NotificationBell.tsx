'use client';

import { useState, useEffect, useRef } from 'react';
import { useAnnouncements, Announcement } from '@/hooks/useAnnouncements';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime } from '@/lib/utils';
import {
  Bell,
  X,
  CheckCheck,
  Info,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';

const typeConfig: Record<Announcement['type'], { icon: React.ElementType; color: string; bgColor: string }> = {
  info: { icon: Info, color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  success: { icon: CheckCircle, color: 'text-green-400', bgColor: 'bg-green-500/20' },
  warning: { icon: AlertTriangle, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
  urgent: { icon: AlertCircle, color: 'text-red-400', bgColor: 'bg-red-500/20' },
};

interface NotificationBellProps {
  userId: string;
}

export default function NotificationBell({ userId }: NotificationBellProps) {
  const { announcements, unreadCount, markAsRead, markAllAsRead } = useAnnouncements(userId);
  const { info } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [lastSeenCount, setLastSeenCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Pokaż toast gdy przychodzi nowe ogłoszenie
  useEffect(() => {
    if (unreadCount > lastSeenCount && lastSeenCount > 0) {
      const newest = announcements.find(a => !a.is_read);
      if (newest) {
        info(newest.title, newest.message);
      }
    }
    setLastSeenCount(unreadCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount]); // Tylko unreadCount - info jest stabilny, announcements potencjalnie nie

  // Zamknij dropdown gdy klikniemy poza
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAnnouncementClick = (announcement: Announcement) => {
    if (!announcement.is_read) {
      markAsRead(announcement.id);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-dark-700 transition-colors"
      >
        <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-turbo-400' : 'text-dark-400'}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-80 max-h-96 bg-dark-800 border border-dark-700 rounded-xl shadow-xl overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700 bg-dark-850">
            <h3 className="font-medium text-white">Ogłoszenia</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-turbo-400 hover:text-turbo-300 flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" />
                  Oznacz wszystkie
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-dark-700 rounded"
              >
                <X className="w-4 h-4 text-dark-400" />
              </button>
            </div>
          </div>

          {/* Announcements list */}
          <div className="overflow-y-auto max-h-72">
            {announcements.length === 0 ? (
              <div className="text-center py-8 text-dark-400">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Brak ogłoszeń</p>
              </div>
            ) : (
              announcements.map(announcement => {
                const config = typeConfig[announcement.type];
                const Icon = config.icon;

                return (
                  <div
                    key={announcement.id}
                    onClick={() => handleAnnouncementClick(announcement)}
                    className={`px-4 py-3 border-b border-dark-700/50 cursor-pointer transition-colors hover:bg-dark-700/50 ${
                      !announcement.is_read ? 'bg-dark-750' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-1.5 rounded-lg ${config.bgColor} flex-shrink-0`}>
                        <Icon className={`w-4 h-4 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className={`text-sm font-medium truncate ${!announcement.is_read ? 'text-white' : 'text-dark-300'}`}>
                            {announcement.title}
                          </h4>
                          {!announcement.is_read && (
                            <span className="w-2 h-2 bg-turbo-500 rounded-full flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-dark-400 line-clamp-2 mt-0.5">
                          {announcement.message}
                        </p>
                        <p className="text-xs text-dark-500 mt-1">
                          {formatDateTime(announcement.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
