import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Download } from 'lucide-react'
import {
  exportSessionsReport,
  getSessionsReport,
  getChargerComparison,
  getConnectorComparison,
  getLocations,
  getChargers,
  getConnectors,
  type SessionsReportRow,
  type ChargerComparisonRow,
  type ConnectorComparisonRow,
  type Location,
  type Charger,
  type Connector,
} from '../services/api'
import { useAuth } from '../context/AuthContext'
import { AppSelect } from '../components/shared/AppSelect'
import { AppMultiSelect } from '../components/shared/AppMultiSelect'
import { TablePagination } from '../components/TablePagination'
import { SessionsReportDateTimeField } from '../components/SessionsReportDateTimeField'
import { useTranslation } from '../context/LanguageContext'
import { compareSessionsReportRowsByStartTime, formatMysqlWallClock24h } from '../lib/dateFormat'
import {
  getTodayMidnightDatetimeLocal,
  sanitizeFilenameDateRange,
  toDateOnlyForComparisonApi,
  validateSessionsDatetimeRange,
} from '../lib/sessionsReportRange'

type TabId = 'sessions' | 'chargers' | 'connectors'

function decodeHexToAsciiIfPrintable(hex: string): string | null {
  const s = hex.trim()
  if (!s || s.length % 2 !== 0) return null
  if (!/^[0-9a-fA-F]+$/.test(s)) return null
  // Avoid decoding short tokens that are unlikely to be a phone number.
  if (s.length < 10) return null
  try {
    const bytes: number[] = []
    for (let i = 0; i < s.length; i += 2) bytes.push(parseInt(s.slice(i, i + 2), 16))
    const out = String.fromCharCode(...bytes).replace(/\0/g, '').trim()
    const compact = out.replace(/\s+/g, '')
    if (/^\+?\d{8,18}$/.test(compact)) return out
    return null
  } catch {
    return null
  }
}

function formatMobileDisplay(value: unknown): string {
  const raw = value == null ? '' : String(value).trim()
  if (!raw) return '—'
  // If backend returns VARBINARY/BINARY as hex text, try to decode to readable phone.
  const decoded = decodeHexToAsciiIfPrintable(raw)
  if (decoded) return decoded
  return raw
}

function useReportsTabs(): { id: TabId; labelKey: string }[] {
  return [
    { id: 'sessions', labelKey: 'reports.tab.sessions' },
    { id: 'chargers', labelKey: 'reports.tab.chargers' },
    { id: 'connectors', labelKey: 'reports.tab.connectors' },
  ]
}

const PER_PAGE_DEFAULT = 10

