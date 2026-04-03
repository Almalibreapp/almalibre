import { useQuery } from '@tanstack/react-query';
import { useMaquinas } from '@/hooks/useMaquinas';
import { useAuth } from '@/hooks/useAuth';
import { fetchVentasResumen, fetchOrdenes, fetchTemperatura } from '@/services/api';
import { VentasResumenResponse, TemperaturaResponse, ToppingVenta } from '@/types';
import { fetchSpanishDayOrders, isSuccessfulSale, buildHourlySalesData, getPeakSalesHour, getCurrentSpainDate } from '@/lib/sales';

const fetchMachineVentasResumen = async (imei: string) => {
  try {
    return await fetchVentasResumen(imei);
  } catch {
    return null;
  }
};

const fetchMachineTemperatura = async (imei: string) => {
  try {
    return await fetchTemperatura(imei);
  } catch {
    return null;
  }
};

export interface NetworkSalesData {
  resumenPorMaquina: { maquinaId: string; nombre: string; imei: string; resumen: VentasResumenResponse | null }[];
  totales: {
    hoy: { cantidad: number; total_euros: number };
    ayer: { cantidad: number; total_euros: number };
    mes: { cantidad: number; total_euros: number };
  };
}

export interface NetworkDetailData {
  detallePorMaquina: { maquinaId: string; nombre: string; imei: string; ventas: any[] }[];
  horaCaliente: { hora: string; ventas: number; ingresos: number } | null;
  todasLasVentas: { maquina: string; id: string; hora: string; producto: string; precio: number; estado: string; toppings: ToppingVenta[] }[];
}

export const useNetworkSales = () => {
  const { user } = useAuth();
  const { maquinas } = useMaquinas(user?.id);

  const imeis = maquinas.map(m => ({ id: m.id, nombre: m.nombre_personalizado, imei: m.mac_address }));

  return useQuery<NetworkSalesData>({
    queryKey: ['network-sales', imeis.map(m => m.imei).join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        imeis.map(async (m) => ({
          maquinaId: m.id,
          nombre: m.nombre,
          imei: m.imei,
          resumen: await fetchMachineVentasResumen(m.imei),
        }))
      );

      const totales = results.reduce(
        (acc, r) => {
          if (r.resumen) {
            acc.hoy.cantidad += r.resumen.ventas_hoy?.cantidad ?? 0;
            acc.hoy.total_euros += r.resumen.ventas_hoy?.total_euros ?? 0;
            acc.ayer.cantidad += r.resumen.ventas_ayer?.cantidad ?? 0;
            acc.ayer.total_euros += r.resumen.ventas_ayer?.total_euros ?? 0;
            acc.mes.cantidad += r.resumen.ventas_mes?.cantidad ?? 0;
            acc.mes.total_euros += r.resumen.ventas_mes?.total_euros ?? 0;
          }
          return acc;
        },
        {
          hoy: { cantidad: 0, total_euros: 0 },
          ayer: { cantidad: 0, total_euros: 0 },
          mes: { cantidad: 0, total_euros: 0 },
        }
      );

      return { resumenPorMaquina: results, totales };
    },
    enabled: imeis.length > 0,
    staleTime: 3 * 60 * 1000,
  });
};

export const useNetworkDetail = (fecha?: string) => {
  const { user } = useAuth();
  const { maquinas } = useMaquinas(user?.id);

  const imeis = maquinas.map(m => ({ id: m.id, nombre: m.nombre_personalizado, imei: m.mac_address }));
  const spainDate = fecha || getCurrentSpainDate();

  return useQuery<NetworkDetailData>({
    queryKey: ['network-detail', imeis.map(m => m.imei).join(','), spainDate],
    queryFn: async () => {
      // Use centralized fetchSpanishDayOrders for each machine — handles timezone detection & normalization
      const results = await Promise.all(
        imeis.map(async (m) => {
          const ventas = await fetchSpanishDayOrders(m.imei, spainDate, fetchOrdenes).catch(() => []);
          return {
            maquinaId: m.id,
            nombre: m.nombre,
            imei: m.imei,
            ventas,
          };
        })
      );

      // Aggregate all sales with machine name — hours are already in Spain time (_spainHora)
      const todasLasVentas = results
        .flatMap(r =>
          r.ventas.map((v: any) => ({
            maquina: r.nombre,
            id: v.saleUid || v.id || String(Math.random()),
            hora: v.horaSpain || v._spainHora || v.hora,
            producto: v.producto,
            precio: Number(v.precio || 0),
            estado: String(v.estado || 'exitoso'),
            toppings: Array.isArray(v.toppings) ? v.toppings : [],
          }))
        )
        .sort((a, b) => b.hora.localeCompare(a.hora));

      // Peak hour using already-normalized Spain hours
      const horaCaliente = getPeakSalesHour(todasLasVentas);

      return { detallePorMaquina: results, horaCaliente, todasLasVentas };
    },
    enabled: imeis.length > 0,
    staleTime: 3 * 60 * 1000,
  });
};

export const useNetworkTemperatures = () => {
  const { user } = useAuth();
  const { maquinas } = useMaquinas(user?.id);

  const imeis = maquinas.map(m => ({ id: m.id, nombre: m.nombre_personalizado, imei: m.mac_address, activa: m.activa }));

  return useQuery({
    queryKey: ['network-temperatures', imeis.map(m => m.imei).join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        imeis.map(async (m) => {
          const temperatura = await fetchMachineTemperatura(m.imei);
          const isOnline = temperatura !== null && temperatura.temperatura !== null && temperatura.temperatura !== undefined;
          return {
            maquinaId: m.id,
            nombre: m.nombre,
            imei: m.imei,
            temperatura,
            isOnline,
          };
        })
      );
      return results;
    },
    enabled: imeis.length > 0,
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
};
