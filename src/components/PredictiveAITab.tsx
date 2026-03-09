import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { Input } from './ui/input'
import { useTranslation } from '../context/LanguageContext'
import { getSessionsReport, type SessionsReportRow } from '../services/api'
import {
  computeForecast,
  buildInsights,
  formatValue,
  type PredictionType,
  type ForecastStats,
} from '../utils/predictiveAi'
import { ForecastSummaryCard } from './predictive/ForecastSummaryCard'
import { InsightCard } from './predictive/InsightCard'
import { Next4WeeksCard } from './predictive/Next4WeeksCard'

export type PredictiveMetric = PredictionType

const N_MIN = 1
const N_MAX = 52

/** Get Monday 00:00 of the week containing the given date (ISO week) */
function getWeekStart(d: Date): string {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d)
  monday.setDate(diff)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().slice(0, 10)
}

function parseStartDate(row: SessionsReportRow): Date | null {
  const raw = (row as Record<string, unknown>)['Start Date/Time']
  if (raw == null) return null
  const d = new Date(String(raw))
  return Number.isNaN(d.getTime()) ? null : d
}

export interface WeeklyPoint {
  weekStart: string
  sessions: number
  revenue: number
  kwh: number
}

function aggregateByWeek(rows: SessionsReportRow[]): WeeklyPoint[] {
  const map = new Map<string, { sessions: number; revenue: number; kwh: number }>()
  for (const row of rows) {
    const d = parseStartDate(row)
    if (!d) continue
    const key = getWeekStart(d)
    const cur = map.get(key) ?? { sessions: 0, revenue: 0, kwh: 0 }
    cur.sessions += 1
    cur.revenue += Number((row as Record<string, unknown>)['Amount (JOD)']) || 0
    cur.kwh += Number((row as Record<string, unknown>)['Energy (KWH)']) || 0
    map.set(key, cur)
  }
  return Array.from(map.entries())
    .map(([weekStart, v]) => ({ weekStart, ...v }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
}

function getValue(w: WeeklyPoint, type: PredictionType): number {
  return type === 'revenue' ? w.revenue : type === 'sessions' ? w.sessions : w.kwh
}

/** Short label per week: "2 Dec", "9 Jan" so no repeated month-only labels */
function weekLabel(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d} ${months[(m ?? 1) - 1]}`
}

const CHART_HEIGHT = 160
const PADDING = { top: 12, right: 12, bottom: 36, left: 40 }

type RangeMode = 'weeks' | 'dates'

function defaultDateRange(weeks: number): { from: string; to: string } {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - Math.max(N_MIN, Math.min(N_MAX, weeks)) * 7)
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }
}

export default function PredictiveAITab() {
  const { t } = useTranslation()
  const [metric, setMetric] = useState<PredictionType>('revenue')
  const [rangeMode, setRangeMode] = useState<RangeMode>('weeks')
  const [weeksBack, setWeeksBack] = useState(12)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [weeksToPredict, setWeeksToPredict] = useState<1 | 2 | 3 | 4>(4)
  const [loading, setLoading] = useState(false)
  const [weeklyData, setWeeklyData] = useState<WeeklyPoint[]>([])
  const [error, setError] = useState('')
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null)

  const fromTo = useMemo(() => {
    if (rangeMode === 'dates' && dateFrom && dateTo) return { from: dateFrom, to: dateTo }
    return defaultDateRange(weeksBack)
  }, [rangeMode, dateFrom, dateTo, weeksBack])

  const series = useMemo(() => {
    return weeklyData.map((w) => ({
      weekLabel: weekLabel(w.weekStart),
      value: getValue(w, metric),
    }))
  }, [weeklyData, metric])

  const seriesForForecast = useMemo(() => {
    if (rangeMode === 'dates') return series.slice(-N_MAX)
    return series.slice(-weeksBack)
  }, [series, weeksBack, rangeMode])
  const canPredict = seriesForForecast.length >= 1

  const stats = useMemo((): ForecastStats | null => {
    if (!canPredict || seriesForForecast.length < 1) return null
    const n = rangeMode === 'dates' ? seriesForForecast.length : Math.min(weeksBack, seriesForForecast.length)
    return computeForecast(seriesForForecast, n, weeksToPredict)
  }, [canPredict, seriesForForecast, weeksBack, rangeMode, weeksToPredict])

  const chartPoints = useMemo(() => {
    const values = seriesForForecast.map((p) => p.value)
    if (stats) {
      values.push(stats.predictedNextWeek, ...stats.predictedNext4Weeks.slice(0, weeksToPredict - 1))
    }
    return values
  }, [seriesForForecast, stats, weeksToPredict])

  const chartLabels = useMemo(() => {
    const labels = seriesForForecast.map((p) => p.weekLabel)
    if (stats) {
      const predLabels = weeksToPredict === 1 ? ['Next'] : ['Next', ...Array.from({ length: weeksToPredict - 1 }, (_, i) => `+${i + 2}`)]
      labels.push(...predLabels)
    }
    return labels
  }, [seriesForForecast, stats, weeksToPredict])

  const maxVal = Math.max(...chartPoints, 1)
  const numHistorical = seriesForForecast.length

  const insights = useMemo(() => (stats ? buildInsights(metric, stats, weeksToPredict) : []), [stats, metric, weeksToPredict])

  const loadAndPredict = () => {
    setLoading(true)
    setError('')
    getSessionsReport({ from: fromTo.from, to: fromTo.to })
      .then((r) => {
        const data = (r as { data?: SessionsReportRow[] }).data ?? (r as unknown as { data?: SessionsReportRow[] }).data
        const rows = Array.isArray(data) ? data : []
        const weekly = aggregateByWeek(rows)
        setWeeklyData(weekly)
      })
      .catch(() => {
        setError(t('predictive.loadError'))
        setWeeklyData([])
      })
      .finally(() => setLoading(false))
  }

  const metricLabel =
    metric === 'revenue' ? t('predictive.revenueJOD') : metric === 'sessions' ? t('predictive.sessions') : t('predictive.energyKwh')

  return (
    <section className="space-y-6 text-start max-w-4xl">
      {/* Simple controls: type + past weeks + load */}
      <Card>
        <CardHeader className="pb-2 px-6 pt-6">
          <CardTitle className="text-base">{t('predictive.title')}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {t('predictive.subtitle')}
          </p>
        </CardHeader>
        <CardContent className="space-y-5 px-6 pb-6 pt-2">
          <div className="flex flex-wrap items-end gap-4 md:gap-6">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('predictive.whatToPredict')}</Label>
              <select
                className="flex h-9 w-[200px] rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={metric}
                onChange={(e) => setMetric(e.target.value as PredictionType)}
              >
                <option value="revenue">{t('predictive.revenueJOD')}</option>
                <option value="sessions">{t('predictive.sessions')}</option>
                <option value="kwh">{t('predictive.energyKwh')}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('predictive.weeksToPredict')}</Label>
              <select
                className="flex h-9 w-[72px] rounded-md border border-input bg-background px-2 py-1 text-sm"
                value={weeksToPredict}
                onChange={(e) => setWeeksToPredict(Number(e.target.value) as 1 | 2 | 3 | 4)}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-4 rtl:gap-4">
              <span className="text-xs text-muted-foreground">{t('predictive.period')}</span>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="rangeMode"
                  checked={rangeMode === 'weeks'}
                  onChange={() => setRangeMode('weeks')}
                  className="border-input"
                />
                {t('predictive.pastWeeks')}
              </label>
              {rangeMode === 'weeks' && (
                <input
                  type="number"
                  min={N_MIN}
                  max={N_MAX}
                  value={weeksBack}
                  onChange={(e) =>
                    setWeeksBack(Math.max(N_MIN, Math.min(N_MAX, parseInt(e.target.value, 10) || N_MIN)))
                  }
                  className="flex h-9 w-16 rounded-md border border-input bg-background px-2 py-1 text-sm"
                />
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="rangeMode"
                  checked={rangeMode === 'dates'}
                  onChange={() => setRangeMode('dates')}
                  className="border-input"
                />
                {t('predictive.dateRange')}
              </label>
              {rangeMode === 'dates' && (
                <>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-36" />
                  <span className="text-muted-foreground">–</span>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-36" />
                </>
              )}
            </div>
            <Button
              onClick={loadAndPredict}
              disabled={loading || (weeklyData.length > 0 && !canPredict) || (rangeMode === 'dates' && (!dateFrom || !dateTo))}
            >
              {loading ? t('common.loading') : t('predictive.loadPredict')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {loading && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">{t('predictive.loadingReport')}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && weeklyData.length === 0 && !error && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t('predictive.noData')}
          </CardContent>
        </Card>
      )}

      {!loading && weeklyData.length > 0 && stats && (
        <>
          {/* Forecast Summary + Next 4 Weeks */}
          <div className="grid gap-4 md:grid-cols-2">
            <ForecastSummaryCard type={metric} stats={stats} />
            <Next4WeeksCard
              type={metric}
              weeksCount={weeksToPredict}
              values={[stats.predictedNextWeek, ...stats.predictedNext4Weeks.slice(0, weeksToPredict - 1)]}
            />
          </div>

          {/* Compact chart: unique labels (day + month), smaller size */}
          <Card>
            <CardHeader className="pb-1 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm">{metricLabel} — {t('predictive.actualVsPredicted')}</CardTitle>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded bg-muted-foreground/50" /> {t('predictive.actual')}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded bg-primary" /> {t('predictive.predicted')}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="overflow-x-auto">
                <svg
                  viewBox={`0 0 ${Math.max(400, chartPoints.length * 24)} ${CHART_HEIGHT}`}
                  className="w-full min-h-[140px] max-h-[180px]"
                  preserveAspectRatio="xMidYMid meet"
                  onMouseLeave={() => setHoveredBarIndex(null)}
                >
                  {chartPoints.map((val, i) => {
                    const barW = 18
                    const gap = 4
                    const x = PADDING.left + i * (barW + gap)
                    const innerH = CHART_HEIGHT - PADDING.top - PADDING.bottom
                    const h = (val / maxVal) * innerH
                    const y = PADDING.top + innerH - h
                    const isPred = i >= numHistorical
                    const hover = hoveredBarIndex === i
                    return (
                      <g key={i} onMouseEnter={() => setHoveredBarIndex(i)}>
                        <rect
                          x={x}
                          y={y}
                          width={barW}
                          height={Math.max(2, h)}
                          fill={isPred ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.5)'}
                          rx={3}
                          opacity={hover ? 0.9 : 1}
                        />
                        <text
                          x={x + barW / 2}
                          y={CHART_HEIGHT - 10}
                          textAnchor="middle"
                          className="fill-muted-foreground text-[8px]"
                          transform={`rotate(-45 ${x + barW / 2} ${CHART_HEIGHT - 10})`}
                        >
                          {chartLabels[i] ?? ''}
                        </text>
                      </g>
                    )
                  })}
                </svg>
                {hoveredBarIndex != null && chartPoints[hoveredBarIndex] != null && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    <span className="font-medium">{chartLabels[hoveredBarIndex]}</span>: {formatValue(metric, chartPoints[hoveredBarIndex])}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Insights */}
          {insights.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium">{t('predictive.insights')}</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {insights.map((insight, i) => (
                  <InsightCard key={i} insight={insight} />
                ))}
              </div>
            </div>
          )}

        </>
      )}
    </section>
  )
}
