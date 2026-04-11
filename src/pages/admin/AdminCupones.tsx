import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Ticket } from 'lucide-react';
import { DiscountCoupons } from '@/components/control/DiscountCoupons';

interface MachineOption {
  id: string;
  mac_address: string;
  nombre_personalizado: string;
  ubicacion: string | null;
}

export const AdminCupones = () => {
  const [selectedImei, setSelectedImei] = useState('');

  const { data: machines = [], isLoading: loadingMachines } = useQuery({
    queryKey: ['admin-machines-for-cupones'],
    queryFn: async () => {
      const { data, error } = await supabase.from('maquinas').select('id, mac_address, nombre_personalizado, ubicacion');
      if (error) throw error;
      // Deduplicate by mac_address, keep first
      const seen = new Set<string>();
      return (data || []).filter((m: MachineOption) => {
        if (seen.has(m.mac_address)) return false;
        seen.add(m.mac_address);
        return true;
      });
    },
  });

  const selectedMachine = useMemo(
    () => machines.find((m: MachineOption) => m.mac_address === selectedImei),
    [machines, selectedImei]
  );

  const allImeis = useMemo(() => machines.map((m: MachineOption) => m.mac_address), [machines]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-primary via-primary/90 to-primary/70 p-8 text-primary-foreground">
        <h1 className="text-3xl font-display font-bold flex items-center gap-3">
          <Ticket className="h-8 w-8" /> Cupones de Descuento
        </h1>
        <p className="text-primary-foreground/70 mt-1">Gestiona los cupones de descuento de tus máquinas</p>
      </div>

      {/* Machine Selector */}
      {loadingMachines ? (
        <Skeleton className="h-12 w-full max-w-md" />
      ) : (
        <div className="max-w-md">
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
      )}

      {/* Coupons List */}
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
    </div>
  );
};
