import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Activity, CheckCircle, AlertCircle, Search, MapPin, Zap, Plug } from 'lucide-react'
import {
  getDashboardStats,
  getConnectorsStatus,
  getLocations,
  getChargers,
  getConnectors,
  type Location as LocationType,
  type Charger,
  type Connector,
  type ConnectorStatusRow,
  type ConnectorsStatusSummary,
} from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { cn } from '../lib/utils'

interface ChargerWithConns extends Charger {
  connectors: Connector[]
}
interface LocationWithChargers extends LocationType {
  chargers: ChargerWithConns[]
}

function connectorTypeLogo(connectorType?: string | null): { src: string; alt: string } | null {
  const raw = (connectorType ?? '').trim()
  if (!raw) return null
  const norm = raw.toLowerCase().replace(/[\s_\-]/g, '')
  const asset = (fileName: string) => `/${encodeURI(fileName)}`

  // Map to exact filenames in /public (including spaces).
  const map: Record<string, { src: string; alt: string }> = {
    type1: { src: asset('type01.png'), alt: 'Type 1' },
    type2: { src: asset('TYP22.png'), alt: 'Type 2' },
    gbtac: { src: asset('GBTAC.png'), alt: 'GBT AC' },
    gbtdc: { src: asset('GBTDC01.png'), alt: 'GBT DC' },
    chademo: { src: asset('CHAdeMO.png'), alt: 'CHAdeMO' },
    ccs: { src: asset('ccs1.png'), alt: 'CCS' },
    ccs1: { src: asset('ccs1.png'), alt: 'CCS1' },
    ccs2: { src: asset('CCS02.png'), alt: 'CCS2' },
  }

  // Direct match (normalized)
  if (map[norm]) return map[norm]

  // Variant matching as requested
  if (norm.includes('type1')) return map.type1
  if (norm.includes('type2')) return map.type2
  if (norm.includes('gbtac')) return map.gbtac
  if (norm.includes('gbtdc')) return map.gbtdc
  if (norm.includes('chademo')) return map.chademo
  if (norm === 'ccs' || norm.includes('ccs1')) return map.ccs1
  if (norm.includes('ccs2')) return map.ccs2
  if (norm.includes('ccs')) return map.ccs
  return null
}

function StatusBadge({ status }: { status: string }) {
  const v = (status ?? '').toLowerCase()
  const isAvailable = ['online', 'available', 'free'].includes(v)
  const isUnavailable = ['offline', 'unavailable', 'faulted'].includes(v)
  const isBusyOrPreparing = ['busy', 'preparing', 'charging', 'suspended', 'reserved', 'finishing'].includes(v)
  const style = isAvailable
    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
    : isUnavailable
      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
      : isBusyOrPreparing
        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-400/50'
        : 'bg-muted text-muted-foreground'
  return <Badge variant="outline" className={cn('text-xs font-medium', style)}>{status || '—'}</Badge>
}

