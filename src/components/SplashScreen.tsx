import logoIcon from '@/assets/logo-icon-almalibre.png';
import logoWhite from '@/assets/logo-almalibre-white.png';
import shapeWave from '@/assets/shape-wave.png';
import shapeLeaves from '@/assets/shape-leaves.png';

export const SplashScreen = () => {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/70 flex flex-col items-center justify-center overflow-hidden">
      {/* Brand shapes */}
      <img
        src={shapeWave}
        alt=""
        className="absolute bottom-0 left-0 w-full opacity-10 pointer-events-none select-none"
      />
      <img
        src={shapeLeaves}
        alt=""
        className="absolute top-10 right-[-60px] w-52 h-52 opacity-[0.07] pointer-events-none select-none animate-float"
        style={{ animationDelay: '1s' }}
      />
      <img
        src={shapeLeaves}
        alt=""
        className="absolute bottom-28 left-[-40px] w-40 h-40 opacity-[0.06] pointer-events-none select-none rotate-180 animate-float"
        style={{ animationDelay: '3s' }}
      />

      {/* Glowing orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl animate-pulse-slow" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Animated logo icon */}
        <div className="animate-splash-logo">
          <div className="relative">
            <div className="absolute inset-0 rounded-3xl bg-white/20 blur-xl animate-glow" />
            <img
              src={logoIcon}
              alt="Almalibre"
              className="h-24 w-24 rounded-3xl shadow-2xl relative z-10 animate-splash-bounce"
            />
          </div>
        </div>

        {/* Full logo */}
        <div className="mt-8 animate-fade-in" style={{ animationDelay: '0.5s' }}>
          <img src={logoWhite} alt="Almalibre" className="h-10 w-auto" />
        </div>

        <p className="text-white/40 text-xs text-center mt-2 animate-fade-in tracking-widest uppercase" style={{ animationDelay: '0.7s' }}>
          Plataforma de Franquicias
        </p>

        {/* Loading dots */}
        <div className="flex items-center gap-1.5 mt-10 animate-fade-in" style={{ animationDelay: '0.8s' }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-white/70 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
