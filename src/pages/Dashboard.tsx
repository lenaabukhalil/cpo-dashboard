import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { ActionCard } from '../components/ActionCard'
import {
  getDashboardStats,
  getConnectorsStatus,
  getActiveSessionsHistory,
  getActiveSessions,
  type ConnectorStatusRow,
  type ActiveSessionRow,
} from '../services/api'
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
  MapPin,
  Settings,
} from 'lucide-react'

export default function Dashboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<{
    activeSessions?: number
    chargersOnline?: number
    totalConnectors?: number
    busyConnectors?: number
    utilization?: number
  } | null>(null)
  const [connectorsList, setConnectorsList] = useState<ConnectorStatusRow[]>([])
  const [historyPoints, setHistoryPoints] = useState<{ ts: number; count: number }[]>([])
  const [activeSessionsList, setActiveSessionsList] = useState<ActiveSessionRow[]>([])
  const [historyUpdatedAt, setHistoryUpdatedAt] = useState<Date | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [loadingSessions, setLoadingSessions] = useState(true)

  useEffect(() => {
    setLoading(true)
    setLoadingHistory(true)
    setLoadingSessions(true)
    let cardsDone = 0
    const CARDS_NEEDED = 2 // stats + connectors → show 4 cards as soon as these 2 are in
    const hideLoadingWhenCardsReady = () => {
      cardsDone += 1
      if (cardsDone >= CARDS_NEEDED) setLoading(false)
    }

    getDashboardStats()
      .then((statsRes) => {
        if ((statsRes as { success?: boolean }).success !== false && (statsRes as { data?: unknown }).data) {
          setStats((statsRes as { data: { activeSessions?: number; chargersOnline?: number; totalConnectors?: number; busyConnectors?: number; utilization?: number } }).data)
        }
      })
      .catch(() => {})
      .finally(hideLoadingWhenCardsReady)

    getConnectorsStatus()
      .then((connectorsRes) => {
        const conn = (connectorsRes as { data?: ConnectorStatusRow[] }).data
        setConnectorsList(Array.isArray(conn) ? conn : [])
      })
      .catch(() => setConnectorsList([]))
      .finally(hideLoadingWhenCardsReady)

    getActiveSessionsHistory(24)
      .then((historyRes) => {
        const hist = (historyRes as { data?: { ts: number; count: number }[] }).data
        const points = Array.isArray(hist) ? hist : []
        setHistoryPoints(points)
        if (points.length) setHistoryUpdatedAt(new Date())
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false))

    getActiveSessions()
      .then((sessionsRes) => {
        const sess = (sessionsRes as { data?: ActiveSessionRow[] }).data
        setActiveSessionsList(Array.isArray(sess) ? sess : [])
      })
      .catch(() => setActiveSessionsList([]))
      .finally(() => setLoadingSessions(false))
  }, [])

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
  // Use same source and logic as Monitor: getConnectorsStatus() list, available = status === 'available'
  const totalConnectorsFromList = connectorsList.length
  const availableConnectors = connectorsList.filter((r) => (r.status ?? '').toLowerCase() === 'available').length

  const { t } = useTranslation()
  if (!user) return null

  return (
    <div className="space-y-6 text-start">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('dashboard.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('dashboard.overviewFor')} {user?.f_name} {user?.l_name}
        </p>
      </div>

      <section
        className="rounded-2xl border border-[#E5E7EB] bg-white p-6 dark:border-gray-700 dark:bg-card"
        aria-labelledby="quick-actions-heading"
      >
        <h2 id="quick-actions-heading" className="text-base font-semibold text-[#111827] dark:text-gray-100 mb-4">
          {t('dashboard.quickActions')}
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ActionCard to="/sessions" icon={<Activity />} title={t('nav.monitor')} />
          <ActionCard to="/details" icon={<MapPin />} title={t('nav.details')} />
          <ActionCard to="/support" icon={<Wrench />} title={t('dashboard.support')} />
          <ActionCard to="/settings" icon={<Settings />} title={t('nav.settings')} />
        </div>
      </section>

      {/* Summary cards – تظهر فوراً، القيم تتحمل لاحقاً */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-border">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{t('dashboard.activeSessions')}</p>
              {loading ? (
                <div className="h-8 w-20 rounded bg-muted animate-pulse mt-1" />
              ) : (
                <p className="text-2xl font-bold text-foreground">{stats?.activeSessions ?? 0}</p>
              )}
            </div>
            <Zap className="h-8 w-8 text-amber-500 shrink-0" />
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{t('dashboard.chargersOnline')}</p>
              {loading ? (
                <div className="h-8 w-16 rounded bg-muted animate-pulse mt-1" />
              ) : (
                <p className="text-2xl font-bold text-green-600">{stats?.chargersOnline ?? 0}</p>
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
                  <p className="text-2xl font-bold text-foreground">
                    {availableConnectors} <span className="text-sm font-normal text-muted-foreground">/ {totalConnectorsFromList}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{t('dashboard.availableTotal')}</p>
                </>
              )}
            </div>
            <Plug className="h-8 w-8 text-muted-foreground shrink-0" />
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{t('dashboard.offlineChargers')}</p>
              {loading ? (
                <div className="h-8 w-12 rounded bg-muted animate-pulse mt-1" />
              ) : (
                <p className={`text-2xl font-bold ${offlineChargers > 0 ? 'text-red-600' : 'text-foreground'}`}>
                  {offlineChargers}
                </p>
              )}
            </div>
            {offlineChargers > 0 ? (
              <AlertCircle className="h-8 w-8 text-red-600 shrink-0" />
            ) : (
              <Activity className="h-8 w-8 text-muted-foreground shrink-0" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Offline alert – يظهر فقط بعد التحميل إذا في أوفلاين */}
      {!loading && offlineChargers > 0 && (
        <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900">
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              <span className="text-sm font-medium text-foreground">
                {offlineChargers} {t('dashboard.offlineAlert')}
              </span>
            </div>
            <Link to="/sessions" className="text-sm text-primary hover:underline flex items-center gap-1">
              {t('dashboard.viewMonitor')} <ExternalLink className="h-3 w-3 shrink-0" />
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Chart + Active sessions – الهيكل يظهر فوراً، المحتوى يتحمل */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 shrink-0" />
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
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
