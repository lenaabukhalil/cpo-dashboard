import { request } from '../services/api'

export type FinancialGranularity = 'hour' | 'day' | 'week' | 'month'

export type FinancialBreakdownGroupBy = 'location' | 'charger' | 'tariff' | 'session_type' | 'connector'

export interface FinancialSummaryData {
  total_revenue: number
  total_energy: number
  total_sessions: number
  total_discount: number
  avg_revenue_per_session: number
  avg_energy_per_session: number
}

/** Normalize API payload (flat or legacy nested metrics). */
export function normalizeFinancialSummary(raw: unknown): FinancialSummaryData | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>

  if (typeof o.total_revenue === 'number') {
    return {
      total_revenue: o.total_revenue,
      total_energy: Number(o.total_energy) || 0,
      total_sessions: Number(o.total_sessions) || 0,
      total_discount: Number(o.total_discount) || 0,
      avg_revenue_per_session: Number(o.avg_revenue_per_session) || 0,
      avg_energy_per_session: Number(o.avg_energy_per_session) || 0,
    }
  }

  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  const metric = (key: string) => {
    const m = o[key]
    if (m && typeof m === 'object' && 'value' in (m as object)) {
      return num((m as { value?: number }).value)
    }
    return num(m)
  }

  return {
    total_revenue: metric('revenue'),
    total_energy: metric('energy'),
    total_sessions: metric('sessions'),
    total_discount: num(o.discount ?? o.total_discount),
    avg_revenue_per_session: num(o.avgAmount ?? o.avg_revenue_per_session),
    avg_energy_per_session: num(o.avgEnergy ?? o.avg_energy_per_session),
  }
}

export interface FinancialBreakdownRow {
  label: string
  sessions: number
  revenue: number
  energy: number
  discount: number
}

/** Row keys match backend JSON (spaces in property names). */
export type FinancialBillRow = Record<string, string | number | null | undefined>

export const FINANCIAL_BILL_KEYS = {
  billId: 'Bill ID',
  sessionId: 'Session ID',
  issueDate: 'Issue Date',
  sessionDate: 'Session Date',
  location: 'Location',
  charger: 'Charger',
  connector: 'Connector',
  type: 'Type',
  tariff: 'Tariff',
  rate: 'Rate',
  energy: 'Energy (KWH)',
  amount: 'Amount (JOD)',
  discount: 'Discount (JOD)',
  net: 'Net (JOD)',
  customer: 'Customer',
} as const

export function getBillField(row: FinancialBillRow, key: keyof typeof FINANCIAL_BILL_KEYS): string | number | null | undefined {
  return row[FINANCIAL_BILL_KEYS[key]]
}

export async function getFinancialSummary(params: { from: string; to: string }) {
  return request<{ data: unknown }>('/api/v4/cpo/financial-summary', {
    params: { from: params.from, to: params.to },
    skipCache: true,
  })
}

export async function getFinancialBreakdown(params: {
  from: string
  to: string
  groupBy: FinancialBreakdownGroupBy
}) {
  return request<{ data: FinancialBreakdownRow[]; count?: number }>('/api/v4/cpo/financial-breakdown', {
    params: { from: params.from, to: params.to, groupBy: params.groupBy },
    skipCache: true,
  })
}

export async function getFinancialBills(params: { from: string; to: string; dateOrder?: 'asc' | 'desc' }) {
  return request<{ data: FinancialBillRow[]; count?: number }>('/api/v4/cpo/financial-bills', {
    params: {
      from: params.from,
      to: params.to,
      dateOrder: params.dateOrder ?? 'desc',
    },
    skipCache: true,
  })
}
