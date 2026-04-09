import { useMemo, useRef, useState } from 'react';
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
  created_at?: string | null;
  ownerName?: string;
  ownerEmail?: string;
  ownerRole?: 'admin' | 'user';
  temperatura?: number;
}

interface ProfileRow {
  id: string;
  nombre: string;
  email: string;
}

interface RoleRow {
  user_id: string;
  role: 'admin' | 'user';
}

const hasText = (value?: string | null) => Boolean(value?.trim());

const isBetterMachineCandidate = (candidate: MachineData, current: MachineData) => {
  const candidateIsAdmin = candidate.ownerRole === 'admin';
  const currentIsAdmin = current.ownerRole === 'admin';

  if (candidateIsAdmin !== currentIsAdmin) {
    return !candidateIsAdmin;
  }

  if (candidate.activa !== current.activa) {
    return candidate.activa;
  }

  if (hasText(candidate.ubicacion) !== hasText(current.ubicacion)) {
    return hasText(candidate.ubicacion);
  }

  const candidateCreatedAt = candidate.created_at ? new Date(candidate.created_at).getTime() : 0;
  const currentCreatedAt = current.created_at ? new Date(current.created_at).getTime() : 0;

  return candidateCreatedAt > currentCreatedAt;
};

const deduplicateMachinesByImei = (
  machines: MachineData[],
  profiles: ProfileRow[],
  roles: RoleRow[]
) => {
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const roleMap = new Map(roles.map((role) => [role.user_id, role.role]));
  const machineMap = new Map<string, MachineData>();

  for (const machine of machines) {
    const ownerRole = roleMap.get(machine.usuario_id) === 'admin' ? 'admin' : 'user';
    const profile = profileMap.get(machine.usuario_id);
    const candidate: MachineData = {
      ...machine,
      ownerName: profile?.nombre || 'Desconocido',
      ownerEmail: profile?.email || '',
      ownerRole,
    };

    const existing = machineMap.get(machine.mac_address);
    if (!existing || isBetterMachineCandidate(candidate, existing)) {
      machineMap.set(machine.mac_address, candidate);
    }
  }

  return Array.from(machineMap.values()).sort((a, b) =>
    a.nombre_personalizado.localeCompare(b.nombre_personalizado, 'es', { sensitivity: 'base' })
  );
};

export const AdminMachines = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const lastKnownTempsRef = useRef(new Map<string, number>());

  const { data: machines = [], isLoading } = useQuery({
    queryKey: ['admin-machines-enriched-v2'],
    queryFn: async () => {
      const [maquinasResult, profilesResult, rolesResult] = await Promise.all([
        supabase.from('maquinas').select('*'),
        supabase.from('profiles').select('id, nombre, email'),
        supabase.from('user_roles').select('user_id, role'),
      ]);

      if (maquinasResult.error) throw maquinasResult.error;
      if (profilesResult.error) throw profilesResult.error;
      if (rolesResult.error) throw rolesResult.error;

      const visibleMachines = deduplicateMachinesByImei(
        (maquinasResult.data || []) as MachineData[],
        (profilesResult.data || []) as ProfileRow[],
        (rolesResult.data || []) as RoleRow[]
      );

      const uniqueImeis = visibleMachines.map((machine) => machine.mac_address);
      const temperatureMap = new Map(lastKnownTempsRef.current);
      const temperatureResults = await Promise.allSettled(
        uniqueImeis.map(async (imei) => {
          const temp = await fetchTemperatura(imei);
          return {
            imei,
            temperatura:
              typeof temp?.temperatura === 'number' && Number.isFinite(temp.temperatura)
                ? temp.temperatura
                : null,
          };
        })
      );

      for (const result of temperatureResults) {
        if (result.status === 'fulfilled' && typeof result.value.temperatura === 'number') {
          temperatureMap.set(result.value.imei, result.value.temperatura);
        }
      }

      lastKnownTempsRef.current = temperatureMap;

      return visibleMachines.map((machine) => ({
        ...machine,
        temperatura: temperatureMap.get(machine.mac_address),
      }));
    },
    staleTime: 60 * 1000,
    refetchInterval: 30000,
    placeholderData: (previousData) => previousData,
    retry: 2,
  });

  const filtered = useMemo(
    () =>
      machines.filter((machine) =>
        machine.nombre_personalizado.toLowerCase().includes(search.toLowerCase()) ||
        machine.mac_address.includes(search) ||
        machine.ownerName?.toLowerCase().includes(search.toLowerCase()) ||
        machine.ubicacion?.toLowerCase().includes(search.toLowerCase())
      ),
    [machines, search]
  );

  const getStatusBadge = (machine: MachineData) => {
    if (!machine.activa) return <Badge variant="secondary">Inactiva</Badge>;
    if (typeof machine.temperatura !== 'number') return <Badge variant="secondary">Sin lectura</Badge>;
    if (machine.temperatura >= 11) return <Badge variant="destructive">Crítico</Badge>;
    return <Badge className="bg-success text-success-foreground">Normal</Badge>;
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">Todas las Máquinas</h1>
        <p className="text-muted-foreground">{machines.length} máquinas físicas registradas</p>
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
              {filtered.map((machine) => (
                <TableRow
                  key={machine.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/admin/machine/${machine.id}`)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">{machine.nombre_personalizado}</p>
                      {machine.ubicacion && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {machine.ubicacion}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell font-mono text-xs">{machine.mac_address}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div><p className="text-sm">{machine.ownerName}</p><p className="text-xs text-muted-foreground">{machine.ownerEmail}</p></div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {typeof machine.temperatura === 'number' ? (
                      <span className={cn('flex items-center gap-1', machine.temperatura >= 11 ? 'text-destructive font-bold' : 'text-success')}>
                        <Thermometer className="h-3.5 w-3.5" /> {machine.temperatura}°C
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin lectura</span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(machine)}</TableCell>
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
