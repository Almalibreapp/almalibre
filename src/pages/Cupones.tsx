import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Ticket } from 'lucide-react';
import { DiscountCoupons } from '@/components/control/DiscountCoupons';
import { BottomNav } from '@/components/layout/BottomNav';

interface MachineOption {
  id: string;
  mac_address: string;
  nombre_personalizado: string;
  ubicacion: string | null;
}

export const Cupones = () => {
  const { user } = useAuth();
  const [selectedImei, setSelectedImei] = useState('');

  const { data: machines = [], isLoading: loadingMachines } = useQuery({
    queryKey: ['user-machines-for-cupones', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('maquinas')
        .select('id, mac_address, nombre_personalizado, ubicacion')
        .eq('usuario_id', user.id);
      if (error) throw error;
      const seen = new Set<string>();
      return (data || []).filter((m: MachineOption) => {
        if (seen.has(m.mac_address)) return false;
        seen.add(m.mac_address);
        return true;
      });
    },
    enabled: !!user?.id,
  });

  const selectedMachine = useMemo(
    () => machines.find((m: MachineOption) => m.mac_address === selectedImei),
    [machines, selectedImei]
  );

  const allImeis = useMemo(() => machines.map((m: MachineOption) => m.mac_address), [machines]);

  // Auto-select if only one machine
  useMemo(() => {
    if (machines.length === 1 && !selectedImei) {
      setSelectedImei(machines[0].mac_address);
    }
  }, [machines, selectedImei]);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex items-center h-16 px-4">
          <Ticket className="h-5 w-5 text-primary mr-3" />
          <h1 className="font-semibold text-lg">Cupones de Descuento</h1>
        </div>
      </header>

      <main className="container px-4 py-6 space-y-6">
        {/* Machine Selector */}
        {loadingMachines ? (
          <Skeleton className="h-12 w-full" />
        ) : machines.length > 1 ? (
          <div>
            <label className="text-sm font-medium mb-2 block">Selecciona una máquina:</label>
            <Select value={selectedImei} onValueChange={setSelectedImei}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar máquina..." />
              </SelectTrigger>
              <SelectContent>
                {machines.map((m: MachineOption) => (
                  <SelectItem key={m.id} value={m.mac_address}>
                    {m.nombre_personalizado} {m.ubicacion ? `(${m.ubicacion})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {/* Content */}
        {!selectedImei ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Ticket className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Selecciona una máquina</p>
              <p className="text-sm">Para ver y gestionar sus cupones de descuento</p>
            </CardContent>
          </Card>
        ) : (
          <DiscountCoupons
            imei={selectedImei}
            ubicacion={selectedMachine?.ubicacion || ''}
            allImeis={allImeis}
          />
        )}
      </main>

      <BottomNav />
    </div>
  );
};
