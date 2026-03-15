import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { RefreshCw, FileText, Bell, Zap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { getNotifications, getSessionsReport, type NotificationItem, type SessionsReportRow } from '../services/api'
import { cn } from '../lib/utils'
import { formatDateTime } from '../lib/dateFormat'

type LogType = 'session' | 'system'

interface LogEntry {
  id: string
  time: Date
  type: LogType
  message: string
  details: string
}

function getSevenDaysRange(): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 7)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

export default function LogsTab() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [typeFilter, setTypeFilter] = useState<LogType | 'all'>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [entries, setEntries] = useState<LogEntry[]>([])
  const orgId = user?.organization_id

  useEffect(() => {
    const { from: f, to: toVal } = getSevenDaysRange()
    setFrom((prev) => prev || f)
    setTo((prev) => prev || toVal)
  }, [])

  const loadLogs = () => {
    if (!orgId || !from || !to) return
    setLoading(true)
    const entriesList: LogEntry[] = []

    const addSessionLogs = (rows: SessionsReportRow[]) => {
      rows.forEach((row, i) => {
        const startStr = row['Start Date/Time']
        const time = startStr ? new Date(startStr) : new Date()
        if (Number.isNaN(time.getTime())) return
        const loc = row.Location ?? '—'
        const energy = row['Energy (KWH)'] ?? 0
        const amount = row['Amount (JOD)'] ?? 0
        entriesList.push({
          id: `session-${row['Session ID'] ?? i}-${time.getTime()}`,
          time,
          type: 'session',
          message: `${loc} — ${energy} kWh, ${amount} JOD`,
          details: [row.Charger, row.Connector].filter(Boolean).join(' · ') || '—',
        })
      })
    }

    const addSystemLogs = (notifs: NotificationItem[]) => {
      notifs.forEach((n) => {
        const ts = n.timestamp ?? (n.createdAt ? new Date(n.createdAt).getTime() : Date.now())
        const time = new Date(ts)
        entriesList.push({
          id: `system-${n.id}`,
          time,
          type: 'system',
          message: n.message ?? 'Notification',
          details: '',
        })
      })
    }

    Promise.all([
      getSessionsReport({ from, to }).then((res) => {
        const data = (res as { data?: SessionsReportRow[] }).data
        if (Array.isArray(data)) addSessionLogs(data)
      }),
      getNotifications({ organizationId: orgId, since: 0 }).then((res) => {
        const data = (res as { data?: NotificationItem[] }).data
        if (Array.isArray(data)) addSystemLogs(data)
      }),
    ])
      .then(() => {
        entriesList.sort((a, b) => b.time.getTime() - a.time.getTime())
        setEntries(entriesList)
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (from && to && orgId) loadLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return entries
    return entries.filter((e) => e.type === typeFilter)
  }, [entries, typeFilter])

  const typeFilters: { value: LogType | 'all'; labelKey: string; icon: React.ReactNode }[] = [
    { value: 'all', labelKey: 'logs.type.all', icon: <FileText className="h-4 w-4" /> },
    { value: 'session', labelKey: 'logs.type.session', icon: <Zap className="h-4 w-4" /> },
    { value: 'system', labelKey: 'logs.type.system', icon: <Bell className="h-4 w-4" /> },
  ]

  return (
    <Card className="border border-border">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">{t('logs.title')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('logs.subtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-muted/20 p-4">
          <div className="flex flex-wrap gap-2">
            {typeFilters.map(({ value, labelKey, icon }) => (
              <Button
                key={value}
                type="button"
                variant={typeFilter === value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTypeFilter(value)}
                className="gap-1.5"
              >
                {icon}
                {t(labelKey)}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3 ms-auto">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('reports.from')}</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} placeholder={t('common.datePlaceholder')} className="w-full min-w-[140px] sm:w-40" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('reports.to')}</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} placeholder={t('common.datePlaceholder')} className="w-full min-w-[140px] sm:w-40" />
            </div>
            <Button type="button" onClick={loadLogs} disabled={loading || !from || !to} className="gap-2">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              {t('logs.refresh')}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto table-wrap table-wrapper">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-start py-3 ps-4 pe-4 font-medium text-muted-foreground">{t('logs.time')}</th>
                  <th className="text-start py-3 ps-4 pe-4 font-medium text-muted-foreground">{t('logs.type')}</th>
                  <th className="text-start py-3 ps-4 pe-4 font-medium text-muted-foreground">{t('logs.message')}</th>
                  <th className="text-start py-3 ps-4 pe-4 font-medium text-muted-foreground">{t('logs.details')}</th>
                </tr>
              </thead>
              <tbody>
                {loading && entries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      {t('reports.loading')}
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      {t('logs.noEntries')}
                    </td>
                  </tr>
                ) : (
                  filtered.map((entry) => (
                    <tr key={entry.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                      <td className="py-2.5 ps-4 pe-4 text-foreground whitespace-nowrap">{formatDateTime(entry.time)}</td>
                      <td className="py-2.5 ps-4 pe-4">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                            entry.type === 'session'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {entry.type === 'session' ? <Zap className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
                          {t(entry.type === 'session' ? 'logs.type.session' : 'logs.type.system')}
                        </span>
                      </td>
                      <td className="py-2.5 ps-4 pe-4 text-foreground">{entry.message}</td>
                      <td className="py-2.5 ps-4 pe-4 text-muted-foreground">{entry.details}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
