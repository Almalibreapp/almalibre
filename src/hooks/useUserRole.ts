import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'user';

export const useUserRole = (userId: string | undefined) => {
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setRole(null);
      setLoading(false);
      fetchedForRef.current = null;
      return;
    }

    // Don't re-fetch if we already have the role for this user
    if (fetchedForRef.current === userId) return;

    let isMounted = true;
    setLoading(true);

    const fetchRole = async () => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle();

        if (!isMounted) return;

        if (error) {
          console.error('Error fetching role:', error);
          setRole('user');
        } else {
          setRole((data?.role as AppRole) || 'user');
        }
        fetchedForRef.current = userId;
      } catch {
        if (isMounted) setRole('user');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRole();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  return { role, isAdmin: role === 'admin', loading };
};
