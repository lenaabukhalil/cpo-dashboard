import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { ActionCard } from '../components/ActionCard'
import {
  clearGetCache,
  getDashboardStats,
  getConnectorsStatus,
  getActiveSessionsHistory,
  getActiveSessions,
  type ConnectorStatusRow,
  type ConnectorsStatusSummary,
  type ActiveSessionRow,
  type DashboardStats,
} from '../services/api'
import { formatMoney, toNumberSafe } from '../lib/numberFormat'
import { OrgSelector } from '../components/shared/OrgSelector'
import { useAccessibleOrgs } from '../hooks/useAccessibleOrgs'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { ActiveSessionsChart } from '../components/ActiveSessionsChart'
import {
  Activity,
  CheckCircle,
  AlertCircle,
  Zap,
  Plug,
  BarChart3,
  ExternalLink,
  Wrench,
  List,
  Calendar,
} from 'lucide-react'

export default function Dashboard() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const {
    orgs,
    selectedOrgPK,
    setSelectedOrgPK,
    getTargetOrgIdParam,
    hasGrants,
    loading: orgsLoading,
  } = useAccessibleOrgs()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [connectorsList, setConnectorsList] = useState<ConnectorStatusRow[]>([])
  const [connectorsSummary, setConnectorsSummary] = useState<ConnectorsStatusSummary | null>(null)
  const [historyPoints, setHistoryPoints] = useState<{ ts: number; count: number }[]>([])
  const [activeSessionsList, setActiveSessionsList] = useState<ActiveSessionRow[]>([])
  const [historyUpdatedAt, setHistoryUpdatedAt] = useState<Date | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [loadingSessions, setLoadingSessions] = useState(true)

  useEffect(() => {
    if (orgsLoading || selectedOrgPK == null) return

    setLoading(true)
    setLoadingHistory(true)
    setLoadingSessions(true)
    let cardsDone = 0
    const CARDS_NEEDED = 2 // stats + connectors → show 4 cards as soon as these 2 are in
    const hideLoadingWhenCardsReady = () => {
      cardsDone += 1
      if (cardsDone >= CARDS_NEEDED) setLoading(false)
    }

    clearGetCache()

    const targetOrgId = getTargetOrgIdParam()
    const cpoOpts = { skipCache: true as const, targetOrgId }

    getDashboardStats(cpoOpts)
      .then((statsRes) => {
        if (statsRes.success !== false && statsRes.data) {
          setStats(statsRes.data)
        } else {
          setStats(null)
        }
      })
      .catch(() => setStats(null))
      .finally(hideLoadingWhenCardsReady)

    getConnectorsStatus({ skipCache: true, targetOrgId })
      .then((connectorsRes) => {
        const conn = connectorsRes.data
        setConnectorsList(Array.isArray(conn) ? conn : [])
        const s = connectorsRes.summary
        if (
          s &&
          typeof s.totalConnectors === 'number' &&
          Number.isFinite(s.totalConnectors) &&
          typeof s.availableCount === 'number' &&
          Number.isFinite(s.availableCount)
        ) {
          setConnectorsSummary(s)
        } else {
          setConnectorsSummary(null)
        }
      })
      .catch(() => {
        setConnectorsList([])
        setConnectorsSummary(null)
      })
      .finally(hideLoadingWhenCardsReady)

    getActiveSessionsHistory(24, cpoOpts)
      .then((historyRes) => {
        const hist = historyRes.data
        const points = Array.isArray(hist) ? hist : []
        setHistoryPoints(points)
        if (points.length) setHistoryUpdatedAt(new Date())
      })
      .catch(() => setHistoryPoints([]))
      .finally(() => setLoadingHistory(false))

    getActiveSessions(cpoOpts)
      .then((sessionsRes) => {
        const sess = sessionsRes.data
        setActiveSessionsList(Array.isArray(sess) ? sess : [])
      })
      .catch(() => setActiveSessionsList([]))
      .finally(() => setLoadingSessions(false))
  }, [orgsLoading, selectedOrgPK, getTargetOrgIdParam])

  const byCharger = connectorsList.reduce<Record<number, ConnectorStatusRow[]>>((acc, row) => {
    const id = row.chargerId ?? 0
    if (!acc[id]) acc[id] = []
    acc[id].push(row)
    return acc
  }, {})
  const totalChargers = Object.keys(byCharger).length
  const offlineChargers = totalChargers
    ? Object.values(byCharger).filter((rows) => {
        const first = rows[0] as Record<string, unknown>
        const key = Object.keys(first || {}).find((k) => k.toLowerCase().replace(/_/g, '') === 'chargerstatus')
        const val = key ? first[key] : first?.chargerStatus ?? first?.charger_status ?? ''
        return String(val ?? '').toLowerCase().trim() !== 'online'
      }).length
    : 0
  const totalConnectorsFromList =
    connectorsSummary != null ? connectorsSummary.totalConnectors : connectorsList.length
  const availableConnectors =
    connectorsSummary != null
      ? connectorsSummary.availableCount
      : connectorsList.filter((r) => (r.status ?? '').toLowerCase() === 'available').length

  if (!user) return null

  return (
    <div className="space-y-6 text-start">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('dashboard.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('dashboard.overviewFor')} {user?.f_name} {user?.l_name}
        </p>
      </div>

      {hasGrants ? (
        <OrgSelector
          orgs={orgs}
          value={selectedOrgPK}
          onChange={setSelectedOrgPK}
          loading={orgsLoading}
        />
      ) : null}

      <section
        className="rounded-2xl border border-border bg-card p-6"
        aria-labelledby="quick-actions-heading"
      >
        <h2 id="quick-actions-heading" className="text-base font-semibold text-foreground mb-4">
          {t('dashboard.quickActions')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ActionCard to="/sessions" icon={<Activity />} title={t('nav.monitor')} />
          <ActionCard to="/details" icon={<List />} title={t('nav.details')} />
          <ActionCard to="/support" icon={<Wrench />} title={t('dashboard.support')} />
        </div>
      </section>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <Card className="border border-border">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              {/* Live count from /api/v4/cpo/stats (active now); chart below is historical point-in-time — intentionally different. */}
              <p className="text-sm text-muted-foreground">{t('dashboard.activeSessions')}</p>
              {loading ? (
                <>
                  <div className="h-8 w-20 rounded bg-muted animate-pulse mt-1" />
                  <div className="mt-2 space-y-1">
                    <div className="h-4 w-28 rounded bg-muted animate-pulse" />
                    <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-foreground">
                    {stats?.totalActive ??
                      (stats?.activeSessions ?? 0) + (stats?.activeNotCharging ?? 0)}
                  </p>
                  <div className="mt-2 space-y-1 border-s border-border ps-3">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">
                        {t('dashboard.activeSessions.chargingNow')}
                      </span>
                      <span className="font-medium text-foreground tabular-nums">
                        {stats?.activeSessions ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">
                        {t('dashboard.activeSessions.notCharging')}
                      </span>
                      <span className="font-medium text-foreground tabular-nums">
                        {stats?.activeNotCharging ?? 0}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
            <Zap className="h-8 w-8 text-amber-500 shrink-0" />
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{t('dashboard.amountEnergy')}</p>
              <p className="text-xs text-muted-foreground/70">{t('dashboard.thisMonth')}</p>
              {loading ? (
                <div className="mt-2 space-y-1">
                  <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                </div>
              ) : (
                <div className="mt-2 space-y-1 border-s border-border ps-3">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">{t('dashboard.monthToDate.amount')}</span>
                    <span className="font-semibold text-foreground tabular-nums text-sm">
                      {formatMoney(stats?.mtdAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">{t('dashboard.monthToDate.energy')}</span>
                    <span className="font-semibold text-foreground tabular-nums text-sm">
                      {toNumberSafe(stats?.mtdEnergyKwh).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <Calendar className="h-8 w-8 text-primary shrink-0" />
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{t('dashboard.chargersOnline')}</p>
              {loading ? (
                <div className="h-8 w-16 rounded bg-muted animate-pulse mt-1" />
              ) : (
                <>
                  <p className="text-2xl font-bold text-green-600">
                    {stats?.chargersOnline ?? 0}{' '}
                    <span className="text-sm font-normal text-muted-foreground">/ {totalChargers}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">Online / Total</p>
                </>
              )}
            </div>
            <CheckCircle className="h-8 w-8 text-green-600 shrink-0" />
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{t('dashboard.connectors')}</p>
              {loading ? (
                <div className="h-8 w-24 rounded bg-muted animate-pulse mt-1" />
              ) : (
                <>
                  <p className="text-2xl font-bold text-green-600">
                    {availableConnectors} <span className="text-sm font-normal text-muted-foreground">/ {totalConnectorsFromList}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{t('dashboard.availableTotal')}</p>
                </>
              )}
            </div>
            <Plug className="h-8 w-8 text-green-600 shrink-0" />
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{t('dashboard.offlineChargers')}</p>
              {loading ? (
                <div className="h-8 w-12 rounded bg-muted animate-pulse mt-1" />
              ) : (
                <>
                  <p className="text-2xl font-bold text-foreground">
                    {offlineChargers}{' '}
                    <span className="text-sm font-normal text-muted-foreground">/ {totalChargers}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">Offline / Total</p>
                </>
              )}
            </div>
            {offlineChargers > 0 ? (
              <AlertCircle className="h-8 w-8 text-muted-foreground shrink-0" />
            ) : (
              <Activity className="h-8 w-8 text-muted-foreground shrink-0" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart + Active sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 shrink-0" />
              {/* Historical point-in-time counts (24h); summary card above is live — intentionally different. */}
              {t('dashboard.activeSessions24h')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="h-[240px] w-full rounded-lg bg-muted/30 animate-pulse flex flex-col items-center justify-center gap-2 p-4">
                <div className="h-4 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
                <p className="text-sm text-muted-foreground">{t('dashboard.loading')}</p>
              </div>
            ) : (
              <ActiveSessionsChart
                title=""
                points={historyPoints}
                updatedAt={historyUpdatedAt ?? undefined}
                className="w-full"
              />
            )}
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">{t('dashboard.activeSessions')}</CardTitle>
            <Link to="/sessions" className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0">
              {t('dashboard.viewMonitor')} <ExternalLink className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {loadingSessions ? (
              <div className="space-y-3 py-2 flex flex-col items-center justify-center gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
                <p className="text-sm text-muted-foreground">{t('dashboard.loading')}</p>
              </div>
            ) : activeSessionsList.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">{t('dashboard.noActiveSessions')}</p>
            ) : (
              <div className="overflow-x-auto table-wrap table-wrapper">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-start py-2 ps-2 pe-2 font-medium text-muted-foreground">{t('dashboard.location')}</th>
                      <th className="text-start py-2 ps-2 pe-2 font-medium text-muted-foreground">{t('dashboard.charger')}</th>
                      <th className="text-end py-2 ps-2 pe-2 font-medium text-muted-foreground">{t('dashboard.energy')}</th>
                      <th className="text-end py-2 ps-2 pe-2 font-medium text-muted-foreground">{t('dashboard.amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSessionsList.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="py-2 ps-2 pe-2 text-foreground">{row.Location ?? '—'}</td>
                        <td className="py-2 ps-2 pe-2 text-foreground">{row.Charger ?? '—'}</td>
                        <td className="py-2 ps-2 pe-2 text-end text-foreground">{row['Energy (KWH)'] ?? '—'} kWh</td>
                        <td className="py-2 ps-2 pe-2 text-end text-foreground">{row['Amount (JOD)'] ?? '—'} JOD</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