export default function Sessions() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [statusStats, setStatusStats] = useState<{
    totalChargers: number
    totalConnectors: number
    onlineChargers: number
    availableConnector: number
    busyPreparingConnector: number
    offlineChargers: number
    unavailableConnector: number
  } | null>(null)
  const [connectorStatusList, setConnectorStatusList] = useState<ConnectorStatusRow[]>([])
  const [searchChargerQuery, setSearchChargerQuery] = useState('')
  const [detailsTree, setDetailsTree] = useState<LocationWithChargers[]>([])
  const [detailsLoading, setDetailsLoading] = useState(false)

  const getConnectorStatusFromList = (chargerId: number, connectorId: number): string | undefined => {
    const row = connectorStatusList.find((r) => {
      const rCh = r.chargerId ?? (r as Record<string, unknown>).charger_id
      const rConn = r.connectorId ?? (r as Record<string, unknown>).connector_id
      return Number(rCh) === Number(chargerId) && Number(rConn) === Number(connectorId)
    })
    return row?.status
  }

  const loadDetailsTree = (orgId: number) => {
    setDetailsLoading(true)
    getLocations(orgId)
      .then((locRes) => {
        if (!locRes.success || !locRes.data) return []
        const locList = Array.isArray(locRes.data) ? locRes.data : []
        return Promise.all(
          locList.map((loc: LocationType) =>
            getChargers(loc.location_id).then((chRes) => {
              const chList = (chRes as { data?: Charger[] }).data ?? []
              const chargers = Array.isArray(chList) ? chList : []
              return Promise.all(
                chargers.map((ch: Charger) =>
                  getConnectors(ch.id).then((connRes) => {
                    const connList = (connRes as { data?: Connector[] }).data ?? []
                    return { ...ch, connectors: Array.isArray(connList) ? connList : [] }
                  })
                )
              ).then((chargersWithConns) => ({ ...loc, chargers: chargersWithConns as ChargerWithConns[] }))
            })
          )
        ) as Promise<LocationWithChargers[]>
      })
      .then((tree) => setDetailsTree(tree ?? []))
      .catch(() => setDetailsTree([]))
      .finally(() => setDetailsLoading(false))
  }

  const [statusError, setStatusError] = useState<string | null>(null)

  const loadStatus = () => {
    setLoading(true)
    setStatusError(null)
    Promise.all([getDashboardStats(), getConnectorsStatus()])
      .then(([statsRes, connectorsRes]) => {
        const statsOk = (statsRes as { success?: boolean }).success !== false
        const connectorsOk = (connectorsRes as { success?: boolean }).success !== false
        if (!statsOk || !connectorsOk) {
          const msg = (statsRes as { message?: string }).message || (connectorsRes as { message?: string }).message || 'API returned an error. Check that you are logged in and your organization has access.'
          setStatusError(msg)
          setStatusStats(null)
          return
        }
        const stats = (statsRes as { data?: { chargersOnline?: number } }).data
        const connectors = (connectorsRes as { data?: { chargerId?: number; status?: string }[] }).data ?? []
        const summary = (connectorsRes as { summary?: ConnectorsStatusSummary }).summary
        const chargersOnline = stats?.chargersOnline ?? 0
        const list = Array.isArray(connectors) ? connectors : []
        setConnectorStatusList(list)
        const uniqueChargers = new Set(list.map((c: { chargerId?: number }) => c.chargerId).filter(Boolean)).size
        const totalChargers = uniqueChargers > 0 ? uniqueChargers : chargersOnline
        const totalConnectors =
          summary != null && Number.isFinite(summary.totalConnectors) ? summary.totalConnectors : list.length
        const availableConnector =
          summary != null && Number.isFinite(summary.availableCount)
            ? summary.availableCount
            : list.filter((c: { status?: string }) => (c.status || '').toLowerCase() === 'available').length
        // Busy/preparing: not counted as available or as online; separate card and distinct badge style
        const busyPreparingStatuses = ['busy', 'preparing', 'charging', 'suspended', 'reserved', 'finishing']
        const busyPreparingConnector = list.filter((c: { status?: string }) =>
          busyPreparingStatuses.includes((c.status || '').toLowerCase())
        ).length
        // Unavailable Connector: only status === 'error' (per requirement)
        const unavailableConnector = list.filter((c: { status?: string }) =>
          (c.status || '').toLowerCase() === 'error'
        ).length
        setStatusStats({
          totalChargers: totalChargers,
          totalConnectors,
          onlineChargers: chargersOnline,
          availableConnector,
          busyPreparingConnector,
          offlineChargers: Math.max(0, totalChargers - chargersOnline),
          unavailableConnector,
        })
      })
      .catch(() => {
        setStatusStats(null)
        setStatusError('Failed to load status. Check that the CPO API is reachable and your token is valid.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadStatus()
    if (user?.organization_id) loadDetailsTree(user.organization_id)
  }, [user?.organization_id])

  if (!user) {
    return null
  }

  return (
    <div className="space-y-6 text-start">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('monitor.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('monitor.subtitle')}</p>
      </div>

      <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground shrink-0" />
            <Input
              type="search"
              placeholder={t('monitor.searchPlaceholder')}
              value={searchChargerQuery}
              onChange={(e) => setSearchChargerQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="text-base">{t('monitor.chargersConnectorsStatus')}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{t('monitor.statusSummary')}</p>
            </CardHeader>
            <CardContent>
            {loading && !statusStats ? (
              <p className="text-sm text-muted-foreground py-8">{t('common.loading')}</p>
            ) : statusStats ? (
              <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <div className="rounded-lg border border-border bg-card p-4 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('monitor.totalChargers')}</p>
                    <p className="text-2xl font-bold mt-1 text-foreground">{statusStats.totalChargers}</p>
                  </div>
                  <Activity className="h-8 w-8 shrink-0 text-muted-foreground" />
                </div>
                <div className="rounded-lg border border-border bg-card p-4 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('monitor.onlineChargers')}</p>
                    <p className="text-2xl font-bold mt-1 text-green-600">
                      {statusStats.onlineChargers} <span className="text-sm font-normal text-muted-foreground">/ {statusStats.totalChargers}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">Online / Total</p>
                  </div>
                  <CheckCircle className="h-8 w-8 shrink-0 text-green-600" />
                </div>
                <div className="rounded-lg border border-border bg-card p-4 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Available Connector</p>
                    <p className="text-2xl font-bold mt-1 text-green-600">
                      {statusStats.availableConnector} <span className="text-sm font-normal text-muted-foreground">/ {statusStats.totalConnectors}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">Available / Total</p>
                  </div>
                  <CheckCircle className="h-8 w-8 shrink-0 text-green-600" />
                </div>
                <div className="rounded-lg border border-border bg-card p-4 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('monitor.offlineChargers')}</p>
                    <p className="text-2xl font-bold mt-1 text-foreground">
                      {statusStats.offlineChargers} <span className="text-sm font-normal text-muted-foreground">/ {statusStats.totalChargers}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">Offline / Total</p>
                  </div>
                  <Activity className="h-8 w-8 shrink-0 text-muted-foreground" />
                </div>
                <div className="rounded-lg border border-border bg-card p-4 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('monitor.unavailableConnector')}</p>
                    <p className="text-2xl font-bold mt-1 text-red-600">
                      {statusStats.unavailableConnector} <span className="text-sm font-normal text-muted-foreground">/ {statusStats.totalConnectors}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">Unavailable / Total</p>
                  </div>
                  <AlertCircle className="h-8 w-8 shrink-0 text-red-600" />
                </div>
              </div>
              {statusStats.totalChargers === 0 && statusStats.onlineChargers === 0 && statusStats.availableConnector === 0 ? (
                <p className="text-sm text-muted-foreground mt-4">No chargers or connectors for your organization. The CPO API returned empty data - check that chargers are registered for your organization.</p>
              ) : null}

              {/* Details: Location → Charger → Connector cards */}
              <div className="mt-8 space-y-6">
                <h3 className="text-sm font-semibold text-foreground">{t('monitor.chargerConnectorDetails')}</h3>
                {detailsLoading ? (
                  <p className="text-sm text-muted-foreground py-4">{t('common.loading')}</p>
                ) : (
                  <div className="space-y-4">
                  {detailsTree
                    .map((loc, index) => {
                      const q = searchChargerQuery.trim().toLowerCase()
                      const chargers = q
                        ? loc.chargers.filter(
                            (ch) =>
                              (ch.name ?? '').toLowerCase().includes(q) ||
                              (ch.chargerID ?? String(ch.id ?? '')).toLowerCase().includes(q)
                          )
                        : loc.chargers
                      if (chargers.length === 0) return null
                      return (
                        <Card key={`${index}-${loc.location_id}`} className="border border-border overflow-hidden">
                          <CardHeader className="py-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-primary" />
                              {loc.name}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0 space-y-4">
                            {chargers.map((ch, chIdx) => (
                              <div key={`${chIdx}-${ch.id}`} className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Zap className="h-4 w-4 text-amber-500" />
                                  <span className="font-semibold text-foreground">{ch.name ?? '—'}</span>
                                  <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">{ch.chargerID ?? ch.id}</span>
                                  <StatusBadge status={ch.status} />
                                  <span className="text-xs text-muted-foreground">{ch.type ?? '—'}</span>
                                </div>
                                <div className="pl-6 space-y-2">
                                  {ch.connectors.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">No connectors</p>
                                  ) : (
                                    ch.connectors.map((conn, connIdx) => {
                                      const liveStatus = getConnectorStatusFromList(ch.id, conn.id) ?? conn.status
                                      const logo = connectorTypeLogo(conn.connector_type ?? conn.type)
                                      return (
                                        <div key={`${connIdx}-${conn.id}`} className="flex items-center gap-2 flex-wrap rounded-lg border border-border bg-background px-3 py-2 text-sm">
                                          {logo ? (
                                            <span className="h-6 w-6 shrink-0 inline-flex items-center justify-center overflow-hidden">
                                              <img
                                                src={logo.src}
                                                alt={logo.alt}
                                                className={cn(
                                                  'h-full w-full object-contain block',
                                                  // Some logos (e.g. GBTAC.png) have extra inner padding → scale slightly.
                                                  logo.alt === 'GBT AC' && 'scale-[1.70]',
                                                  logo.alt === 'CCS2' && 'scale-[1.70]',
                                                  logo.alt === 'GBT DC' && 'scale-[1.35]'
                                                )}
                                                onError={(e) => {
                                                  // If public asset can't be loaded, fall back to the icon.
                                                  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                                                }}
                                              />
                                            </span>
                                          ) : (
                                            <Plug className="h-6 w-6 text-blue-500 shrink-0" />
                                          )}
                                          <span className="text-muted-foreground">{conn.connector_type ?? conn.type ?? '—'}</span>
                                          <StatusBadge status={liveStatus} />
                                          {conn.power != null && <span className="text-muted-foreground">{conn.power} {conn.power_unit ?? 'kW'}</span>}
                                        </div>
                                      )
                                    })
                                  )}
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )
                    })
                    .filter(Boolean)}
                  </div>
                )}
                {!detailsLoading && detailsTree.length === 0 && statusStats && (
                  <p className="text-sm text-muted-foreground py-4">No location details to show.</p>
                )}
              </div>
              </>
            ) : (
              <div className="py-8 space-y-2">
                <p className="text-sm text-muted-foreground">{statusError ?? 'Failed to load status.'}</p>
                <p className="text-xs text-muted-foreground">Ensure the CPO API is deployed and your token includes organization context.</p>
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  )
}
