import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Users } from 'lucide-react';
import { format } from 'date-fns';

interface Franchisee {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  created_at: string | null;
  machineCount: number;
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

      // Count machines per user
      const machineMap = new Map<string, number>();
      machines?.forEach((m) => {
        machineMap.set(m.usuario_id, (machineMap.get(m.usuario_id) || 0) + 1);
      });

      // Filter out admins
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

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Users className="h-6 w-6" /> Franquiciados
        </h1>
        <p className="text-muted-foreground">{franchisees.length} franquiciados registrados</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="hidden sm:table-cell">Teléfono</TableHead>
                <TableHead>Máquinas</TableHead>
                <TableHead className="hidden md:table-cell">Registro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {franchisees.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.nombre}</TableCell>
                  <TableCell className="text-sm">{f.email}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">{f.telefono || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{f.machineCount}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {f.created_at ? format(new Date(f.created_at), 'dd/MM/yyyy') : '—'}
                  </TableCell>
                </TableRow>
              ))}
              {franchisees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No hay franquiciados registrados
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
