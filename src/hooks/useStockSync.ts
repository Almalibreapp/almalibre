/**
 * DEPRECATED: El desconteo de stock ahora se hace en el backend mediante un
 * trigger sobre `ventas_historico` (public.deduct_stock_on_sale).
 *
 * Este hook se mantiene como no-op para no romper imports existentes, pero ya
 * no realiza ninguna llamada a la máquina física ni escribe en stock_config.
 */
export const useStockSync = (_imei: string | undefined) => {
  // Intencionalmente vacío. Ver comentario arriba.
};
