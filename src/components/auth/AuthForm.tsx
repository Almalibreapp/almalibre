import { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Mail, Lock, User, Phone, Loader2, ArrowRight } from 'lucide-react';
import logoIcon from '@/assets/logo-icon-almalibre.png';
import logoWhite from '@/assets/logo-almalibre-white.png';
import shapeWave from '@/assets/shape-wave.png';
import shapeLeaves from '@/assets/shape-leaves.png';
import shapeVertical from '@/assets/shape-vertical.png';

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
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
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
        description: error.message === 'Invalid login credentials' ? 'Credenciales inválidas' : error.message,
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
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setLoading(true);
    const { error } = await signUp(registerData.email, registerData.password, registerData.nombre, registerData.telefono);
    setLoading(false);
    if (error) {
      if (error.message.includes('already registered')) {
        toast({ title: 'Usuario ya existe', description: 'Este email ya está registrado.', variant: 'destructive' });
      } else {
        toast({ title: 'Error al registrar', description: error.message, variant: 'destructive' });
      }
    } else {
      toast({ title: 'Cuenta creada', description: 'Tu cuenta ha sido creada exitosamente.' });
    }
  };

  const inputClasses = "pl-10 h-12 bg-white/10 border-white/20 rounded-xl text-white placeholder:text-white/40 focus:bg-white/15 focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all text-base";
  const labelClasses = "text-[11px] font-medium text-white/60 uppercase tracking-widest";

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-gradient-to-br from-[hsl(290,57%,22%)] via-primary to-[hsl(290,70%,35%)] animate-gradient">
      {/* Brand shapes in background */}
      <img src={shapeWave} alt="" className="absolute bottom-0 left-0 w-full opacity-[0.08] pointer-events-none select-none" />
      <img src={shapeLeaves} alt="" className="absolute top-16 right-[-50px] w-44 h-44 opacity-[0.06] pointer-events-none select-none animate-float" style={{ animationDelay: '1s' }} />
      <img src={shapeLeaves} alt="" className="absolute bottom-40 left-[-30px] w-36 h-36 opacity-[0.05] pointer-events-none select-none rotate-[200deg] animate-float" style={{ animationDelay: '4s' }} />
      <img src={shapeVertical} alt="" className="absolute top-1/4 left-4 w-10 opacity-[0.04] pointer-events-none select-none animate-float" style={{ animationDelay: '2s' }} />
      <img src={shapeVertical} alt="" className="absolute top-1/3 right-6 w-8 opacity-[0.04] pointer-events-none select-none rotate-12 animate-float" style={{ animationDelay: '5s' }} />

      {/* Glowing orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -right-32 w-72 h-72 bg-white/[0.06] rounded-full blur-3xl animate-float" />
        <div className="absolute top-1/3 -left-20 w-60 h-60 bg-white/[0.04] rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }} />
        <div className="absolute bottom-20 right-10 w-48 h-48 bg-white/[0.05] rounded-full blur-3xl animate-pulse-slow" />
      </div>

      {/* Top branding */}
      <div className="relative z-10 flex flex-col items-center pt-14 pb-4 px-6">
        <div className="animate-splash-logo">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-white/20 blur-lg animate-glow" />
            <img src={logoIcon} alt="Almalibre" className="h-18 w-18 rounded-2xl shadow-2xl relative z-10" style={{ height: '72px', width: '72px' }} />
          </div>
        </div>
        <div className="mt-5 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <img src={logoWhite} alt="Almalibre" className="h-8 w-auto" />
        </div>
        <p className="text-white/35 text-[10px] mt-1.5 animate-fade-in tracking-[0.2em] uppercase" style={{ animationDelay: '0.3s' }}>
          Plataforma de Franquicias
        </p>
      </div>

      {/* Form area — glass card */}
      <div className="relative z-10 flex-1 mt-2">
        <div
          className="glass-dark rounded-t-[2rem] min-h-full px-6 pt-7 pb-10 animate-fade-in-up"
          style={{ animationDelay: '0.3s', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', borderTop: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div className="w-full max-w-md mx-auto">
            {/* Tab Switcher */}
            <div className="flex gap-1 p-1 bg-white/[0.08] rounded-2xl mb-6 border border-white/[0.06]">
              <button
                onClick={() => setActiveTab('login')}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all duration-300 ${
                  activeTab === 'login'
                    ? 'bg-white text-primary shadow-lg'
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                Iniciar Sesión
              </button>
              <button
                onClick={() => setActiveTab('register')}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all duration-300 ${
                  activeTab === 'register'
                    ? 'bg-white text-primary shadow-lg'
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                Crear Cuenta
              </button>
            </div>

            {/* Login Form */}
            {activeTab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-1">
                  <h2 className="text-xl font-display font-bold text-white">Bienvenido de vuelta</h2>
                  <p className="text-white/40 text-sm">Ingresa tus credenciales para continuar</p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email" className={labelClasses}>Email</Label>
                    <div className="relative group">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 transition-colors group-focus-within:text-white/70" />
                      <Input id="login-email" type="email" placeholder="tu@email.com" className={inputClasses} value={loginData.email} onChange={(e) => setLoginData({ ...loginData, email: e.target.value })} />
                    </div>
                    {errors.email && <p className="text-xs text-red-300">{errors.email}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="login-password" className={labelClasses}>Contraseña</Label>
                    <div className="relative group">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 transition-colors group-focus-within:text-white/70" />
                      <Input id="login-password" type="password" placeholder="••••••••" className={inputClasses} value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} />
                    </div>
                    {errors.password && <p className="text-xs text-red-300">{errors.password}</p>}
                  </div>
                </div>

                <Button type="submit" className="w-full h-12 rounded-xl text-base font-semibold group bg-white text-primary hover:bg-white/90 shadow-xl" disabled={loading}>
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (<>Entrar<ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" /></>)}
                </Button>
              </form>
            )}

            {/* Register Form */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-5">
                <div className="space-y-1">
                  <h2 className="text-xl font-display font-bold text-white">Crear cuenta</h2>
                  <p className="text-white/40 text-sm">Únete a la red de franquiciados</p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="register-nombre" className={labelClasses}>Nombre completo</Label>
                    <div className="relative group">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 transition-colors group-focus-within:text-white/70" />
                      <Input id="register-nombre" type="text" placeholder="Juan Pérez" className={inputClasses} value={registerData.nombre} onChange={(e) => setRegisterData({ ...registerData, nombre: e.target.value })} />
                    </div>
                    {errors.nombre && <p className="text-xs text-red-300">{errors.nombre}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="register-email" className={labelClasses}>Email</Label>
                    <div className="relative group">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 transition-colors group-focus-within:text-white/70" />
                      <Input id="register-email" type="email" placeholder="tu@email.com" className={inputClasses} value={registerData.email} onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })} />
                    </div>
                    {errors.email && <p className="text-xs text-red-300">{errors.email}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="register-telefono" className={labelClasses}>Teléfono</Label>
                    <div className="relative group">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 transition-colors group-focus-within:text-white/70" />
                      <Input id="register-telefono" type="tel" placeholder="+34 612 345 678" className={inputClasses} value={registerData.telefono} onChange={(e) => setRegisterData({ ...registerData, telefono: e.target.value })} />
                    </div>
                    {errors.telefono && <p className="text-xs text-red-300">{errors.telefono}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="register-password" className={labelClasses}>Contraseña</Label>
                    <div className="relative group">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 transition-colors group-focus-within:text-white/70" />
                      <Input id="register-password" type="password" placeholder="Mínimo 8 caracteres" className={inputClasses} value={registerData.password} onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })} />
                    </div>
                    {errors.password && <p className="text-xs text-red-300">{errors.password}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="register-confirm" className={labelClasses}>Confirmar contraseña</Label>
                    <div className="relative group">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 transition-colors group-focus-within:text-white/70" />
                      <Input id="register-confirm" type="password" placeholder="Repite tu contraseña" className={inputClasses} value={registerData.confirmPassword} onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })} />
                    </div>
                    {errors.confirmPassword && <p className="text-xs text-red-300">{errors.confirmPassword}</p>}
                  </div>
                </div>

                <Button type="submit" className="w-full h-12 rounded-xl text-base font-semibold group bg-white text-primary hover:bg-white/90 shadow-xl" disabled={loading}>
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (<>Crear Cuenta<ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" /></>)}
                </Button>
              </form>
            )}

            {/* Footer */}
            <p className="mt-6 text-center text-xs text-white/30">
              Al continuar, aceptas nuestros{' '}
              <a href="#" className="text-white/50 hover:underline">Términos</a>
              {' '}y{' '}
              <a href="#" className="text-white/50 hover:underline">Privacidad</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
