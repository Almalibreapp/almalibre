import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, Loader2, Clock, User, MapPin, Camera, MessageCircle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface Incident {
  id: string;
  numero_ticket: string;
  tipo: string;
  descripcion: string;
  prioridad: string;
  estado: string;
  maquina_id: string;
  usuario_id: string;
  fotos: string[] | null;
  resolucion: string | null;
  created_at: string;
  updated_at: string;
}

const statusColors: Record<string, string> = {
  abierta: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  en_proceso: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
  resuelta: 'bg-green-500/10 text-green-700 border-green-500/30',
  cerrada: 'bg-muted text-muted-foreground',
};

const statusLabels: Record<string, string> = {
  abierta: 'Abierta',
  en_proceso: 'En Proceso',
  resuelta: 'Resuelta',
  cerrada: 'Cerrada',
};

const statusOptions = ['abierta', 'en_proceso', 'resuelta', 'cerrada'];

export const AdminIncidents = () => {
  const { toast } = useToast();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [machines, setMachines] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, { nombre: string; email: string }>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, any[]>>({});
  const [newMessage, setNewMessage] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [incRes, machRes, profRes] = await Promise.all([
      supabase.from('incidencias').select('*').order('created_at', { ascending: false }),
      supabase.from('maquinas').select('id, nombre_personalizado, ubicacion'),
      supabase.from('profiles').select('id, nombre, email'),
    ]);

    setIncidents((incRes.data || []) as Incident[]);

    const machMap: Record<string, string> = {};
    (machRes.data || []).forEach((m: any) => { machMap[m.id] = m.nombre_personalizado; });
    setMachines(machMap);

    const profMap: Record<string, { nombre: string; email: string }> = {};
    (profRes.data || []).forEach((p: any) => { profMap[p.id] = { nombre: p.nombre, email: p.email }; });
    setProfiles(profMap);

    setLoading(false);
  };

  const fetchMessages = async (incidentId: string) => {
    const { data } = await supabase
      .from('incidencia_mensajes')
      .select('*')
      .eq('incidencia_id', incidentId)
      .order('created_at', { ascending: true });
    setMessages(prev => ({ ...prev, [incidentId]: data || [] }));
  };

  const handleStatusChange = async (incidentId: string, newStatus: string) => {
    setUpdatingId(incidentId);
    const { error } = await supabase
      .from('incidencias')
      .update({ estado: newStatus, updated_at: new Date().toISOString() })
      .eq('id', incidentId);

    if (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar el estado', variant: 'destructive' });
    } else {
      toast({ title: 'Estado actualizado', description: `Incidencia marcada como "${statusLabels[newStatus]}"` });
      setIncidents(prev => prev.map(i => i.id === incidentId ? { ...i, estado: newStatus } : i));
    }
    setUpdatingId(null);
  };

  const handleSendMessage = async (incidentId: string) => {
    const msg = newMessage[incidentId]?.trim();
    if (!msg) return;

    const { error } = await supabase.from('incidencia_mensajes').insert({
      incidencia_id: incidentId,
      mensaje: msg,
      autor: 'soporte',
    });

    if (error) {
      toast({ title: 'Error', description: 'No se pudo enviar el mensaje', variant: 'destructive' });
    } else {
      setNewMessage(prev => ({ ...prev, [incidentId]: '' }));
      fetchMessages(incidentId);
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      if (!messages[id]) fetchMessages(id);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">Incidencias</h1>
        <p className="text-muted-foreground">Gestión de incidencias de franquiciados · {incidents.length} total</p>
      </div>

      {incidents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay incidencias registradas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {incidents.map((incident) => (
            <Card key={incident.id} className="overflow-hidden">
              <CardContent className="p-0">
                {/* Header row */}
                <div
                  className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggleExpand(incident.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{incident.numero_ticket}</span>
                        <Badge className={incident.prioridad === 'urgente' ? 'bg-red-500/10 text-red-700 border-red-500/30' : 'bg-muted text-muted-foreground'}>
                          {incident.prioridad === 'urgente' ? '🔴 Urgente' : 'Normal'}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium">{incident.tipo}</p>
                    </div>
                    <Badge className={statusColors[incident.estado]}>
                      {statusLabels[incident.estado]}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {profiles[incident.usuario_id]?.nombre || 'Usuario'}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {machines[incident.maquina_id] || 'Máquina'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(incident.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                    </span>
                    {incident.fotos && (incident.fotos as string[]).length > 0 && (
                      <span className="flex items-center gap-1">
                        <Camera className="h-3 w-3" />
                        {(incident.fotos as string[]).length} foto(s)
                      </span>
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {expandedId === incident.id && (
                  <div className="border-t p-4 space-y-4 bg-muted/10">
                    {/* Description */}
                    <div>
                      <h4 className="text-sm font-semibold mb-1">Descripción del problema</h4>
                      <p className="text-sm bg-background p-3 rounded-lg border">{incident.descripcion}</p>
                    </div>

                    {/* Franchisee info */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Franquiciado:</span>
                        <p className="font-medium">{profiles[incident.usuario_id]?.nombre || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">{profiles[incident.usuario_id]?.email || ''}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Máquina:</span>
                        <p className="font-medium">{machines[incident.maquina_id] || 'N/A'}</p>
                      </div>
                    </div>

                    {/* Photos */}
                    {incident.fotos && (incident.fotos as string[]).length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Fotografías</h4>
                        <div className="flex gap-2 flex-wrap">
                          {(incident.fotos as string[]).map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                              <img src={url} alt={`Foto ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border hover:opacity-80 transition-opacity" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Status change */}
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">Cambiar estado:</span>
                      <Select
                        value={incident.estado}
                        onValueChange={(val) => handleStatusChange(incident.id, val)}
                        disabled={updatingId === incident.id}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map(s => (
                            <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {updatingId === incident.id && <Loader2 className="h-4 w-4 animate-spin" />}
                    </div>

                    {/* Messages */}
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                        <MessageCircle className="h-4 w-4" />
                        Mensajes
                      </h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                        {(messages[incident.id] || []).length === 0 ? (
                          <p className="text-xs text-muted-foreground">Sin mensajes aún</p>
                        ) : (
                          (messages[incident.id] || []).map((msg: any) => (
                            <div key={msg.id} className={`p-2 rounded-lg text-sm ${msg.autor === 'soporte' ? 'bg-primary/10 ml-4' : 'bg-muted mr-4'}`}>
                              <p className="text-xs font-medium mb-0.5">{msg.autor === 'soporte' ? 'Soporte' : 'Franquiciado'}</p>
                              <p>{msg.mensaje}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {format(new Date(msg.created_at), "d MMM, HH:mm", { locale: es })}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="Responder al franquiciado..."
                          value={newMessage[incident.id] || ''}
                          onChange={(e) => setNewMessage(prev => ({ ...prev, [incident.id]: e.target.value }))}
                          rows={2}
                          className="flex-1"
                        />
                        <Button size="sm" onClick={() => handleSendMessage(incident.id)} disabled={!newMessage[incident.id]?.trim()}>
                          Enviar
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
