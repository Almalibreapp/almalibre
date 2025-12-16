import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotificaciones } from '@/hooks/useNotificaciones';
import { NOTIFICATION_TYPE_CONFIG, type Notificacion, type NotificationType } from '@/types/notifications';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface NotificationItemProps {
  notificacion: Notificacion;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (notificacion: Notificacion) => void;
}

const NotificationItem = ({ notificacion, onMarkAsRead, onDelete, onNavigate }: NotificationItemProps) => {
  const config = NOTIFICATION_TYPE_CONFIG[notificacion.tipo as NotificationType] || {
    icon: '📬',
    color: 'text-muted-foreground',
    label: 'Notificación'
  };

  const timeAgo = formatDistanceToNow(new Date(notificacion.created_at), {
    addSuffix: true,
    locale: es
  });

  return (
    <div
      className={cn(
        'group flex items-start gap-3 p-4 border-b transition-colors cursor-pointer hover:bg-muted/50',
        !notificacion.leida && 'bg-primary/5'
      )}
      onClick={() => onNavigate(notificacion)}
    >
      <div className="text-2xl flex-shrink-0">{config.icon}</div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className={cn(
              'font-medium text-sm line-clamp-1',
              !notificacion.leida && 'text-foreground'
            )}>
              {notificacion.titulo}
            </p>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
              {notificacion.mensaje}
            </p>
          </div>
          
          {!notificacion.leida && (
            <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1.5" />
          )}
        </div>
        
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
          
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!notificacion.leida && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkAsRead(notificacion.id);
                }}
              >
                <Check className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(notificacion.id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const NotificationCenter = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const {
    notificaciones,
    noLeidas,
    isLoading,
    marcarComoLeida,
    marcarTodasComoLeidas,
    eliminarNotificacion,
  } = useNotificaciones();

  const handleNavigate = (notificacion: Notificacion) => {
    // Marcar como leída
    if (!notificacion.leida) {
      marcarComoLeida(notificacion.id);
    }

    // Navegar según el tipo
    const datos = notificacion.datos as Record<string, string>;
    
    switch (notificacion.tipo) {
      case 'stock_bajo':
      case 'temperatura_alerta':
      case 'nueva_venta':
        if (datos?.maquina_id) {
          navigate(`/machine/${datos.maquina_id}`);
        }
        break;
      case 'pedido_actualizado':
        navigate('/orders');
        break;
      case 'incidencia_actualizada':
        navigate('/incidents');
        break;
      case 'promocion':
        navigate('/promotions');
        break;
      default:
        navigate('/');
    }

    setOpen(false);
  };

  // Agrupar notificaciones por fecha
  const groupedNotifications = notificaciones.reduce((groups, notif) => {
    const date = new Date(notif.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let group: string;
    if (date.toDateString() === today.toDateString()) {
      group = 'Hoy';
    } else if (date.toDateString() === yesterday.toDateString()) {
      group = 'Ayer';
    } else {
      group = 'Anteriores';
    }

    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(notif);
    return groups;
  }, {} as Record<string, Notificacion[]>);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {noLeidas > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]"
              variant="destructive"
            >
              {noLeidas > 9 ? '9+' : noLeidas}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      
      <SheetContent className="w-full sm:max-w-md p-0">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificaciones
              {noLeidas > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {noLeidas} nuevas
                </Badge>
              )}
            </SheetTitle>
            
            {noLeidas > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => marcarTodasComoLeidas()}
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                Marcar todas
              </Button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : notificaciones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Bell className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No tienes notificaciones</p>
              <p className="text-xs text-muted-foreground mt-1">
                Las notificaciones aparecerán aquí
              </p>
            </div>
          ) : (
            <div>
              {Object.entries(groupedNotifications).map(([group, notifs]) => (
                <div key={group}>
                  <div className="sticky top-0 bg-muted/80 backdrop-blur px-4 py-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase">
                      {group}
                    </span>
                  </div>
                  {notifs.map((notificacion) => (
                    <NotificationItem
                      key={notificacion.id}
                      notificacion={notificacion}
                      onMarkAsRead={marcarComoLeida}
                      onDelete={eliminarNotificacion}
                      onNavigate={handleNavigate}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
