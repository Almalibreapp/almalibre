import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MachineCard } from '@/components/dashboard/MachineCard';
import { BottomNav } from '@/components/layout/BottomNav';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { useAuth } from '@/hooks/useAuth';
import { useMaquinas } from '@/hooks/useMaquinas';
import { initPushNotifications } from '@/services/pushNotifications';
import { Plus, Settings, IceCream, RefreshCw, Loader2, Network } from 'lucide-react';
import logoAlmalibre from '@/assets/logo-almalibre.png';

export const Dashboard = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { maquinas, loading, refetch } = useMaquinas(user?.id);
  const [refreshing, setRefreshing] = useState(false);

  // Inicializar notificaciones push al cargar el dashboard
  useEffect(() => {
    if (user) {
      initPushNotifications();
    }
  }, [user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <img src={logoAlmalibre} alt="Almalibre" className="h-10 w-auto" />
            <div>
              <p className="text-sm text-muted-foreground">{getGreeting()}</p>
              <h1 className="font-semibold">{profile?.nombre || 'Usuario'}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <NotificationCenter />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/settings')}
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-6 pb-24">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : maquinas.length === 0 ? (
          <Card className="animate-fade-in">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-20 h-20 bg-primary-light rounded-full flex items-center justify-center mb-4">
                <IceCream className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2 text-center">
                Aún no tienes máquinas
              </h2>
              <p className="text-muted-foreground text-center mb-6 max-w-sm">
                Añade tu primera máquina de helados para comenzar a monitorear tus ventas y stock.
              </p>
              <Button onClick={() => navigate('/add-machine')}>
                <Plus className="h-4 w-4 mr-2" />
                Añadir Máquina
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Network Dashboard Button */}
            {maquinas.length > 0 && (
              <Card 
                className="cursor-pointer hover:shadow-soft hover:border-primary/30 transition-all duration-200 active:scale-[0.98] border-primary/20 bg-primary/5"
                onClick={() => navigate('/network')}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Network className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Dashboard de Red</h3>
                    <p className="text-xs text-muted-foreground">Ver ventas y temperatura de todas las máquinas</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Mis Máquinas</h2>
              <span className="text-sm text-muted-foreground">{maquinas.length} máquina(s)</span>
            </div>
            
            <div className="grid gap-4">
              {maquinas.map((maquina, index) => (
                <div 
                  key={maquina.id} 
                  className="animate-slide-up"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <MachineCard
                    maquina={maquina}
                    onClick={() => navigate(`/machine/${maquina.id}`)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* FAB */}
      {maquinas.length > 0 && (
        <div className="fixed bottom-24 right-6">
          <Button
            size="lg"
            className="rounded-full shadow-lg h-14 w-14"
            onClick={() => navigate('/add-machine')}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      )}

      <BottomNav />
    </div>
  );
};
