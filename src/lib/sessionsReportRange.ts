/**
 * Charger/connector comparison endpoints still expect calendar dates (YYYY-MM-DD).
 * When the sessions report uses datetime-local, strip the time part for those fallbacks.
 */
export function toDateOnlyForComparisonApi(s: string): string {
  const t = s.trim()
  if (t.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10)
  return t
}

/** Safe fragment for download filenames (Windows forbids : in names). */
export function sanitizeFilenameDateRange(s: string): string {
  return s.trim().replace(/[:]/g, '-').replace(/[/\\?*|"<>]/g, '_')
}

/** Must include calendar date + `T` + time (`HH:mm`); allows optional seconds / ms from some browsers. */
const DATETIME_LOCAL_PREFIX_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

export function isValidDatetimeLocalSessionsInput(s: string): boolean {
  const t = s.trim()
  if (!DATETIME_LOCAL_PREFIX_RE.test(t)) return false
  const ms = Date.parse(t)
  return !Number.isNaN(ms)
}

export function sessionsDatetimeRangeOrderOk(from: string, to: string): boolean {
  const a = Date.parse(from.trim())
  const b = Date.parse(to.trim())
  if (Number.isNaN(a) || Number.isNaN(b)) return false
  return a <= b
}

export type SessionsRangeValidationError = 'required' | 'invalidFormat' | 'fromAfterTo'

export function validateSessionsDatetimeRange(from: string, to: string): SessionsRangeValidationError | null {
  const f = from.trim()
  const t = to.trim()
  if (!f || !t) return 'required'
  if (!isValidDatetimeLocalSessionsInput(f) || !isValidDatetimeLocalSessionsInput(t)) return 'invalidFormat'
  if (!sessionsDatetimeRangeOrderOk(f, t)) return 'fromAfterTo'
  return null
}

/** Calendar date from current From field (`YYYY-MM-DD` prefix), or today in local time. */
export function calendarDateFromFromFieldOrToday(fromValue: string): string {
  const raw = fromValue.trim()
  if (raw.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const n = new Date()
  const y = n.getFullYear()
  const m = String(n.getMonth() + 1).padStart(2, '0')
  const d = String(n.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function fullDayDatetimeLocalForDateYmd(dateYmd: string): { from: string; to: string } {
  return { from: `${dateYmd}T00:00`, to: `${dateYmd}T23:59` }
}

/** Local calendar date at 00:00 for `datetime-local` default (picker opens on current month). */
export function getTodayMidnightDatetimeLocal(): string {
  const n = new Date()
  const y = n.getFullYear()
  const m = String(n.getMonth() + 1).padStart(2, '0')
  const d = String(n.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}T00:00`
}
