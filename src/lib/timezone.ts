/**
 * Converts a time string from China timezone (UTC+8) to Spain timezone (Europe/Madrid).
 * The API returns times in China local time; we need to display them in Spain local time.
 *
 * @param hora - Time string in HH:MM or HH:MM:SS format (China time)
 * @param fecha - Optional date string YYYY-MM-DD (needed for DST calculation). Defaults to today.
 * @returns Time string in HH:MM format (Spain time)
 */
export const convertChinaToSpain = (hora: string, fecha?: string): string => {
  try {
    const dateStr = fecha || new Date().toISOString().split('T')[0];
    const [hours, minutes] = hora.split(':').map(Number);

    // Create a Date object representing the China time
    // China is always UTC+8 (no DST)
    const utcDate = new Date(`${dateStr}T${hora.length === 5 ? hora + ':00' : hora}+08:00`);

    // Format in Spain timezone
    const spainTime = utcDate.toLocaleTimeString('es-ES', {
      timeZone: 'Europe/Madrid',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    return spainTime;
  } catch {
    return hora; // fallback to original
  }
};

/**
 * Converts the hour part (HH:00) from China to Spain timezone.
 * Used for hourly grouping in charts.
 */
export const convertHourChinaToSpain = (horaGroup: string, fecha?: string): string => {
  return convertChinaToSpain(horaGroup.replace(':00', ':00'), fecha);
};
