import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { fetchTemperatura } from '@/services/api';
import { Search, Loader2, MapPin, Thermometer } from 'lucide-react';
import { cn } from '@/lib/utils';

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
}

export const AdminMachines = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: machines = [], isLoading } = useQuery({
    queryKey: ['admin-machines-enriched'],
    queryFn: async () => {
      const [{ data: maquinas }, { data: profiles }] = await Promise.all([
        supabase.from('maquinas').select('*'),
        supabase.from('profiles').select('id, nombre, email'),
      ]);
      if (!maquinas) return [];
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const enriched: MachineData[] = maquinas.map(m => ({
        ...m,
        ownerName: profileMap.get(m.usuario_id)?.nombre || 'Desconocido',
        ownerEmail: profileMap.get(m.usuario_id)?.email || '',
      }));

      // Fetch temps
      const tempPromises = enriched.map(async (m) => {
        try {
          const temp = await fetchTemperatura(m.mac_address);
          if (temp) m.temperatura = temp.temperatura;
        } catch { /* skip */ }
      });
      await Promise.allSettled(tempPromises);
      return enriched;
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 30000,
  });

  const filtered = machines.filter(m =>
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

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">Todas las Máquinas</h1>
        <p className="text-muted-foreground">{machines.length} máquinas registradas</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nombre, IMEI, ubicación..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Máquina</TableHead>
                <TableHead className="hidden md:table-cell">IMEI</TableHead>
                <TableHead className="hidden lg:table-cell">Franquiciado</TableHead>
                <TableHead className="hidden sm:table-cell">Temp</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(m => (
                <TableRow
                  key={m.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/admin/machine/${m.id}`)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">{m.nombre_personalizado}</p>
                      {m.ubicacion && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {m.ubicacion}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell font-mono text-xs">{m.mac_address}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div><p className="text-sm">{m.ownerName}</p><p className="text-xs text-muted-foreground">{m.ownerEmail}</p></div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {m.temperatura !== undefined ? (
                      <span className={cn("flex items-center gap-1", m.temperatura >= 11 ? 'text-critical font-bold' : 'text-success')}>
                        <Thermometer className="h-3.5 w-3.5" /> {m.temperatura}°C
                      </span>
                    ) : '--'}
                  </TableCell>
                  <TableCell>{getStatusBadge(m)}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No se encontraron máquinas</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
