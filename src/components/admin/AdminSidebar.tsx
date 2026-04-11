import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  IceCream,
  Users,
  Euro,
  LogOut,
  ArrowLeft,
  AlertTriangle,
  Mail,
  Ticket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoAlmalibre from '@/assets/logo-almalibre.png';

const navItems = [
  { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/admin/machines', icon: IceCream, label: 'Máquinas' },
  { path: '/admin/franchisees', icon: Users, label: 'Franquiciados' },
  { path: '/admin/sales', icon: Euro, label: 'Ventas y Análisis' },
  { path: '/admin/cupones', icon: Ticket, label: 'Cupones' },
  { path: '/admin/incidents', icon: AlertTriangle, label: 'Incidencias' },
  { path: '/admin/notifications', icon: Mail, label: 'Notificaciones' },
];

export const AdminSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin';
    // Also match /admin/machine/:id under "Máquinas"
    if (path === '/admin/machines') {
      return location.pathname.startsWith('/admin/machines') || location.pathname.startsWith('/admin/machine');
    }
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="w-64 min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img src={logoAlmalibre} alt="Almalibre" className="h-8 w-auto" />
          <div>
            <h2 className="font-display font-bold text-sm text-sidebar-foreground">Panel Admin</h2>
            <p className="text-xs text-muted-foreground">Almalibre</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                active
                  ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <item.icon className={cn("h-4 w-4", active && "text-primary-foreground")} />
              {item.label}
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-foreground" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/70"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a la App
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-destructive hover:text-destructive"
          onClick={async () => { await signOut(); navigate('/', { replace: true }); }}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Cerrar Sesión
        </Button>
      </div>
    </aside>
  );
};
