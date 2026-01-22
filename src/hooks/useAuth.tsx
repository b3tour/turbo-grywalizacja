'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { User } from '@/types';

interface AuthState {
  session: Session | null;
  user: SupabaseUser | null;
  profile: User | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  isAuthenticated: boolean;
  hasProfile: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<{ success: boolean; error: string | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ success: boolean; error: string | null }>;
  signInWithPassword: (email: string, password: string) => Promise<{ success: boolean; error: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<{ success: boolean; error: string | null }>;
  createProfile: (nick: string, phone?: string) => Promise<{ success: boolean; error: string | null }>;
  checkNickAvailable: (nick: string) => Promise<boolean>;
  getEmailByNick: (nick: string) => Promise<string | null>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Cache dla profilu - persystentny w localStorage
const PROFILE_CACHE_KEY = 'turbo_profile_cache';
const SESSION_CACHE_KEY = 'turbo_session_cache';

function getProfileFromCache(userId: string): User | null {
  try {
    const cached = localStorage.getItem(PROFILE_CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      if (data.userId === userId && Date.now() - data.timestamp < 300000) { // 5 minut
        return data.profile;
      }
    }
  } catch (e) {}
  return null;
}

function saveProfileToCache(userId: string, profile: User) {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
      userId,
      profile,
      timestamp: Date.now()
    }));
  } catch (e) {}
}

