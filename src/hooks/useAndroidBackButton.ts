import { useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { App } from '@capacitor/app';
import { toast } from '@/hooks/use-toast';

export const useAndroidBackButton = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const lastBackPressRef = useRef<number>(0);
  const exitToastShownRef = useRef<boolean>(false);

  const handleBackButton = useCallback(() => {
    const currentPath = location.pathname;
    
    // If on main page (home)
    if (currentPath === '/' || currentPath === '') {
      const now = Date.now();
      const timeSinceLastPress = now - lastBackPressRef.current;
      
      // If pressed twice within 2 seconds, exit app
      if (timeSinceLastPress < 2000 && exitToastShownRef.current) {
        App.exitApp();
        return;
      }
      
      // Show exit confirmation toast
      lastBackPressRef.current = now;
      exitToastShownRef.current = true;
      toast({
        title: 'Presiona atrás de nuevo para salir',
        duration: 2000,
      });
      
      // Reset after 2 seconds
      setTimeout(() => {
        exitToastShownRef.current = false;
      }, 2000);
      
      return;
    }
    
    // If on a detail page, go back
    if (currentPath.startsWith('/machine/')) {
      if (currentPath.includes('/settings')) {
        // From settings, go to machine detail
        navigate(currentPath.replace('/settings', ''));
      } else {
        // From machine detail, go to home
        navigate('/');
      }
      return;
    }
    
    // For other pages, go to home
    navigate('/');
  }, [location.pathname, navigate]);

  useEffect(() => {
    let backButtonListener: any = null;

    const setupListener = async () => {
      try {
        backButtonListener = await App.addListener('backButton', () => {
          handleBackButton();
        });
      } catch (error) {
        // Not running in Capacitor (web browser)
        console.log('Not running in Capacitor environment');
      }
    };

    setupListener();

    return () => {
      if (backButtonListener) {
        backButtonListener.remove();
      }
    };
  }, [handleBackButton]);
};
