import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a numeric value (number or numeric string) to a fixed number of decimal places.
 * Returns '—' for null/undefined/NaN/non-numeric input.
 */
export function formatDecimal(value: number | string | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(decimals)
}

/** Whole-number display for counts (e.g. session totals). */
export function formatInteger(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n)) return '—'
  return Math.round(n).toLocaleString()
}
