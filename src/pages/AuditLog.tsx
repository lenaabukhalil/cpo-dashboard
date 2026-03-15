import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { createPortal } from 'react-dom'
import { Download, Filter, RefreshCw, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { canAccessAuditLog, canAccessAuditLogFull } from '../lib/permissions'
import {
  getAuditLogs,
  exportAuditLogs,
  getAccessLogs,
  exportAccessLogs,
  type AuditLogEntry,
  type AuditLogFilters,
  type AccessLogEntry,
  type AccessLogFilters,
} from '../services/api'
import { getAuditLogSummary, getAccessLogSummary, getAuditLogDetailSections } from '../lib/auditLogSummary'
import { formatDateTime, type DateInput } from '../lib/dateFormat'
import { TablePagination } from '../components/TablePagination'
import { AppSelect } from '../components/shared/AppSelect'
import { PageTabs } from '../components/PageTabs'
import { cn } from '../lib/utils'

const PAGE_SIZES = [10, 25, 50, 100, 200]
const ENTITY_TYPES = [
  { value: '', labelKey: 'common.all' },
  { value: 'org_logo', labelKey: 'audit.entityOrgLogo' },
  { value: 'maintenance_ticket', labelKey: 'audit.entityMaintenanceTicket' },
  { value: 'user', labelKey: 'audit.entityUser' },
] as const

const AUDIT_ACTION_OPTIONS = [
  { value: '', labelKey: 'common.all' },
  { value: 'create', labelKey: 'audit.actionCreate' },
  { value: 'update', labelKey: 'audit.actionUpdate' },
  { value: 'delete', labelKey: 'audit.actionDelete' },
  { value: 'notification', labelKey: 'audit.actionNotification' },
] as const

const ACCESS_ACTION_OPTIONS = [
  { value: '', labelKey: 'common.all' },
  { value: 'login', labelKey: 'accessLog.actionLogin' },
  { value: 'logout', labelKey: 'accessLog.actionLogout' },
  { value: 'failed_login', labelKey: 'accessLog.actionFailedLogin' },
  { value: 'password_reset', labelKey: 'accessLog.actionPasswordReset' },
  { value: 'token_refresh', labelKey: 'accessLog.actionTokenRefresh' },
  { value: 'session_expired', labelKey: 'accessLog.actionSessionExpired' },
  { value: 'mfa_login', labelKey: 'accessLog.actionMfaLogin' },
  { value: 'mfa_failed', labelKey: 'accessLog.actionMfaFailed' },
] as const

type TabId = 'audit' | 'access'

function actionLabelAccess(action: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    login: 'accessLog.actionLogin',
    logout: 'accessLog.actionLogout',
    failed_login: 'accessLog.actionFailedLogin',
    password_reset: 'accessLog.actionPasswordReset',
    token_refresh: 'accessLog.actionTokenRefresh',
    session_expired: 'accessLog.actionSessionExpired',
    mfa_login: 'accessLog.actionMfaLogin',
    mfa_failed: 'accessLog.actionMfaFailed',
  }
  return map[action] ? t(map[action]) : action
}

