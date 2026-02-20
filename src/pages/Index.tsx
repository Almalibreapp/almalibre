import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { SplashScreen } from '@/components/SplashScreen';
import { AuthForm } from '@/components/auth/AuthForm';
import { Dashboard } from './Dashboard';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

const Index = () => {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole(user?.id);
  const navigate = useNavigate();
  // Safety timeout: never show splash for more than 5 seconds
  const [safetyTimeout, setSafetyTimeout] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSafetyTimeout(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (user && !roleLoading && isAdmin) {
      navigate('/admin', { replace: true });
    }
  }, [user, isAdmin, roleLoading, navigate]);

  // Show splash only while auth is loading, or while checking role (with safety timeout)
  const isStillLoading = loading || (user && roleLoading && !safetyTimeout);

  if (isStillLoading) {
    return <SplashScreen />;
  }

  if (!user) {
    return <AuthForm />;
  }

  return <Dashboard />;
};

export default Index;

