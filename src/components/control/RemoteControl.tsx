import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { 
  controlOrigen,
  controlPausarVentas,
  controlReanudarVentas,
  controlRefrigeracionOn,
  controlRefrigeracionOff,
  controlDeshielo,
} from '@/services/controlApi';
import { 
  RotateCcw, 
  Snowflake,
  PlayCircle, 
  ThermometerSnowflake,
  Droplets,
  Loader2 
} from 'lucide-react';

interface RemoteControlProps {
  imei: string;
}

interface ControlAction {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  needsConfirmation: boolean;
  confirmMessage?: string;
  action: (imei: string) => Promise<any>;
}

const controlActions: ControlAction[] = [
  {
    id: 'refrigeracion-on',
    label: 'Activar Refrigeración',
    description: 'Activa el sistema de refrigeración',
    icon: Snowflake,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100 hover:bg-cyan-200',
    needsConfirmation: false,
    action: controlRefrigeracionOn,
  },
  {
    id: 'refrigeracion-off',
    label: 'Desactivar Refrigeración',
    description: 'Desactiva el sistema de refrigeración',
    icon: ThermometerSnowflake,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100 hover:bg-orange-200',
    needsConfirmation: true,
    confirmMessage: '¿Desactivar refrigeración? Solo para mantenimiento',
    action: controlRefrigeracionOff,
  },
  {
    id: 'deshielo',
    label: 'Activar Descongelación',
    description: 'Inicia el ciclo de descongelación',
    icon: Droplets,
    color: 'text-sky-600',
    bgColor: 'bg-sky-100 hover:bg-sky-200',
    needsConfirmation: true,
    confirmMessage: '¿Activar el ciclo de descongelación?',
    action: controlDeshielo,
  },
  {
    id: 'reanudar',
    label: 'Reanudar Ventas',
    description: 'Reactiva la máquina para ventas',
    icon: PlayCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-100 hover:bg-green-200',
    needsConfirmation: false,
    action: controlReanudarVentas,
  },
  {
    id: 'origen',
    label: 'Volver a Origen',
    description: 'Reinicia la máquina a su estado inicial',
    icon: RotateCcw,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 hover:bg-blue-200',
    needsConfirmation: true,
    confirmMessage: '¿Reiniciar máquina a estado inicial?',
    action: controlOrigen,
  },
];

export const RemoteControl = ({ imei }: RemoteControlProps) => {
  const [confirmAction, setConfirmAction] = useState<ControlAction | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const executeAction = async (action: ControlAction) => {
    setLoadingId(action.id);
    try {
      await action.action(imei);
      toast({ title: `✅ ${action.label} ejecutado` });
    } catch (error) {
      toast({ 
        title: 'Error', 
        description: (error as Error).message, 
        variant: 'destructive' 
      });
    } finally {
      setLoadingId(null);
      setConfirmAction(null);
    }
  };

  const handleButtonClick = (action: ControlAction) => {
    if (action.needsConfirmation) {
      setConfirmAction(action);
    } else {
      executeAction(action);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Control Remoto</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {controlActions.map((action) => {
          const Icon = action.icon;
          const isLoading = loadingId === action.id;
          
          return (
            <Card 
              key={action.id}
              className="overflow-hidden transition-all hover:shadow-md"
            >
              <CardContent className="p-0">
                <button
                  className={`w-full p-4 flex flex-col items-center text-center transition-colors ${action.bgColor}`}
                  onClick={() => handleButtonClick(action)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mb-2" />
                  ) : (
                    <Icon className={`h-10 w-10 ${action.color} mb-2`} />
                  )}
                  <span className="font-medium text-sm">{action.label}</span>
                  <span className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {action.description}
                  </span>
                </button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Acción</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.confirmMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmAction && executeAction(confirmAction)}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
