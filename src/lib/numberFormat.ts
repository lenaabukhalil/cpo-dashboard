export const toNumberSafe = (v: unknown): number => {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

/** JOD columns — 2 decimal places (Mobile PDF). */
export const formatMoney = (v: unknown): string => toNumberSafe(v).toFixed(2)

/** Energy kWh — 3 decimal places (Mobile PDF). */
export const formatEnergy = (v: unknown): string => toNumberSafe(v).toFixed(3)
