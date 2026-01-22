'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'urgent';
  created_by: string;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
  is_read?: boolean;
}

export function useAnnouncements(userId?: string) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchAnnouncements = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      // Pobierz wszystkie aktywne ogłoszenia
      const { data: allAnnouncements, error: annError } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .or('expires_at.is.null,expires_at.gt.now()')
        .order('created_at', { ascending: false });

      if (annError) throw annError;

      // Pobierz przeczytane przez tego użytkownika
      const { data: reads, error: readsError } = await supabase
        .from('announcement_reads')
        .select('announcement_id')
        .eq('user_id', userId);

      if (readsError) throw readsError;

      const readIds = new Set((reads || []).map(r => r.announcement_id));

      // Połącz dane
      const withReadStatus = (allAnnouncements || []).map(a => ({
        ...a,
        is_read: readIds.has(a.id)
      }));

      setAnnouncements(withReadStatus);
      setUnreadCount(withReadStatus.filter(a => !a.is_read).length);
    } catch (e) {
      console.error('Error fetching announcements:', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAnnouncements();

    // Subskrybuj nowe ogłoszenia w czasie rzeczywistym
    const channel = supabase
      .channel('announcements_channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcements' },
        (payload) => {
          const newAnnouncement = { ...payload.new, is_read: false } as Announcement;
          setAnnouncements(prev => [newAnnouncement, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'announcements' },
        () => {
          fetchAnnouncements();
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'announcements' },
        () => {
          fetchAnnouncements();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAnnouncements]);

  const markAsRead = async (announcementId: string) => {
    if (!userId) return;

    const { error } = await supabase
      .from('announcement_reads')
      .upsert({
        announcement_id: announcementId,
        user_id: userId
      }, {
        onConflict: 'announcement_id,user_id'
      });

    if (!error) {
      setAnnouncements(prev =>
        prev.map(a => a.id === announcementId ? { ...a, is_read: true } : a)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = async () => {
    if (!userId) return;

    const unreadIds = announcements.filter(a => !a.is_read).map(a => a.id);

    for (const id of unreadIds) {
      await supabase
        .from('announcement_reads')
        .upsert({
          announcement_id: id,
          user_id: userId
        }, {
          onConflict: 'announcement_id,user_id'
        });
    }

    setAnnouncements(prev => prev.map(a => ({ ...a, is_read: true })));
    setUnreadCount(0);
  };

  return {
    announcements,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refresh: fetchAnnouncements
  };
}

// Hook dla admina - zarządzanie ogłoszeniami
export function useAnnouncementsAdmin() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAnnouncements(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const createAnnouncement = async (
    title: string,
    message: string,
    type: Announcement['type'],
    expiresAt?: Date
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Nie zalogowany' };

    const { error } = await supabase
      .from('announcements')
      .insert({
        title,
        message,
        type,
        created_by: user.id,
        expires_at: expiresAt?.toISOString() || null,
        is_active: true
      });

    if (error) {
      return { success: false, error: error.message };
    }

    fetchAll();
    return { success: true, error: null };
  };

  const deleteAnnouncement = async (id: string) => {
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    fetchAll();
    return { success: true, error: null };
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from('announcements')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    fetchAll();
    return { success: true, error: null };
  };

  return {
    announcements,
    loading,
    createAnnouncement,
    deleteAnnouncement,
    toggleActive,
    refresh: fetchAll
  };
}
