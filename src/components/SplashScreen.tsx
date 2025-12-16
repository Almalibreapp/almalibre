import logoAlmalibre from '@/assets/logo-almalibre.png';

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
        <div className="animate-fade-in">
          <img 
            src={logoAlmalibre} 
            alt="Almalibre" 
            className="h-20 w-auto brightness-0 invert mb-8 animate-pulse-slow" 
          />
        </div>
        
        {/* Loading indicator */}
        <div className="flex items-center gap-2 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 bg-white/80 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
