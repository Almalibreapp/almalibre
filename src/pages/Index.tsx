import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { SplashScreen } from '@/components/SplashScreen';
import { AuthForm } from '@/components/auth/AuthForm';
import { Dashboard } from './Dashboard';
import { useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

async function prefetchStoreProducts() {
  const { data, error } = await supabase.functions.invoke('woocommerce-products', { body: {} });
  if (error || data?.error) return [];
  return data?.products ?? [];
}

const Index = () => {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole(user?.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const prefetchedRef = useRef(false);

  // Prefetch store products as soon as the user is authenticated (runs once per session)
  useEffect(() => {
    if (user && !prefetchedRef.current) {
      prefetchedRef.current = true;
      queryClient.prefetchQuery({
        queryKey: ['store-products-v2'],
        queryFn: prefetchStoreProducts,
        staleTime: 15 * 60 * 1000,
      });
    }
  }, [user, queryClient]);

  useEffect(() => {
    if (user && !roleLoading && isAdmin) {
      navigate('/admin', { replace: true });
    }
  }, [user, isAdmin, roleLoading, navigate]);

  if (loading || (user && roleLoading)) {
    return <SplashScreen />;
  }

  if (!user) {
    return <AuthForm />;
  }

  return <Dashboard />;
};

export default Index;

