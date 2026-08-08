import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ShoppingBag, Ticket, User, MessageCircleHeart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

const baseItems = [
  { path: '/', icon: Home, label: 'Inicio' },
  { path: '/store', icon: ShoppingBag, label: 'Pedidos' },
  { path: '/cupones', icon: Ticket, label: 'Cupones' },
  { path: '/settings', icon: User, label: 'Mi Perfil' },
];

const soporteItem = { path: '/soporte-alma', icon: MessageCircleHeart, label: 'Soporte 24/7' };

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isAdmin } = useUserRole(user?.id);

  // Los administradores no ven el chat de soporte (tienen su panel en /admin)
  const navItems = isAdmin
    ? baseItems
    : [baseItems[0], baseItems[1], soporteItem, baseItems[2], baseItems[3]];


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
