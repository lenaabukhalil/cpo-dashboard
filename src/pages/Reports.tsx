import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Download } from 'lucide-react'
import {
  downloadChargerComparisonPdf,
  downloadConnectorComparisonPdf,
  getChargerComparison,
  getConnectorComparison,
  getLocations,
  getChargers,
  getConnectors,
  type ChargerComparisonRow,
  type ConnectorComparisonRow,
  type Location,
  type Charger,
  type Connector,
} from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { AppSelect } from '../components/shared/AppSelect'
import { useTranslation } from '../context/LanguageContext'
import FinancialReport from './reports/FinancialReport'
import { formatDecimal, formatInteger } from '../lib/utils'

type TabId = 'chargers' | 'connectors' | 'financial'

function useReportsTabs(): { id: TabId; labelKey: string }[] {
  return [
    { id: 'financial', labelKey: 'reports.tab.financial' },
    { id: 'chargers', labelKey: 'reports.tab.chargers' },
    { id: 'connectors', labelKey: 'reports.tab.connectors' },
  ]
}

function daysBetween(start: string, end: string): number {
  const a = new Date(start).getTime()
  const b = new Date(end).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return 1
  return Math.max(1, Math.round((b - a) / (24 * 60 * 60 * 1000)) + 1)
}

function chargerScore(row: ChargerComparisonRow | null, days: number): number {
  if (!row || days <= 0) return 0
  const sessions = Number(row.sessionsCount) || 0
  const kwh = Number(row.totalKwh) || 0
  const amount = Number(row.totalAmount) || 0
  const sPerDay = sessions / days
  const kwhPerDay = kwh / days
  const amountPerDay = amount / days
  const kwhPerSession = sessions > 0 ? kwh / sessions : 0
  return (sPerDay + kwhPerDay + amountPerDay + kwhPerSession) / 4
}

function connectorScore(row: ConnectorComparisonRow | null, days: number): number {
  if (!row || days <= 0) return 0
  const sessions = Number(row.sessionsCount) || 0
  const kwh = Number(row.totalKwh) || 0
  const amount = Number(row.totalAmount) || 0
  const sPerDay = sessions / days
  const kwhPerDay = kwh / days
  const amountPerDay = amount / days
  const kwhPerSession = sessions > 0 ? kwh / sessions : 0
  return (sPerDay + kwhPerDay + amountPerDay + kwhPerSession) / 4
}

