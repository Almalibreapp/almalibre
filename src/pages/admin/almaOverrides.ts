// Guarda cambios de estado hechos desde el panel cuando el sistema externo de Alma
// no permite escribir (solo lectura). Así el panel siempre refleja la última acción.

const KEY = 'alma-estado-overrides-v1';

export type Override = { status: string; resolved_at: string | null; at: string };
type Store = Record<string, Override>; // clave: `${tabla}:${id}`

const read = (): Store => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as Store;
  } catch {
    return {};
  }
};

export const getOverrides = read;

export const setOverride = (tabla: string, id: string, ov: Omit<Override, 'at'>) => {
  const store = read();
  store[`${tabla}:${id}`] = { ...ov, at: new Date().toISOString() };
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* noop */
  }
};

export const applyOverrides = <T extends Record<string, any>>(tabla: string, rows: T[]): T[] => {
  const store = read();
  if (!Object.keys(store).length) return rows;
  return rows.map((r) => {
    const ov = store[`${tabla}:${r.id}`];
    return ov ? ({ ...r, status: ov.status, resolved_at: ov.resolved_at } as T) : r;
  });
};
