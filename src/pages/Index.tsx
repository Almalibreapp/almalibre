import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { SplashScreen } from '@/components/SplashScreen';
import { AuthForm } from '@/components/auth/AuthForm';
import { Dashboard } from './Dashboard';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole(user?.id);
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !roleLoading && isAdmin) {
      navigate('/admin', { replace: true });
    }
  }, [user, isAdmin, roleLoading, navigate]);

  // Only block on auth loading (role loads fast and doesn't need to block)
  if (authLoading) {
    return <SplashScreen />;
  }

  if (!user) {
    return <AuthForm />;
  }

  return <Dashboard />;
};

export default Index;
