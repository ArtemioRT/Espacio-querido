import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import * as auth from '@/services/auth.service';
import type { Profile } from '@/types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isStaff: boolean;
  isAdmin: boolean;
  loading: boolean;
  /** true cuando el usuario llegó desde el enlace de "restablecer contraseña" */
  recoveryMode: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    try {
      setProfile(await auth.getProfile(userId));
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      if (mounted) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      if (event === 'SIGNED_OUT') setRecoveryMode(false);
      // Diferido para no bloquear el callback de Supabase
      setTimeout(() => loadProfile(newSession?.user.id), 0);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isStaff: !!profile?.active && (profile.role === 'admin' || profile.role === 'agent'),
      isAdmin: !!profile?.active && profile.role === 'admin',
      loading,
      recoveryMode,
      signIn: async (email, password) => {
        const { user } = await auth.signIn(email, password);
        const p = user ? await auth.getProfile(user.id) : null;
        if (!p || (p.role !== 'admin' && p.role !== 'agent')) {
          await auth.signOut();
          throw new Error('Tu cuenta no tiene acceso al panel de administración.');
        }
        if (!p.active) {
          await auth.signOut();
          throw new Error('Tu cuenta está desactivada. Contacta al administrador.');
        }
        setProfile(p);
      },
      signOut: async () => {
        await auth.signOut();
        setProfile(null);
      },
      refreshProfile: () => loadProfile(session?.user.id),
    }),
    [session, profile, loading, recoveryMode, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
