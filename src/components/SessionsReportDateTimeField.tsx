import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../lib/utils'
import { Input } from './ui/input'
import { Label } from './ui/label'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function localYmd(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

function getNowParts(): { ymd: string; h: number; m: number } {
  const n = new Date()
  return { ymd: localYmd(n), h: n.getHours(), m: n.getMinutes() }
}

function combinedLocalMs(dateYmd: string, h: number, m: number): number {
  return new Date(`${dateYmd}T${pad2(h)}:${pad2(m)}:00`).getTime()
}

/** If dateYmd + time is after now (local), return clamped parts to now. */
function clampDateTimeToNowParts(dateYmd: string, h: number, m: number): { date: string; h: number; m: number } {
  const now = new Date()
  const ts = combinedLocalMs(dateYmd, h, m)
  if (ts <= now.getTime()) return { date: dateYmd, h, m }
  const np = getNowParts()
  return { date: np.ymd, h: np.h, m: np.m }
}

function clampCombinedString(value: string, emptyTimeDefault: '00:00' | '23:59'): string {
  const p = parseCombined(value, emptyTimeDefault)
  if (!p.date) return value
  const hi = parseInt(p.hh, 10)
  const mi = parseInt(p.mm, 10)
  const h = Number.isFinite(hi) ? hi : 0
  const m = Number.isFinite(mi) ? mi : 0
  const { date, h: ch, m: cm } = clampDateTimeToNowParts(p.date, h, m)
  return `${date}T${pad2(ch)}:${pad2(cm)}`
}

/** Reads `YYYY-MM-DDTHH:mm` and extracts date / hour / minute strings (same contract as before). */
function parseCombined(
  value: string,
  emptyTimeDefault: '00:00' | '23:59'
): { date: string; hh: string; mm: string } {
  const [defH, defM] = emptyTimeDefault.split(':')
  const t = value.trim()
  if (!t) return { date: '', hh: defH, mm: defM }
  const m = t.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/)
  if (m) {
    let hh = m[2]
    let mm = m[3]
    const hi = parseInt(hh, 10)
    const mi = parseInt(mm, 10)
    if (!Number.isFinite(hi) || hi < 0 || hi > 23) hh = defH
    if (!Number.isFinite(mi) || mi < 0 || mi > 59) mm = defM
    return { date: m[1], hh, mm }
  }
  const dm = t.match(/^(\d{4}-\d{2}-\d{2})$/)
  if (dm) return { date: dm[1], hh: defH, mm: defM }
  return { date: '', hh: defH, mm: defM }
}

function defaultsFromEmptyTime(emptyTimeDefault: '00:00' | '23:59'): { h: number; m: number } {
  return {
    h: emptyTimeDefault === '23:59' ? 23 : 0,
    m: emptyTimeDefault === '23:59' ? 59 : 0,
  }
}

function parsedToHourMinute(
  value: string,
  emptyTimeDefault: '00:00' | '23:59'
): { hour: number; minute: number } {
  const { hh, mm } = parseCombined(value, emptyTimeDefault)
  const { h: dH, m: dM } = defaultsFromEmptyTime(emptyTimeDefault)
  const hi = parseInt(hh, 10)
  const mi = parseInt(mm, 10)
  return {
    hour: Number.isFinite(hi) && hi >= 0 && hi <= 23 ? hi : dH,
    minute: Number.isFinite(mi) && mi >= 0 && mi <= 59 ? mi : dM,
  }
}

const spinBtnClass =
  'h-3 w-5 flex shrink-0 items-center justify-center rounded-sm text-muted-foreground opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30'

const timeDigitInputClass =
  'h-[14px] w-[22px] border-0 bg-transparent p-0 text-center font-mono text-sm tabular-nums leading-none shadow-none outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0'

export interface SessionsReportDateTimeFieldProps {
  /** Shown on the same row as HH / MM (e.g. “From”, “To”). */
  fieldLabel: string
  value: string
  onChange: (combined: string) => void
  /** Default hour:minute when value is empty or date-only. */
  emptyTimeDefault: '00:00' | '23:59'
  className?: string
}

/**
 * Date input + spinner time (hour / minute); `value` / `onChange` use `YYYY-MM-DDTHH:mm`.
 * Selection is capped at the current local date and time.
 * `fieldLabel`, **HH**, and **MM** share one row; the bordered control is on the row below.
 */
