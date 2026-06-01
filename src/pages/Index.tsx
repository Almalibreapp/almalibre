import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useAcademyStatus } from '@/hooks/useAcademyStatus';
import { SplashScreen } from '@/components/SplashScreen';
import { AuthForm } from '@/components/auth/AuthForm';
import { RoleSelector } from '@/components/auth/RoleSelector';
import { Dashboard } from './Dashboard';
import { Academy } from './Academy';
import { useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole(user?.id);
  const academy = useAcademyStatus();
  const location = useLocation();
  const [showRoleSelector, setShowRoleSelector] = useState(false);

  const skipRoleSelect = (location.state as any)?.skipRoleSelect;

  useEffect(() => {
    if (user && !roleLoading && isAdmin && !skipRoleSelect) {
      setShowRoleSelector(true);
    } else {
      setShowRoleSelector(false);
    }
  }, [user, isAdmin, roleLoading, skipRoleSelect]);

  if (authLoading) {
    return <SplashScreen />;
  }

  if (!user) {
    return <AuthForm />;
  }

  if (showRoleSelector) {
    return <RoleSelector />;
  }

  // Gate de formación obligatoria: franquiciados deben certificarse antes de acceder
  if (!isAdmin && !roleLoading && !academy.isLoading && academy.data && !academy.data.certified && (academy.data.modulos?.length ?? 0) > 0) {
    return <Academy />;
  }

  return <Dashboard />;
};

export default Index;