function clearProfileCache() {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY);
    localStorage.removeItem(SESSION_CACHE_KEY);
  } catch (e) {}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    loading: true,
    error: null,
  });

  // Pobierz profil z bazy
  const fetchProfile = useCallback(async (userId: string): Promise<User | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, nick, phone, avatar_url, total_xp, level, team_id, is_admin, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      saveProfileToCache(userId, data as User);
      return data as User;
    } catch (e) {
      return null;
    }
  }, []);

  // Szybka inicjalizacja - najpierw cache, potem serwer
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      // Krok 1: Szybko sprawdź czy mamy sesję (bez czekania na serwer)
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session?.user) {
          // Mamy sesję - najpierw pokaż z cache
          const cachedProfile = getProfileFromCache(session.user.id);

          if (cachedProfile) {
            // Pokaż od razu z cache
            setState({
              session,
              user: session.user,
              profile: cachedProfile,
              loading: false,
              error: null,
            });

            // Odśwież profil w tle
            fetchProfile(session.user.id).then(freshProfile => {
              if (mounted && freshProfile) {
                setState(prev => ({ ...prev, profile: freshProfile }));
              }
            });
          } else {
            // Brak cache - pobierz profil (max 5 sekund)
            const profilePromise = fetchProfile(session.user.id);
            const timeoutPromise = new Promise<null>((resolve) => {
              setTimeout(() => resolve(null), 5000);
            });

            const profile = await Promise.race([profilePromise, timeoutPromise]);

            if (mounted) {
              setState({
                session,
                user: session.user,
                profile,
                loading: false,
                error: null,
              });
            }
          }
        } else {
          // Brak sesji
          if (mounted) {
            setState({
              session: null,
              user: null,
              profile: null,
              loading: false,
              error: null,
            });
          }
        }
      } catch (error) {
        console.error('Auth init error:', error);
        if (mounted) {
          setState({
            session: null,
            user: null,
            profile: null,
            loading: false,
            error: null,
          });
        }
      }
    };

    // Ustaw krótki timeout na całą inicjalizację - max 8 sekund
    const globalTimeout = setTimeout(() => {
      if (mounted && state.loading) {
        console.warn('Auth global timeout - showing app without auth');
        setState(prev => ({ ...prev, loading: false }));
      }
    }, 8000);

    initAuth();

    // Nasłuchuj zmian autoryzacji
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      // Ignoruj INITIAL_SESSION - już obsłużone
      if (event === 'INITIAL_SESSION') return;

      if (session?.user) {
        // Najpierw pokaż z cache jeśli mamy
        const cachedProfile = getProfileFromCache(session.user.id);

        setState(prev => ({
          ...prev,
          session,
          user: session.user,
          profile: cachedProfile || prev.profile,
          loading: false,
        }));

        // Pobierz świeży profil
        const profile = await fetchProfile(session.user.id);
        if (mounted && profile) {
          setState(prev => ({ ...prev, profile }));
        }
      } else {
        clearProfileCache();
        setState({
          session: null,
          user: null,
          profile: null,
          loading: false,
          error: null,
        });
      }
    });

    return () => {
      mounted = false;
      clearTimeout(globalTimeout);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Logowanie przez Google
  const signInWithGoogle = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setState(prev => ({ ...prev, loading: false, error: error.message }));
    }
  };

  // Logowanie przez email (magic link)
  const signInWithEmail = async (email: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setState(prev => ({ ...prev, loading: false, error: error.message }));
      return { success: false, error: error.message };
    }

    setState(prev => ({ ...prev, loading: false }));
    return { success: true, error: null };
  };

  // Rejestracja z hasłem
  const signUpWithEmail = async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setState(prev => ({ ...prev, loading: false, error: error.message }));
      return { success: false, error: error.message };
    }

    setState(prev => ({ ...prev, loading: false }));
    return { success: true, error: null };
  };

  // Logowanie z hasłem
  const signInWithPassword = async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setState(prev => ({ ...prev, loading: false, error: error.message }));
      return { success: false, error: error.message };
    }

    setState(prev => ({ ...prev, loading: false }));
    return { success: true, error: null };
  };

  // Wylogowanie
  const signOut = async () => {
    setState(prev => ({ ...prev, loading: true }));
    clearProfileCache();
    await supabase.auth.signOut();
    setState({
      session: null,
      user: null,
      profile: null,
      loading: false,
      error: null,
    });
  };

  // Aktualizuj profil
  const updateProfile = async (updates: Partial<User>) => {
    if (!state.user) return { success: false, error: 'Nie jesteś zalogowany' };

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', state.user.id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    saveProfileToCache(state.user.id, data as User);
    setState(prev => ({ ...prev, profile: data as User }));
    return { success: true, error: null };
  };

  // Utwórz profil (po pierwszym logowaniu)
  const createProfile = async (nick: string, phone?: string) => {
    if (!state.user) {
      return { success: false, error: 'Nie jesteś zalogowany' };
    }

    try {
      const newProfile = {
        id: state.user.id,
        email: state.user.email!,
        nick,
        phone: phone || null,
        total_xp: 0,
        level: 1,
        is_admin: false,
      };

      const { data, error } = await supabase
        .from('users')
        .insert(newProfile)
        .select('id, email, nick, phone, avatar_url, total_xp, level, team_id, is_admin, created_at, updated_at')
        .single();

      if (error) {
        return { success: false, error: `Błąd tworzenia profilu: ${error.message}` };
      }

      if (!data) {
        return { success: false, error: 'Nie udało się utworzyć profilu - brak danych' };
      }

      saveProfileToCache(state.user.id, data as User);
      setState(prev => ({ ...prev, profile: data as User }));
      return { success: true, error: null };
    } catch (e) {
      return { success: false, error: 'Wystąpił nieoczekiwany błąd' };
    }
  };

  // Sprawdź czy nick jest dostępny
  const checkNickAvailable = useCallback(async (nick: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('nick', nick)
        .maybeSingle();

      if (error) {
        return true; // Przy błędzie zakładamy że dostępny
      }

      return data === null;
    } catch (e) {
      return true;
    }
  }, []);

  // Pobierz email po nicku (do logowania nickiem)
  const getEmailByNick = useCallback(async (nick: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('email')
        .eq('nick', nick)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return data.email;
    } catch (e) {
      return null;
    }
  }, []);

  // Odśwież profil
  const refreshProfile = async () => {
    if (!state.user) return;
    const profile = await fetchProfile(state.user.id);
    setState(prev => ({ ...prev, profile }));
  };

  const value: AuthContextType = {
    ...state,
    isAuthenticated: !!state.session,
    hasProfile: !!state.profile,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signInWithPassword,
    signOut,
    updateProfile,
    createProfile,
    checkNickAvailable,
    getEmailByNick,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
