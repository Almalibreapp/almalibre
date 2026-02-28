import { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Mail, Lock, User, Phone, Loader2, ArrowRight } from 'lucide-react';
import logoIcon from '@/assets/logo-icon-almalibre.png';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});

const registerSchema = z.object({
  nombre: z.string().min(2, 'Nombre muy corto').max(100, 'Nombre muy largo'),
  email: z.string().email('Email inválido'),
  telefono: z.string().min(8, 'Teléfono inválido').max(20, 'Teléfono muy largo'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

export const AuthForm = () => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { signIn, signUp } = useAuth();

  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = loginSchema.safeParse(loginData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    const { error } = await signIn(loginData.email, loginData.password);
    setLoading(false);

    if (error) {
      toast({
        title: 'Error al iniciar sesión',
        description: error.message === 'Invalid login credentials' 
          ? 'Credenciales inválidas' 
          : error.message,
        variant: 'destructive',
      });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = registerSchema.safeParse(registerData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    const { error } = await signUp(
      registerData.email,
      registerData.password,
      registerData.nombre,
      registerData.telefono
    );
    setLoading(false);

    if (error) {
      if (error.message.includes('already registered')) {
        toast({
          title: 'Usuario ya existe',
          description: 'Este email ya está registrado. Intenta iniciar sesión.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error al registrar',
          description: error.message,
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Cuenta creada',
        description: 'Tu cuenta ha sido creada exitosamente.',
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary via-primary/95 to-primary/80 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -right-32 w-72 h-72 bg-white/8 rounded-full blur-3xl animate-float" />
        <div className="absolute top-1/3 -left-20 w-60 h-60 bg-white/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }} />
        <div className="absolute bottom-20 right-10 w-48 h-48 bg-white/6 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-radial from-white/5 to-transparent rounded-full" />
      </div>

      {/* Top branding area */}
      <div className="relative z-10 flex flex-col items-center pt-12 pb-6 px-6 lg:pt-16">
        <div className="animate-splash-logo">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-white/20 blur-lg animate-glow" />
            <img 
              src={logoIcon} 
              alt="Almalibre" 
              className="h-16 w-16 lg:h-20 lg:w-20 rounded-2xl shadow-2xl relative z-10" 
            />
          </div>
        </div>
        <h1 className="mt-4 text-2xl lg:text-3xl font-display font-bold text-white animate-fade-in" style={{ animationDelay: '0.2s' }}>
          Almalibre
        </h1>
        <p className="text-white/50 text-xs mt-1 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          Plataforma de Gestión de Franquicias
        </p>
      </div>

      {/* Form card - slides up from bottom like a native sheet */}
      <div className="relative z-10 flex-1 mt-2">
        <div 
          className="bg-background rounded-t-[2rem] min-h-full px-6 pt-8 pb-10 animate-fade-in-up shadow-[0_-10px_60px_rgba(0,0,0,0.15)]"
          style={{ animationDelay: '0.3s' }}
        >
          <div className="w-full max-w-md mx-auto">
            {/* Tab Switcher */}
            <div className="flex gap-1 p-1 bg-muted rounded-2xl mb-6">
              <button
                onClick={() => setActiveTab('login')}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all duration-300 ${
                  activeTab === 'login'
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Iniciar Sesión
              </button>
              <button
                onClick={() => setActiveTab('register')}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all duration-300 ${
                  activeTab === 'register'
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Crear Cuenta
              </button>
            </div>

            {/* Login Form */}
            {activeTab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-1">
                  <h2 className="text-xl font-display font-bold text-foreground">
                    Bienvenido de vuelta
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Ingresa tus credenciales para continuar
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Email
                    </Label>
                    <div className="relative group">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="tu@email.com"
                        className="pl-10 h-12 bg-muted/50 border-0 rounded-xl focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all text-base"
                        value={loginData.email}
                        onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      />
                    </div>
                    {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="login-password" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Contraseña
                    </Label>
                    <div className="relative group">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10 h-12 bg-muted/50 border-0 rounded-xl focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all text-base"
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      />
                    </div>
                    {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl text-base font-semibold group shadow-lg shadow-primary/25"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      Entrar
                      <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </Button>
              </form>
            )}

            {/* Register Form */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-5">
                <div className="space-y-1">
                  <h2 className="text-xl font-display font-bold text-foreground">
                    Crear cuenta
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Únete a la red de franquiciados
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="register-nombre" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Nombre completo
                    </Label>
                    <div className="relative group">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                      <Input
                        id="register-nombre"
                        type="text"
                        placeholder="Juan Pérez"
                        className="pl-10 h-12 bg-muted/50 border-0 rounded-xl focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all text-base"
                        value={registerData.nombre}
                        onChange={(e) => setRegisterData({ ...registerData, nombre: e.target.value })}
                      />
                    </div>
                    {errors.nombre && <p className="text-xs text-destructive">{errors.nombre}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="register-email" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Email
                    </Label>
                    <div className="relative group">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="tu@email.com"
                        className="pl-10 h-12 bg-muted/50 border-0 rounded-xl focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all text-base"
                        value={registerData.email}
                        onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                      />
                    </div>
                    {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="register-telefono" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Teléfono
                    </Label>
                    <div className="relative group">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                      <Input
                        id="register-telefono"
                        type="tel"
                        placeholder="+34 612 345 678"
                        className="pl-10 h-12 bg-muted/50 border-0 rounded-xl focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all text-base"
                        value={registerData.telefono}
                        onChange={(e) => setRegisterData({ ...registerData, telefono: e.target.value })}
                      />
                    </div>
                    {errors.telefono && <p className="text-xs text-destructive">{errors.telefono}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="register-password" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Contraseña
                    </Label>
                    <div className="relative group">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                      <Input
                        id="register-password"
                        type="password"
                        placeholder="Mínimo 8 caracteres"
                        className="pl-10 h-12 bg-muted/50 border-0 rounded-xl focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all text-base"
                        value={registerData.password}
                        onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                      />
                    </div>
                    {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="register-confirm" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Confirmar contraseña
                    </Label>
                    <div className="relative group">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                      <Input
                        id="register-confirm"
                        type="password"
                        placeholder="Repite tu contraseña"
                        className="pl-10 h-12 bg-muted/50 border-0 rounded-xl focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all text-base"
                        value={registerData.confirmPassword}
                        onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                      />
                    </div>
                    {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl text-base font-semibold group shadow-lg shadow-primary/25"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      Crear Cuenta
                      <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </Button>
              </form>
            )}

            {/* Footer */}
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Al continuar, aceptas nuestros{' '}
              <a href="#" className="text-primary hover:underline">Términos</a>
              {' '}y{' '}
              <a href="#" className="text-primary hover:underline">Privacidad</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
