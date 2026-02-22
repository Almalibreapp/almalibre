/**
 * Converts a datetime from China timezone (UTC+8) to Spain timezone (Europe/Madrid).
 * The API returns dates and times in China local time; we display them in Spain local time.
 *
 * @param hora - Time string in HH:MM or HH:MM:SS format (China time)
 * @param fecha - Date string YYYY-MM-DD (China date). Defaults to today.
 * @returns Object with { fecha: 'YYYY-MM-DD', hora: 'HH:MM' } in Spain time
 */
export const convertChinaToSpainFull = (hora: string, fecha?: string): { fecha: string; hora: string } => {
  try {
    const dateStr = fecha || new Date().toISOString().split('T')[0];
    const timeStr = hora.length === 5 ? hora + ':00' : hora;

    // Create a Date object with China timezone offset (UTC+8)
    const utcDate = new Date(`${dateStr}T${timeStr}+08:00`);

    // Format date in Spain timezone
    const spainDate = utcDate.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' }); // sv-SE gives YYYY-MM-DD
    const spainTime = utcDate.toLocaleTimeString('es-ES', {
      timeZone: 'Europe/Madrid',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    return { fecha: spainDate, hora: spainTime };
  } catch {
    return { fecha: fecha || '', hora };
  }
};

/**
 * Shorthand: converts only the time, returning just the HH:MM string in Spain time.
 */
export const convertChinaToSpain = (hora: string, fecha?: string): string => {
  return convertChinaToSpainFull(hora, fecha).hora;
};

/**
 * Given a Spain target date, returns the range of China dates that could contain
 * sales for that Spanish day.
 * 
 * Spain is 6-7 hours behind China depending on DST.
 * - China 00:00 = Spain ~17:00-18:00 (previous day)
 * - China 07:00-08:00 = Spain ~00:00-01:00 (same day)
 * 
 * So for a given Spain date D, we need China dates D and D+1.
 */
export const getChinaDatesForSpainDate = (spainDate: string): string[] => {
  const d = new Date(spainDate);
  const next = new Date(d);
  next.setDate(next.getDate() + 1);
  return [
    spainDate,
    next.toISOString().split('T')[0],
  ];
};
