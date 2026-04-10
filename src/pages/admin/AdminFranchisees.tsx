import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Users, UserCheck, Cpu } from 'lucide-react';
import { format } from 'date-fns';

interface Franchisee {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  created_at: string | null;
  machineCount: number;
}

function FranchiseesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border bg-card p-6 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-card">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-4 p-4 border-b last:border-0">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-6 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

export const AdminFranchisees = () => {
  const [franchisees, setFranchisees] = useState<Franchisee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFranchisees();
  }, []);

  const loadFranchisees = async () => {
    try {
      const { data: profiles } = await supabase.from('profiles').select('*');
      const { data: machines } = await supabase.from('maquinas').select('usuario_id');
      const { data: roles } = await supabase.from('user_roles').select('user_id, role');

      if (!profiles) return;

      const machineMap = new Map<string, number>();
      machines?.forEach((m) => {
        machineMap.set(m.usuario_id, (machineMap.get(m.usuario_id) || 0) + 1);
      });

      const adminIds = new Set(roles?.filter((r) => r.role === 'admin').map((r) => r.user_id) || []);

      const result: Franchisee[] = profiles
        .filter((p) => !adminIds.has(p.id))
        .map((p) => ({
          id: p.id,
          nombre: p.nombre,
          email: p.email,
          telefono: p.telefono,
          created_at: p.created_at,
          machineCount: machineMap.get(p.id) || 0,
        }));

      setFranchisees(result);
    } catch (error) {
      console.error('Error loading franchisees:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalMachines = franchisees.reduce((sum, f) => sum + f.machineCount, 0);
  const withMachines = franchisees.filter(f => f.machineCount > 0).length;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header con gradiente */}
      <div className="rounded-2xl bg-gradient-to-r from-primary via-primary/90 to-primary/70 p-8 text-primary-foreground">
        <h1 className="text-3xl font-display font-bold flex items-center gap-3">
          <Users className="h-8 w-8" /> Franquiciados
        </h1>
        <p className="text-primary-foreground/70 mt-1">
          {loading ? 'Cargando...' : `${franchisees.length} franquiciados registrados`}
        </p>
      </div>

      {loading ? (
        <FranchiseesSkeleton />
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Total Franquiciados"
              value={franchisees.length}
              icon={<Users className="h-6 w-6" />}
            />
            <StatCard
              title="Con Máquinas"
              value={withMachines}
              icon={<UserCheck className="h-6 w-6" />}
            />
            <StatCard
              title="Total Máquinas"
              value={totalMachines}
              icon={<Cpu className="h-6 w-6" />}
            />
          </div>

          {/* Table */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Nombre</TableHead>
                    <TableHead className="font-semibold">Email</TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold">Teléfono</TableHead>
                    <TableHead className="font-semibold text-center">Máquinas</TableHead>
                    <TableHead className="hidden md:table-cell font-semibold">Registro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {franchisees.map((f) => (
                    <TableRow key={f.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium">{f.nombre}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{f.email}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{f.telefono || '—'}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={f.machineCount > 0 ? 'default' : 'secondary'}>
                          {f.machineCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {f.created_at ? format(new Date(f.created_at), 'dd/MM/yyyy') : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {franchisees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        No hay franquiciados registrados
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
