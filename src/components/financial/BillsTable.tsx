import { useMemo } from 'react'
import { Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { TablePagination } from '../TablePagination'
import { FINANCIAL_BILL_KEYS, getBillField, type FinancialBillRow } from '../../api/financial'
import { useTranslation } from '../../context/LanguageContext'
import { formatDateTime24, type DateInput } from '../../lib/dateFormat'
import { formatEnergy, formatMoney, toNumberSafe } from '../../lib/numberFormat'

/** financial-bills API: true UTC ISO strings → local display (DD/MM/YYYY HH:mm). */
function formatFinancialBillUtcDate(value: DateInput): string {
  return formatDateTime24(value)
}

export type BillsSortKey =
  | 'billId'
  | 'issueDate'
  | 'location'
  | 'charger'
  | 'connector'
  | 'tariff'
  | 'energy'
  | 'amount'
  | 'discount'
  | 'net'
  | 'customer'

export function billSortValue(row: FinancialBillRow, key: BillsSortKey): string | number {
  switch (key) {
    case 'billId': {
      const v = getBillField(row, 'billId')
      const n = Number(v)
      return Number.isFinite(n) ? n : String(v ?? '')
    }
    case 'issueDate': {
      const v = getBillField(row, 'issueDate')
      const t = v != null ? new Date(String(v)).getTime() : NaN
      return Number.isFinite(t) ? t : String(v ?? '')
    }
    case 'location':
      return String(getBillField(row, 'location') ?? '').toLowerCase()
    case 'charger':
      return String(getBillField(row, 'charger') ?? '').toLowerCase()
    case 'connector':
      return String(getBillField(row, 'connector') ?? '').toLowerCase()
    case 'tariff':
      return String(getBillField(row, 'tariff') ?? '').toLowerCase()
    case 'energy':
      return toNumberSafe(getBillField(row, 'energy'))
    case 'amount':
      return toNumberSafe(getBillField(row, 'amount'))
    case 'discount':
      return toNumberSafe(getBillField(row, 'discount'))
    case 'net':
      return toNumberSafe(getBillField(row, 'net'))
    case 'customer':
      return String(getBillField(row, 'customer') ?? '').toLowerCase()
    default:
      return ''
  }
}

export function sortBillsRows(rows: FinancialBillRow[], sortKey: BillsSortKey, sortDir: 'asc' | 'desc'): FinancialBillRow[] {
  const list = [...rows]
  list.sort((a, b) => {
    const va = billSortValue(a, sortKey)
    const vb = billSortValue(b, sortKey)
    let c = 0
    if (typeof va === 'number' && typeof vb === 'number') c = va - vb
    else c = String(va).localeCompare(String(vb), undefined, { numeric: true })
    return sortDir === 'asc' ? c : -c
  })
  return list
}

function escapeCsvCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

function formatCsvCell(header: string, raw: string | number | null | undefined): string {
  if (raw == null) return ''
  if (header === FINANCIAL_BILL_KEYS.energy) return formatEnergy(raw)
  if (
    header === FINANCIAL_BILL_KEYS.amount ||
    header === FINANCIAL_BILL_KEYS.discount ||
    header === FINANCIAL_BILL_KEYS.net ||
    header === FINANCIAL_BILL_KEYS.rate
  ) {
    return formatMoney(raw)
  }
  return String(raw)
}

function sumBillField(rows: FinancialBillRow[], key: keyof typeof FINANCIAL_BILL_KEYS): number {
  return rows.reduce((sum, row) => sum + toNumberSafe(getBillField(row, key)), 0)
}

export function exportBillsCsv(rows: FinancialBillRow[], filename: string) {
  const headers = [
    FINANCIAL_BILL_KEYS.billId,
    FINANCIAL_BILL_KEYS.issueDate,
    FINANCIAL_BILL_KEYS.sessionDate,
    FINANCIAL_BILL_KEYS.location,
    FINANCIAL_BILL_KEYS.charger,
    FINANCIAL_BILL_KEYS.connector,
    FINANCIAL_BILL_KEYS.tariff,
    FINANCIAL_BILL_KEYS.energy,
    FINANCIAL_BILL_KEYS.amount,
    FINANCIAL_BILL_KEYS.discount,
    FINANCIAL_BILL_KEYS.net,
    FINANCIAL_BILL_KEYS.customer,
  ]

  const DATE_COLUMNS: string[] = [
    FINANCIAL_BILL_KEYS.issueDate,
    FINANCIAL_BILL_KEYS.sessionDate,
  ]

  const LRM = '\u200E'

  const formatRowCells = (row: FinancialBillRow): string[] =>
    headers.map((h) => {
      const raw = row[h]
      if (raw == null) return ''
      if (DATE_COLUMNS.includes(h)) return `${LRM}${formatFinancialBillUtcDate(raw)}`
      return formatCsvCell(h, raw)
    })

  const totalEnergy = sumBillField(rows, 'energy')
  const totalAmount = sumBillField(rows, 'amount')
  const totalDiscount = sumBillField(rows, 'discount')
  const totalNet = sumBillField(rows, 'net')

  const totalsRow: Record<string, string> = Object.fromEntries(headers.map((h) => [h, '']))
  totalsRow[FINANCIAL_BILL_KEYS.billId] = 'TOTAL'
  totalsRow[FINANCIAL_BILL_KEYS.energy] = formatEnergy(totalEnergy)
  totalsRow[FINANCIAL_BILL_KEYS.amount] = formatMoney(totalAmount)
  totalsRow[FINANCIAL_BILL_KEYS.discount] = formatMoney(totalDiscount)
  totalsRow[FINANCIAL_BILL_KEYS.net] = formatMoney(totalNet)

  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => formatRowCells(row).map(escapeCsvCell).join(',')),
    headers.map((h) => escapeCsvCell(totalsRow[h] ?? '')).join(','),
  ]
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function BillsTable({
  bills,
  apiTotalCount,
  sortKey,
  sortDir,
  onSort,
  page,
  perPage,
  onPageChange,
  onExportCsv,
}: {
  bills: FinancialBillRow[]
  /** Total from API metadata (may exceed loaded `bills.length`). */
  apiTotalCount: number
  sortKey: BillsSortKey
  sortDir: 'asc' | 'desc'
  onSort: (key: BillsSortKey) => void
  page: number
  perPage: number
  onPageChange: (p: number) => void
  onExportCsv: () => void
}) {
  const { t } = useTranslation()

  const sorted = useMemo(() => sortBillsRows(bills, sortKey, sortDir), [bills, sortKey, sortDir])
  const pagerTotal = sorted.length

  const totals = useMemo(
    () => ({
      energy: sumBillField(bills, 'energy'),
      amount: sumBillField(bills, 'amount'),
      discount: sumBillField(bills, 'discount'),
      net: sumBillField(bills, 'net'),
      sessions: bills.length,
    }),
    [bills],
  )

  const pageSlice = useMemo(
    () => sorted.slice((page - 1) * perPage, page * perPage),
    [sorted, page, perPage],
  )

  const th = (key: BillsSortKey, label: string, className = '') => (
    <th className={`py-2 px-3 font-semibold text-foreground cursor-pointer select-none hover:bg-muted/50 ${className}`}>
      <button type="button" className="w-full text-start rtl:text-end" onClick={() => onSort(key)}>
        {label}
        {sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  )

  const cellNum = (v: string | number | null | undefined) => {
    const n = Number(v)
    return Number.isFinite(n) ? String(n) : '—'
  }

  return (
    <Card className="border border-border">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{t('reports.financial.billsTitle')}</CardTitle>
        <Button type="button" variant="outline" size="sm" className="gap-2 shrink-0" onClick={onExportCsv} disabled={sorted.length === 0}>
          <Download className="h-4 w-4" />
          {t('reports.financial.exportCsv')}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto table-wrap rounded-lg border border-border">
          <table className="w-full min-w-[900px] text-sm [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {th('billId', t('reports.financial.col.billId'))}
                {th('issueDate', t('reports.financial.col.issueDate'))}
                <th className="py-2 px-3 font-semibold text-foreground whitespace-nowrap">
                  {t('reports.financial.col.sessionDate')}
                </th>
                {th('location', t('reports.financial.col.location'))}
                {th('charger', t('reports.financial.col.charger'))}
                {th('connector', t('reports.financial.col.connector'))}
                {th('tariff', t('reports.financial.col.tariff'))}
                {th('energy', t('reports.financial.col.energy'), 'text-end rtl:text-start')}
                {th('amount', t('reports.financial.col.amount'), 'text-end rtl:text-start')}
                {th('discount', t('reports.financial.col.discount'), 'text-end rtl:text-start')}
                {th('net', t('reports.financial.col.net'), 'text-end rtl:text-start')}
                {th('customer', t('reports.financial.col.customer'))}
              </tr>
            </thead>
            <tbody>
              {pageSlice.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-muted-foreground">
                    {t('reports.noData')}
                  </td>
                </tr>
              ) : (
                pageSlice.map((row, i) => (
                  <tr key={`${getBillField(row, 'billId')}-${i}`} className="border-b border-border last:border-0">
                    <td className="py-2 px-3 text-start">{cellNum(getBillField(row, 'billId'))}</td>
                    <td className="py-2 px-3 text-start text-muted-foreground">
                      {formatFinancialBillUtcDate(getBillField(row, 'issueDate'))}
                    </td>
                    <td className="py-2 px-3 text-start text-muted-foreground">
                      {formatFinancialBillUtcDate(getBillField(row, 'sessionDate'))}
                    </td>
                    <td className="py-2 px-3 text-start">{String(getBillField(row, 'location') ?? '—')}</td>
                    <td className="py-2 px-3 text-start">{String(getBillField(row, 'charger') ?? '—')}</td>
                    <td className="py-2 px-3 text-start">{String(getBillField(row, 'connector') ?? '—')}</td>
                    <td className="py-2 px-3 text-start">{String(getBillField(row, 'tariff') ?? '—')}</td>
                    <td className="py-2 px-3 text-end rtl:text-start tabular-nums">
                      {formatEnergy(getBillField(row, 'energy'))}
                    </td>
                    <td className="py-2 px-3 text-end rtl:text-start tabular-nums">
                      {formatMoney(getBillField(row, 'amount'))}
                    </td>
                    <td className="py-2 px-3 text-end rtl:text-start tabular-nums">
                      {formatMoney(getBillField(row, 'discount'))}
                    </td>
                    <td className="py-2 px-3 text-end rtl:text-start tabular-nums">
                      {formatMoney(getBillField(row, 'net'))}
                    </td>
                    <td className="py-2 px-3 text-start font-mono text-xs">{String(getBillField(row, 'customer') ?? '—')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {bills.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">{t('reports.financial.kpi.revenue')}</p>
              <p className="font-semibold tabular-nums text-foreground">
                {formatMoney(totals.amount)} JOD
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('reports.financial.kpi.energy')}</p>
              <p className="font-semibold tabular-nums text-foreground">
                {formatEnergy(totals.energy)} KWH
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('reports.financial.kpi.sessions')}</p>
              <p className="font-semibold tabular-nums text-foreground">{totals.sessions}</p>
            </div>
          </div>
        ) : null}
        <TablePagination
          total={pagerTotal}
          page={page}
          perPage={perPage}
          onPageChange={onPageChange}
          onPerPageChange={() => {}}
          pageSizeOptions={[50]}
        />
        <p className="text-xs text-muted-foreground">
          {t('reports.financial.billsCountHint')
            .replace('{n}', String(apiTotalCount))
            .replace('{loaded}', String(pagerTotal))}
        </p>
      </CardContent>
    </Card>
  )
}
