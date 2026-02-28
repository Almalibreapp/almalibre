import logoIcon from '@/assets/logo-icon-almalibre.png';

export const SplashScreen = () => {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/70 flex flex-col items-center justify-center overflow-hidden">
      {/* Background animated elements */}
      <div className="absolute inset-0">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl animate-pulse-slow" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Animated logo */}
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
        
        {/* Brand name */}
        <div className="mt-6 animate-fade-in" style={{ animationDelay: '0.5s' }}>
          <h1 className="text-2xl font-display font-bold text-white tracking-wide">Almalibre</h1>
          <p className="text-white/50 text-xs text-center mt-1">Franquicias</p>
        </div>

        {/* Loading dots */}
        <div className="flex items-center gap-1.5 mt-8 animate-fade-in" style={{ animationDelay: '0.8s' }}>
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
