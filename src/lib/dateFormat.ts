/**
 * Centralized date/time formatting for display across the frontend.
 * Use for all user-facing date/time values; API and state keep raw values.
 *
 * Formats:
 * - Date only: DD/MM/YYYY
 * - Time only: hh:mm A (12-hour with AM/PM)
 * - DateTime: DD/MM/YYYY hh:mm A
 * - Time only (24h): HH:mm
 * - DateTime (24h): DD/MM/YYYY HH:mm
 * - MySQL DATETIME / naive API strings: DD/MM/YYYY HH:mm:ss (24h, wall-clock digits, no UTC shift)
 *   or DD/MM/YYYY h:mm:ss AM/PM via formatMysqlWallClock12h
 *
 * Invalid, null, or undefined inputs display as "—".
 * Optional locale parameter for future i18n (e.g. from LanguageContext).
 */

export type DateInput = string | number | Date | null | undefined

const FALLBACK = '—'

function toDate(value: DateInput): Date | null {
  if (value == null || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number') {
    const ms = value > 1e12 ? value : value * 1000
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(value as string)
  return Number.isNaN(d.getTime()) ? null : d
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Format as date only: DD/MM/YYYY
 */
export function formatDate(value: DateInput, _locale?: string): string {
  const d = toDate(value)
  if (!d) return FALLBACK
  const day = pad2(d.getDate())
  const month = pad2(d.getMonth() + 1)
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

/**
 * Format as time only: hh:mm A (12-hour with AM/PM)
 */
export function formatTime(value: DateInput, _locale?: string): string {
  const d = toDate(value)
  if (!d) return FALLBACK
  const h = d.getHours()
  const m = pad2(d.getMinutes())
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${pad2(h12)}:${m} ${ampm}`
}

/**
 * Format as time only (24-hour): HH:mm
 */
export function formatTime24(value: DateInput, _locale?: string): string {
  const d = toDate(value)
  if (!d) return FALLBACK
  const h = pad2(d.getHours())
  const m = pad2(d.getMinutes())
  return `${h}:${m}`
}

/**
 * Format as date and time: DD/MM/YYYY hh:mm A
 */
export function formatDateTime(value: DateInput, _locale?: string): string {
  const d = toDate(value)
  if (!d) return FALLBACK
  return `${formatDate(d)} ${formatTime(d)}`
}

/**
 * Format as date and time (24-hour): DD/MM/YYYY HH:mm
 */
export function formatDateTime24(value: DateInput, _locale?: string): string {
  const d = toDate(value)
  if (!d) return FALLBACK
  return `${formatDate(d)} ${formatTime24(d)}`
}

const NAIVE_DATETIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z)?$/i

/** Lexicographic sort key for naive MySQL/API datetime (wall clock, no TZ shift). */
function naiveWallClockSortKey(value: unknown): string {
  const s = value == null ? '' : String(value).trim()
  const m = s.match(NAIVE_DATETIME_RE)
  if (m) {
    const sec = m[6] != null && m[6] !== '' ? pad2(Number(m[6])) : '00'
    const hh = pad2(Number(m[4]))
    return `${m[1]}-${m[2]}-${m[3]} ${hh}:${m[5]}:${sec}`
  }
  return s
}

/**
 * Sort sessions report rows by Start Date/Time (issue_date wall clock), then Session ID.
 * Use when the API orders by session_id only so the "Date order" control matches chronological order.
 */
export function compareSessionsReportRowsByStartTime(
  a: { 'Start Date/Time'?: string; 'Session ID'?: string | number },
  b: { 'Start Date/Time'?: string; 'Session ID'?: string | number }
): number {
  const ka = naiveWallClockSortKey(a['Start Date/Time'])
  const kb = naiveWallClockSortKey(b['Start Date/Time'])
  if (ka !== kb) return ka < kb ? -1 : ka > kb ? 1 : 0
  const sa = String(a['Session ID'] ?? '')
  const sb = String(b['Session ID'] ?? '')
  const na = Number(sa)
  const nb = Number(sb)
  if (Number.isFinite(na) && Number.isFinite(nb) && sa !== '' && sb !== '') {
    if (na !== nb) return na < nb ? -1 : na > nb ? 1 : 0
  }
  return sa.localeCompare(sb, undefined, { numeric: true })
}

function wallClockToDisplay12h(
  y: string,
  mo: string,
  day: string,
  h24: number,
  mi: string,
  sec: string | undefined
): string {
  const ampm = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 || 12
  const hasSec = sec != null && sec !== ''
  const time = hasSec ? `${h12}:${mi}:${pad2(Number(sec))}` : `${h12}:${mi}`
  return `${pad2(Number(day))}/${mo}/${y} ${time} ${ampm}`
}

function wallClockToDisplay24h(
  y: string,
  mo: string,
  day: string,
  h24: number,
  mi: string,
  sec: string | undefined
): string {
  const hasSec = sec != null && sec !== ''
  const time = hasSec
    ? `${pad2(h24)}:${mi}:${pad2(Number(sec))}`
    : `${pad2(h24)}:${mi}`
  return `${pad2(Number(day))}/${mo}/${y} ${time}`
}

/**
 * Sessions report / Partner_Bill.issue_date: same wall-clock digits as formatMysqlWallClock12h,
 * formatted as 24-hour time (no AM/PM).
 */
export function formatMysqlWallClock24h(value: DateInput, _locale?: string): string {
  if (value == null || value === '') return FALLBACK

  if (typeof value === 'string') {
    const m = value.trim().match(NAIVE_DATETIME_RE)
    if (m) {
      return wallClockToDisplay24h(m[1], m[2], m[3], Number(m[4]), m[5], m[6])
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return wallClockToDisplay24h(
      String(value.getUTCFullYear()),
      pad2(value.getUTCMonth() + 1),
      pad2(value.getUTCDate()),
      value.getUTCHours(),
      pad2(value.getUTCMinutes()),
      pad2(value.getUTCSeconds())
    )
  }

  if (typeof value === 'number') {
    const ms = value > 1e12 ? value : value * 1000
    const d = new Date(ms)
    if (Number.isNaN(d.getTime())) return FALLBACK
    return wallClockToDisplay24h(
      String(d.getUTCFullYear()),
      pad2(d.getUTCMonth() + 1),
      pad2(d.getUTCDate()),
      d.getUTCHours(),
      pad2(d.getUTCMinutes()),
      pad2(d.getUTCSeconds())
    )
  }

  const m = String(value).trim().match(NAIVE_DATETIME_RE)
  if (m) {
    return wallClockToDisplay24h(m[1], m[2], m[3], Number(m[4]), m[5], m[6])
  }

  return formatDateTime24(value, _locale)
}

/**
 * Sessions report / Partner_Bill.issue_date: show the same clock time as stored in MySQL
 * (naive DATETIME). Avoids `new Date(iso+Z)` shifting by the browser TZ (e.g. +3 → 13:48 vs 10:48).
 * Uses 12-hour clock with AM/PM.
 */
export function formatMysqlWallClock12h(value: DateInput, _locale?: string): string {
  if (value == null || value === '') return FALLBACK

  if (typeof value === 'string') {
    const m = value.trim().match(NAIVE_DATETIME_RE)
    if (m) {
      return wallClockToDisplay12h(m[1], m[2], m[3], Number(m[4]), m[5], m[6])
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return wallClockToDisplay12h(
      String(value.getUTCFullYear()),
      pad2(value.getUTCMonth() + 1),
      pad2(value.getUTCDate()),
      value.getUTCHours(),
      pad2(value.getUTCMinutes()),
      pad2(value.getUTCSeconds())
    )
  }

  if (typeof value === 'number') {
    const ms = value > 1e12 ? value : value * 1000
    const d = new Date(ms)
    if (Number.isNaN(d.getTime())) return FALLBACK
    return wallClockToDisplay12h(
      String(d.getUTCFullYear()),
      pad2(d.getUTCMonth() + 1),
      pad2(d.getUTCDate()),
      d.getUTCHours(),
      pad2(d.getUTCMinutes()),
      pad2(d.getUTCSeconds())
    )
  }

  const m = String(value).trim().match(NAIVE_DATETIME_RE)
  if (m) {
    return wallClockToDisplay12h(m[1], m[2], m[3], Number(m[4]), m[5], m[6])
  }

  return formatDateTime(value, _locale)
}
