import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { createPortal } from 'react-dom'
import { Activity, Download, Edit, Filter, LogIn, PlusCircle, RefreshCw, X } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
  PieChart,
  Pie,
} from 'recharts'
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
import { formatDateTime24, type DateInput } from '../lib/dateFormat'
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
] as const

type TabId = 'audit' | 'access' | 'activity'

type ActivityItem =
  | { kind: 'audit'; ts: string; row: AuditLogEntry }
  | { kind: 'access'; ts: string; row: AccessLogEntry }

type ActivityCategory = 'access' | 'users' | 'maintenance' | 'infrastructure' | 'organization'
type ActivityRange = '24h' | '7d' | '30d' | '60d'

type ActivityFeedCard = {
  id: string
  kind: 'audit' | 'access'
  category: ActivityCategory
  ts: string
  actor: string
  action: string
  entityType?: string
  entityId?: string | null
  title: string
  summary: string
  changedFieldChips?: string[]
  row: AuditLogEntry | AccessLogEntry
}

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
  const { user, logout } = useAuth()
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

  // Activity tab state (combined: Audit + Access)
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityError, setActivityError] = useState<string | null>(null)
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([])
  const [activityVersion, setActivityVersion] = useState(0)
  const [activityRange, setActivityRange] = useState<ActivityRange>('24h')
  const [selectedDomain, setSelectedDomain] = useState<ActivityCategory | null>(null)
  const [selectedActionKey, setSelectedActionKey] = useState<string | null>(null)
  /** Insights modal: show full list for a domain or action with paging */
  const [insightsModal, setInsightsModal] = useState<{ type: 'domain'; key: ActivityCategory } | { type: 'action'; key: string } | null>(null)
  const [insightsModalPage, setInsightsModalPage] = useState(1)
  const [insightsModalPerPage, setInsightsModalPerPage] = useState(10)
  const [latestActivityDetailsOpen, setLatestActivityDetailsOpen] = useState(false)

  function pad2(n: number) {
    return String(n).padStart(2, '0')
  }
  function dateOnly(d: Date): string {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
  }

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

  const loadActivity = useCallback(() => {
    if (!canAccess) return
    setActivityLoading(true)
    setActivityError(null)
    const orgScoped =
      user?.organization_id != null && !canAccessAuditLogFull(user?.role_name)
        ? { organization_id: user.organization_id }
        : {}
    // Fetch a stable window (up to 60d) then filter precisely in UI (needed for 24h).
    const now = new Date()
    const from60 = new Date(now)
    from60.setDate(from60.getDate() - 60)
    const from = dateOnly(from60)
    const to = dateOnly(now)

    const PAGE_LIMIT = 500
    const MAX_RECORDS_PER_STREAM = 5000

    const fetchAllAudit = async () => {
      const out: AuditLogEntry[] = []
      let offset = 0
      while (out.length < MAX_RECORDS_PER_STREAM) {
        const res = await getAuditLogs({ limit: PAGE_LIMIT, offset, from, to, ...orgScoped })
        if (!res.success) throw new Error((res as { message?: string }).message || t('common.error'))
        const list = Array.isArray((res as { data?: AuditLogEntry[] }).data) ? ((res as { data?: AuditLogEntry[] }).data as AuditLogEntry[]) : []
        if (list.length === 0) break
        out.push(...list)
        if (list.length < PAGE_LIMIT) break
        offset += PAGE_LIMIT
      }
      return out
    }

    const fetchAllAccess = async () => {
      const out: AccessLogEntry[] = []
      let offset = 0
      while (out.length < MAX_RECORDS_PER_STREAM) {
        const res = await getAccessLogs({ limit: PAGE_LIMIT, offset, from, to, ...orgScoped })
        if (!res.success) throw new Error((res as { message?: string }).message || t('common.error'))
        const list = Array.isArray((res as { data?: AccessLogEntry[] }).data) ? ((res as { data?: AccessLogEntry[] }).data as AccessLogEntry[]) : []
        if (list.length === 0) break
        out.push(...list)
        if (list.length < PAGE_LIMIT) break
        offset += PAGE_LIMIT
      }
      return out
    }

    Promise.all([fetchAllAudit(), fetchAllAccess()])
      .then(([aRes, xRes]) => {
        const aList = Array.isArray(aRes) ? aRes : []
        const xList = Array.isArray(xRes) ? xRes : []
        const merged: ActivityItem[] = [
          ...aList.map((row) => ({ kind: 'audit' as const, ts: row.timestamp, row })),
          ...xList.map((row) => ({ kind: 'access' as const, ts: row.timestamp, row })),
        ]
        merged.sort((p, q) => {
          const pt = new Date(p.ts).getTime()
          const qt = new Date(q.ts).getTime()
          if (!Number.isFinite(pt) && !Number.isFinite(qt)) return 0
          if (!Number.isFinite(pt)) return 1
          if (!Number.isFinite(qt)) return -1
          return qt - pt
        })
        // Keep all merged items for the stable window; UI will filter by selected range.
        setActivityItems(merged)
      })
      .catch((e) => {
        setActivityItems([])
        setActivityError(e instanceof Error ? e.message : t('common.error'))
      })
      .finally(() => setActivityLoading(false))
  }, [canAccess, user?.organization_id, user?.role_name, t])

  useEffect(() => {
    if (activeTab === 'activity') loadActivity()
  }, [activeTab, activityVersion, loadActivity])

  useEffect(() => {
    if (activeTab !== 'activity') return
    const id = window.setInterval(() => {
      setActivityVersion((v) => v + 1)
    }, 30000)
    return () => window.clearInterval(id)
  }, [activeTab])

  useEffect(() => {
    setSelectedDomain(null)
    setSelectedActionKey(null)
    setInsightsModal(null)
  }, [activityRange])

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
    { id: 'activity' as TabId, label: t('audit.activityFeed') },
  ]
  const entityTypeOptions = ENTITY_TYPES.map((e) => ({ value: e.value, label: t(e.labelKey) }))
  const actionOptions = AUDIT_ACTION_OPTIONS.map((a) => ({ value: a.value, label: t(a.labelKey) }))
  const accActionOptions = ACCESS_ACTION_OPTIONS.map((a) => ({ value: a.value, label: t(a.labelKey) }))

  const formatRelativeTime = (ts: string) => {
    const ms = new Date(ts).getTime()
    if (!Number.isFinite(ms)) return ''
    const diffMin = Math.max(0, Math.floor((Date.now() - ms) / 60000))
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`
    const diffHour = Math.floor(diffMin / 60)
    if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`
    const diffDay = Math.floor(diffHour / 24)
    return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`
  }

  // Spotlight: prefer audit "actions" (create/update/delete/notification) over logins.
  // If none exist, fall back to access login/logout, then any activity.
  const latestImportantItem =
    activityItems.find((it) => {
      if (it.kind !== 'audit') return false
      const act = (it.row as AuditLogEntry).action
      return ['update', 'create', 'delete', 'notification'].includes(act)
    }) ||
    activityItems.find((it) => {
      if (it.kind !== 'access') return false
      return ['login', 'logout'].includes((it.row as AccessLogEntry).action)
    }) ||
    activityItems[0]

  const latestImportant = latestImportantItem
    ? (() => {
      if (latestImportantItem.kind === 'access') {
        const row = latestImportantItem.row as AccessLogEntry
        const actor = row.user_name ?? (row.user_id != null ? String(row.user_id) : 'Unknown user')
        const action = row.action || 'activity'
        const verb = action === 'login' ? 'logged in' : action === 'logout' ? 'logged out' : actionLabelAccess(action, t)
        return {
          kind: 'access' as const,
          row,
          actor,
          eventType: actionLabelAccess(action, t),
          summary: getAccessLogSummary(row, t),
          entity: row.entity_type || 'access',
          ts: row.timestamp,
          message: `Latest activity: ${actor} ${verb}`,
        }
      }
      const row = latestImportantItem.row as AuditLogEntry
      const actor = row.user_name ?? (row.user_id != null ? String(row.user_id) : 'Unknown user')
      const eventType =
        row.action === 'update' ? t('audit.actionUpdate')
          : row.action === 'create' ? t('audit.actionCreate')
            : row.action === 'delete' ? t('audit.actionDelete')
              : row.action === 'notification' ? t('audit.actionNotification')
                : row.action
      return {
        kind: 'audit' as const,
        row,
        actor,
        eventType,
        summary: getAuditLogSummary(row, t),
        entity: row.entity_type || 'record',
        ts: row.timestamp,
        message: `Latest ${eventType.toLowerCase()}: ${getAuditLogSummary(row, t)}`,
      }
    })()
    : null

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('audit.title')}</h1>
        <p className="text-muted-foreground mt-1">
          {activeTab === 'audit'
            ? t('audit.subtitle')
            : activeTab === 'access'
              ? t('accessLog.subtitle')
              : t('audit.activityFeedSubtitle')}
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
                            <td className="p-3 whitespace-nowrap">{formatDateTime24(row.timestamp)}</td>
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
                            <td className="p-3 whitespace-nowrap">{formatDateTime24(row.timestamp)}</td>
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

      {activeTab === 'activity' && (
        <>
        <div className="rounded-lg border border-sky-200/70 dark:border-sky-900/40 bg-sky-50/60 dark:bg-sky-950/20 px-3 py-2.5 flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-2.5">
            <Activity className="h-4 w-4 mt-0.5 text-sky-700 dark:text-sky-300 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {latestImportant?.message || 'Latest important activity is not available yet.'}
              </p>
              {latestImportant ? (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {latestImportant.eventType} • {latestImportant.actor} • {formatRelativeTime(latestImportant.ts)}
                </p>
              ) : null}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs shrink-0"
            onClick={() => setLatestActivityDetailsOpen(true)}
            disabled={!latestImportant}
          >
            View details
          </Button>
        </div>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">{t('audit.activityFeed')}</CardTitle>
              <div className="flex items-center gap-2 shrink-0">
                <div className="inline-flex rounded-lg border border-border/70 bg-muted/10 p-1">
                  {(['24h', '7d', '30d', '60d'] as ActivityRange[]).map((r) => (
                    <Button
                      key={r}
                      type="button"
                      size="sm"
                      variant={activityRange === r ? 'default' : 'ghost'}
                      onClick={() => { setActivityRange(r) }}
                      className="px-3"
                    >
                      {r === '24h' ? 'Last 24 hours' : r === '7d' ? 'Last week' : r === '30d' ? 'Last month' : 'Last 2 months'}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            {activityError && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="text-destructive text-sm">
                  {activityError}. If this keeps happening, try refresh. If your session expired, please logout and login again.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={logout}
                  className="h-7 px-2 text-xs"
                >
                  Logout
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {(() => {
              const rangeLabels: Record<ActivityRange, string> = {
                '24h': 'Last 24 hours',
                '7d': 'Last week',
                '30d': 'Last month',
                '60d': 'Last 2 months',
              }

              const now = new Date()
              const since = new Date(now)
              since.setHours(
                now.getHours() -
                  (activityRange === '24h' ? 24 : activityRange === '7d' ? 24 * 7 : activityRange === '30d' ? 24 * 30 : 24 * 60),
              )
              const sinceMs = since.getTime()

              const inRange = (ts: string) => {
                const ms = new Date(ts).getTime()
                return Number.isFinite(ms) && ms >= sinceMs
              }

              const categoryLabels: Record<ActivityCategory, string> = {
                access: t('activity.category.access'),
                users: t('activity.category.users'),
                maintenance: t('activity.category.maintenance'),
                infrastructure: t('activity.category.infrastructure'),
                organization: t('activity.category.organization'),
              }

              const categoryForAudit = (entityType?: string, action?: string): ActivityCategory => {
                if (action === 'notification' || entityType === 'notification') return 'organization'
                if (entityType === 'user' || entityType === 'role_permissions') return 'users'
                if (entityType === 'maintenance_ticket') return 'maintenance'
                if (entityType === 'org' || entityType === 'org_logo') return 'organization'
                if (entityType === 'location' || entityType === 'charger' || entityType === 'connector' || entityType === 'tariff') return 'infrastructure'
                return 'organization'
              }

              const cardFromItem = (it: ActivityItem): ActivityFeedCard => {
                if (it.kind === 'access') {
                  const r = it.row as AccessLogEntry
                  const actor = r.user_name ?? (r.user_id != null ? String(r.user_id) : '—')
                  const title = getAccessLogSummary(r, t)
                  const action = (r.action || '').toString()
                  return {
                    id: `access-${r.id}`,
                    kind: 'access',
                    category: 'access',
                    ts: it.ts,
                    actor,
                    action,
                    entityType: r.entity_type,
                    entityId: r.entity_id,
                    title,
                    summary: title,
                    row: r,
                  }
                }
                const r = it.row as AuditLogEntry
                const actor = r.user_name ?? (r.user_id != null ? String(r.user_id) : '—')
                const action = (r.action || '').toString()
                const entityType = (r.entity_type || '').toString()
                const summary = getAuditLogSummary(r, t)
                const title = summary
                const category = categoryForAudit(entityType, action)
                const changedFieldChips =
                  action === 'update'
                    ? (getAuditLogDetailSections(r, t, (value: unknown) => formatDateTime24(value as DateInput)).changes || [])
                        .slice(0, 5)
                        .map((c) => c.fieldLabel)
                    : undefined
                return {
                  id: `audit-${r.id}`,
                  kind: 'audit',
                  category,
                  ts: it.ts,
                  actor,
                  action,
                  entityType,
                  entityId: r.entity_id,
                  title,
                  summary,
                  changedFieldChips,
                  row: r,
                }
              }

              const cardsAll = activityItems.filter((it) => inRange(it.ts)).map(cardFromItem)

              const countBy = (pred: (c: ActivityFeedCard) => boolean) => cardsAll.filter(pred).length
              const updates = countBy((c) => c.kind === 'audit' && c.action === 'update')
              const logins = countBy((c) => c.kind === 'access' && c.action === 'login')

              const badgeClass = (c: ActivityFeedCard) => {
                if (c.kind === 'access') {
                  if (c.action === 'login') return 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300'
                  if (c.action === 'logout') return 'bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300'
                  if (c.action === 'failed_login') return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                  if (c.action === 'password_reset') return 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300'
                  return 'bg-muted text-muted-foreground'
                }
                if (c.action === 'create') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                if (c.action === 'update') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                if (c.action === 'delete') return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                if (c.action === 'notification') return 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300'
                return 'bg-muted text-muted-foreground'
              }

              // By domain chart: hide "Infrastructure" (bucket it into "Organization" for totals).
              const catOrder: ActivityCategory[] = ['access', 'users', 'maintenance', 'organization']
              const domainKey = (c: ActivityCategory) => (c === 'infrastructure' ? 'organization' : c)
              const catCounts = new Map<ActivityCategory, number>()
              catOrder.forEach((c) => catCounts.set(c, 0))
              cardsAll.forEach((x) => {
                const k = domainKey(x.category)
                if (!catCounts.has(k)) return
                catCounts.set(k, (catCounts.get(k) || 0) + 1)
              })
              const totalCats = catOrder.reduce((sum, c) => sum + (catCounts.get(c) || 0), 0)

              const actionKeys = ['login', 'create', 'update', 'delete', 'notification'] as const
              const actionLabel: Record<(typeof actionKeys)[number], string> = {
                login: t('activity.kpi.logins'),
                create: t('activity.kpi.creates'),
                update: t('activity.kpi.updates'),
                delete: t('activity.kpi.deletes'),
                notification: t('activity.kpi.notifications'),
              }
              const actionCount = (k: (typeof actionKeys)[number]) =>
                cardsAll.filter((c) => c.action === k).length
              const actionTotals = actionKeys.map((k) => ({ k, n: actionCount(k) }))

              const getActivityLabel = (c: ActivityFeedCard) => {
                if (c.kind === 'access') return actionLabelAccess(c.action, t)
                if (c.action === 'create') return t('audit.actionCreate')
                if (c.action === 'update') return t('audit.actionUpdate')
                if (c.action === 'delete') return t('audit.actionDelete')
                if (c.action === 'notification') return t('audit.actionNotification')
                return c.action
              }

              return (
                <>
                <div className="space-y-8">
                  {/* 2) Summary with Selected range (and No activity yet when empty) */}
                  <div className="space-y-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="text-sm font-semibold text-foreground">Summary</div>
                        {cardsAll.length === 0 && (
                          <span className="text-xs text-muted-foreground">· No activity yet</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0 tabular-nums">
                        Selected range: {rangeLabels[activityRange]}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {[
                        { key: 'total', label: t('activity.kpi.total'), value: cardsAll.length, icon: <Activity className="h-6 w-6 text-muted-foreground" /> },
                        { key: 'creates', label: t('activity.kpi.creates'), value: actionCount('create'), icon: <PlusCircle className="h-6 w-6 text-muted-foreground" /> },
                        { key: 'updates', label: t('activity.kpi.updates'), value: updates, icon: <Edit className="h-6 w-6 text-muted-foreground" /> },
                        { key: 'logins', label: t('activity.kpi.logins'), value: logins, icon: <LogIn className="h-6 w-6 text-muted-foreground" /> },
                      ].map((k) => (
                        <div
                          key={k.key}
                          className="rounded-lg border border-border bg-card p-4 flex items-start justify-between gap-2"
                        >
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
                            <p className="mt-1 text-3xl font-bold text-foreground tabular-nums leading-none">
                              {k.value}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">{rangeLabels[activityRange]}</p>
                          </div>
                          <div className="shrink-0 flex items-start">
                            {k.icon}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 4) By domain + By action (compact insights under KPIs) */}
                  <div className="space-y-3">
                    <div className="flex items-baseline justify-between">
                      <div className="text-sm font-semibold text-foreground">Insights</div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
                      {/* By domain */}
                      <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
                        <div className="p-4 pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-foreground">By domain</div>
                              <div className="mt-1 text-xs text-muted-foreground">Distribution by domain</div>
                            </div>
                            <div className="text-[11px] text-muted-foreground tabular-nums">{totalCats}</div>
                          </div>
                        </div>
                        <div className="px-4 pb-4">
                          {totalCats === 0 ? (
                            <div className="text-sm text-muted-foreground">{t('activity.feed.empty')}</div>
                          ) : (
                            <>
                              {(() => {
                                const domainColors: Record<ActivityCategory, string> = {
                                  access: 'hsl(199 89% 48%)',
                                  users: 'hsl(262 83% 58%)',
                                  maintenance: 'hsl(38 92% 50%)',
                                  infrastructure: 'hsl(142 71% 45%)',
                                  organization: 'hsl(215 16% 47%)',
                                }

                                const domainData = catOrder.map((c) => ({
                                  key: c,
                                  name: categoryLabels[c],
                                  value: catCounts.get(c) || 0,
                                }))

                                return (
                                  <div className="space-y-3">
                                    <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                                      <div className="text-[11px] text-muted-foreground">Click a segment to view all results</div>
                                      <div className="mt-2 grid grid-cols-1 gap-3">
                                        <div className="h-44">
                                          <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                              <Tooltip
                                                content={({ active, payload }: any) => {
                                                  if (!active || !payload || payload.length === 0) return null
                                                  const p = payload[0]?.payload
                                                  const v = typeof p?.value === 'number' ? p.value : 0
                                                  const name = String(p?.name ?? '')
                                                  const pct = totalCats > 0 ? Math.round((v / totalCats) * 100) : 0
                                                  return (
                                                    <div className="rounded-xl border border-border bg-popover px-3 py-2 shadow-lg">
                                                      <div className="text-xs font-semibold text-foreground truncate">{name}</div>
                                                      <div className="mt-1 text-xs text-muted-foreground">
                                                        <span className="font-medium text-foreground tabular-nums">{v}</span> activities ·{' '}
                                                        <span className="tabular-nums">{pct}%</span>
                                                      </div>
                                                    </div>
                                                  )
                                                }}
                                              />
                                              <Pie
                                                data={domainData}
                                                dataKey="value"
                                                nameKey="name"
                                                innerRadius={56}
                                                outerRadius={78}
                                                paddingAngle={2}
                                                stroke="hsl(var(--background))"
                                                strokeWidth={2}
                                                onClick={(p: any) => {
                                                  const key = p?.payload?.key as ActivityCategory | undefined
                                                  const v = typeof p?.payload?.value === 'number' ? p.payload.value : 0
                                                  if (!key || !v) return
                                                  setSelectedDomain(key)
                                                  setInsightsModal({ type: 'domain', key })
                                                  setInsightsModalPage(1)
                                                }}
                                              >
                                                {domainData.map((d) => (
                                                  <Cell
                                                    key={d.key}
                                                    fill={domainColors[d.key]}
                                                    fillOpacity={selectedDomain ? (selectedDomain === d.key ? 0.92 : 0.22) : 0.7}
                                                    style={{ cursor: d.value > 0 ? 'pointer' : 'default' }}
                                                  />
                                                ))}
                                              </Pie>
                                            </PieChart>
                                          </ResponsiveContainer>
                                        </div>

                                        <div className="space-y-1.5">
                                          {domainData.map((d) => {
                                            const pct = totalCats > 0 ? Math.round((d.value / totalCats) * 100) : 0
                                            const isSelected = selectedDomain === d.key
                                            const isClickable = d.value > 0
                                            return (
                                              <button
                                                key={d.key}
                                                type="button"
                                                onClick={() => {
                                                  if (!isClickable) return
                                                  setSelectedDomain(d.key)
                                                  setInsightsModal({ type: 'domain', key: d.key })
                                                  setInsightsModalPage(1)
                                                }}
                                                className={cn(
                                                  'w-full rounded-lg border px-2.5 py-2 text-left transition-colors',
                                                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                                  isSelected ? 'border-primary/50 bg-primary/5' : 'border-border/60 bg-background/30 hover:bg-muted/15',
                                                  !isClickable && 'opacity-60 cursor-default'
                                                )}
                                              >
                                                <div className="flex items-center justify-between gap-2">
                                                  <div className="flex items-center gap-2 min-w-0">
                                                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: domainColors[d.key], opacity: 0.7 }} aria-hidden />
                                                    <span className="text-xs text-muted-foreground truncate">{d.name}</span>
                                                  </div>
                                                  <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-xs font-medium text-foreground tabular-nums">{d.value}</span>
                                                    <span className="text-[11px] text-muted-foreground tabular-nums">{pct}%</span>
                                                  </div>
                                                </div>
                                              </button>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    </div>

                                  </div>
                                )
                              })()}
                            </>
                          )}
                        </div>
                      </div>
                      {/* By action */}
                      <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
                        <div className="p-4 pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-foreground">By action</div>
                              <div className="mt-1 text-xs text-muted-foreground">Distribution by action</div>
                            </div>
                            <div className="text-[11px] text-muted-foreground tabular-nums">{cardsAll.length}</div>
                          </div>
                        </div>
                        <div className="px-4 pb-4">
                        {(() => {
                          const actionColors: Record<string, string> = {
                            login: 'hsl(199 89% 48%)',
                            create: 'hsl(142 71% 45%)',
                            update: 'hsl(262 83% 58%)',
                            delete: 'hsl(0 84% 60%)',
                            failed_login: 'hsl(346 77% 49%)',
                            notification: 'hsl(38 92% 50%)',
                          }

                          const actionData = actionTotals.map(({ k, n }) => ({
                            key: k,
                            name: actionLabel[k],
                            value: n,
                          }))

                          return (
                            <div className="mt-3 space-y-3">
                              {actionTotals.every((x) => x.n === 0) ? (
                                <div className="text-sm text-muted-foreground">{t('activity.feed.empty')}</div>
                              ) : (
                                <>
                                  <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                                    <div className="text-[11px] text-muted-foreground">Click a bar to view all results</div>
                                    <div className="mt-2 h-48">
                                      <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                          data={[...actionData].sort((a, b) => b.value - a.value)}
                                          layout="vertical"
                                          margin={{ top: 4, right: 18, left: 6, bottom: 4 }}
                                          barCategoryGap={10}
                                        >
                                          <CartesianGrid
                                            stroke="hsl(var(--border))"
                                            strokeOpacity={0.22}
                                            horizontal={false}
                                          />
                                          <XAxis type="number" hide domain={[0, 'dataMax + 1']} />
                                          <YAxis
                                            type="category"
                                            dataKey="name"
                                            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                            tickLine={false}
                                            axisLine={false}
                                            width={106}
                                          />
                                          <Tooltip
                                            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.28 }}
                                            content={({ active, payload }: any) => {
                                              if (!active || !payload || payload.length === 0) return null
                                              const p = payload[0]?.payload
                                              const name = String(p?.name ?? '')
                                              const v = typeof p?.value === 'number' ? p.value : 0
                                              return (
                                                <div className="rounded-xl border border-border bg-popover px-3 py-2 shadow-lg">
                                                  <div className="text-xs font-semibold text-foreground truncate">{name}</div>
                                                  <div className="mt-1 text-xs text-muted-foreground">
                                                    Total: <span className="font-medium text-foreground tabular-nums">{v}</span>
                                                  </div>
                                                </div>
                                              )
                                            }}
                                          />
                                          <Bar
                                            dataKey="value"
                                            radius={[7, 7, 7, 7]}
                                            maxBarSize={22}
                                            background={{ fill: 'hsl(var(--border))', fillOpacity: 0.18, radius: 7 }}
                                            onClick={(e: any) => {
                                              const key = e?.payload?.key as string | undefined
                                              const v = typeof e?.payload?.value === 'number' ? e.payload.value : 0
                                              if (!key || !v) return
                                              setSelectedActionKey(key)
                                              setInsightsModal({ type: 'action', key })
                                              setInsightsModalPage(1)
                                            }}
                                          >
                                            {[...actionData].sort((a, b) => b.value - a.value).map((d) => (
                                              <Cell
                                                key={d.key}
                                                fill={actionColors[d.key] || 'hsl(var(--primary))'}
                                                fillOpacity={
                                                  selectedActionKey ? (selectedActionKey === d.key ? 0.9 : 0.2) : 0.62
                                                }
                                                style={{ cursor: d.value > 0 ? 'pointer' : 'default' }}
                                              />
                                            ))}
                                            <LabelList
                                              dataKey="value"
                                              position="right"
                                              formatter={(v: any) => (typeof v === 'number' && v > 0 ? String(v) : '')}
                                              className="fill-foreground/80"
                                              fontSize={11}
                                            />
                                          </Bar>
                                        </BarChart>
                                      </ResponsiveContainer>
                                    </div>
                                  </div>

                                </>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
                </div>

                {insightsModal &&
                  createPortal(
                    (() => {
                      const title =
                        insightsModal.type === 'domain'
                          ? categoryLabels[insightsModal.key]
                          : (actionLabel as Record<string, string>)[insightsModal.key] ?? insightsModal.key

                      const isLoginAggregation =
                        insightsModal.type === 'action' && String(insightsModal.key).toLowerCase() === 'login'

                      type LoginAggRow = { actor: string; count: number; lastTs: string }

                      const loginAgg: LoginAggRow[] = isLoginAggregation
                        ? (() => {
                            const m = new Map<string, { actor: string; count: number; lastMs: number; lastTs: string }>()
                            cardsAll.forEach((c) => {
                              if (c.kind !== 'access') return
                              if (String(c.action).toLowerCase() !== 'login') return
                              const actor = (c.actor || '—').toString().trim() || '—'
                              const ms = new Date(c.ts).getTime()
                              const entry = m.get(actor) || { actor, count: 0, lastMs: -1, lastTs: c.ts }
                              entry.count += 1
                              if (Number.isFinite(ms) && ms > entry.lastMs) {
                                entry.lastMs = ms
                                entry.lastTs = c.ts
                              }
                              m.set(actor, entry)
                            })
                            const arr = Array.from(m.values()).map((x) => ({ actor: x.actor, count: x.count, lastTs: x.lastTs }))
                            arr.sort((a, b) => (b.count - a.count) || (new Date(b.lastTs).getTime() - new Date(a.lastTs).getTime()))
                            return arr
                          })()
                        : []

                      const list = isLoginAggregation
                        ? []
                        : insightsModal.type === 'domain'
                          ? cardsAll.filter((c) => c.category === insightsModal.key)
                          : cardsAll.filter((c) => c.action === insightsModal.key)

                      const total = isLoginAggregation ? loginAgg.length : list.length
                      const totalPages = Math.max(1, Math.ceil(total / insightsModalPerPage))
                      const page = Math.min(insightsModalPage, totalPages)
                      const start = (page - 1) * insightsModalPerPage
                      const pageItemsAgg: LoginAggRow[] = isLoginAggregation
                        ? loginAgg.slice(start, start + insightsModalPerPage)
                        : []
                      const pageItemsCards: ActivityFeedCard[] = isLoginAggregation
                        ? []
                        : (list.slice(start, start + insightsModalPerPage) as ActivityFeedCard[])

                      return (
                        <div
                          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
                          onClick={() => {
                            setInsightsModal(null)
                            setSelectedDomain(null)
                            setSelectedActionKey(null)
                          }}
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="insights-dialog-title"
                        >
                          <div
                            className="bg-card border border-border rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-between gap-3 p-4 border-b border-border shrink-0">
                              <div>
                                <h2 id="insights-dialog-title" className="text-lg font-semibold text-foreground">
                                  {isLoginAggregation ? `${title} (by user)` : title}
                                </h2>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                  Total:{' '}
                                  <span className="font-medium text-foreground tabular-nums">{total}</span>
                                  {isLoginAggregation ? ' Users' : ''}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setInsightsModal(null)
                                  setSelectedDomain(null)
                                  setSelectedActionKey(null)
                                }}
                                aria-label="Close"
                              >
                                <X className="h-5 w-5" />
                              </Button>
                            </div>
                            <div className="p-4 overflow-auto flex-1 min-h-0">
                              {total === 0 ? (
                                <p className="text-sm text-muted-foreground py-6 text-center">{t('activity.feed.empty')}</p>
                              ) : (
                                isLoginAggregation ? (
                                  <div className="overflow-x-auto table-wrap table-wrapper">
                                    <table className="w-full border-collapse text-sm min-w-[520px]">
                                      <thead>
                                        <tr className="border-b border-border">
                                          <th className="text-left p-3 font-medium">User</th>
                                          <th className="text-right p-3 font-medium">Logins</th>
                                          <th className="text-left p-3 font-medium">Last login</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {pageItemsAgg.map((r) => (
                                          <tr key={r.actor} className="border-b border-border/70">
                                            <td className="p-3">{r.actor}</td>
                                            <td className="p-3 text-right tabular-nums">{r.count}</td>
                                            <td className="p-3 whitespace-nowrap text-muted-foreground">{formatDateTime24(r.lastTs)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {pageItemsCards.map((c) => {
                                      const isAudit = c.kind === 'audit'
                                      const entityLine = [c.entityType, c.entityId].filter(Boolean).join(' · ')
                                      return (
                                        <button
                                          key={c.id}
                                          type="button"
                                          onClick={() => {
                                            if (isAudit) setSelectedAuditRow(c.row as AuditLogEntry)
                                          }}
                                          className={cn(
                                            'w-full text-left rounded-lg border border-border/60 bg-background/40 px-3 py-2 transition-colors',
                                            'hover:bg-muted/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                            !isAudit && 'cursor-default'
                                          )}
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium', badgeClass(c))}>
                                              {getActivityLabel(c)}
                                            </span>
                                            <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime24(c.ts)}</span>
                                          </div>
                                          <div className="mt-1 text-sm font-medium text-foreground truncate">{c.title}</div>
                                          <div className="mt-0.5 text-xs text-muted-foreground truncate">
                                            {c.actor}
                                            <span className="mx-1 text-muted-foreground/60">•</span>
                                            <span className="font-mono">{entityLine || '—'}</span>
                                          </div>
                                        </button>
                                      )
                                    })}
                                  </div>
                                )
                              )}
                            </div>
                            {total > 0 && (
                              <div className="p-3 border-t border-border shrink-0">
                                <TablePagination
                                  total={total}
                                  page={page}
                                  perPage={insightsModalPerPage}
                                  onPageChange={setInsightsModalPage}
                                  onPerPageChange={(n) => {
                                    setInsightsModalPerPage(n)
                                    setInsightsModalPage(1)
                                  }}
                                  pageSizeOptions={[10, 25, 50]}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })(),
                    document.body
                  )}
                </>
              )
            })()}
            {activityLoading && activityItems.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <RefreshCw className="h-8 w-8 animate-spin" />
              </div>
            ) : activityItems.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">{t('audit.noResults')}</p>
            ) : null}
          </CardContent>
        </Card>
        </>
      )}

      {latestActivityDetailsOpen && latestImportant &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
            onClick={() => setLatestActivityDetailsOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="latest-activity-title"
          >
            <div
              className="bg-card border border-border rounded-xl shadow-lg max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2 p-4 border-b border-border">
                <h2 id="latest-activity-title" className="text-base font-semibold text-foreground">Latest important activity</h2>
                <Button variant="ghost" size="icon" onClick={() => setLatestActivityDetailsOpen(false)} aria-label="Close">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="p-4 space-y-3 text-sm">
                <div><span className="text-muted-foreground">Message: </span><span className="text-foreground">{latestImportant.message}</span></div>
                <div><span className="text-muted-foreground">Actor: </span><span className="text-foreground">{latestImportant.actor}</span></div>
                <div><span className="text-muted-foreground">Type: </span><span className="text-foreground">{latestImportant.eventType}</span></div>
                <div><span className="text-muted-foreground">When: </span><span className="text-foreground">{formatDateTime24(latestImportant.ts)}</span></div>
                <div><span className="text-muted-foreground">Module: </span><span className="text-foreground font-mono">{latestImportant.entity}</span></div>
                <div><span className="text-muted-foreground">Summary: </span><span className="text-foreground">{latestImportant.summary}</span></div>
              </div>
              <div className="p-4 border-t border-border flex items-center justify-end gap-2">
                {latestImportant.kind === 'audit' ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedAuditRow(latestImportant.row as AuditLogEntry)
                      setLatestActivityDetailsOpen(false)
                    }}
                  >
                    Inspect log entry
                  </Button>
                ) : null}
                <Button onClick={() => setLatestActivityDetailsOpen(false)}>Close</Button>
              </div>
            </div>
          </div>,
          document.body
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
                  const s = getAuditLogDetailSections(selectedAuditRow, t, (value: unknown) => formatDateTime24(value as DateInput))
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