export default function Reports() {
  const { user } = useAuth()
  const { pushToast } = useToast()
  const { t } = useTranslation()
  const tabs = useReportsTabs()
  const [tab, setTab] = useState<TabId>('financial')
  const [locations, setLocations] = useState<Location[]>([])

  // Charger A vs B
  const [locationAId, setLocationAId] = useState('')
  const [chargerAId, setChargerAId] = useState('')
  const [startA, setStartA] = useState('')
  const [endA, setEndA] = useState('')
  const [locationBId, setLocationBId] = useState('')
  const [chargerBId, setChargerBId] = useState('')
  const [startB, setStartB] = useState('')
  const [endB, setEndB] = useState('')
  const [chargersForA, setChargersForA] = useState<Charger[]>([])
  const [chargersForB, setChargersForB] = useState<Charger[]>([])
  const [compareChargerA, setCompareChargerA] = useState<ChargerComparisonRow | null>(null)
  const [compareChargerB, setCompareChargerB] = useState<ChargerComparisonRow | null>(null)
  const [loadingCompareCharger, setLoadingCompareCharger] = useState(false)
  const [chargerPdfDownloading, setChargerPdfDownloading] = useState(false)

  // Connector A vs B
  const [connectorLocAId, setConnectorLocAId] = useState('')
  const [connectorChargerAId, setConnectorChargerAId] = useState('')
  const [connectorAId, setConnectorAId] = useState('')
  const [connectorStartA, setConnectorStartA] = useState('')
  const [connectorEndA, setConnectorEndA] = useState('')
  const [connectorLocBId, setConnectorLocBId] = useState('')
  const [connectorChargerBId, setConnectorChargerBId] = useState('')
  const [connectorBId, setConnectorBId] = useState('')
  const [connectorStartB, setConnectorStartB] = useState('')
  const [connectorEndB, setConnectorEndB] = useState('')
  const [connectorsForA, setConnectorsForA] = useState<Connector[]>([])
  const [connectorsForB, setConnectorsForB] = useState<Connector[]>([])
  const [chargersForConnectorA, setChargersForConnectorA] = useState<Charger[]>([])
  const [chargersForConnectorB, setChargersForConnectorB] = useState<Charger[]>([])
  const [compareConnectorA, setCompareConnectorA] = useState<ConnectorComparisonRow | null>(null)
  const [compareConnectorB, setCompareConnectorB] = useState<ConnectorComparisonRow | null>(null)
  const [loadingCompareConnector, setLoadingCompareConnector] = useState(false)
  const [connectorPdfDownloading, setConnectorPdfDownloading] = useState(false)

  useEffect(() => {
    if (!user?.organization_id) return
    getLocations(user.organization_id).then((r) => {
      const d = (r as { data?: Location[] }).data ?? (r as unknown as Location[])
      setLocations(Array.isArray(d) ? d : [])
    })
  }, [user?.organization_id])

  useEffect(() => {
    if (locationAId) {
      getChargers(Number(locationAId)).then((r) => {
        const d = (r as { data?: Charger[] }).data ?? (r as unknown as Charger[])
        setChargersForA(Array.isArray(d) ? d : [])
      })
      setChargerAId('')
    } else setChargersForA([])
  }, [locationAId])

  useEffect(() => {
    if (locationBId) {
      getChargers(Number(locationBId)).then((r) => {
        const d = (r as { data?: Charger[] }).data ?? (r as unknown as Charger[])
        setChargersForB(Array.isArray(d) ? d : [])
      })
      setChargerBId('')
    } else setChargersForB([])
  }, [locationBId])

  // Clear charger comparison results when user changes any filter (new comparison)
  useEffect(() => {
    setCompareChargerA(null)
    setCompareChargerB(null)
  }, [locationAId, chargerAId, startA, endA, locationBId, chargerBId, startB, endB])

  // Clear connector comparison results when user changes any filter (new comparison)
  useEffect(() => {
    setCompareConnectorA(null)
    setCompareConnectorB(null)
  }, [connectorLocAId, connectorChargerAId, connectorAId, connectorStartA, connectorEndA, connectorLocBId, connectorChargerBId, connectorBId, connectorStartB, connectorEndB])

  useEffect(() => {
    if (connectorChargerAId) {
      getConnectors(Number(connectorChargerAId)).then((r) => {
        const d = (r as { data?: Connector[] }).data ?? (r as unknown as Connector[])
        setConnectorsForA(Array.isArray(d) ? d : [])
      })
      setConnectorAId('')
    } else setConnectorsForA([])
  }, [connectorChargerAId])

  useEffect(() => {
    if (connectorChargerBId) {
      getConnectors(Number(connectorChargerBId)).then((r) => {
        const d = (r as { data?: Connector[] }).data ?? (r as unknown as Connector[])
        setConnectorsForB(Array.isArray(d) ? d : [])
      })
      setConnectorBId('')
    } else setConnectorsForB([])
  }, [connectorChargerBId])

  useEffect(() => {
    if (connectorLocAId) {
      getChargers(Number(connectorLocAId)).then((r) => {
        const d = (r as { data?: Charger[] }).data ?? (r as unknown as Charger[])
        setChargersForConnectorA(Array.isArray(d) ? d : [])
      })
      setConnectorChargerAId('')
    } else setChargersForConnectorA([])
  }, [connectorLocAId])

  useEffect(() => {
    if (connectorLocBId) {
      getChargers(Number(connectorLocBId)).then((r) => {
        const d = (r as { data?: Charger[] }).data ?? (r as unknown as Charger[])
        setChargersForConnectorB(Array.isArray(d) ? d : [])
      })
      setConnectorChargerBId('')
    } else setChargersForConnectorB([])
  }, [connectorLocBId])

  const runCompareChargerAB = () => {
    if (!chargerAId || !chargerBId) return
    const sA = startA || '2025-01-01'
    const eA = endA || '2026-12-31'
    const sB = startB || '2025-01-01'
    const eB = endB || '2026-12-31'
    setLoadingCompareCharger(true)
    setCompareChargerA(null)
    setCompareChargerB(null)
    Promise.all([
      getChargerComparison({ start: sA, end: eA, chargerIds: chargerAId }),
      getChargerComparison({ start: sB, end: eB, chargerIds: chargerBId }),
    ])
      .then(([resA, resB]) => {
        const dataA = (resA as { data?: ChargerComparisonRow[] }).data ?? (resA as unknown as { data?: ChargerComparisonRow[] }).data
        const dataB = (resB as { data?: ChargerComparisonRow[] }).data ?? (resB as unknown as { data?: ChargerComparisonRow[] }).data
        setCompareChargerA(Array.isArray(dataA) && dataA.length > 0 ? dataA[0] : null)
        setCompareChargerB(Array.isArray(dataB) && dataB.length > 0 ? dataB[0] : null)
      })
      .finally(() => setLoadingCompareCharger(false))
  }

  const runCompareConnectorAB = () => {
    if (!connectorAId || !connectorBId || !connectorChargerAId || !connectorChargerBId) return
    const sA = connectorStartA || '2025-01-01'
    const eA = connectorEndA || '2026-12-31'
    const sB = connectorStartB || '2025-01-01'
    const eB = connectorEndB || '2026-12-31'
    setLoadingCompareConnector(true)
    setCompareConnectorA(null)
    setCompareConnectorB(null)
    Promise.all([
      getConnectorComparison({ start: sA, end: eA, chargerId: connectorChargerAId, connectorIds: connectorAId }),
      getConnectorComparison({ start: sB, end: eB, chargerId: connectorChargerBId, connectorIds: connectorBId }),
    ])
      .then(([resA, resB]) => {
        const dataA = (resA as { data?: ConnectorComparisonRow[] }).data ?? (resA as unknown as { data?: ConnectorComparisonRow[] }).data
        const dataB = (resB as { data?: ConnectorComparisonRow[] }).data ?? (resB as unknown as { data?: ConnectorComparisonRow[] }).data
        setCompareConnectorA(Array.isArray(dataA) && dataA.length > 0 ? dataA[0] : null)
        setCompareConnectorB(Array.isArray(dataB) && dataB.length > 0 ? dataB[0] : null)
      })
      .finally(() => setLoadingCompareConnector(false))
  }

  const daysA = useMemo(() => (startA && endA ? daysBetween(startA, endA) : 1), [startA, endA])
  const daysB = useMemo(() => (startB && endB ? daysBetween(startB, endB) : 1), [startB, endB])
  const scoreChargerA = useMemo(() => chargerScore(compareChargerA, daysA), [compareChargerA, daysA])
  const scoreChargerB = useMemo(() => chargerScore(compareChargerB, daysB), [compareChargerB, daysB])
  const bestCharger = scoreChargerA >= scoreChargerB ? 'A' : 'B'

  const daysConnA = useMemo(() => (connectorStartA && connectorEndA ? daysBetween(connectorStartA, connectorEndA) : 1), [connectorStartA, connectorEndA])
  const daysConnB = useMemo(
    () => (connectorStartB && connectorEndB ? daysBetween(connectorStartB, connectorEndB) : 1),
    [connectorStartB, connectorEndB]
  )
  const scoreConnectorA = useMemo(() => connectorScore(compareConnectorA, daysConnA), [compareConnectorA, daysConnA])
  const scoreConnectorB = useMemo(() => connectorScore(compareConnectorB, daysConnB), [compareConnectorB, daysConnB])
  const bestConnector = scoreConnectorA >= scoreConnectorB ? 'A' : 'B'

  const handleDownloadChargerPdf = async () => {
    if (
      !chargerAId ||
      !chargerBId ||
      !startA.trim() ||
      !endA.trim() ||
      !startB.trim() ||
      !endB.trim()
    ) {
      pushToast(t('reports.comparison.selectBothSides'), '')
      return
    }
    setChargerPdfDownloading(true)
    try {
      await downloadChargerComparisonPdf({
        chargerA: chargerAId,
        chargerB: chargerBId,
        startA: startA.trim(),
        endA: endA.trim(),
        startB: startB.trim(),
        endB: endB.trim(),
      })
    } catch (e) {
      pushToast(t('common.error'), e instanceof Error ? e.message : 'Download failed')
    } finally {
      setChargerPdfDownloading(false)
    }
  }

  const handleDownloadConnectorPdf = async () => {
    if (
      !connectorAId ||
      !connectorBId ||
      !connectorStartA.trim() ||
      !connectorEndA.trim() ||
      !connectorStartB.trim() ||
      !connectorEndB.trim()
    ) {
      pushToast(t('reports.comparison.selectBothSides'), '')
      return
    }
    setConnectorPdfDownloading(true)
    try {
      await downloadConnectorComparisonPdf({
        connectorA: connectorAId,
        connectorB: connectorBId,
        startA: connectorStartA.trim(),
        endA: connectorEndA.trim(),
        startB: connectorStartB.trim(),
        endB: connectorEndB.trim(),
      })
    } catch (e) {
      pushToast(t('common.error'), e instanceof Error ? e.message : 'Download failed')
    } finally {
      setConnectorPdfDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-start">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('reports.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('reports.subtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {tabs.map(({ id, labelKey }) => (
          <Button key={id} type="button" variant={tab === id ? 'default' : 'ghost'} size="sm" onClick={() => setTab(id)}>
            {t(labelKey)}
          </Button>
        ))}
      </div>

      {tab === 'financial' && <FinancialReport />}

      {/* Charger comparison — one white block, all connected */}
      {tab === 'chargers' && (
        <Card className="border border-border bg-card rounded-xl shadow-sm overflow-hidden">
          <CardContent className="p-6 space-y-6">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">{t('reports.chargerComparison')}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t('reports.chargerComparisonDesc')}</p>
            </div>

            {/* Input cards: CHARGER A / CHARGER B — white, light border, connected */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border border-primary/30 bg-card rounded-xl shadow-none">
                <CardContent className="pt-5 pb-5 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t('reports.chargerA')}</p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{t('list.location')}</Label>
                    <AppSelect options={[{ value: '', label: t('reports.selectLocation') }, ...locations.map((l) => ({ value: String(l.location_id), label: l.name }))]} value={locationAId} onChange={setLocationAId} placeholder={t('reports.selectLocation')} className="w-full bg-background" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{t('list.charger')}</Label>
                    <AppSelect options={[{ value: '', label: t('reports.selectCharger') }, ...chargersForA.map((c) => ({ value: String(c.id), label: c.name }))]} value={chargerAId} onChange={setChargerAId} placeholder={t('reports.selectCharger')} className="w-full bg-background" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{t('reports.startDate')}</Label>
                      <Input type="date" value={startA} onChange={(e) => setStartA(e.target.value)} placeholder={t('common.datePlaceholder')} className="w-full bg-background" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{t('reports.endDate')}</Label>
                      <Input type="date" value={endA} onChange={(e) => setEndA(e.target.value)} placeholder={t('common.datePlaceholder')} className="w-full bg-background" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-primary/30 bg-card rounded-xl shadow-none">
              <CardContent className="pt-5 pb-5 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t('reports.chargerB')}</p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{t('list.location')}</Label>
                    <AppSelect options={[{ value: '', label: t('reports.selectLocation') }, ...locations.map((l) => ({ value: String(l.location_id), label: l.name }))]} value={locationBId} onChange={setLocationBId} placeholder={t('reports.selectLocation')} className="w-full bg-background" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{t('list.charger')}</Label>
                    <AppSelect options={[{ value: '', label: t('reports.selectCharger') }, ...chargersForB.map((c) => ({ value: String(c.id), label: c.name }))]} value={chargerBId} onChange={setChargerBId} placeholder={t('reports.selectCharger')} className="w-full bg-background" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{t('reports.startDate')}</Label>
                      <Input type="date" value={startB} onChange={(e) => setStartB(e.target.value)} placeholder={t('common.datePlaceholder')} className="w-full bg-background" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{t('reports.endDate')}</Label>
                      <Input type="date" value={endB} onChange={(e) => setEndB(e.target.value)} placeholder={t('common.datePlaceholder')} className="w-full bg-background" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-muted-foreground">{t('reports.differentOrgsHint')}</p>
            <Button type="button" onClick={runCompareChargerAB} disabled={!chargerAId || !chargerBId || loadingCompareCharger}>
              {loadingCompareCharger ? t('reports.loading') : t('reports.compareAB')}
            </Button>
          </div>

            {loadingCompareCharger && <p className="text-sm text-muted-foreground py-2">Loading comparison...</p>}

            {/* Result cards: Best performer above, then white cards — same block, light border */}
            {!loadingCompareCharger && (compareChargerA != null || compareChargerB != null) && (
              <div className="space-y-4">
                {compareChargerA != null && compareChargerB != null ? (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2 shrink-0"
                      disabled={chargerPdfDownloading}
                      onClick={() => void handleDownloadChargerPdf()}
                    >
                      <Download className="h-4 w-4" />
                      {chargerPdfDownloading ? t('reports.comparison.downloadingPdf') : t('reports.comparison.downloadPdf')}
                    </Button>
                  </div>
                ) : null}
                {compareChargerA?.type && compareChargerB?.type && compareChargerA.type !== compareChargerB.type && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">Different charger types (e.g. AC vs DC) — compare with care.</p>
                )}
                <p className="text-center text-sm font-semibold text-emerald-600">
                  {bestCharger === 'A' ? 'Charger A — Best performer' : 'Charger B — Best performer'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border border-primary/30 bg-card rounded-xl shadow-none overflow-hidden">
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div>
                        <p className="font-semibold text-foreground">Charger A</p>
                        <p className="text-sm text-muted-foreground mt-0.5">{compareChargerA?.name ?? '—'} — {compareChargerA?.type ?? '—'}</p>
                      </div>
                      <span className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium border-border ${String(compareChargerA?.status ?? '').toLowerCase() === 'online' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                        {compareChargerA?.status ?? '—'}
                      </span>
                    </div>
                    <div className="space-y-4 text-sm">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Utilization</p>
                        <div className="flex justify-between"><span>Total Sessions</span><span className="font-semibold tabular-nums">{formatInteger(compareChargerA?.sessionsCount)}</span></div>
                        <div className="flex justify-between mt-1"><span>Sessions/day</span><span className="font-semibold tabular-nums">{formatDecimal((Number(compareChargerA?.sessionsCount) || 0) / daysA)}</span></div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Revenue</p>
                        <div className="flex justify-between"><span>Total (JOD)</span><span className="font-semibold tabular-nums">{compareChargerA?.totalAmount != null ? formatDecimal(Number(compareChargerA.totalAmount)) : '—'}</span></div>
                        <div className="flex justify-between mt-1"><span>Per day</span><span className="font-semibold tabular-nums">{formatDecimal((Number(compareChargerA?.totalAmount) || 0) / daysA)}</span></div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Energy</p>
                        <div className="flex justify-between"><span>Total (kWh)</span><span className="font-semibold tabular-nums">{compareChargerA?.totalKwh != null ? formatDecimal(Number(compareChargerA.totalKwh)) : '—'}</span></div>
                        <div className="flex justify-between mt-1"><span>Per session (kWh)</span><span className="font-semibold tabular-nums">{daysA && (Number(compareChargerA?.sessionsCount) || 0) ? formatDecimal((Number(compareChargerA?.totalKwh) || 0) / (Number(compareChargerA?.sessionsCount) || 0)) : '—'}</span></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border border-primary/30 bg-card rounded-xl shadow-none overflow-hidden">
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div>
                        <p className="font-semibold text-foreground">Charger B</p>
                        <p className="text-sm text-muted-foreground mt-0.5">{compareChargerB?.name ?? '—'} — {compareChargerB?.type ?? '—'}</p>
                      </div>
                      <span className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium border-border ${String(compareChargerB?.status ?? '').toLowerCase() === 'online' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                        {compareChargerB?.status ?? '—'}
                      </span>
                    </div>
                    <div className="space-y-4 text-sm">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Utilization</p>
                        <div className="flex justify-between"><span>Total Sessions</span><span className="font-semibold tabular-nums">{formatInteger(compareChargerB?.sessionsCount)}</span></div>
                        <div className="flex justify-between mt-1"><span>Sessions/day</span><span className="font-semibold tabular-nums">{formatDecimal((Number(compareChargerB?.sessionsCount) || 0) / daysB)}</span></div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Revenue</p>
                        <div className="flex justify-between"><span>Total (JOD)</span><span className="font-semibold tabular-nums">{compareChargerB?.totalAmount != null ? formatDecimal(Number(compareChargerB.totalAmount)) : '—'}</span></div>
                        <div className="flex justify-between mt-1"><span>Per day</span><span className="font-semibold tabular-nums">{formatDecimal((Number(compareChargerB?.totalAmount) || 0) / daysB)}</span></div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Energy</p>
                        <div className="flex justify-between"><span>Total (kWh)</span><span className="font-semibold tabular-nums">{compareChargerB?.totalKwh != null ? formatDecimal(Number(compareChargerB.totalKwh)) : '—'}</span></div>
                        <div className="flex justify-between mt-1"><span>Per session (kWh)</span><span className="font-semibold tabular-nums">{daysB && (Number(compareChargerB?.sessionsCount) || 0) ? formatDecimal((Number(compareChargerB?.totalKwh) || 0) / (Number(compareChargerB?.sessionsCount) || 0)) : '—'}</span></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
          </CardContent>
        </Card>
      )}

      {/* Connector comparison — same design as Charger: one white block, A vs B only, no table */}
      {tab === 'connectors' && (
        <Card className="border border-border bg-card rounded-xl shadow-sm overflow-hidden">
          <CardContent className="p-6 space-y-6">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">{t('reports.connectorComparison')}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t('reports.connectorComparisonDesc')}</p>
            </div>

            {/* Input cards: CONNECTOR A / CONNECTOR B — white, light border, connected */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border border-primary/30 bg-card rounded-xl shadow-none">
                <CardContent className="pt-5 pb-5 space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t('reports.connectorA')}</p>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{t('list.location')}</Label>
                      <AppSelect options={[{ value: '', label: t('reports.selectLocation') }, ...locations.map((l) => ({ value: String(l.location_id), label: l.name }))]} value={connectorLocAId} onChange={setConnectorLocAId} placeholder={t('reports.selectLocation')} className="w-full bg-background" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{t('list.charger')}</Label>
                      <AppSelect options={[{ value: '', label: t('reports.selectCharger') }, ...chargersForConnectorA.map((c) => ({ value: String(c.id), label: c.name }))]} value={connectorChargerAId} onChange={setConnectorChargerAId} placeholder={t('reports.selectCharger')} className="w-full bg-background" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{t('details.connectorLabel')}</Label>
                      <AppSelect options={[{ value: '', label: t('reports.selectConnector') }, ...connectorsForA.map((c) => ({ value: String(c.id), label: `${c.type ?? c.connector_type ?? c.id}` }))]} value={connectorAId} onChange={setConnectorAId} placeholder={t('reports.selectConnector')} className="w-full bg-background" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{t('reports.startDate')}</Label>
                        <Input type="date" value={connectorStartA} onChange={(e) => setConnectorStartA(e.target.value)} placeholder={t('common.datePlaceholder')} className="w-full bg-background" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{t('reports.endDate')}</Label>
                        <Input type="date" value={connectorEndA} onChange={(e) => setConnectorEndA(e.target.value)} placeholder={t('common.datePlaceholder')} className="w-full bg-background" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-primary/30 bg-card rounded-xl shadow-none">
                <CardContent className="pt-5 pb-5 space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t('reports.connectorB')}</p>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{t('list.location')}</Label>
                      <AppSelect options={[{ value: '', label: t('reports.selectLocation') }, ...locations.map((l) => ({ value: String(l.location_id), label: l.name }))]} value={connectorLocBId} onChange={setConnectorLocBId} placeholder={t('reports.selectLocation')} className="w-full bg-background" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{t('list.charger')}</Label>
                      <AppSelect options={[{ value: '', label: t('reports.selectCharger') }, ...chargersForConnectorB.map((c) => ({ value: String(c.id), label: c.name }))]} value={connectorChargerBId} onChange={setConnectorChargerBId} placeholder={t('reports.selectCharger')} className="w-full bg-background" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{t('details.connectorLabel')}</Label>
                      <AppSelect options={[{ value: '', label: t('reports.selectConnector') }, ...connectorsForB.map((c) => ({ value: String(c.id), label: `${c.type ?? c.connector_type ?? c.id}` }))]} value={connectorBId} onChange={setConnectorBId} placeholder={t('reports.selectConnector')} className="w-full bg-background" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{t('reports.startDate')}</Label>
                        <Input type="date" value={connectorStartB} onChange={(e) => setConnectorStartB(e.target.value)} placeholder={t('common.datePlaceholder')} className="w-full bg-background" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{t('reports.endDate')}</Label>
                        <Input type="date" value={connectorEndB} onChange={(e) => setConnectorEndB(e.target.value)} placeholder={t('common.datePlaceholder')} className="w-full bg-background" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-muted-foreground">{t('reports.differentOrgsHint')}</p>
              <Button type="button" onClick={runCompareConnectorAB} disabled={!connectorAId || !connectorBId || loadingCompareConnector}>
                {loadingCompareConnector ? t('reports.loading') : t('reports.compareAB')}
              </Button>
            </div>

            {loadingCompareConnector && <p className="text-sm text-muted-foreground py-2">Loading comparison...</p>}

            {/* Result cards: Best performer above, then white cards — same block, light border, online green */}
            {!loadingCompareConnector && (compareConnectorA != null || compareConnectorB != null) && (
              <div className="space-y-4">
                {compareConnectorA != null && compareConnectorB != null ? (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2 shrink-0"
                      disabled={connectorPdfDownloading}
                      onClick={() => void handleDownloadConnectorPdf()}
                    >
                      <Download className="h-4 w-4" />
                      {connectorPdfDownloading ? t('reports.comparison.downloadingPdf') : t('reports.comparison.downloadPdf')}
                    </Button>
                  </div>
                ) : null}
                <p className="text-center text-sm font-semibold text-emerald-600">
                  {bestConnector === 'A' ? 'Connector A — Best performer' : 'Connector B — Best performer'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border border-primary/30 bg-card rounded-xl shadow-none overflow-hidden">
                    <CardContent className="pt-5 pb-5">
                      <div className="flex items-start justify-between gap-2 mb-4">
                        <div>
                          <p className="font-semibold text-foreground">Connector A</p>
                          <p className="text-sm text-muted-foreground mt-0.5">{compareConnectorA?.chargerName ?? '—'} — {compareConnectorA?.connectorType ?? '—'}</p>
                        </div>
                        <span className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium border-border ${String(compareConnectorA?.status ?? '').toLowerCase() === 'online' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                          {compareConnectorA?.status ?? '—'}
                        </span>
                      </div>
                      <div className="space-y-4 text-sm">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Utilization</p>
                          <div className="flex justify-between"><span>Total Sessions</span><span className="font-semibold tabular-nums">{formatInteger(compareConnectorA?.sessionsCount)}</span></div>
                          <div className="flex justify-between mt-1"><span>Sessions/day</span><span className="font-semibold tabular-nums">{formatDecimal((Number(compareConnectorA?.sessionsCount) || 0) / daysConnA)}</span></div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Revenue</p>
                          <div className="flex justify-between"><span>Total (JOD)</span><span className="font-semibold tabular-nums">{compareConnectorA?.totalAmount != null ? formatDecimal(Number(compareConnectorA.totalAmount)) : '—'}</span></div>
                          <div className="flex justify-between mt-1"><span>Per day</span><span className="font-semibold tabular-nums">{formatDecimal((Number(compareConnectorA?.totalAmount) || 0) / daysConnA)}</span></div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Energy</p>
                          <div className="flex justify-between"><span>Total (kWh)</span><span className="font-semibold tabular-nums">{compareConnectorA?.totalKwh != null ? formatDecimal(Number(compareConnectorA.totalKwh)) : '—'}</span></div>
                          <div className="flex justify-between mt-1"><span>Per session (kWh)</span><span className="font-semibold tabular-nums">{daysConnA && (Number(compareConnectorA?.sessionsCount) || 0) ? formatDecimal((Number(compareConnectorA?.totalKwh) || 0) / (Number(compareConnectorA?.sessionsCount) || 0)) : '—'}</span></div>
                        </div>
                        {(compareConnectorA?.avgSessionAmount != null || compareConnectorA?.avgSessionMinutes != null) && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Session</p>
                            <div className="flex justify-between"><span>Avg/session (JOD)</span><span className="font-semibold tabular-nums">{compareConnectorA?.avgSessionAmount != null ? formatDecimal(Number(compareConnectorA.avgSessionAmount)) : '—'}</span></div>
                            <div className="flex justify-between mt-1"><span>Avg duration (min)</span><span className="font-semibold tabular-nums">{compareConnectorA?.avgSessionMinutes != null ? formatDecimal(Number(compareConnectorA.avgSessionMinutes)) : '—'}</span></div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border border-primary/30 bg-card rounded-xl shadow-none overflow-hidden">
                    <CardContent className="pt-5 pb-5">
                      <div className="flex items-start justify-between gap-2 mb-4">
                        <div>
                          <p className="font-semibold text-foreground">Connector B</p>
                          <p className="text-sm text-muted-foreground mt-0.5">{compareConnectorB?.chargerName ?? '—'} — {compareConnectorB?.connectorType ?? '—'}</p>
                        </div>
                        <span className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium border-border ${String(compareConnectorB?.status ?? '').toLowerCase() === 'online' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                          {compareConnectorB?.status ?? '—'}
                        </span>
                      </div>
                      <div className="space-y-4 text-sm">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Utilization</p>
                          <div className="flex justify-between"><span>Total Sessions</span><span className="font-semibold tabular-nums">{formatInteger(compareConnectorB?.sessionsCount)}</span></div>
                          <div className="flex justify-between mt-1"><span>Sessions/day</span><span className="font-semibold tabular-nums">{formatDecimal((Number(compareConnectorB?.sessionsCount) || 0) / daysConnB)}</span></div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Revenue</p>
                          <div className="flex justify-between"><span>Total (JOD)</span><span className="font-semibold tabular-nums">{compareConnectorB?.totalAmount != null ? formatDecimal(Number(compareConnectorB.totalAmount)) : '—'}</span></div>
                          <div className="flex justify-between mt-1"><span>Per day</span><span className="font-semibold tabular-nums">{formatDecimal((Number(compareConnectorB?.totalAmount) || 0) / daysConnB)}</span></div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Energy</p>
                          <div className="flex justify-between"><span>Total (kWh)</span><span className="font-semibold tabular-nums">{compareConnectorB?.totalKwh != null ? formatDecimal(Number(compareConnectorB.totalKwh)) : '—'}</span></div>
                          <div className="flex justify-between mt-1"><span>Per session (kWh)</span><span className="font-semibold tabular-nums">{daysConnB && (Number(compareConnectorB?.sessionsCount) || 0) ? formatDecimal((Number(compareConnectorB?.totalKwh) || 0) / (Number(compareConnectorB?.sessionsCount) || 0)) : '—'}</span></div>
                        </div>
                        {(compareConnectorB?.avgSessionAmount != null || compareConnectorB?.avgSessionMinutes != null) && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Session</p>
                            <div className="flex justify-between"><span>Avg/session (JOD)</span><span className="font-semibold tabular-nums">{compareConnectorB?.avgSessionAmount != null ? formatDecimal(Number(compareConnectorB.avgSessionAmount)) : '—'}</span></div>
                            <div className="flex justify-between mt-1"><span>Avg duration (min)</span><span className="font-semibold tabular-nums">{compareConnectorB?.avgSessionMinutes != null ? formatDecimal(Number(compareConnectorB.avgSessionMinutes)) : '—'}</span></div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  )
}
