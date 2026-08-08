import { useEffect, useState } from 'react';
import { almaClient } from '@/integrations/alma/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, MessageSquare, LifeBuoy, Ticket, BarChart3 } from 'lucide-react';

type Row = Record<string, any>;

const TABLES = ['conversations', 'incidents', 'tickets'] as const;

const useAlmaTable = (table: string, refreshKey: number) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    almaClient
      .from(table)
      .select('*')
      .order(table === 'conversations' ? 'updated_at' : 'created_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setError(error.message);
        setRows((data as Row[]) ?? []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [table, refreshKey]);

  return { rows, loading, error };
};

const EmptyState = ({ error }: { error: string | null }) => (
  <div className="py-12 text-center space-y-3">
    <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto" />
    <p className="text-sm text-muted-foreground max-w-md mx-auto">
      {error
        ? `No se pudo leer esta información: ${error}`
        : 'No hay datos visibles. Es posible que las reglas de acceso del sistema de Alma no permitan la lectura desde esta app todavía.'}
    </p>
  </div>
);

const DataTable = ({ rows }: { rows: Row[] }) => {
  const cols = Object.keys(rows[0] ?? {}).slice(0, 8);
  return (
    <div className="overflow-x-auto -mx-2 px-2">
      <table className="w-full text-xs sm:text-sm">
        <thead>
          <tr className="border-b">
            {cols.map((c) => (
              <th key={c} className="text-left font-medium py-2 pr-3 whitespace-nowrap capitalize text-muted-foreground">
                {c.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? i} className="border-b last:border-0">
              {cols.map((c) => {
                const v = r[c];
                const text = v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v);
                return (
                  <td key={c} className="py-2 pr-3 align-top max-w-[220px] truncate">
                    {text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const TableSection = ({ table, refreshKey }: { table: string; refreshKey: number }) => {
  const { rows, loading, error } = useAlmaTable(table, refreshKey);
  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (error || rows.length === 0) return <EmptyState error={error} />;
  return <DataTable rows={rows} />;
};

const Reportes = ({ refreshKey }: { refreshKey: number }) => {
  const conv = useAlmaTable('conversations', refreshKey);
  const inc = useAlmaTable('incidents', refreshKey);
  const tick = useAlmaTable('tickets', refreshKey);
  const msg = useAlmaTable('messages', refreshKey);

  const stats = [
    { label: 'Conversaciones', value: conv.rows.length, icon: MessageSquare },
    { label: 'Mensajes', value: msg.rows.length, icon: BarChart3 },
    { label: 'Incidencias', value: inc.rows.length, icon: LifeBuoy },
    { label: 'Tickets', value: tick.rows.length, icon: Ticket },
  ];

  const anyError = conv.error || inc.error || tick.error || msg.error;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <s.icon className="h-4 w-4" />
                <span className="text-xs">{s.label}</span>
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {anyError && <EmptyState error={anyError as string} />}
    </div>
  );
};

export const AdminAlma = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold">Panel de Alma</h1>
          <p className="text-sm text-muted-foreground">Conversaciones, incidencias y tickets del soporte</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      <Tabs defaultValue="conversations">
        <TabsList className="w-full overflow-x-auto justify-start">
          <TabsTrigger value="conversations">Conversaciones</TabsTrigger>
          <TabsTrigger value="incidents">Incidencias</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="reportes">Reportes</TabsTrigger>
        </TabsList>

        {TABLES.map((t) => (
          <TabsContent key={t} value={t}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  {t === 'conversations' ? 'Conversaciones' : t === 'incidents' ? 'Incidencias' : 'Tickets'}
                  <Badge variant="secondary">Sistema Alma</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TableSection table={t} refreshKey={refreshKey} />
              </CardContent>
            </Card>
          </TabsContent>
        ))}

        <TabsContent value="reportes">
          <Reportes refreshKey={refreshKey} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
