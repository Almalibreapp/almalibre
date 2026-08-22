interface DedupableMaquina {
  mac_address: string;
  activa?: boolean | null;
  ubicacion?: string | null;
  created_at?: string | null;
}

const hasText = (value?: string | null) => Boolean(value?.trim());

const isBetterCandidate = (candidate: DedupableMaquina, current: DedupableMaquina) => {
  if (Boolean(candidate.activa) !== Boolean(current.activa)) return Boolean(candidate.activa);
  if (hasText(candidate.ubicacion) !== hasText(current.ubicacion)) return hasText(candidate.ubicacion);
  const candidateTime = candidate.created_at ? new Date(candidate.created_at).getTime() : 0;
  const currentTime = current.created_at ? new Date(current.created_at).getTime() : 0;
  return candidateTime > currentTime;
};

/** Elimina máquinas repetidas quedándose con un único registro por IMEI. */
export function dedupeMaquinasByImei<T extends DedupableMaquina>(maquinas: T[] | null | undefined): T[] {
  const map = new Map<string, T>();
  for (const maquina of maquinas || []) {
    const existing = map.get(maquina.mac_address);
    if (!existing || isBetterCandidate(maquina, existing)) map.set(maquina.mac_address, maquina);
  }
  return Array.from(map.values());
}
