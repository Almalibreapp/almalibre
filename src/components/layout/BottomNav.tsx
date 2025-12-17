import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ShoppingBag, Sparkles, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', icon: Home, label: 'Inicio' },
  { path: '/store', icon: ShoppingBag, label: 'Pedidos' },
  { path: '/ai', icon: Sparkles, label: 'IA' },
  { path: '/settings', icon: User, label: 'Mi Perfil' },
];

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t safe-area-bottom">
      <div className="container flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== '/' && location.pathname.startsWith(item.path));
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-lg transition-colors min-w-[60px]',
                isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive && 'text-primary')} />
              <span className={cn('text-xs', isActive && 'font-medium')}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