export function SessionsReportDateTimeField({
  fieldLabel,
  value,
  onChange,
  emptyTimeDefault,
  className,
}: SessionsReportDateTimeFieldProps) {
  const maxDateStr = localYmd(new Date())
  const { date } = parseCombined(value, emptyTimeDefault)

  const [hour, setHour] = useState(() => parsedToHourMinute(value, emptyTimeDefault).hour)
  const [minute, setMinute] = useState(() => parsedToHourMinute(value, emptyTimeDefault).minute)
  const [hourText, setHourText] = useState(() => pad2(parsedToHourMinute(value, emptyTimeDefault).hour))
  const [minuteText, setMinuteText] = useState(() => pad2(parsedToHourMinute(value, emptyTimeDefault).minute))
  const hourFocused = useRef(false)
  const minuteFocused = useRef(false)

  useEffect(() => {
    const t = value.trim()
    if (!t) {
      const next = parsedToHourMinute(value, emptyTimeDefault)
      setHour(next.hour)
      setMinute(next.minute)
      return
    }
    const clamped = clampCombinedString(value, emptyTimeDefault)
    if (clamped !== t) {
      onChange(clamped)
      return
    }
    const next = parsedToHourMinute(value, emptyTimeDefault)
    setHour(next.hour)
    setMinute(next.minute)
  }, [value, emptyTimeDefault, onChange])

  useEffect(() => {
    if (!hourFocused.current) setHourText(pad2(hour))
  }, [hour])

  useEffect(() => {
    if (!minuteFocused.current) setMinuteText(pad2(minute))
  }, [minute])

  const apply = (nextDate: string, h: number, m: number) => {
    if (!nextDate.trim()) {
      onChange('')
      return
    }
    let d = nextDate.trim()
    if (d > maxDateStr) d = maxDateStr
    const { date: cd, h: ch, m: cm } = clampDateTimeToNowParts(d, h, m)
    onChange(`${cd}T${pad2(ch)}:${pad2(cm)}`)
  }

  const commitHourInput = () => {
    if (!date) return
    hourFocused.current = false
    const raw = hourText.trim()
    const n = parseInt(raw, 10)
    if (raw === '' || !Number.isFinite(n)) {
      setHourText(pad2(hour))
      return
    }
    const h = Math.min(23, Math.max(0, Math.floor(n)))
    setHour(h)
    setHourText(pad2(h))
    apply(date, h, minute)
  }

  const commitMinuteInput = () => {
    if (!date) return
    minuteFocused.current = false
    const raw = minuteText.trim()
    const n = parseInt(raw, 10)
    if (raw === '' || !Number.isFinite(n)) {
      setMinuteText(pad2(minute))
      return
    }
    const m = Math.min(59, Math.max(0, Math.floor(n)))
    setMinute(m)
    setMinuteText(pad2(m))
    apply(date, hour, m)
  }

  const np = getNowParts()
  const isToday = !!date && date === np.ymd
  const maxHour = isToday ? np.h : 23
  const maxMinuteForHour = isToday && hour === np.h ? np.m : 59

  const hourUp = () => {
    if (!date) return
    let h: number
    if (isToday) {
      if (hour >= maxHour) return
      h = hour + 1
    } else {
      h = (hour + 1) % 24
    }
    let mm = minute
    if (isToday && h === np.h && mm > np.m) mm = np.m
    setHour(h)
    setMinute(mm)
    apply(date, h, mm)
  }

  const hourDown = () => {
    if (!date) return
    let h: number
    if (hour === 0) {
      if (isToday) return
      h = 23
    } else {
      h = hour - 1
    }
    hourFocused.current = false
    setHour(h)
    setHourText(pad2(h))
    apply(date, h, minute)
  }

  const minuteUp = () => {
    if (!date) return
    let m = minute + 15
    if (m >= 60) m -= 60
    if (isToday && hour === np.h && m > np.m) m = np.m
    minuteFocused.current = false
    setMinute(m)
    setMinuteText(pad2(m))
    apply(date, hour, m)
  }

  const minuteDown = () => {
    if (!date) return
    let m: number
    if (isToday && hour === np.h) {
      m = Math.max(0, minute - 15)
    } else {
      m = (minute + 45) % 60
    }
    minuteFocused.current = false
    setMinute(m)
    setMinuteText(pad2(m))
    apply(date, hour, m)
  }

  const hourUpDisabled = !date || (isToday && hour >= maxHour)
  const hourDownDisabled = !date || (isToday && hour === 0)
  const minuteUpDisabled = !date || (isToday && hour === np.h && minute >= maxMinuteForHour)
  const minuteDownDisabled = !date || (isToday && hour === np.h && minute <= 0)

  const timeDisabled = !date

  return (
    <div className={cn('flex w-fit max-w-full flex-col gap-1', className)}>
      {/* Same line: From/To + HH + MM (aligned above time columns) */}
      <div className="flex min-w-0 items-end gap-0">
        <Label className="min-w-[9.25rem] max-w-[11rem] shrink-0 text-xs font-normal text-muted-foreground">
          {fieldLabel}
        </Label>
        <div className="w-px shrink-0 self-stretch min-h-[0.875rem] select-none" aria-hidden />
        <div
          className="flex shrink-0 items-end gap-x-1 px-2"
          aria-hidden
        >
          <span className="text-center text-[10px] font-semibold uppercase leading-none tracking-wide text-muted-foreground">
            HH
          </span>
          <span className="pb-px text-muted-foreground font-medium text-xs leading-none select-none">:</span>
          <span className="text-center text-[10px] font-semibold uppercase leading-none tracking-wide text-muted-foreground">
            MM
          </span>
        </div>
      </div>

      <div
        className={cn(
          'flex min-h-10 min-w-0 items-center overflow-hidden rounded-lg border border-input bg-background',
          'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background'
        )}
      >
        <Input
          type="date"
          value={date}
          max={maxDateStr}
          onChange={(e) => apply(e.target.value, hour, minute)}
          className="h-10 min-h-10 max-h-10 w-auto min-w-[9.25rem] max-w-[11rem] shrink-0 grow-0 self-center border-0 rounded-none rounded-s-lg py-0 focus-visible:ring-0 focus-visible:ring-offset-0 font-mono text-sm"
        />
        <div className="w-px shrink-0 self-stretch min-h-[2.5rem] bg-border" aria-hidden />
        <div
          role="group"
          aria-label="Time"
          className={cn(
            'flex h-10 shrink-0 items-center gap-1 rounded-e-lg bg-muted/30 px-2',
            timeDisabled && 'pointer-events-none opacity-50'
          )}
        >
          <div className="flex flex-col items-center justify-center leading-none">
            <button
              type="button"
              className={spinBtnClass}
              disabled={timeDisabled || hourUpDisabled}
              onClick={hourUp}
              aria-label="Hour up"
            >
              <ChevronUp className="h-2.5 w-2.5" />
            </button>
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              disabled={timeDisabled}
              value={hourText}
              aria-label="Hour"
              className={timeDigitInputClass}
              onFocus={(e) => {
                hourFocused.current = true
                e.target.select()
              }}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 2)
                setHourText(v)
              }}
              onBlur={commitHourInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  ;(e.target as HTMLInputElement).blur()
                }
              }}
            />
            <button
              type="button"
              className={spinBtnClass}
              disabled={timeDisabled || hourDownDisabled}
              onClick={hourDown}
              aria-label="Hour down"
            >
              <ChevronDown className="h-2.5 w-2.5" />
            </button>
          </div>
          <span className="text-muted-foreground font-medium text-sm leading-none select-none" aria-hidden>
            :
          </span>
          <div className="flex flex-col items-center justify-center leading-none">
            <button
              type="button"
              className={spinBtnClass}
              disabled={timeDisabled || minuteUpDisabled}
              onClick={minuteUp}
              aria-label="Minute up"
            >
              <ChevronUp className="h-2.5 w-2.5" />
            </button>
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              disabled={timeDisabled}
              value={minuteText}
              aria-label="Minute"
              className={timeDigitInputClass}
              onFocus={(e) => {
                minuteFocused.current = true
                e.target.select()
              }}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 2)
                setMinuteText(v)
              }}
              onBlur={commitMinuteInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  ;(e.target as HTMLInputElement).blur()
                }
              }}
            />
            <button
              type="button"
              className={spinBtnClass}
              disabled={timeDisabled || minuteDownDisabled}
              onClick={minuteDown}
              aria-label="Minute down"
            >
              <ChevronDown className="h-2.5 w-2.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
