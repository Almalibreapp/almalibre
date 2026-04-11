import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  fetchCupones,
  fetchCodigosCupon,
  crearCupon,
  eliminarCupon,
  eliminarCodigoCupon,
  generarCodigosCupon,
  CuponDescuento,
  CodigoCupon
} from '@/services/controlApi';
import { Plus, Loader2, CalendarIcon, Ticket, Copy, Check, Eye, Trash2 } from 'lucide-react';

interface DiscountCouponsProps {
  imei: string;
  ubicacion?: string;
  allImeis?: string[];
}

export const DiscountCoupons = ({ imei, ubicacion = '', allImeis = [] }: DiscountCouponsProps) => {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCupon, setSelectedCupon] = useState<CuponDescuento | null>(null);
  const [isCodesOpen, setIsCodesOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['cupones', imei],
    queryFn: () => fetchCupones(1, imei),
  });

  const cuponesList: CuponDescuento[] = data?.cupones ?? [];

  const deleteMutation = useMutation({
    mutationFn: (cuponId: string) => eliminarCupon([cuponId]),
    onSuccess: () => {
      toast({ title: '✅ Cupón eliminado' });
      queryClient.invalidateQueries({ queryKey: ['cupones', imei] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Cupones de Descuento</h3>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Crear Nuevo Cupón
        </Button>
      </div>

      {error ? (
        <Card className="border-warning/50">
          <CardContent className="py-6 text-center">
            <p className="text-warning">Error al cargar cupones: {(error as Error).message}</p>
          </CardContent>
        </Card>
      ) : cuponesList.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay cupones creados</p>
            <p className="text-sm">Crea tu primer cupón de descuento</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {cuponesList.map((cupon) => (
            <Card key={cupon.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="font-semibold">{cupon.nombre}</h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="secondary" className="text-primary font-bold">
                        {cupon.tipo === 'una_copa' ? '🍦 Copa gratis' : `-${cupon.descuento}€`}
                      </Badge>
                      <span>•</span>
                      <span>{cupon.cantidad_codigos > 0 ? `${cupon.cantidad_codigos} códigos` : 'Códigos disponibles'}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Válido: {cupon.fecha_inicio?.split(' ')[0] ?? '—'} - {cupon.fecha_fin?.split(' ')[0] ?? '—'}
                    </p>
                    {cupon.ubicacion && (
                      <p className="text-xs text-muted-foreground">📍 {cupon.ubicacion}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedCupon(cupon);
                        setIsCodesOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Ver Códigos
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm('¿Eliminar este cupón?')) {
                          deleteMutation.mutate(cupon.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Cupón</DialogTitle>
          </DialogHeader>
          <CreateCouponForm
            imei={imei}
            ubicacion={ubicacion}
            allImeis={allImeis.length > 0 ? allImeis : [imei]}
            onSuccess={() => {
              setIsCreateOpen(false);
              queryClient.invalidateQueries({ queryKey: ['cupones', imei] });
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isCodesOpen} onOpenChange={setIsCodesOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Códigos: {selectedCupon?.nombre}</DialogTitle>
          </DialogHeader>
          {selectedCupon && (
            <CouponCodes cuponId={selectedCupon.id} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface CreateCouponFormProps {
  imei: string;
  ubicacion: string;
  allImeis: string[];
  onSuccess: () => void;
}

const CreateCouponForm = ({ imei, ubicacion, allImeis, onSuccess }: CreateCouponFormProps) => {
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('0'); // 0=descuento, 1=una copa, 2=tarjeta múltiple
  const [descuento, setDescuento] = useState('1.00');
  const [fechaInicio, setFechaInicio] = useState<Date>();
  const [fechaFin, setFechaFin] = useState<Date>();
  const [diasValidez, setDiasValidez] = useState('20');
  const [cantidadCodigos, setCantidadCodigos] = useState('10');
  const [ubicacionInput, setUbicacionInput] = useState(ubicacion);

  const mutation = useMutation({
    mutationFn: () => {
      if (!fechaInicio || !fechaFin) {
        throw new Error('Selecciona las fechas de validez');
      }

      const formatDateTime = (date: Date, isEnd: boolean) => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const time = isEnd ? '23:59:59' : '00:00:00';
        return `${yyyy}-${mm}-${dd} ${time}`;
      };

      const content = tipo === '0'
        ? JSON.stringify({ money: descuento })
        : tipo === '1'
          ? JSON.stringify({ amount: 1, productPosition: '1', productName: 'Açai' })
          : JSON.stringify({ times: 5 });

      return crearCupon({
        couponType: tipo,
        totalCount: cantidadCodigos,
        couponName: nombre,
        startTime: formatDateTime(fechaInicio, false),
        endTime: formatDateTime(fechaFin, true),
        validDay: diasValidez,
        deviceImeis: allImeis.join(','),
        localName: ubicacionInput,
        content,
      });
    },
    onSuccess: () => {
      toast({ title: '✅ Cupón creado correctamente' });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Tipo de cupón</Label>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Descuento en €</SelectItem>
            <SelectItem value="1">Una copa gratis</SelectItem>
            <SelectItem value="2">Tarjeta múltiple</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Nombre del cupón</Label>
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Descuento Verano"
        />
      </div>

      {tipo === '0' && (
        <div className="space-y-2">
          <Label>Descuento (€)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={descuento}
            onChange={(e) => setDescuento(e.target.value)}
            placeholder="1.00"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Fecha inicio</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !fechaInicio && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {fechaInicio ? format(fechaInicio, "dd/MM/yyyy") : "Seleccionar"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={fechaInicio}
                onSelect={setFechaInicio}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>Fecha fin</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !fechaFin && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {fechaFin ? format(fechaFin, "dd/MM/yyyy") : "Seleccionar"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={fechaFin}
                onSelect={setFechaFin}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Días de validez</Label>
          <Input
            type="number"
            min="1"
            value={diasValidez}
            onChange={(e) => setDiasValidez(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Cantidad de códigos</Label>
          <Input
            type="number"
            min="1"
            max="100"
            value={cantidadCodigos}
            onChange={(e) => setCantidadCodigos(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Ubicación</Label>
        <Input
          value={ubicacionInput}
          onChange={(e) => setUbicacionInput(e.target.value)}
          placeholder="Ej: Valencia"
        />
      </div>

      <Button
        className="w-full"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !nombre || !fechaInicio || !fechaFin}
      >
        {mutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Plus className="h-4 w-4 mr-2" />
        )}
        Crear Cupón
      </Button>
    </div>
  );
};

interface CouponCodesProps {
  cuponId: string;
}

const CouponCodes = ({ cuponId }: CouponCodesProps) => {
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterEstado, setFilterEstado] = useState<string>('todos');
  const [generarCantidad, setGenerarCantidad] = useState('5');

  const { data, isLoading, error } = useQuery({
    queryKey: ['codigos-cupon', cuponId],
    queryFn: () => fetchCodigosCupon(cuponId),
    enabled: !!cuponId,
  });

  const codigosList: CodigoCupon[] = data?.codigos ?? [];

  const filteredCodigos = filterEstado === 'todos'
    ? codigosList
    : codigosList.filter(c => c.estado === filterEstado);

  const generateMutation = useMutation({
    mutationFn: () => generarCodigosCupon(cuponId, parseInt(generarCantidad)),
    onSuccess: () => {
      toast({ title: '✅ Códigos generados' });
      queryClient.invalidateQueries({ queryKey: ['codigos-cupon', cuponId] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const deleteCodeMutation = useMutation({
    mutationFn: (recordId: string) => eliminarCodigoCupon([recordId]),
    onSuccess: () => {
      toast({ title: '✅ Código eliminado' });
      queryClient.invalidateQueries({ queryKey: ['codigos-cupon', cuponId] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const copyToClipboard = async (codigo: string, id: string) => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiedId(id);
      toast({ title: '📋 Código copiado' });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: 'Error al copiar', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 rounded" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-center text-warning py-4">
        Error al cargar códigos: {(error as Error).message}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Generate more codes */}
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min="1"
          max="100"
          value={generarCantidad}
          onChange={(e) => setGenerarCantidad(e.target.value)}
          className="w-20"
        />
        <Button
          size="sm"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
          Generar códigos
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['todos', 'disponible', 'usado', 'expirado'].map(estado => (
          <Button
            key={estado}
            variant={filterEstado === estado ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterEstado(estado)}
          >
            {estado.charAt(0).toUpperCase() + estado.slice(1)}
          </Button>
        ))}
      </div>

      {filteredCodigos.length === 0 ? (
        <p className="text-center text-muted-foreground py-4">
          No hay códigos {filterEstado !== 'todos' ? `con estado "${filterEstado}"` : 'disponibles'}
        </p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredCodigos.map((codigo) => (
            <div
              key={codigo.id}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border",
                codigo.usado ? "bg-muted opacity-60" : "bg-background"
              )}
            >
              <div className="space-y-1">
                <p className="font-mono text-lg font-bold">{codigo.codigo}</p>
                <div className="flex items-center gap-2">
                  <Badge variant={codigo.estado === 'disponible' ? 'default' : 'secondary'}>
                    {codigo.estado}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Exp: {codigo.fecha_expiracion?.split(' ')[0] || '—'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyToClipboard(codigo.codigo, codigo.id)}
                >
                  {copiedId === codigo.id ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm('¿Eliminar este código?')) {
                      deleteCodeMutation.mutate(codigo.id);
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
