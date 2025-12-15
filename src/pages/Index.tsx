import { useAuth } from '@/hooks/useAuth';
import { SplashScreen } from '@/components/SplashScreen';
import { AuthForm } from '@/components/auth/AuthForm';
import { Dashboard } from './Dashboard';

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  if (!user) {
    return <AuthForm />;
  }

  return <Dashboard />;
};

export default Index;
