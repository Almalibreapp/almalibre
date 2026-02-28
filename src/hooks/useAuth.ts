import { useState, useEffect, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      setProfile(data as Profile);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Step 1: Get the current session immediately (synchronous-ish)
    // This prevents the flash of "no session" before onAuthStateChange fires
    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          await fetchProfile(currentSession.user.id);
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
      } finally {
        if (isMounted) {
          initializedRef.current = true;
          setLoading(false);
        }
      }
    };

    // Step 2: Listen for ongoing auth changes AFTER initialization
    // IMPORTANT: We do NOT set loading here to avoid flickering
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!isMounted) return;

        // Ignore SIGNED_OUT events during the initial load window
        // (Supabase sometimes fires these spuriously during token refresh)
        if (event === 'SIGNED_OUT' && !initializedRef.current) {
          return;
        }

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Use setTimeout to avoid potential deadlocks during token refresh
          setTimeout(() => {
            if (isMounted) fetchProfile(newSession.user.id);
          }, 0);
        } else {
          setProfile(null);
        }
      }
    );

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, nombre: string, telefono: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { nombre, telefono },
      },
    });

    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  };

  const signOut = async () => {
    let error: Error | null = null;

    try {
      const result = await supabase.auth.signOut({ scope: 'local' });
      if (result.error && result.error.message !== 'Session from session_id claim in JWT does not exist') {
        error = result.error as Error;
      }
    } catch (e) {
      error = e as Error;
    } finally {
      // Force-clear any persisted auth tokens to avoid stale sessions
      Object.keys(localStorage)
        .filter((key) => key.startsWith('sb-') && key.endsWith('-auth-token'))
        .forEach((key) => localStorage.removeItem(key));

      setUser(null);
      setSession(null);
      setProfile(null);

      // This app uses useAuth in multiple places without a shared provider,
      // so we force a hard reload to guarantee all auth states are reset.
      window.location.replace('/');
    }

    return { error };
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('No user') };

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (!error && data) {
      setProfile(data as Profile);
    }

    return { data, error };
  };

  return {
    user,
    session,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
  };
};
