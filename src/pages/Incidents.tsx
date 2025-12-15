import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BottomNav } from '@/components/layout/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMaquinas } from '@/hooks/useMaquinas';
import { Plus, AlertTriangle, Loader2, ChevronRight, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Incident {
  id: string;
  numero_ticket: string;
  tipo: string;
  descripcion: string;
  prioridad: string;
  estado: string;
  maquina_id: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  abierta: 'bg-warning-light text-warning-foreground',
  en_proceso: 'bg-primary-light text-primary',
  resuelta: 'bg-success-light text-success',
  cerrada: 'bg-muted text-muted-foreground',
};

const statusLabels: Record<string, string> = {
  abierta: 'Abierta',
  en_proceso: 'En Proceso',
  resuelta: 'Resuelta',
  cerrada: 'Cerrada',
};

const priorityColors: Record<string, string> = {
  normal: 'bg-muted text-muted-foreground',
  urgente: 'bg-critical-light text-critical',
};

export const Incidents = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { maquinas } = useMaquinas(user?.id);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchIncidents();
    }
  }, [user]);

  const fetchIncidents = async () => {
    try {
      const { data, error } = await supabase
        .from('incidencias')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIncidents(data || []);
    } catch (error) {
      console.error('Error fetching incidents:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMachineName = (maquinaId: string) => {
    const machine = maquinas.find((m) => m.id === maquinaId);
    return machine?.nombre_personalizado || 'Máquina';
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex items-center justify-between h-16 px-4">
          <h1 className="font-semibold text-lg">Incidencias</h1>
          <Button size="sm" onClick={() => navigate('/incidents/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva
          </Button>
        </div>
      </header>

      <main className="container px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : incidents.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertTriangle className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold mb-2">Sin incidencias</h2>
              <p className="text-muted-foreground text-center mb-4">
                No tienes incidencias registradas
              </p>
              <Button onClick={() => navigate('/incidents/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Reportar Incidencia
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {incidents.map((incident) => (
              <Card
                key={incident.id}
                className="cursor-pointer hover:shadow-md transition-shadow animate-fade-in"
                onClick={() => navigate(`/incidents/${incident.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">
                          {incident.numero_ticket}
                        </span>
                        <Badge className={priorityColors[incident.prioridad]} variant="secondary">
                          {incident.prioridad === 'urgente' ? 'Urgente' : 'Normal'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {getMachineName(incident.maquina_id)}
                      </p>
                    </div>
                    <Badge className={statusColors[incident.estado]}>
                      {statusLabels[incident.estado]}
                    </Badge>
                  </div>
                  <p className="text-sm line-clamp-2 mb-2">{incident.descripcion}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(incident.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                    </div>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};