export default function AuditLog() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const canAccess = canAccessAuditLog(user?.role_name)
  const defaultFrom = ''
  const defaultTo = ''

  const [activeTab, setActiveTab] = useState<TabId>('audit')
  // Audit tab state
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [action, setAction] = useState<string>('')
  const [entityType, setEntityType] = useState<string>('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportHint, setExportHint] = useState<string | null>(null)

  // Access tab state
  const [accFrom, setAccFrom] = useState(defaultFrom)
  const [accTo, setAccTo] = useState(defaultTo)
  const [accAction, setAccAction] = useState<string>('')
  const [accPage, setAccPage] = useState(1)
  const [accPerPage, setAccPerPage] = useState(10)
  const [accEntries, setAccEntries] = useState<AccessLogEntry[]>([])
  const [accTotal, setAccTotal] = useState(0)
  const [accLoading, setAccLoading] = useState(false)
  const [accExporting, setAccExporting] = useState<string | null>(null)
  const [accExportError, setAccExportError] = useState<string | null>(null)
  const [accExportHint, setAccExportHint] = useState<string | null>(null)
  const [hasAppliedAudit, setHasAppliedAudit] = useState(false)
  const [hasAppliedAccess, setHasAppliedAccess] = useState(false)
  /** Increment when user clicks Apply so useEffect refetches with current filters (action/entityType). */
  const [auditFilterVersion, setAuditFilterVersion] = useState(0)
  const [accessFilterVersion, setAccessFilterVersion] = useState(0)
  /** When API returns 500 or success: false, show this instead of generic "no results". */
  const [auditError, setAuditError] = useState<string | null>(null)
  /** True when user clicked "Latest 10": show only 10 total (no pagination beyond that). */
  const [isLatest10, setIsLatest10] = useState(false)
  /** Row selected for "More details" modal (Audit tab only). */
  const [selectedAuditRow, setSelectedAuditRow] = useState<AuditLogEntry | null>(null)

  const loadAudit = useCallback(() => {
    if (!canAccess) return
    setLoading(true)
    setAuditError(null)
    const filters: AuditLogFilters = { from, to, limit: perPage, offset: (page - 1) * perPage }
    if (action) filters.action = action as 'create' | 'update' | 'delete' | 'notification'
    if (entityType) filters.entity_type = entityType
    if (user?.organization_id != null && !canAccessAuditLogFull(user?.role_name)) filters.organization_id = user.organization_id
    getAuditLogs(filters)
      .then((res) => {
        if (!res.success) {
          setEntries([])
          setTotal(0)
          const msg = (res as { message?: string }).message || (res as { error?: string }).error
          setAuditError(msg || ((res as { statusCode?: number }).statusCode === 500 ? 'Server error. Check backend (e.g. audit_log table, DB connection).' : 'Request failed.'))
          return
        }
        const r = res as { data?: AuditLogEntry[]; total?: number }
        const list = Array.isArray(r.data) ? r.data : []
        setEntries(list)
        setTotal(isLatest10 ? list.length : (typeof r.total === 'number' ? r.total : list.length))
      })
      .catch((e) => {
        setEntries([])
        setTotal(0)
        setAuditError(e instanceof Error ? e.message : 'Request failed.')
      })
      .finally(() => setLoading(false))
  }, [canAccess, from, to, action, entityType, page, perPage, isLatest10, user?.organization_id])

  const loadAccess = useCallback(() => {
    if (!canAccess) return
    setAccLoading(true)
    const filters: AccessLogFilters = { from: accFrom, to: accTo, limit: accPerPage, offset: (accPage - 1) * accPerPage }
    if (accAction) filters.action = accAction
    if (user?.organization_id != null && !canAccessAuditLogFull(user?.role_name)) filters.organization_id = user.organization_id
    getAccessLogs(filters)
      .then((res) => {
        if (!res.success) { setAccEntries([]); setAccTotal(0); return }
        const r = res as { data?: AccessLogEntry[]; total?: number }
        const list = Array.isArray(r.data) ? r.data : []
        setAccEntries(list)
        setAccTotal(typeof r.total === 'number' ? r.total : list.length)
      })
      .catch(() => { setAccEntries([]); setAccTotal(0) })
      .finally(() => setAccLoading(false))
  }, [canAccess, accFrom, accTo, accAction, accPage, accPerPage, user?.organization_id])

  useEffect(() => {
    if (activeTab === 'audit' && hasAppliedAudit) loadAudit()
  }, [activeTab, hasAppliedAudit, page, perPage, auditFilterVersion, loadAudit])

  useEffect(() => {
    if (activeTab === 'access' && hasAppliedAccess) loadAccess()
  }, [activeTab, hasAppliedAccess, accPage, accPerPage, accessFilterVersion, loadAccess])

  const handleExportAudit = async (format: 'csv' | 'pdf') => {
    setExportError(null); setExportHint(null); setExporting(format)
    try {
      const exportFilters: Omit<AuditLogFilters, 'limit' | 'offset'> = {
        from,
        to,
        action: action ? (action as 'create' | 'update' | 'delete') : undefined,
        entity_type: entityType || undefined,
      }
      if (user?.organization_id != null && !canAccessAuditLogFull(user?.role_name)) exportFilters.organization_id = user.organization_id
      const { blob, filename } = await exportAuditLogs(format, exportFilters)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename || `audit-log-${new Date().toISOString().slice(0, 10)}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      if (format === 'pdf' && (blob.type.indexOf('html') !== -1 || (filename && filename.toLowerCase().endsWith('.html')))) {
        setExportHint(t('audit.exportPdfAsHtmlHint'))
        setTimeout(() => setExportHint(null), 8000)
      }
    } catch (e) { setExportError(e instanceof Error ? e.message : t('audit.exportError')) }
    finally { setExporting(null) }
  }

  const handleExportAccess = async (format: 'csv' | 'pdf') => {
    setAccExportError(null); setAccExportHint(null); setAccExporting(format)
    try {
      const exportFilters: Omit<AccessLogFilters, 'limit' | 'offset'> = { from: accFrom, to: accTo, action: accAction || undefined }
      if (user?.organization_id != null && !canAccessAuditLogFull(user?.role_name)) exportFilters.organization_id = user.organization_id
      const { blob, filename } = await exportAccessLogs(format, exportFilters)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename || `access-log-${new Date().toISOString().slice(0, 10)}.${format === 'pdf' && blob.type?.indexOf('html') !== -1 ? 'html' : format}`
      a.click()
      URL.revokeObjectURL(url)
      if (format === 'pdf' && (blob.type?.indexOf('html') !== -1 || (filename && filename.toLowerCase().endsWith('.html')))) {
        setAccExportHint(t('audit.exportPdfAsHtmlHint'))
        setTimeout(() => setAccExportHint(null), 8000)
      }
    } catch (e) { setAccExportError(e instanceof Error ? e.message : t('audit.exportError')) }
    finally { setAccExporting(null) }
  }

  if (!canAccess) {
    return (
      <div className="p-6">
        <Card><CardContent className="pt-6"><p className="text-muted-foreground">{t('common.error')}: {t('audit.noResults')}</p></CardContent></Card>
      </div>
    )
  }

  const tabs = [
    { id: 'audit' as TabId, label: t('audit.title') },
    { id: 'access' as TabId, label: t('accessLog.title') },
  ]
  const entityTypeOptions = ENTITY_TYPES.map((e) => ({ value: e.value, label: t(e.labelKey) }))
  const actionOptions = AUDIT_ACTION_OPTIONS.map((a) => ({ value: a.value, label: t(a.labelKey) }))
  const accActionOptions = ACCESS_ACTION_OPTIONS.map((a) => ({ value: a.value, label: t(a.labelKey) }))

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('audit.title')}</h1>
        <p className="text-muted-foreground mt-1">
          {activeTab === 'audit' ? t('audit.subtitle') : t('accessLog.subtitle')}
        </p>
      </div>

      <PageTabs tabs={tabs} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as TabId)} />

      {activeTab === 'audit' && (
        <>
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" />{t('audit.filters')}</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setFrom(defaultFrom); setTo(defaultTo); setAction(''); setEntityType(''); setPage(1); setIsLatest10(false); setHasAppliedAudit(false); setEntries([]); setTotal(0) }}>
                    {t('audit.clearFilters')}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2"><Label>{t('audit.from')}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} placeholder={t('common.datePlaceholder')} /></div>
                <div className="space-y-2"><Label>{t('audit.to')}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} placeholder={t('common.datePlaceholder')} /></div>
                <div className="space-y-2"><Label>{t('audit.action')}</Label><AppSelect options={actionOptions} value={action} onChange={setAction} size="default" className="w-full" /></div>
                <div className="space-y-2"><Label>{t('audit.entityType')}</Label><AppSelect options={entityTypeOptions} value={entityType} onChange={setEntityType} size="default" className="w-full" /></div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => { setIsLatest10(false); setPage(1); setHasAppliedAudit(true); setAuditFilterVersion((v) => v + 1); }} disabled={!from.trim() || !to.trim()}>{t('audit.applyFilters')}</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFrom('')
                    setTo('')
                    setAction('')
                    setEntityType('')
                    setPage(1)
                    setPerPage(10)
                    setIsLatest10(true)
                    setHasAppliedAudit(true)
                    setAuditFilterVersion((v) => v + 1)
                  }}
                  disabled={loading}
                >
                  {t('audit.latest10')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <CardTitle>{t('audit.title')}</CardTitle>
                {auditError && <p className="text-destructive text-sm w-full mb-2">{auditError}</p>}
                {exportError && <p className="text-destructive text-sm w-full mb-2">{exportError}</p>}
                {exportHint && <p className="text-muted-foreground text-sm w-full mb-2 max-w-md">{exportHint}</p>}
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => handleExportAudit('csv')} disabled={!!exporting}><Download className="h-4 w-4" />{t('audit.exportCsv')}</Button>
                  <Button variant="outline" size="sm" onClick={() => handleExportAudit('pdf')} disabled={!!exporting}><Download className="h-4 w-4" />{t('audit.exportPdf')}</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading && entries.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground"><RefreshCw className="h-8 w-8 animate-spin" /></div>
              ) : entries.length === 0 ? (
                <p className={cn('py-8 text-center', auditError ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                  {auditError || t('audit.noResults')}
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto -mx-2 table-wrap table-wrapper">
                    <table className="w-full border-collapse text-sm min-w-[600px]">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-3 font-medium">{t('audit.timestamp')}</th>
                          <th className="text-left p-3 font-medium">{t('audit.user')}</th>
                          <th className="text-left p-3 font-medium">{t('audit.action')}</th>
                          <th className="text-left p-3 font-medium">{t('audit.entityType')}</th>
                          <th className="text-left p-3 font-medium" title={t('audit.entityIdTooltipAudit')}>{t('audit.entityId')}</th>
                          <th className="text-left p-3 font-medium">{t('audit.details')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((row) => (
                          <tr
                            key={row.id}
                            className="border-b border-border/70 hover:bg-muted/30 cursor-pointer"
                            onClick={() => setSelectedAuditRow(row)}
                          >
                            <td className="p-3 whitespace-nowrap">{formatDateTime(row.timestamp)}</td>
                            <td className="p-3">{row.user_name ?? (row.user_id != null ? String(row.user_id) : '—')}</td>
                            <td className="p-3">
                              <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', row.action === 'create' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300', row.action === 'update' && 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300', row.action === 'delete' && 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300', row.action === 'notification' && 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300')}>
                                {row.action === 'create' && t('audit.actionCreate')}{row.action === 'update' && t('audit.actionUpdate')}{row.action === 'delete' && t('audit.actionDelete')}{row.action === 'notification' && t('audit.actionNotification')}{!['create', 'update', 'delete', 'notification'].includes(row.action) && row.action}
                              </span>
                            </td>
                            <td className="p-3">{row.entity_type}</td>
                            <td className="p-3 font-mono text-xs" title={t('audit.entityIdTooltipAudit')}>{row.entity_id ?? '—'}</td>
                            <td className="p-3 text-muted-foreground">
                              <span className="max-w-[200px] truncate inline-block align-middle">{getAuditLogSummary(row, t)}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <TablePagination total={total} page={page} perPage={perPage} onPageChange={(p) => { setIsLatest10(false); setPage(p); }} onPerPageChange={(n) => { setPerPage(n); setPage(1); setIsLatest10(false); }} pageSizeOptions={PAGE_SIZES} />
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === 'access' && (
        <>
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" />{t('audit.filters')}</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setAccFrom(defaultFrom); setAccTo(defaultTo); setAccAction(''); setAccPage(1); setHasAppliedAccess(false); setAccEntries([]); setAccTotal(0) }}>{t('audit.clearFilters')}</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2"><Label>{t('audit.from')}</Label><Input type="date" value={accFrom} onChange={(e) => setAccFrom(e.target.value)} placeholder={t('common.datePlaceholder')} /></div>
                <div className="space-y-2"><Label>{t('audit.to')}</Label><Input type="date" value={accTo} onChange={(e) => setAccTo(e.target.value)} placeholder={t('common.datePlaceholder')} /></div>
                <div className="space-y-2"><Label>{t('audit.action')}</Label><AppSelect options={accActionOptions} value={accAction} onChange={setAccAction} size="default" className="w-full" /></div>
              </div>
              <Button onClick={() => { setAccPage(1); setHasAppliedAccess(true); setAccessFilterVersion((v) => v + 1); }} disabled={!accFrom.trim() || !accTo.trim()}>{t('audit.applyFilters')}</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <CardTitle>{t('accessLog.title')}</CardTitle>
                {accExportError && <p className="text-destructive text-sm w-full mb-2">{accExportError}</p>}
                {accExportHint && <p className="text-muted-foreground text-sm w-full mb-2 max-w-md">{accExportHint}</p>}
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => handleExportAccess('csv')} disabled={!!accExporting}><Download className="h-4 w-4" />{t('audit.exportCsv')}</Button>
                  <Button variant="outline" size="sm" onClick={() => handleExportAccess('pdf')} disabled={!!accExporting}><Download className="h-4 w-4" />{t('audit.exportPdf')}</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {accLoading && accEntries.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground"><RefreshCw className="h-8 w-8 animate-spin" /></div>
              ) : accEntries.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">{t('accessLog.noResults')}</p>
              ) : (
                <>
                  <div className="overflow-x-auto -mx-2 table-wrap table-wrapper">
                    <table className="w-full border-collapse text-sm min-w-[600px]">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-3 font-medium">{t('audit.timestamp')}</th>
                          <th className="text-left p-3 font-medium">{t('audit.user')}</th>
                          <th className="text-left p-3 font-medium">{t('audit.action')}</th>
                          <th className="text-left p-3 font-medium">{t('audit.entityType')}</th>
                          <th className="text-left p-3 font-medium" title={t('audit.entityIdTooltipAccess')}>{t('audit.entityId')}</th>
                          <th className="text-left p-3 font-medium">{t('audit.details')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accEntries.map((row) => (
                          <tr key={row.id} className="border-b border-border/70 hover:bg-muted/30">
                            <td className="p-3 whitespace-nowrap">{formatDateTime(row.timestamp)}</td>
                            <td className="p-3">{row.user_name ?? (row.user_id != null ? String(row.user_id) : '—')}</td>
                            <td className="p-3">
                              <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', row.action === 'login' && 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300', row.action === 'logout' && 'bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300', row.action === 'failed_login' && 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300', row.action === 'password_reset' && 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300', row.action === 'token_refresh' && 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300', row.action === 'session_expired' && 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300', !['login', 'logout', 'failed_login', 'password_reset', 'token_refresh', 'session_expired', 'mfa_login', 'mfa_failed'].includes(row.action) && 'bg-muted text-muted-foreground')}>
                                {actionLabelAccess(row.action, t)}
                              </span>
                            </td>
                            <td className="p-3">{row.entity_type}</td>
                            <td className="p-3 font-mono text-xs" title={t('audit.entityIdTooltipAccess')}>{row.entity_id ?? '—'}</td>
                            <td className="p-3 text-muted-foreground">
                              <span className="max-w-[200px] truncate inline-block align-middle">{getAccessLogSummary(row, t)}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <TablePagination total={accTotal} page={accPage} perPage={accPerPage} onPageChange={setAccPage} onPerPageChange={(n) => { setAccPerPage(n); setAccPage(1); }} pageSizeOptions={PAGE_SIZES} />
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {selectedAuditRow &&
        createPortal(
          <div
            className="fixed inset-0 top-0 left-0 right-0 bottom-0 min-h-[100dvh] min-h-[100vh] z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
            onClick={() => setSelectedAuditRow(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-details-title"
          >
            <div
              className="bg-card border border-border rounded-xl shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2 p-4 border-b border-border">
                <h2 id="audit-details-title" className="text-lg font-semibold text-foreground">
                  {t('audit.moreDetails')}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setSelectedAuditRow(null)} aria-label={t('audit.detailsModal.close')}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="p-4 space-y-4">
                {(() => {
                  const s = getAuditLogDetailSections(selectedAuditRow, t, (value: unknown) => formatDateTime(value as DateInput))
                  return (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div><span className="font-medium text-muted-foreground">{t('audit.detailsModal.when')}</span><p className="mt-0.5 text-foreground">{s.when}</p></div>
                        {selectedAuditRow.action !== 'notification' && (
                          <div><span className="font-medium text-muted-foreground">{t('audit.detailsModal.who')}</span><p className="mt-0.5 text-foreground">{s.who}</p></div>
                        )}
                        <div><span className="font-medium text-muted-foreground">{t('audit.detailsModal.action')}</span><p className="mt-0.5 text-foreground">{s.action}</p></div>
                        <div><span className="font-medium text-muted-foreground">{t('audit.detailsModal.where')}</span><p className="mt-0.5 text-foreground font-mono text-xs break-all">{s.where}</p></div>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">{t('audit.detailsModal.whatChanged')}</h3>
                        {s.changeSummary === 'changes' && s.changes && s.changes.length > 0 && (
                          <ul className="space-y-2 text-sm">
                            {s.changes.map((c, i) => (
                              <li key={i} className="flex flex-wrap gap-x-2 items-baseline border-b border-border/50 pb-2 last:border-0">
                                <span className="font-medium text-foreground shrink-0">{c.fieldLabel}:</span>
                                <span className="text-muted-foreground">{t('audit.detailsModal.previousValue')} </span>
                                <span className="line-through text-muted-foreground">{c.oldVal}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="text-foreground">{c.newVal}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {s.changeSummary === 'created' && s.createdFields && s.createdFields.length > 0 && (
                          <ul className="space-y-2 text-sm">
                            {s.createdFields.map((f, i) => (
                              <li key={i} className="flex flex-wrap gap-x-2 border-b border-border/50 pb-2 last:border-0">
                                <span className="font-medium text-foreground shrink-0">{f.fieldLabel}:</span>
                                <span className="text-foreground break-all">{f.value}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {s.changeSummary === 'deleted' && s.deletedText && (
                          <p className="text-sm text-foreground">{s.deletedText}</p>
                        )}
                        {s.changeSummary === 'notification' && s.notificationFields && s.notificationFields.length > 0 && (
                          <ul className="space-y-2 text-sm">
                            {s.notificationFields.map((f, i) => (
                              <li key={i} className="flex flex-wrap gap-x-2 border-b border-border/50 pb-2 last:border-0">
                                <span className="font-medium text-foreground shrink-0">{f.fieldLabel}:</span>
                                <span className="text-foreground break-all">{f.value}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {(s.changeSummary === 'changes' && (!s.changes || s.changes.length === 0)) && (
                          <p className="text-sm text-muted-foreground">{t('audit.summary.updatedEntity').replace('{entity}', (selectedAuditRow.entity_type || 'record').replace(/_/g, ' '))}</p>
                        )}
                      </div>
                    </>
                  )
                })()}
              </div>
              <div className="p-4 border-t border-border">
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => setSelectedAuditRow(null)}>
                  {t('audit.detailsModal.close')}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}

    </div>
  )
}
