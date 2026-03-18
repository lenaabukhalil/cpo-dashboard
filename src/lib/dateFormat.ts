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