/** Current local date and time as `YYYY-MM-DDTHH:mm` (sessions To field default when date is today). */
function getNowDatetimeLocal(): string {
  const n = new Date()
  const y = n.getFullYear()
  const mo = String(n.getMonth() + 1).padStart(2, '0')
  const d = String(n.getDate()).padStart(2, '0')
  const h = String(n.getHours()).padStart(2, '0')
  const mi = String(n.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${d}T${h}:${mi}`
}

function daysBetween(start: string, end: string): number {
  const a = new Date(start).getTime()
  const b = new Date(end).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return 1
  return Math.max(1, Math.round((b - a) / (24 * 60 * 60 * 1000)) + 1)
}

/** Format number to 7 decimal places for display */
function fmt7(n: number | undefined | null): string {
  if (n == null || typeof n !== 'number' || Number.isNaN(n)) return '—'
  return Number(n).toFixed(7)
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

function sessionsRangeValidationMessage(
  code: NonNullable<ReturnType<typeof validateSessionsDatetimeRange>>,
  t: (key: string) => string
): string {
  switch (code) {
    case 'required':
      return t('reports.validationDateRequired')
    case 'invalidFormat':
      return t('reports.validationInvalidDateTimeFormat')
    case 'fromAfterTo':
      return t('reports.validationFromBeforeTo')
    default:
      return t('reports.validationInvalidDate')
  }
}

export default function Reports() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const tabs = useReportsTabs()
  const [tab, setTab] = useState<TabId>('sessions')
  const [from, setFrom] = useState(() => getTodayMidnightDatetimeLocal())
  const [to, setTo] = useState(() => getNowDatetimeLocal())
  const [locations, setLocations] = useState<Location[]>([])
  // Sessions report: null = never loaded, [] = loaded empty, [...] = loaded with data
  const [sessionsData, setSessionsData] = useState<SessionsReportRow[] | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  // Sessions report filters (sent to backend) – multi-select as arrays
  const [locationIds, setLocationIds] = useState<string[]>([])
  const [chargerIds, setChargerIds] = useState<string[]>([])
  const [connectorIds, setConnectorIds] = useState<string[]>([])
  const [energyMin, setEnergyMin] = useState('')
  const [energyMax, setEnergyMax] = useState('')
  /** Chronological sort for the table: applied on the client (see sessionsList) so it matches issue_date even if API orders by session_id. */
  const [dateOrder, setDateOrder] = useState<'asc' | 'desc'>('desc')
  const [connectorsForSessionFilter, setConnectorsForSessionFilter] = useState<Connector[]>([])

  // Sessions paging
  const [pageSession, setPageSession] = useState(1)
  const [perPageSession, setPerPageSession] = useState(PER_PAGE_DEFAULT)

  // Sessions report: map charger id/chargerID (from report) -> display name (from org chargers)
  const [allOrgChargers, setAllOrgChargers] = useState<Charger[]>([])
  const chargerIdToName = useMemo(() => {
    const m = new Map<string, string>()
    allOrgChargers.forEach((c) => {
      const name = c.name ?? ''
      m.set(String(c.id), name)
      if (c.charger_id != null) m.set(String(c.charger_id), name)
      if (c.chargerID) m.set(String(c.chargerID).trim(), name)
    })
    return m
  }, [allOrgChargers])

  // Backend may ORDER BY session_id only; sort by Start Date/Time (issue_date) so "Date order" works
  const sessionsList = useMemo(() => {
    const list = sessionsData ?? []
    if (list.length < 2) return list
    const next = [...list]
    next.sort((a, b) => {
      const c = compareSessionsReportRowsByStartTime(a, b)
      return dateOrder === 'asc' ? c : -c
    })
    return next
  }, [sessionsData, dateOrder])
  const paginatedSessions = useMemo(
    () => sessionsList.slice((pageSession - 1) * perPageSession, pageSession * perPageSession),
    [sessionsList, pageSession, perPageSession]
  )

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

  useEffect(() => {
    if (!user?.organization_id) return
    getLocations(user.organization_id).then((r) => {
      const d = (r as { data?: Location[] }).data ?? (r as unknown as Location[])
      setLocations(Array.isArray(d) ? d : [])
    })
  }, [user?.organization_id])

  // Load all org chargers for Sessions report (id/chargerID -> name for display)
  useEffect(() => {
    if (!locations.length) {
      setAllOrgChargers([])
      return
    }
    Promise.all(locations.map((loc) => getChargers(loc.location_id)))
      .then((results) => {
        const lists = results.map((r) => {
          const d = (r as { data?: Charger[] }).data ?? (r as unknown as Charger[])
          return Array.isArray(d) ? d : []
        })
        setAllOrgChargers(lists.flat())
      })
      .catch(() => setAllOrgChargers([]))
  }, [locations])

  // Sessions report: chargers list – when locations selected, filter by them; else all org chargers
  const sessionChargerOptions = useMemo(() => {
    if (locationIds.length === 0) return allOrgChargers
    const set = new Set(locationIds.map((id) => Number(id)))
    return allOrgChargers.filter((c) => set.has(Number(c.locationId ?? c.id)))
  }, [allOrgChargers, locationIds])

  // Stable option arrays for multi-select (same references across renders so react-select can match selection)
  const locationOptions = useMemo(
    () => locations.map((l) => ({ value: String(l.location_id), label: l.name })),
    [locations]
  )
  const chargerFilterOptions = useMemo(
    () =>
      sessionChargerOptions.map((c) => ({
        value: String(c.charger_id ?? c.id),
        label: c.name ?? '',
      })),
    [sessionChargerOptions]
  )
  const connectorFilterOptions = useMemo(
    () =>
      connectorsForSessionFilter.map((co) => ({
        value: String(co.id),
        label: co.connector_type || co.type || String(co.id),
      })),
    [connectorsForSessionFilter]
  )

  // Sessions report: load connectors when charger filter changes (multi-charger: load all and merge)
  useEffect(() => {
    if (chargerIds.length === 0) {
      setConnectorsForSessionFilter([])
      setConnectorIds([])
      return
    }
    Promise.all(chargerIds.map((id) => getConnectors(Number(id))))
      .then((results) => {
        const lists = results.map((r) => {
          const d = (r as { data?: Connector[] }).data ?? (r as unknown as Connector[])
          return Array.isArray(d) ? d : []
        })
        const merged = lists.flat()
        const byId = new Map<number, Connector>()
        merged.forEach((co) => byId.set(co.id, co))
        setConnectorsForSessionFilter(Array.from(byId.values()))
      })
      .catch(() => setConnectorsForSessionFilter([]))
  }, [chargerIds])

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

  const buildSessionsReportParams = () => {
    const f = from.trim()
    const toVal = to.trim()
    const params: Parameters<typeof getSessionsReport>[0] = { from: f, to: toVal }
    if (locationIds.length > 0) params.locationIds = locationIds.join(',')
    if (chargerIds.length > 0) params.chargerIds = chargerIds.join(',')
    if (connectorIds.length > 0) params.connectorIds = connectorIds.join(',')
    if (energyMin.trim() !== '') params.energyMin = energyMin.trim()
    if (energyMax.trim() !== '') params.energyMax = energyMax.trim()
    if (dateOrder === 'asc') params.dateOrder = 'asc'
    return params
  }

  const loadSessions = () => {
    const f = from.trim()
    const toVal = to.trim()
    const rangeErr = validateSessionsDatetimeRange(f, toVal)
    if (rangeErr) {
      setSessionError(sessionsRangeValidationMessage(rangeErr, t))
      return
    }
    const minKwh = energyMin.trim() !== '' ? parseFloat(energyMin) : NaN
    const maxKwh = energyMax.trim() !== '' ? parseFloat(energyMax) : NaN
    if (!Number.isNaN(minKwh) && !Number.isNaN(maxKwh) && minKwh > maxKwh) {
      setSessionError(t('reports.validationEnergyRange') || 'Energy Min must be less than or equal to Energy Max')
      return
    }
    setSessionError(null)
    setLoading(true)
    setPageSession(1)
    getSessionsReport(buildSessionsReportParams())
      .then((r) => {
        if (!(r as { success?: boolean }).success && (r as { message?: string }).message) {
          setSessionError((r as { message: string }).message)
          setSessionsData([])
          return
        }
        const d = (r as { data?: SessionsReportRow[] }).data ?? (r as unknown as { data?: SessionsReportRow[] }).data
        setSessionsData(Array.isArray(d) ? d : [])
      })
      .catch((err) => {
        setSessionError(err?.message || (err?.payload?.message as string) || 'Failed to load sessions')
        setSessionsData([])
      })
      .finally(() => setLoading(false))
  }

  const runCompareChargerAB = () => {
    if (!chargerAId || !chargerBId) return
    const fromDay = from ? toDateOnlyForComparisonApi(from) : ''
    const toDay = to ? toDateOnlyForComparisonApi(to) : ''
    const sA = startA || fromDay || '2025-01-01'
    const eA = endA || toDay || '2026-12-31'
    const sB = startB || fromDay || '2025-01-01'
    const eB = endB || toDay || '2026-12-31'
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
    const fromDay = from ? toDateOnlyForComparisonApi(from) : ''
    const toDay = to ? toDateOnlyForComparisonApi(to) : ''
    const sA = connectorStartA || fromDay || '2025-01-01'
    const eA = connectorEndA || toDay || '2026-12-31'
    const sB = connectorStartB || fromDay || '2025-01-01'
    const eB = connectorEndB || toDay || '2026-12-31'
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

  const exportSessionsExcel = () => {
    const f = from.trim()
    const toVal = to.trim()
    const rangeErr = validateSessionsDatetimeRange(f, toVal)
    if (rangeErr) {
      setSessionError(sessionsRangeValidationMessage(rangeErr, t))
      return
    }
    setExportLoading(true)
    exportSessionsReport(buildSessionsReportParams())
      .then(({ blob, filename }) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename || `sessions-report-${sanitizeFilenameDateRange(f)}-${sanitizeFilenameDateRange(toVal)}.xlsx`
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch((err) => setSessionError(err?.message || 'Export failed'))
      .finally(() => setExportLoading(false))
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

  const clearSessionFilters = () => {
    setLocationIds([])
    setChargerIds([])
    setConnectorIds([])
    setEnergyMin('')
    setEnergyMax('')
    setPageSession(1)
    setSessionsData(null)
    setSessionError(null)
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

      {/* Sessions report */}
      {tab === 'sessions' && (
        <Card className="border border-border">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">{t('reports.tab.sessions')}</CardTitle>
            {(from.trim() && to.trim()) && (
              <Button type="button" variant="outline" size="sm" onClick={exportSessionsExcel} disabled={exportLoading} className="shrink-0 gap-2">
                <Download className="h-4 w-4" />
                {exportLoading ? t('reports.loading') : t('reports.exportCsv')}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {/* Filters: all sent to backend on Load sessions */}
            <div className="space-y-3 mb-2 pb-4 border-b border-border">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 shrink-0">
                  <SessionsReportDateTimeField
                    fieldLabel={t('reports.from')}
                    value={from}
                    onChange={setFrom}
                    emptyTimeDefault="00:00"
                  />
                </div>
                <div className="min-w-0 shrink-0">
                  <SessionsReportDateTimeField
                    fieldLabel={t('reports.to')}
                    value={to}
                    onChange={setTo}
                    emptyTimeDefault="23:59"
                  />
                </div>
                <div className="space-y-1.5 min-w-[180px]">
                  <Label className="text-xs text-muted-foreground">{t('list.location')}</Label>
                  <AppMultiSelect
                    options={locationOptions}
                    value={locationIds}
                    onChange={setLocationIds}
                    placeholder={t('reports.allLocations')}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-1.5 min-w-[180px]">
                  <Label className="text-xs text-muted-foreground">{t('list.charger')}</Label>
                  <AppMultiSelect
                    options={chargerFilterOptions}
                    value={chargerIds}
                    onChange={setChargerIds}
                    placeholder={t('reports.allChargers')}
                    className="bg-background"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5 min-w-[180px]">
                  <Label className="text-xs text-muted-foreground">{t('list.connectors')}</Label>
                  <AppMultiSelect
                    options={connectorFilterOptions}
                    value={connectorIds}
                    onChange={setConnectorIds}
                    placeholder={t('reports.allConnectors')}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Energy (KWH)</Label>
                  <div className="flex h-10 items-center gap-2">
                    <Input type="number" placeholder="Min" value={energyMin} onChange={(e) => setEnergyMin(e.target.value)} className="h-10 w-24 text-sm rounded-lg" min={0} step="any" />
                    <span className="text-muted-foreground">–</span>
                    <Input type="number" placeholder="Max" value={energyMax} onChange={(e) => setEnergyMax(e.target.value)} className="h-10 w-24 text-sm rounded-lg" min={0} step="any" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t('reports.dateSort')}</Label>
                  <div
                    className="flex h-10 items-center rounded-lg border border-border bg-muted/30 p-0.5 gap-0.5"
                    role="group"
                    aria-label={t('reports.dateSort')}
                  >
                    <Button
                      type="button"
                      variant={dateOrder === 'desc' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-9 shrink-0 px-3 text-xs sm:text-sm"
                      onClick={() => setDateOrder('desc')}
                    >
                      {t('reports.dateSortDesc')}
                    </Button>
                    <Button
                      type="button"
                      variant={dateOrder === 'asc' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-9 shrink-0 px-3 text-xs sm:text-sm"
                      onClick={() => setDateOrder('asc')}
                    >
                      {t('reports.dateSortAsc')}
                    </Button>
                  </div>
                </div>
                <Button type="button" className="h-10" onClick={loadSessions} disabled={loading}>
                  {loading ? t('reports.loading') : t('reports.loadSessions')}
                </Button>
                {(from.trim() || to.trim() || locationIds.length > 0 || chargerIds.length > 0 || connectorIds.length > 0 || energyMin.trim() || energyMax.trim()) && (
                  <Button type="button" variant="outline" className="h-10" onClick={clearSessionFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
            </div>

            {sessionError && <p className="text-sm text-destructive py-2">{sessionError}</p>}

            {loading && sessionsData === null ? (
              <p className="text-sm text-muted-foreground py-4">{t('reports.loading')}</p>
            ) : sessionsData === null ? (
              <p className="text-sm text-muted-foreground py-4">{t('reports.selectFiltersAndLoad')}</p>
            ) : sessionsList.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">{t('reports.noSessionsMatch')}</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-2">
                  Showing {sessionsList.length} session{sessionsList.length !== 1 ? 's' : ''}
                </p>
                <div className="overflow-x-auto table-wrap table-wrapper">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 font-semibold text-foreground">Start Date/Time</th>
                        <th className="text-left py-2 font-semibold text-foreground">Session ID</th>
                        <th className="text-left py-2 font-semibold text-foreground">Location</th>
                        <th className="text-left py-2 font-semibold text-foreground">Charger</th>
                        <th className="text-left py-2 font-semibold text-foreground">Connector</th>
                        <th className="text-right py-2 font-semibold text-foreground">Energy (KWH)</th>
                        <th className="text-right py-2 font-semibold text-foreground pr-6">Amount (JOD)</th>
                        <th className="text-left py-2 font-semibold text-foreground pl-4 min-w-[120px]">mobile</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedSessions.map((r, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-2">{formatMysqlWallClock24h(r['Start Date/Time'])}</td>
                          <td className="py-2">{String(r['Session ID'] ?? '—')}</td>
                          <td className="py-2">{String(r.Location ?? '—')}</td>
                          <td className="py-2">{chargerIdToName.get(String(r.Charger ?? '').trim()) ?? r.Charger ?? '—'}</td>
                          <td className="py-2">{String(r.Connector ?? '—')}</td>
                          <td className="py-2 text-right">{String(r['Energy (KWH)'] ?? '—')}</td>
                          <td className="py-2 text-right pr-6">{String(r['Amount (JOD)'] ?? '—')}</td>
                          <td className="py-2 pl-4 min-w-[120px]">{formatMobileDisplay(r.mobile)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  total={sessionsList.length}
                  page={pageSession}
                  perPage={perPageSession}
                  onPageChange={setPageSession}
                  onPerPageChange={(n) => {
                    setPerPageSession(n)
                    setPageSession(1)
                  }}
                />
              </>
            )}
          </CardContent>
        </Card>
      )}

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
                        <div className="flex justify-between"><span>Total Sessions</span><span className="font-semibold tabular-nums">{compareChargerA?.sessionsCount ?? '—'}</span></div>
                        <div className="flex justify-between mt-1"><span>Sessions/day</span><span className="font-semibold tabular-nums">{fmt7((Number(compareChargerA?.sessionsCount) || 0) / daysA)}</span></div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Revenue</p>
                        <div className="flex justify-between"><span>Total (JOD)</span><span className="font-semibold tabular-nums">{compareChargerA?.totalAmount != null ? fmt7(Number(compareChargerA.totalAmount)) : '—'}</span></div>
                        <div className="flex justify-between mt-1"><span>Per day</span><span className="font-semibold tabular-nums">{fmt7((Number(compareChargerA?.totalAmount) || 0) / daysA)}</span></div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Energy</p>
                        <div className="flex justify-between"><span>Total (kWh)</span><span className="font-semibold tabular-nums">{compareChargerA?.totalKwh != null ? fmt7(Number(compareChargerA.totalKwh)) : '—'}</span></div>
                        <div className="flex justify-between mt-1"><span>Per session (kWh)</span><span className="font-semibold tabular-nums">{daysA && (Number(compareChargerA?.sessionsCount) || 0) ? fmt7((Number(compareChargerA?.totalKwh) || 0) / (Number(compareChargerA?.sessionsCount) || 0)) : '—'}</span></div>
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
                        <div className="flex justify-between"><span>Total Sessions</span><span className="font-semibold tabular-nums">{compareChargerB?.sessionsCount ?? '—'}</span></div>
                        <div className="flex justify-between mt-1"><span>Sessions/day</span><span className="font-semibold tabular-nums">{fmt7((Number(compareChargerB?.sessionsCount) || 0) / daysB)}</span></div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Revenue</p>
                        <div className="flex justify-between"><span>Total (JOD)</span><span className="font-semibold tabular-nums">{compareChargerB?.totalAmount != null ? fmt7(Number(compareChargerB.totalAmount)) : '—'}</span></div>
                        <div className="flex justify-between mt-1"><span>Per day</span><span className="font-semibold tabular-nums">{fmt7((Number(compareChargerB?.totalAmount) || 0) / daysB)}</span></div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Energy</p>
                        <div className="flex justify-between"><span>Total (kWh)</span><span className="font-semibold tabular-nums">{compareChargerB?.totalKwh != null ? fmt7(Number(compareChargerB.totalKwh)) : '—'}</span></div>
                        <div className="flex justify-between mt-1"><span>Per session (kWh)</span><span className="font-semibold tabular-nums">{daysB && (Number(compareChargerB?.sessionsCount) || 0) ? fmt7((Number(compareChargerB?.totalKwh) || 0) / (Number(compareChargerB?.sessionsCount) || 0)) : '—'}</span></div>
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

            {/* Result cards: Best performer above, then white cards — same block, light border, fmt7, online green */}
            {!loadingCompareConnector && (compareConnectorA != null || compareConnectorB != null) && (
              <div className="space-y-4">
                {compareConnectorA?.connectorType && compareConnectorB?.connectorType && compareConnectorA.connectorType !== compareConnectorB.connectorType && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">Different connector types — compare with care.</p>
                )}
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
                          <div className="flex justify-between"><span>Total Sessions</span><span className="font-semibold tabular-nums">{compareConnectorA?.sessionsCount ?? '—'}</span></div>
                          <div className="flex justify-between mt-1"><span>Sessions/day</span><span className="font-semibold tabular-nums">{fmt7((Number(compareConnectorA?.sessionsCount) || 0) / daysConnA)}</span></div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Revenue</p>
                          <div className="flex justify-between"><span>Total (JOD)</span><span className="font-semibold tabular-nums">{compareConnectorA?.totalAmount != null ? fmt7(Number(compareConnectorA.totalAmount)) : '—'}</span></div>
                          <div className="flex justify-between mt-1"><span>Per day</span><span className="font-semibold tabular-nums">{fmt7((Number(compareConnectorA?.totalAmount) || 0) / daysConnA)}</span></div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Energy</p>
                          <div className="flex justify-between"><span>Total (kWh)</span><span className="font-semibold tabular-nums">{compareConnectorA?.totalKwh != null ? fmt7(Number(compareConnectorA.totalKwh)) : '—'}</span></div>
                          <div className="flex justify-between mt-1"><span>Per session (kWh)</span><span className="font-semibold tabular-nums">{daysConnA && (Number(compareConnectorA?.sessionsCount) || 0) ? fmt7((Number(compareConnectorA?.totalKwh) || 0) / (Number(compareConnectorA?.sessionsCount) || 0)) : '—'}</span></div>
                        </div>
                        {(compareConnectorA?.avgSessionAmount != null || compareConnectorA?.avgSessionMinutes != null) && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Session</p>
                            <div className="flex justify-between"><span>Avg/session (JOD)</span><span className="font-semibold tabular-nums">{compareConnectorA?.avgSessionAmount != null ? fmt7(Number(compareConnectorA.avgSessionAmount)) : '—'}</span></div>
                            <div className="flex justify-between mt-1"><span>Avg duration (min)</span><span className="font-semibold tabular-nums">{compareConnectorA?.avgSessionMinutes != null ? fmt7(Number(compareConnectorA.avgSessionMinutes)) : '—'}</span></div>
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
                          <div className="flex justify-between"><span>Total Sessions</span><span className="font-semibold tabular-nums">{compareConnectorB?.sessionsCount ?? '—'}</span></div>
                          <div className="flex justify-between mt-1"><span>Sessions/day</span><span className="font-semibold tabular-nums">{fmt7((Number(compareConnectorB?.sessionsCount) || 0) / daysConnB)}</span></div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Revenue</p>
                          <div className="flex justify-between"><span>Total (JOD)</span><span className="font-semibold tabular-nums">{compareConnectorB?.totalAmount != null ? fmt7(Number(compareConnectorB.totalAmount)) : '—'}</span></div>
                          <div className="flex justify-between mt-1"><span>Per day</span><span className="font-semibold tabular-nums">{fmt7((Number(compareConnectorB?.totalAmount) || 0) / daysConnB)}</span></div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Energy</p>
                          <div className="flex justify-between"><span>Total (kWh)</span><span className="font-semibold tabular-nums">{compareConnectorB?.totalKwh != null ? fmt7(Number(compareConnectorB.totalKwh)) : '—'}</span></div>
                          <div className="flex justify-between mt-1"><span>Per session (kWh)</span><span className="font-semibold tabular-nums">{daysConnB && (Number(compareConnectorB?.sessionsCount) || 0) ? fmt7((Number(compareConnectorB?.totalKwh) || 0) / (Number(compareConnectorB?.sessionsCount) || 0)) : '—'}</span></div>
                        </div>
                        {(compareConnectorB?.avgSessionAmount != null || compareConnectorB?.avgSessionMinutes != null) && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Session</p>
                            <div className="flex justify-between"><span>Avg/session (JOD)</span><span className="font-semibold tabular-nums">{compareConnectorB?.avgSessionAmount != null ? fmt7(Number(compareConnectorB.avgSessionAmount)) : '—'}</span></div>
                            <div className="flex justify-between mt-1"><span>Avg duration (min)</span><span className="font-semibold tabular-nums">{compareConnectorB?.avgSessionMinutes != null ? fmt7(Number(compareConnectorB.avgSessionMinutes)) : '—'}</span></div>
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
