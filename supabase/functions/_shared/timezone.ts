/**
 * Timezone utilities: China (UTC+8) ↔ Spain (Europe/Madrid)
 *
 * Spain offsets:
 *   CET  (winter) = UTC+1  → China is +7h ahead
 *   CEST (summer) = UTC+2  → China is +6h ahead
 */

/**
 * Convert a China datetime string to an ISO string in Spain timezone.
 * @param chinaDateString  "YYYY-MM-DD HH:mm:ss" in UTC+8
 * @returns ISO-8601 string representing the same instant in Europe/Madrid
 */
export function convertChinaToSpain(chinaDateString: string): string {
  // Parse as UTC, then subtract 8h to get true UTC
  const [datePart, timePart = '00:00:00'] = chinaDateString.trim().split(' ')
  const utcMs = Date.parse(`${datePart}T${timePart}Z`) - 8 * 3600_000

  // Format in Europe/Madrid
  const d = new Date(utcMs)
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d)

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  const iso = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`

  // Compute Spain UTC offset at this instant
  const spainStr = d.toLocaleString('en-US', { timeZone: 'Europe/Madrid' })
  const spainLocal = new Date(spainStr)
  const offsetMs = spainLocal.getTime() - d.getTime()
  const offsetH = Math.round(offsetMs / 3600_000)
  const sign = offsetH >= 0 ? '+' : '-'
  const abs = String(Math.abs(offsetH)).padStart(2, '0')

  return `${iso}${sign}${abs}:00`
}

/**
 * Format an ISO string to Spain time "HH:mm"
 */
export function formatSpainTime(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleTimeString('es-ES', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/**
 * Format an ISO string to Spain date "DD/MM/YYYY"
 */
export function formatSpainDate(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleDateString('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Given a Spanish date "YYYY-MM-DD", return the China date range
 * needed to cover that full Spanish day when querying the API.
 *
 * Spain 00:00 → China 06:00 or 07:00 (depending on DST)
 * Spain 23:59 → China 05:59 or 06:59 next day
 *
 * Returns { start, end } as "YYYY-MM-DD" in China calendar dates.
 */
export function getChineseDateRange(spanishDateString: string): { start: string; end: string } {
  // Spain day start: YYYY-MM-DD 00:00:00 Europe/Madrid → UTC → +8h = China
  const spainMidnight = new Date(`${spanishDateString}T00:00:00`)

  // Get UTC offset for Spain at midnight of that date
  const spainMidnightStr = spainMidnight.toLocaleString('en-US', { timeZone: 'Europe/Madrid' })
  const spainLocal = new Date(spainMidnightStr)
  const utcForMidnight = new Date(
    spainMidnight.getTime() - (spainLocal.getTime() - spainMidnight.getTime())
  )

  // Spain end of day: 23:59:59
  const spainEndOfDay = new Date(`${spanishDateString}T23:59:59`)
  const spainEndStr = spainEndOfDay.toLocaleString('en-US', { timeZone: 'Europe/Madrid' })
  const spainEndLocal = new Date(spainEndStr)
  const utcForEnd = new Date(
    spainEndOfDay.getTime() - (spainEndLocal.getTime() - spainEndOfDay.getTime())
  )

  // Convert UTC → China (UTC+8)
  const chinaStart = new Date(utcForMidnight.getTime() + 8 * 3600_000)
  const chinaEnd = new Date(utcForEnd.getTime() + 8 * 3600_000)

  const fmt = (d: Date) => d.toISOString().split('T')[0]

  return { start: fmt(chinaStart), end: fmt(chinaEnd) }
}
