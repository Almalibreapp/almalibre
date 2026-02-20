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
  // Safety timeout: never show splash for more than 6 seconds regardless of any loading state
  const [safetyTimeout, setSafetyTimeout] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSafetyTimeout(true), 6000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (user && !roleLoading && isAdmin) {
      navigate('/admin', { replace: true });
    }
  }, [user, isAdmin, roleLoading, navigate]);

  // Show splash only while genuinely loading, but never more than 6s (safetyTimeout)
  const isStillLoading = !safetyTimeout && (loading || (user && roleLoading));

  if (isStillLoading) {
    return <SplashScreen />;
  }

  if (!user) {
    return <AuthForm />;
  }

  return <Dashboard />;
};


export default Index;

