import { useQuery } from '@tanstack/react-query';
import { useMaquinas } from '@/hooks/useMaquinas';
import { useAuth } from '@/hooks/useAuth';
import { fetchVentasResumen, fetchOrdenes, fetchTemperatura } from '@/services/api';
import { VentasResumenResponse, VentasDetalleResponse, TemperaturaResponse, ToppingVenta } from '@/types';

// Fetch ordenes for a specific machine and date
const fetchMachineOrdenes = async (imei: string, fecha?: string) => {
  try {
    return await fetchOrdenes(imei, fecha);
  } catch {
    return null;
  }
};

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
  detallePorMaquina: { maquinaId: string; nombre: string; imei: string; detalle: VentasDetalleResponse | null }[];
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

  return useQuery<NetworkDetailData>({
    queryKey: ['network-detail', imeis.map(m => m.imei).join(','), fecha],
    queryFn: async () => {
      const results = await Promise.all(
        imeis.map(async (m) => ({
          maquinaId: m.id,
          nombre: m.nombre,
          imei: m.imei,
          detalle: await fetchMachineOrdenes(m.imei, fecha),
        }))
      );

      // Aggregate all sales with machine name and toppings
      const todasLasVentas = results
        .flatMap(r =>
          (r.detalle?.ventas ?? []).map(v => ({
            maquina: r.nombre,
            id: v.id,
            hora: v.hora,
            producto: v.producto,
            precio: v.precio,
            estado: v.estado,
            toppings: v.toppings || [],
          }))
        )
        .sort((a, b) => b.hora.localeCompare(a.hora));

      // Calculate peak hour (hora caliente) in Spanish local time
      const ventasPorHora: Record<string, { ventas: number; ingresos: number }> = {};
      todasLasVentas.forEach(v => {
        const hora = v.hora.split(':')[0] + ':00';
        if (!ventasPorHora[hora]) ventasPorHora[hora] = { ventas: 0, ingresos: 0 };
        ventasPorHora[hora].ventas += 1;
        ventasPorHora[hora].ingresos += v.precio;
      });

      let horaCaliente: NetworkDetailData['horaCaliente'] = null;
      let maxVentas = 0;
      Object.entries(ventasPorHora).forEach(([hora, data]) => {
        if (data.ventas > maxVentas) {
          maxVentas = data.ventas;
          horaCaliente = { hora, ventas: data.ventas, ingresos: data.ingresos };
        }
      });

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
          // Machine is online if API returns valid temperature data (not null)
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
