import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Download, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { canAccessAuditLog, canAccessAuditLogFull } from '../lib/permissions'
import {
  getAccessLogs,
  exportAccessLogs,
  type AccessLogEntry,
  type AccessLogFilters,
} from '../services/api'
import { TablePagination } from '../components/TablePagination'
import { AppSelect } from '../components/shared/AppSelect'
import { cn } from '../lib/utils'

const PAGE_SIZES = [25, 50, 100, 200]

const ACTION_OPTIONS = [
  { value: '', labelKey: 'common.all' },
  { value: 'login', labelKey: 'accessLog.actionLogin' },
  { value: 'logout', labelKey: 'accessLog.actionLogout' },
] as const

function formatTs(ts: string): string {
  if (!ts) return '—'
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' })
}

function jsonPreview(obj: Record<string, unknown> | null, maxLen = 120): string {
  if (obj == null) return '—'
  try {
    const s = JSON.stringify(obj)
    return s.length <= maxLen ? s : s.slice(0, maxLen) + '…'
  } catch {
    return '—'
  }
}

function defaultDateRange(): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 30)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

function actionLabel(action: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    login: 'accessLog.actionLogin',
    logout: 'accessLog.actionLogout',
  }
  return map[action] ? t(map[action]) : action
}

export default function AccessLog() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const canAccess = canAccessAuditLog(user?.role_name)
  const { from: defaultFrom, to: defaultTo } = defaultDateRange()

  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [action, setAction] = useState<string>('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)
  const [entries, setEntries] = useState<AccessLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportHint, setExportHint] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!canAccess) return
    setLoading(true)
    const filters: AccessLogFilters = {
      from,
      to,
      limit: perPage,
      offset: (page - 1) * perPage,
    }
    if (action) filters.action = action
    if (user?.organization_id != null && !canAccessAuditLogFull(user?.role_name)) {
      filters.organization_id = user.organization_id
    }

    getAccessLogs(filters)
      .then((res) => {
        if (!res.success) {
          setEntries([])
          setTotal(0)
          return
        }
        const r = res as { data?: AccessLogEntry[]; total?: number }
        const list = Array.isArray(r.data) ? r.data : []
        const totalCount = typeof r.total === 'number' ? r.total : list.length
        setEntries(list)
        setTotal(totalCount)
      })
      .catch(() => {
        setEntries([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }, [canAccess, from, to, action, page, perPage, user?.organization_id])

  useEffect(() => {
    load()
  }, [load])

  const handleExport = async (format: 'csv' | 'pdf') => {
    setExportError(null)
    setExportHint(null)
    setExporting(format)
    try {
      const exportFilters: Omit<AccessLogFilters, 'limit' | 'offset'> = { from, to, action: action || undefined }
      if (user?.organization_id != null && !canAccessAuditLogFull(user?.role_name)) {
        exportFilters.organization_id = user.organization_id
      }
      const { blob, filename } = await exportAccessLogs(format, exportFilters)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename || `access-log-${new Date().toISOString().slice(0, 10)}.${format === 'pdf' && blob.type?.indexOf('html') !== -1 ? 'html' : format}`
      a.click()
      URL.revokeObjectURL(url)
      if (format === 'pdf' && (blob.type?.indexOf('html') !== -1 || (filename && filename.toLowerCase().endsWith('.html')))) {
        setExportHint(t('audit.exportPdfAsHtmlHint'))
        setTimeout(() => setExportHint(null), 8000)
      }
    } catch (e) {
      setExportError(e instanceof Error ? e.message : t('audit.exportError'))
    } finally {
      setExporting(null)
    }
  }

  if (!canAccess) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">{t('common.error')}: {t('accessLog.noResults')}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('accessLog.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('accessLog.subtitle')}</p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">{t('accessLog.title')}</CardTitle>
          <div className="flex flex-wrap items-end gap-4 pt-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{t('audit.from')}</label>
              <input
                type="date"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{t('audit.to')}</label>
              <input
                type="date"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1 min-w-[160px]">
              <label className="text-xs text-muted-foreground">{t('audit.action')}</label>
              <AppSelect
                value={action}
                onChange={setAction}
                options={ACTION_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                placeholder={t('common.all')}
              />
            </div>
            <Button variant="default" size="sm" onClick={() => load()}>
              {t('audit.applyFilters')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => load()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              {t('common.refresh')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFrom(defaultFrom)
                setTo(defaultTo)
                setAction('')
                setPage(1)
              }}
            >
              {t('audit.clearFilters')}
            </Button>
          </div>
          {exportError && <p className="text-destructive text-sm mt-2">{exportError}</p>}
          {exportHint && <p className="text-muted-foreground text-sm mt-2">{exportHint}</p>}
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-muted-foreground">{t('audit.export')}</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('csv')}
                disabled={!!exporting}
              >
                <Download className="h-4 w-4" />
                {t('audit.exportCsv')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('pdf')}
                disabled={!!exporting}
              >
                <Download className="h-4 w-4" />
                {t('audit.exportPdf')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && entries.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <RefreshCw className="h-8 w-8 animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">{t('accessLog.noResults')}</p>
          ) : (
            <>
              <div className="overflow-x-auto -mx-2">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 font-medium">{t('audit.timestamp')}</th>
                      <th className="text-left p-3 font-medium">{t('audit.user')}</th>
                      <th className="text-left p-3 font-medium">{t('audit.action')}</th>
                      <th className="text-left p-3 font-medium">{t('audit.entityType')}</th>
                      <th className="text-left p-3 font-medium">{t('audit.entityId')}</th>
                      <th className="text-left p-3 font-medium max-w-[140px]">{t('audit.newValue')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((row) => (
                      <tr key={row.id} className="border-b border-border/70 hover:bg-muted/30">
                        <td className="p-3 whitespace-nowrap">{formatTs(row.timestamp)}</td>
                        <td className="p-3">{row.user_name ?? (row.user_id != null ? String(row.user_id) : '—')}</td>
                        <td className="p-3">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                              row.action === 'login' && 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
                              row.action === 'logout' && 'bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300',
                              row.action === 'failed_login' && 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
                              row.action === 'password_reset' && 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
                              row.action === 'token_refresh' && 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
                              row.action === 'session_expired' && 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
                              !['login', 'logout', 'failed_login', 'password_reset', 'token_refresh', 'session_expired', 'mfa_login', 'mfa_failed'].includes(row.action) && 'bg-muted text-muted-foreground'
                            )}
                          >
                            {actionLabel(row.action, t)}
                          </span>
                        </td>
                        <td className="p-3">{row.entity_type}</td>
                        <td className="p-3 font-mono text-xs">{row.entity_id ?? '—'}</td>
                        <td className="p-3 text-muted-foreground max-w-[140px] truncate" title={jsonPreview(row.new_value, 300)}>
                          {jsonPreview(row.new_value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                total={total}
                page={page}
                perPage={perPage}
                onPageChange={setPage}
                onPerPageChange={(n) => { setPerPage(n); setPage(1); }}
                pageSizeOptions={PAGE_SIZES}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
