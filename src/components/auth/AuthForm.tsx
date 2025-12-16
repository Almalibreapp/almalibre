import { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Mail, Lock, User, Phone, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import logoAlmalibre from '@/assets/logo-almalibre.png';

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
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel - Branding */}
      <div className="relative lg:w-1/2 bg-gradient-to-br from-primary via-primary/90 to-primary/70 p-8 lg:p-12 flex flex-col justify-between overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-float" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-white/5 to-transparent rounded-full blur-3xl animate-pulse-slow" />
        </div>

        {/* Content */}
        <div className="relative z-10">
          <div className="animate-fade-in">
            <img src={logoAlmalibre} alt="Almalibre" className="h-12 lg:h-16 w-auto brightness-0 invert" />
          </div>
        </div>

        <div className="relative z-10 hidden lg:block">
          <div className="space-y-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 text-white/90 text-sm">
              <Sparkles className="h-4 w-4" />
              <span>Plataforma de gestión inteligente</span>
            </div>
            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-display font-bold text-white leading-tight">
              Controla tu negocio<br />
              <span className="text-white/80">desde cualquier lugar</span>
            </h1>
            <p className="text-lg text-white/70 max-w-md leading-relaxed">
              Monitorea tus máquinas, gestiona inventario y aumenta tus ventas con nuestra plataforma todo-en-uno.
            </p>
          </div>
        </div>

        <div className="relative z-10 hidden lg:block animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <div className="flex items-center gap-4 text-white/60 text-sm">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-white/20 border-2 border-primary" />
              ))}
            </div>
            <span>+500 franquiciados confían en nosotros</span>
          </div>
        </div>

        {/* Mobile branding */}
        <div className="lg:hidden relative z-10 text-center py-8">
          <h1 className="text-2xl font-display font-bold text-white mb-2 animate-fade-in">
            Bienvenido a Almalibre
          </h1>
          <p className="text-white/70 text-sm animate-fade-in" style={{ animationDelay: '0.1s' }}>
            Gestiona tu franquicia desde cualquier lugar
          </p>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-md animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          {/* Tab Switcher */}
          <div className="flex gap-1 p-1 bg-muted rounded-2xl mb-8">
            <button
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all duration-300 ${
                activeTab === 'login'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              onClick={() => setActiveTab('register')}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all duration-300 ${
                activeTab === 'register'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Crear Cuenta
            </button>
          </div>

          {/* Login Form */}
          {activeTab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
                  Hola de nuevo
                </h2>
                <p className="text-muted-foreground">
                  Ingresa tus credenciales para continuar
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-sm font-medium">
                    Email
                  </Label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="tu@email.com"
                      className="pl-12 h-12 bg-muted/50 border-0 rounded-xl focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    />
                  </div>
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-sm font-medium">
                    Contraseña
                  </Label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-12 h-12 bg-muted/50 border-0 rounded-xl focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    />
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 rounded-xl text-base font-medium group"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Iniciar Sesión
                    <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Register Form */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
                  Crea tu cuenta
                </h2>
                <p className="text-muted-foreground">
                  Únete a la red de franquiciados Almalibre
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-nombre" className="text-sm font-medium">
                    Nombre completo
                  </Label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <Input
                      id="register-nombre"
                      type="text"
                      placeholder="Juan Pérez"
                      className="pl-12 h-12 bg-muted/50 border-0 rounded-xl focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all"
                      value={registerData.nombre}
                      onChange={(e) => setRegisterData({ ...registerData, nombre: e.target.value })}
                    />
                  </div>
                  {errors.nombre && <p className="text-sm text-destructive">{errors.nombre}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-email" className="text-sm font-medium">
                    Email
                  </Label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="tu@email.com"
                      className="pl-12 h-12 bg-muted/50 border-0 rounded-xl focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all"
                      value={registerData.email}
                      onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                    />
                  </div>
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-telefono" className="text-sm font-medium">
                    Teléfono
                  </Label>
                  <div className="relative group">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <Input
                      id="register-telefono"
                      type="tel"
                      placeholder="+34 612 345 678"
                      className="pl-12 h-12 bg-muted/50 border-0 rounded-xl focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all"
                      value={registerData.telefono}
                      onChange={(e) => setRegisterData({ ...registerData, telefono: e.target.value })}
                    />
                  </div>
                  {errors.telefono && <p className="text-sm text-destructive">{errors.telefono}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-password" className="text-sm font-medium">
                      Contraseña
                    </Label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
                      <Input
                        id="register-password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-12 h-12 bg-muted/50 border-0 rounded-xl focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all"
                        value={registerData.password}
                        onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                      />
                    </div>
                    {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-confirm" className="text-sm font-medium">
                      Confirmar
                    </Label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
                      <Input
                        id="register-confirm"
                        type="password"
                        placeholder="••••••••"
                        className="pl-12 h-12 bg-muted/50 border-0 rounded-xl focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all"
                        value={registerData.confirmPassword}
                        onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                      />
                    </div>
                    {errors.confirmPassword && <p className="text-sm text-destructive col-span-2">{errors.confirmPassword}</p>}
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 rounded-xl text-base font-medium group"
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
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Al continuar, aceptas nuestros{' '}
            <a href="#" className="text-primary hover:underline">
              Términos de Servicio
            </a>{' '}
            y{' '}
            <a href="#" className="text-primary hover:underline">
              Política de Privacidad
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
