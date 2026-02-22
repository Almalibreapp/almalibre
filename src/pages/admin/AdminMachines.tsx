import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { fetchTemperatura } from '@/services/api';
import { convertChinaToSpainFull, getChinaDatesForSpainDate } from '@/lib/timezone';
import { format } from 'date-fns';
import { Search, Eye, Loader2, MapPin } from 'lucide-react';

interface MachineData {
  id: string;
  mac_address: string;
  nombre_personalizado: string;
  ubicacion: string | null;
  activa: boolean;
  usuario_id: string;
  ownerName?: string;
  ownerEmail?: string;
  temperatura?: number;
  tempEstado?: string;
}

export const AdminMachines = () => {
  const navigate = useNavigate();
  const [machines, setMachines] = useState<MachineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [ventasHoy, setVentasHoy] = useState<any[]>([]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const chinaDates = getChinaDatesForSpainDate(todayStr);

  useEffect(() => {
    loadMachines();
  }, []);

  const loadMachines = async () => {
    try {
      const { data: maquinas } = await supabase.from('maquinas').select('*');
      const { data: profiles } = await supabase.from('profiles').select('id, nombre, email');

      if (!maquinas) return;

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      const enriched: MachineData[] = maquinas.map((m) => {
        const owner = profileMap.get(m.usuario_id);
        return {
          ...m,
          ownerName: owner?.nombre || 'Desconocido',
          ownerEmail: owner?.email || '',
        };
      });

      // Fetch today's sales from DB
      const { data: ventas } = await supabase
        .from('ventas_historico')
        .select('precio, hora, fecha, cantidad_unidades, maquina_id')
        .in('fecha', chinaDates);
      setVentasHoy(ventas || []);

      // Fetch temp in parallel
      const promises = enriched.map(async (m) => {
        try {
          const temp = await fetchTemperatura(m.mac_address);
          if (temp) {
            m.temperatura = temp.temperatura;
            m.tempEstado = temp.temperatura !== undefined
              ? (temp.temperatura >= 11 ? 'critico' : 'normal')
              : undefined;
          }
        } catch { /* skip */ }
      });

      await Promise.allSettled(promises);
      setMachines(enriched);
    } catch (error) {
      console.error('Error loading machines:', error);
    } finally {
      setLoading(false);
    }
  };

  // Compute per-machine sales for Spain today
  const salesByMachine = useMemo(() => {
    const map: Record<string, { euros: number; cantidad: number }> = {};
    ventasHoy.forEach(v => {
      const converted = convertChinaToSpainFull(v.hora, v.fecha);
      if (converted.fecha !== todayStr) return;
      if (!map[v.maquina_id]) map[v.maquina_id] = { euros: 0, cantidad: 0 };
      map[v.maquina_id].euros += Number(v.precio);
      map[v.maquina_id].cantidad += (v.cantidad_unidades || 1);
    });
    return map;
  }, [ventasHoy, todayStr]);

  const filtered = machines.filter(
    (m) =>
      m.nombre_personalizado.toLowerCase().includes(search.toLowerCase()) ||
      m.mac_address.includes(search) ||
      m.ownerName?.toLowerCase().includes(search.toLowerCase()) ||
      m.ubicacion?.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (m: MachineData) => {
    if (m.temperatura !== undefined && m.temperatura >= 11) return <Badge variant="destructive">Crítico</Badge>;
    if (m.activa) return <Badge className="bg-success text-success-foreground">Normal</Badge>;
    return <Badge variant="secondary">Inactiva</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">Todas las Máquinas</h1>
        <p className="text-muted-foreground">{machines.length} máquinas registradas</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, IMEI, ubicación..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Máquina</TableHead>
                <TableHead className="hidden md:table-cell">IMEI</TableHead>
                <TableHead className="hidden lg:table-cell">Franquiciado</TableHead>
                <TableHead>Ventas Hoy</TableHead>
                <TableHead className="hidden sm:table-cell">Temp</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => {
                const sales = salesByMachine[m.id];
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{m.nombre_personalizado}</p>
                        {m.ubicacion && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {m.ubicacion}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell font-mono text-xs">
                      {m.mac_address}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div>
                        <p className="text-sm">{m.ownerName}</p>
                        <p className="text-xs text-muted-foreground">{m.ownerEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-semibold text-primary">{(sales?.euros || 0).toFixed(2)}€</p>
                        <p className="text-xs text-muted-foreground">{sales?.cantidad || 0} uds</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {m.temperatura !== undefined ? (
                        <span className={
                          m.temperatura >= 11 ? 'text-critical font-bold' :
                          'text-success'
                        }>
                          {m.temperatura}°C
                        </span>
                      ) : '--'}
                    </TableCell>
                    <TableCell>{getStatusBadge(m)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/admin/machine/${m.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No se encontraron máquinas
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};