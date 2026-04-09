/**
 * Timezone conversion utilities.
 * The manufacturer API returns timestamps in China time (UTC+8).
 * We convert them to Spain time (Europe/Madrid) for display.
 */

/**
 * Parse a China-time datetime string and return a JS Date (in UTC internally).
 * Accepts formats: "YYYY-MM-DD HH:mm:ss", "YYYY-MM-DDTHH:mm:ss", or ISO strings.
 */
export function parseChinaDateTime(chinaDateString: string): Date {
  if (!chinaDateString) return new Date();

  // Normalize T separator
  const normalized = chinaDateString.replace('T', ' ').replace(/\.000Z$/, '');
  const [datePart, timePart = '00:00:00'] = normalized.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const timeParts = timePart.split(':').map(Number);
  const [hour = 0, minute = 0, second = 0] = timeParts;

  // China is UTC+8, so subtract 8 hours to get UTC
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second));
}

/**
 * Format a Date object to Spain time "HH:mm" string.
 */
export function formatSpainTime(date: Date): string {
  return date.toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Format a Date object to Spain date "YYYY-MM-DD" string.
 */
export function formatSpainDate(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
}

/**
 * Format a Date object to full Spain datetime string.
 */
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

/**
 * Convert a China-time "HH:mm" hour string (with a date context) to Spain time "HH:mm".
 * If only hour is available, uses today's date as context.
 */
export function convertChinaHourToSpain(hora: string, fecha?: string): string {
  const dateContext = fecha || new Date().toISOString().substring(0, 10);
  const chinaString = `${dateContext} ${hora}:00`;
  const utcDate = parseChinaDateTime(chinaString);
  return formatSpainTime(utcDate);
}

/**
 * Convert a sale's fecha+hora from China time to Spain time.
 * Returns { fecha, hora } in Spain timezone.
 */
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
