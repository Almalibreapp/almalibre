import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/sales-skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Search, MapPin, Cpu } from 'lucide-react';

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
  if (candidateIsAdmin !== currentIsAdmin) return !candidateIsAdmin;
  if (candidate.activa !== current.activa) return candidate.activa;
  if (hasText(candidate.ubicacion) !== hasText(current.ubicacion)) return hasText(candidate.ubicacion);
  const candidateCreatedAt = candidate.created_at ? new Date(candidate.created_at).getTime() : 0;
  const currentCreatedAt = current.created_at ? new Date(current.created_at).getTime() : 0;
  return candidateCreatedAt > currentCreatedAt;
};

const deduplicateMachinesByImei = (machines: MachineData[], profiles: ProfileRow[], roles: RoleRow[]) => {
  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const roleMap = new Map(roles.map((r) => [r.user_id, r.role]));
  const machineMap = new Map<string, MachineData>();
  for (const machine of machines) {
    const ownerRole = roleMap.get(machine.usuario_id) === 'admin' ? 'admin' : 'user';
    const profile = profileMap.get(machine.usuario_id);
    const candidate: MachineData = { ...machine, ownerName: profile?.nombre || 'Desconocido', ownerEmail: profile?.email || '', ownerRole };
    const existing = machineMap.get(machine.mac_address);
    if (!existing || isBetterMachineCandidate(candidate, existing)) machineMap.set(machine.mac_address, candidate);
  }
  return Array.from(machineMap.values()).sort((a, b) => a.nombre_personalizado.localeCompare(b.nombre_personalizado, 'es', { sensitivity: 'base' }));
};

export const AdminMachines = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

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
      return deduplicateMachinesByImei(
        (maquinasResult.data || []) as MachineData[],
        (profilesResult.data || []) as ProfileRow[],
        (rolesResult.data || []) as RoleRow[]
      );
    },
    staleTime: 60 * 1000,
    refetchInterval: 30000,
    placeholderData: (prev) => prev,
    retry: 2,
  });

  const filtered = useMemo(
    () => machines.filter((m) =>
      m.nombre_personalizado.toLowerCase().includes(search.toLowerCase()) ||
      m.mac_address.includes(search) ||
      m.ownerName?.toLowerCase().includes(search.toLowerCase()) ||
      m.ubicacion?.toLowerCase().includes(search.toLowerCase())
    ),
    [machines, search]
  );


  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header con gradiente */}
      <div className="rounded-2xl bg-gradient-to-r from-primary via-primary/90 to-primary/70 p-8 text-primary-foreground">
        <h1 className="text-3xl font-display font-bold flex items-center gap-3">
          <Cpu className="h-8 w-8" /> Todas las Máquinas
        </h1>
        <p className="text-primary-foreground/70 mt-1">{machines.length} máquinas físicas registradas</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nombre, IMEI, ubicación..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} cols={3} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Máquina</TableHead>
                  <TableHead className="hidden md:table-cell">IMEI</TableHead>
                  <TableHead className="hidden lg:table-cell">Franquiciado</TableHead>
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
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No se encontraron máquinas</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
