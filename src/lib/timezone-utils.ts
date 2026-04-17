/**
 * Timezone conversion utilities.
 * The backend now sends fecha_hora_china field (China time string).
 * We convert to Spain time (Europe/Madrid) for display.
 */

/**
 * Convert a fecha_hora_china string to Spain display time,
 * applying machine-specific adjustments.
 * 
 * - Machine 865622072039477 (China): subtract 6 hours (UTC+8 → UTC+2)
 * - All other machines: use time as-is (already in Spain time)
 */
export function convertirHoraSegunMaquina(fechaHoraChina: string, imei: string): string {
  if (!fechaHoraChina) return '00:00';
  const normalized = fechaHoraChina.replace('T', ' ').replace(/\.\d+Z?$/, '').replace(/Z$/, '');
  const [fecha, hora] = normalized.split(' ');
  if (!fecha || !hora) return '00:00';
  const [year, month, day] = fecha.split('-').map(Number);
  const [hour, minute, second = 0] = hora.split(':').map(Number);

  // Para la máquina 865622072039477: el timestamp viene en UTC+8 (China).
  // Lo convertimos a UTC restando 8 horas y luego formateamos en zona Europe/Madrid
  // para que se aplique automáticamente el horario de invierno/verano.
  if (imei === '865622072039477') {
    const utcMs = Date.UTC(year, month - 1, day, hour - 8, minute, second);
    const utcDate = new Date(utcMs);
    return utcDate.toLocaleTimeString('es-ES', {
      timeZone: 'Europe/Madrid',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  // Resto de máquinas: la hora ya viene en hora española, devolver tal cual.
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Legacy wrapper — uses convertirHoraSegunMaquina with empty imei (no adjustment).
 * @deprecated Use convertirHoraSegunMaquina(fechaHoraChina, imei) instead.
 */
export function mostrarHoraVenta(fechaHoraChina: string): string {
  return convertirHoraSegunMaquina(fechaHoraChina, '');
}

/**
 * Extract Spain date from fecha_hora_china.
 * Input: "2026-04-11 16:27:12"
 * Output: "2026-04-11"
 */
export function extraerFechaVenta(fechaHoraChina: string): string {
  if (!fechaHoraChina) return '';
  return fechaHoraChina.split(' ')[0] || '';
}

/**
 * Convert fecha_hora_china to both date and time for Spain.
 */
export function convertirVentaAEspana(fechaHoraChina: string, imei: string = ''): { fecha: string; hora: string } {
  return {
    fecha: extraerFechaVenta(fechaHoraChina),
    hora: convertirHoraSegunMaquina(fechaHoraChina, imei),
  };
}

// Legacy exports kept for backward compatibility during transition
export function parseChinaDateTime(chinaDateString: string): Date {
  if (!chinaDateString) return new Date();
  const normalized = chinaDateString.replace('T', ' ').replace(/\.000Z$/, '');
  const [datePart, timePart = '00:00:00'] = normalized.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const timeParts = timePart.split(':').map(Number);
  const [hour = 0, minute = 0, second = 0] = timeParts;
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second));
}

export function formatSpainTime(date: Date): string {
  return date.toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatSpainDate(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
}

export function formatSpainDateTime(date: Date): string {
  return date.toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function convertChinaHourToSpain(hora: string, fecha?: string): string {
  const dateContext = fecha || new Date().toISOString().substring(0, 10);
  const chinaString = `${dateContext} ${hora}:00`;
  const utcDate = parseChinaDateTime(chinaString);
  return formatSpainTime(utcDate);
}

export function convertSaleToSpain(fecha: string, hora: string): { fecha: string; hora: string } {
  const dateStr = (fecha || '').substring(0, 10);
  const timeStr = hora || '00:00';
  const chinaString = `${dateStr} ${timeStr}:00`;
  const utcDate = parseChinaDateTime(chinaString);
  return {
    fecha: formatSpainDate(utcDate),
    hora: formatSpainTime(utcDate),
  };
}
