import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, CreditCard, Pencil, Plus, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Switch } from '../ui/switch'
import { EmptyState } from '../EmptyState'
import { AppSelect } from '../shared/AppSelect'
import { cn } from '../../lib/utils'
import { getLocationsBizId } from '../../hooks/useAccessibleOrgs'
import type { AccessibleOrg } from '../../types/org'
import { useTranslation } from '../../context/LanguageContext'
import { useToast } from '../../contexts/ToastContext'
import { hasWritePermission } from '../../lib/permissions'
import { useAuth } from '../../context/AuthContext'
import {
  clearGetCache,
  deleteRfidUser,
  getRfidUsers,
  setRfidUserEnabled,
  type RfidStatus,
  type RfidUser,
} from '../../services/api'
import { RFID_STATUSES } from '../../lib/rfidUserFormValidation'
import { RfidUserFormModal } from './RfidUserFormModal'
import { RfidEnableDisableDialog } from './RfidEnableDisableDialog'
import { formatDateTime } from '../../lib/dateFormat'

function formatStat(value: number | null | undefined, decimals = 0): string {
  if (value == null || Number.isNaN(value) || value === 0) return '—'
  return decimals > 0 ? value.toFixed(decimals) : String(value)
}

function statusBadgeClass(status: RfidStatus): string {
  switch (status) {
    case 'active':
      return 'bg-green-500/15 text-green-700 dark:text-green-400'
    case 'disabled':
      return 'bg-red-500/15 text-red-700 dark:text-red-400'
    case 'suspended':
      return 'bg-orange-500/15 text-orange-700 dark:text-orange-400'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-b border-border/80">
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="py-3 px-3">
              <div className="h-4 bg-muted/60 rounded animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export type RfidUsersTabProps = {
  orgsLoading: boolean
  selectedOrgPK: number | null
  selectedOrg: AccessibleOrg | null
  orgs: AccessibleOrg[]
  ownOrg: AccessibleOrg | null
}

export function RfidUsersTab({
  orgsLoading,
  selectedOrgPK,
  selectedOrg,
  orgs,
  ownOrg,
}: RfidUsersTabProps) {
  const { permissions } = useAuth()
  const { t } = useTranslation()
  const { pushToast } = useToast()
  const isReadOnly = selectedOrg?.access_type === 'grant'
  const canEdit = hasWritePermission(permissions, 'rfid.edit')
  const showWriteUi = !isReadOnly && canEdit
  const showActionsColumn = showWriteUi || isReadOnly

  const activeOrg = useMemo((): AccessibleOrg | null => {
    if (orgs.length === 0) return null
    if (selectedOrgPK == null) return ownOrg
    return orgs.find((o) => o.id === selectedOrgPK) ?? ownOrg
  }, [orgs, selectedOrgPK, ownOrg])

  const activeOrgPK = activeOrg?.id ?? null
  const locationsBizId = getLocationsBizId(activeOrg, ownOrg)

  const [list, setList] = useState<RfidUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editingUser, setEditingUser] = useState<RfidUser | null>(null)
  const [toggleUser, setToggleUser] = useState<RfidUser | null>(null)
  const [toggleEnabling, setToggleEnabling] = useState(false)
  const [toggleSubmitting, setToggleSubmitting] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setSearchDebounced(search.trim()), 300)
    return () => window.clearTimeout(id)
  }, [search])

  const loadList = useCallback(
    (silent = false) => {
      if (orgsLoading || activeOrgPK == null) return
      if (!silent) setLoading(true)
      getRfidUsers(activeOrgPK, {
        q: searchDebounced || undefined,
        status: statusFilter,
        skipCache: true,
      })
        .then((res) => {
          const data = (res as { data?: RfidUser[] }).data
          setList(Array.isArray(data) ? data : [])
        })
        .catch(() => setList([]))
        .finally(() => {
          if (!silent) setLoading(false)
        })
    },
    [orgsLoading, activeOrgPK, searchDebounced, statusFilter],
  )

  useEffect(() => {
    if (orgsLoading || activeOrgPK == null) return

    clearGetCache()

    let cancelled = false
    setLoading(true)

    getRfidUsers(activeOrgPK, {
      q: searchDebounced || undefined,
      status: statusFilter,
      skipCache: true,
    })
      .then((res) => {
        if (cancelled) return
        const data = (res as { data?: RfidUser[] }).data
        setList(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setList([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [orgsLoading, selectedOrgPK, activeOrgPK, searchDebounced, statusFilter])

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('rfid.filterAll') },
      ...RFID_STATUSES.map((s) => ({ value: s, label: t(`rfid.status.${s}`) })),
    ],
    [t],
  )

  const openCreate = () => {
    if (isReadOnly) return
    setFormMode('create')
    setEditingUser(null)
    setFormOpen(true)
  }

  const openEdit = (u: RfidUser) => {
    if (isReadOnly) return
    setFormMode('edit')
    setEditingUser(u)
    setFormOpen(true)
  }

  const handleToggleClick = (u: RfidUser) => {
    if (isReadOnly || !canEdit) return
    setToggleUser(u)
    setToggleEnabling(u.status !== 'active')
  }

  const handleToggleConfirm = (reason?: string) => {
    if (isReadOnly || !toggleUser) return
    setToggleSubmitting(true)
    const enabling = toggleEnabling
    setRfidUserEnabled(toggleUser.id, { enabled: enabling, reason })
      .then((res) => {
        if (res.success) {
          setList((prev) =>
            prev.map((row) =>
              row.id === toggleUser.id
                ? {
                    ...row,
                    status: enabling ? 'active' : 'disabled',
                    disabled_at: enabling ? null : new Date().toISOString(),
                    disabled_reason: enabling ? null : reason ?? null,
                  }
                : row,
            ),
          )
          setToggleUser(null)
          pushToast(enabling ? t('rfid.enabledSuccess') : t('rfid.disabledSuccess'), '')
          loadList(true)
        } else {
          pushToast(t('common.error'), (res as { message?: string }).message || t('users.requestFailed'))
        }
      })
      .catch(() => pushToast(t('common.error'), t('users.requestFailed')))
      .finally(() => setToggleSubmitting(false))
  }

  const handleDelete = (u: RfidUser) => {
    if (isReadOnly) return
    if (!confirm(t('rfid.deleteConfirm'))) return
    deleteRfidUser(u.id)
      .then((res) => {
        if (res.success) {
          loadList(true)
          pushToast(t('rfid.deletedSuccess'), '')
        } else {
          pushToast(t('common.error'), (res as { message?: string }).message || t('users.requestFailed'))
        }
      })
      .catch(() => pushToast(t('common.error'), t('users.requestFailed')))
  }

  const colCount = showActionsColumn ? 8 : 7

  return (
    <>
      <Card className="border border-border">
        <CardHeader className="pb-2 space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">{t('users.tabRfidTitle')}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{t('users.tabRfidSubtitle')}</p>
            </div>
            {showWriteUi ? (
              <Button type="button" className="shrink-0 gap-2" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                {t('users.addRfidUser')}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('rfid.searchPlaceholder')}
                className="pl-9 rounded-lg"
              />
            </div>
            <div className="w-full sm:w-44">
              <AppSelect
                options={statusOptions}
                value={statusFilter}
                onChange={setStatusFilter}
                placeholder={t('rfid.status')}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isReadOnly ? (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
              <p className="flex items-start gap-2">
                <BookOpen className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
                <span>{t('users.rfidGrantReadOnly')}</span>
              </p>
            </div>
          ) : null}
          {loading ? (
            <div className="rounded-xl border border-border overflow-x-auto table-wrap">
              <table className="w-full text-sm border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-start py-3 px-3 font-semibold">{t('rfid.uid')}</th>
                    <th className="text-start py-3 px-3 font-semibold">{t('list.name')}</th>
                    <th className="text-start py-3 px-3 font-semibold">{t('rfid.cardType')}</th>
                    <th className="text-start py-3 px-3 font-semibold">{t('rfid.status')}</th>
                    <th className="text-end py-3 px-3 font-semibold">{t('rfid.sessions')}</th>
                    <th className="text-end py-3 px-3 font-semibold">{t('rfid.totalKwh')}</th>
                    <th className="text-end py-3 px-3 font-semibold">{t('rfid.totalAmount')}</th>
                    {showActionsColumn ? (
                      <th className="text-end py-3 px-3 font-semibold">{t('users.actions')}</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  <TableSkeleton cols={colCount} />
                </tbody>
              </table>
            </div>
          ) : list.length === 0 ? (
            <EmptyState
              title={t('rfid.emptyTitle')}
              description={t('rfid.emptyDescription')}
              icon={<CreditCard className="h-12 w-12" />}
              actionLabel={showWriteUi ? t('users.addRfidUser') : undefined}
              onAction={showWriteUi ? openCreate : undefined}
            />
          ) : (
            <div className="rounded-xl border border-border overflow-x-auto table-wrap">
              <table className="w-full text-sm border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-start py-3 px-3 font-semibold">{t('rfid.uid')}</th>
                    <th className="text-start py-3 px-3 font-semibold">{t('list.name')}</th>
                    <th className="text-start py-3 px-3 font-semibold">{t('rfid.cardType')}</th>
                    <th className="text-start py-3 px-3 font-semibold">{t('rfid.status')}</th>
                    <th className="text-end py-3 px-3 font-semibold">{t('rfid.sessions')}</th>
                    <th className="text-end py-3 px-3 font-semibold">{t('rfid.totalKwh')}</th>
                    <th className="text-end py-3 px-3 font-semibold">{t('rfid.totalAmount')}</th>
                    {showActionsColumn ? (
                      <th className="text-end py-3 px-3 font-semibold">{t('users.actions')}</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {list.map((u) => {
                    const name = `${u.first_name} ${u.last_name}`.trim() || '—'
                    const isActive = u.status === 'active'
                    const toggleTitle =
                      u.status === 'disabled' && u.disabled_reason
                        ? `${u.disabled_reason}${u.disabled_at ? ` · ${formatDateTime(u.disabled_at)}` : ''}`
                        : undefined
                    return (
                      <tr key={u.id} className="border-b border-border/80 last:border-0 hover:bg-muted/20">
                        <td className="py-3 px-3 font-mono text-xs font-medium">{u.rfid_uid}</td>
                        <td className="py-3 px-3 font-medium">{name}</td>
                        <td className="py-3 px-3">{t('rfid.cardType.customer')}</td>
                        <td className="py-3 px-3">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                              statusBadgeClass(u.status),
                            )}
                          >
                            {t(`rfid.status.${u.status}`)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-end tabular-nums">{formatStat(u.sessions_count)}</td>
                        <td className="py-3 px-3 text-end tabular-nums">{formatStat(u.total_kwh, 2)}</td>
                        <td className="py-3 px-3 text-end tabular-nums">{formatStat(u.total_amount, 2)}</td>
                        {showActionsColumn ? (
                          <td className="py-3 px-3 text-end">
                            {isReadOnly ? (
                              <span className="text-xs text-muted-foreground italic">{t('common.viewOnly')}</span>
                            ) : showWriteUi ? (
                              <div className="flex items-center justify-end gap-2">
                                <span title={toggleTitle} className="inline-flex items-center">
                                  <Switch
                                    checked={isActive}
                                    onCheckedChange={() => handleToggleClick(u)}
                                    aria-label={isActive ? t('rfid.disableAction') : t('rfid.enableAction')}
                                  />
                                </span>
                                <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => openEdit(u)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-destructive hover:text-destructive"
                                  onClick={() => handleDelete(u)}
                                >
                                  {t('support.remove')}
                                </Button>
                              </div>
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <RfidUserFormModal
        open={formOpen}
        mode={formMode}
        organizationId={locationsBizId}
        editingUser={editingUser}
        onOpenChange={setFormOpen}
        onSuccess={() => {
          loadList(true)
          pushToast(formMode === 'edit' ? t('rfid.updatedSuccess') : t('rfid.createdSuccess'), '')
        }}
      />

      <RfidEnableDisableDialog
        open={toggleUser != null}
        user={toggleUser}
        enabling={toggleEnabling}
        submitting={toggleSubmitting}
        onOpenChange={(open) => {
          if (!open) setToggleUser(null)
        }}
        onConfirm={handleToggleConfirm}
      />
    </>
  )
}
