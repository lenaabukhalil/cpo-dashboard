import { useCallback, useState } from 'react'
import { Activity, BatteryCharging, CircleDollarSign, DollarSign, Percent, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { AppSelect } from '../../components/shared/AppSelect'
import { KpiCard } from '../../components/financial/KpiCard'
import { FinancialBreakdownBarChart } from '../../components/financial/BreakdownChart'
import { BillsTable, exportBillsCsv, sortBillsRows, type BillsSortKey } from '../../components/financial/BillsTable'
import {
  getFinancialBills,
  getFinancialBreakdown,
  getFinancialSummary,
  normalizeFinancialSummary,
  type FinancialBillRow,
  type FinancialBreakdownGroupBy,
  type FinancialBreakdownRow,
  type FinancialGranularity,
  type FinancialSummaryData,
} from '../../api/financial'
import { useTranslation } from '../../context/LanguageContext'

function defaultFinancialRange() {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 30)
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return { from: `${fmt(from)}T00:00`, to: `${fmt(to)}T23:59` }
}

function fmtMoney(n: number) {
  if (!Number.isFinite(n)) return '—'
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} JOD`
}

function fmtKwh(n: number) {
  if (!Number.isFinite(n)) return '—'
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh`
}

function fmtInt(n: number) {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString()
}

const BILLS_PER_PAGE = 10

