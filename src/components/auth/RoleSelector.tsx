import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Shield, IceCream, LogOut } from 'lucide-react';
import logoIcon from '@/assets/logo-icon-almalibre.png';

export const RoleSelector = () => {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-primary/70 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <img src={logoIcon} alt="Almalibre" className="h-16 w-16 mx-auto rounded-2xl shadow-lg" />
          <h1 className="text-2xl font-display font-bold text-white">
            Hola, {profile?.nombre || 'Usuario'}
          </h1>
          <p className="text-white/70 text-sm">¿A qué sección quieres acceder?</p>
        </div>

        {/* Options */}
        <div className="space-y-4">
          <button
            onClick={() => navigate('/admin', { replace: true })}
            className="w-full bg-white/15 backdrop-blur-xl border border-white/20 rounded-2xl p-5 flex items-center gap-4 text-white hover:bg-white/25 active:scale-[0.98] transition-all duration-200"
          >
            <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Shield className="h-6 w-6" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-base">Panel de Administración</p>
              <p className="text-white/60 text-xs">Gestión global, franquiciados y análisis</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/', { replace: true, state: { skipRoleSelect: true } })}
            className="w-full bg-white/15 backdrop-blur-xl border border-white/20 rounded-2xl p-5 flex items-center gap-4 text-white hover:bg-white/25 active:scale-[0.98] transition-all duration-200"
          >
            <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
              <IceCream className="h-6 w-6" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-base">Modo Franquiciado</p>
              <p className="text-white/60 text-xs">Mis máquinas, ventas y pedidos</p>
            </div>
          </button>
        </div>

        {/* Sign out */}
        <button
          onClick={async () => {
            if (isSigningOut) return;
            setIsSigningOut(true);
            await signOut();
          }}
          disabled={isSigningOut}
          className="w-full flex items-center justify-center gap-2 text-white/50 hover:text-white/80 text-sm transition-colors py-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <LogOut className="h-4 w-4" />
          {isSigningOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
        </button>
      </div>
    </div>
  );
};