export default function FinancialReport() {
  const { t } = useTranslation()
  const [draftFrom, setDraftFrom] = useState(() => defaultFinancialRange().from)
  const [draftTo, setDraftTo] = useState(() => defaultFinancialRange().to)
  const [draftGranularity, setDraftGranularity] = useState<FinancialGranularity>('day')

  const [appliedFrom, setAppliedFrom] = useState<string | null>(null)
  const [appliedTo, setAppliedTo] = useState<string | null>(null)

  const [summary, setSummary] = useState<FinancialSummaryData | null>(null)
  const [bills, setBills] = useState<FinancialBillRow[]>([])
  const [billsCount, setBillsCount] = useState(0)
  const [breakdownBar, setBreakdownBar] = useState<FinancialBreakdownRow[]>([])
  const [groupBar, setGroupBar] = useState<FinancialBreakdownGroupBy>('location')

  const [barLoading, setBarLoading] = useState(false)
  const [mainLoading, setMainLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [sortKey, setSortKey] = useState<BillsSortKey>('issueDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  const granularityOptions = [
    { value: 'hour', label: t('reports.financial.granularity.hour') },
    { value: 'day', label: t('reports.financial.granularity.day') },
    { value: 'week', label: t('reports.financial.granularity.week') },
    { value: 'month', label: t('reports.financial.granularity.month') },
  ]

  const loadBreakdownBar = useCallback(async (from: string, to: string, gb: FinancialBreakdownGroupBy) => {
    setBarLoading(true)
    try {
      const r = await getFinancialBreakdown({ from, to, groupBy: gb })
      const d = (r as { data?: FinancialBreakdownRow[] }).data
      setBreakdownBar(Array.isArray(d) ? d : [])
    } catch {
      setBreakdownBar([])
    } finally {
      setBarLoading(false)
    }
  }, [])

  const handleApply = async () => {
    const from = draftFrom.trim()
    const to = draftTo.trim()
    if (!from || !to) {
      setError(t('reports.validationDateRequired'))
      return
    }
    setError(null)
    setMainLoading(true)
    setPage(1)
    try {
      const [sRes, bRes, barRes] = await Promise.all([
        getFinancialSummary({ from, to }),
        getFinancialBills({ from, to, dateOrder: 'desc' }),
        getFinancialBreakdown({ from, to, groupBy: groupBar }),
      ])

      if (!sRes.success) throw new Error(sRes.message || t('reports.financial.loadFailed'))
      const sData = normalizeFinancialSummary((sRes as { data?: unknown }).data)
      setSummary(sData)

      const bData = (bRes as { data?: FinancialBillRow[] }).data
      const list = Array.isArray(bData) ? bData : []
      setBills(list)
      const c = (bRes as { count?: number }).count
      setBillsCount(typeof c === 'number' && Number.isFinite(c) ? c : list.length)

      const barData = (barRes as { data?: FinancialBreakdownRow[] }).data
      setBreakdownBar(Array.isArray(barData) ? barData : [])

      setAppliedFrom(from)
      setAppliedTo(to)
    } catch (e) {
      setError((e as Error)?.message || t('reports.financial.loadFailed'))
      setSummary(null)
      setBills([])
      setBillsCount(0)
      setBreakdownBar([])
    } finally {
      setMainLoading(false)
    }
  }

  const onGroupBarChange = (g: FinancialBreakdownGroupBy) => {
    setGroupBar(g)
    if (appliedFrom && appliedTo) void loadBreakdownBar(appliedFrom, appliedTo, g)
  }

  const handleSort = (key: BillsSortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortDir('asc')
      return key
    })
    setPage(1)
  }

  const handleExportCsv = () => {
    if (!appliedFrom || !appliedTo || bills.length === 0) return
    const sorted = sortBillsRows(bills, sortKey, sortDir)
    exportBillsCsv(sorted, `financial-bills-${appliedFrom.slice(0, 10)}_${appliedTo.slice(0, 10)}.csv`)
  }

  return (
    <div className="space-y-6">
      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="text-base">{t('reports.tab.financial')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('reports.financial.subtitle')}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5 min-w-[200px]">
              <Label className="text-xs text-muted-foreground">{t('reports.from')}</Label>
              <Input type="datetime-local" value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} className="bg-background" />
            </div>
            <div className="space-y-1.5 min-w-[200px]">
              <Label className="text-xs text-muted-foreground">{t('reports.to')}</Label>
              <Input type="datetime-local" value={draftTo} onChange={(e) => setDraftTo(e.target.value)} className="bg-background" />
            </div>
            <div className="space-y-1.5 min-w-[160px]">
              <Label className="text-xs text-muted-foreground">{t('reports.financial.granularityLabel')}</Label>
              <AppSelect
                options={granularityOptions}
                value={draftGranularity}
                onChange={(v) => setDraftGranularity(v as FinancialGranularity)}
                className="bg-background"
              />
            </div>
            <Button type="button" className="h-10" onClick={() => void handleApply()} disabled={mainLoading}>
              {mainLoading ? t('reports.loading') : t('reports.financial.apply')}
            </Button>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      {!appliedFrom ? (
        <p className="text-sm text-muted-foreground">{t('reports.financial.hintApply')}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {summary ? (
              <>
                <KpiCard
                  title={t('reports.financial.kpi.revenue')}
                  valueDisplay={fmtMoney(summary.total_revenue)}
                  icon={DollarSign}
                />
                <KpiCard
                  title={t('reports.financial.kpi.energy')}
                  valueDisplay={fmtKwh(summary.total_energy)}
                  icon={Zap}
                />
                <KpiCard
                  title={t('reports.financial.kpi.sessions')}
                  valueDisplay={fmtInt(summary.total_sessions)}
                  icon={Activity}
                />
                <KpiCard
                  title={t('reports.financial.kpi.avgAmount')}
                  valueDisplay={fmtMoney(summary.avg_revenue_per_session)}
                  icon={CircleDollarSign}
                />
                <KpiCard
                  title={t('reports.financial.kpi.avgEnergy')}
                  valueDisplay={fmtKwh(summary.avg_energy_per_session)}
                  icon={BatteryCharging}
                />
                <KpiCard
                  title={t('reports.financial.kpi.discount')}
                  valueDisplay={fmtMoney(summary.total_discount)}
                  icon={Percent}
                />
              </>
            ) : mainLoading ? (
              <p className="text-sm text-muted-foreground col-span-full py-4">{t('reports.loading')}</p>
            ) : null}
          </div>

          <FinancialBreakdownBarChart
            title={t('reports.financial.revenueByBar')}
            data={breakdownBar}
            groupBy={groupBar}
            onGroupByChange={onGroupBarChange}
            loading={mainLoading || barLoading}
          />

          <BillsTable
            bills={bills}
            apiTotalCount={billsCount}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            page={page}
            perPage={BILLS_PER_PAGE}
            onPageChange={setPage}
            onExportCsv={handleExportCsv}
          />
        </>
      )}
    </div>
  )
}
