import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Share2, Plus, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { EmptyState } from '../components/EmptyState'
import { PageTabs } from '../components/PageTabs'
import { AppSelect } from '../components/shared/AppSelect'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { cn } from '../lib/utils'
import { formatDate } from '../lib/dateFormat'
import {
  createGrant,
  getGrants,
  revokeGrant,
  type Grant,
} from '../services/api'

type TabId = 'incoming' | 'outgoing'
type ScopeType = Grant['scope_type']

const SCOPE_OPTIONS: { value: ScopeType; labelKey: string }[] = [
  { value: 'organization', labelKey: 'grants.scope.organization' },
  { value: 'location', labelKey: 'grants.scope.location' },
  { value: 'charger', labelKey: 'grants.scope.charger' },
]

type CreateFormState = {
  grantee_organization_id: string
  scope_type: ScopeType
  target_organization_id: string
  target_location_id: string
  target_charger_id: string
  can_view: boolean
  can_view_bills: boolean
  can_manage: boolean
  can_operate: boolean
  starts_at: string
  ends_at: string
}

const defaultCreateForm = (): CreateFormState => ({
  grantee_organization_id: '',
  scope_type: 'organization',
  target_organization_id: '',
  target_location_id: '',
  target_charger_id: '',
  can_view: true,
  can_view_bills: false,
  can_manage: false,
  can_operate: false,
  starts_at: '',
  ends_at: '',
})

function isPlatformAdmin(roleName: string | undefined): boolean {
  const r = (roleName || '').toLowerCase().trim()
  return (
    r === 'admin' ||
    r === 'owner' ||
    r === 'platform_admin' ||
    r === 'platform admin' ||
    r.includes('admin') ||
    r.includes('owner')
  )
}

function flagOn(v: number | undefined): boolean {
  return Number(v) === 1
}

function grantResourceLabel(g: Grant): string {
  if (g.scope_type === 'charger') {
    return g.target_charger_name?.trim() || (g.target_charger_id != null ? `Charger ${g.target_charger_id}` : '—')
  }
  if (g.scope_type === 'location') {
    return g.target_location_name?.trim() || (g.target_location_id != null ? `Location ${g.target_location_id}` : '—')
  }
  return g.target_org_name?.trim() || (g.target_organization_id != null ? `Org ${g.target_organization_id}` : '—')
}

function isGrantIncoming(g: Grant, orgId: number): boolean {
  return g.grantee_organization_id === orgId
}

function isGrantOutgoing(g: Grant, orgId: number): boolean {
  if (g.scope_type === 'organization') {
    return g.target_organization_id === orgId
  }
  if (g.target_organization_id != null) {
    return g.target_organization_id === orgId
  }
  return false
}

function formatPeriod(starts?: string | null, ends?: string | null): string {
  const s = starts ? formatDate(starts) : '—'
  const e = ends ? formatDate(ends) : '—'
  return `${s} → ${e}`
}

function PermissionBadges({ grant, t }: { grant: Grant; t: (k: string) => string }) {
  const items: { key: string; label: string; className: string }[] = []
  if (flagOn(grant.can_view)) {
    items.push({
      key: 'view',
      label: t('grants.perm.view'),
      className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
    })
  }
  if (flagOn(grant.can_view_bills)) {
    items.push({
      key: 'bills',
      label: t('grants.perm.bills'),
      className: 'bg-green-500/15 text-green-700 dark:text-green-400',
    })
  }
  if (flagOn(grant.can_manage)) {
    items.push({
      key: 'manage',
      label: t('grants.perm.manage'),
      className: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
    })
  }
  if (flagOn(grant.can_operate)) {
    items.push({
      key: 'operate',
      label: t('grants.perm.operate'),
      className: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
    })
  }
  if (items.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span
          key={item.key}
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
            item.className,
          )}
        >
          {item.label}
        </span>
      ))}
    </div>
  )
}

export default function Grants() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const orgId = user?.organization_id
  const platformAdmin = isPlatformAdmin(user?.role_name)

  const [activeTab, setActiveTab] = useState<TabId>('incoming')
  const [allGrants, setAllGrants] = useState<Grant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateFormState>(() => defaultCreateForm())
  const [submitting, setSubmitting] = useState(false)
  const [revokingId, setRevokingId] = useState<number | null>(null)

  const scopeSelectOptions = useMemo(
    () => SCOPE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) })),
    [t],
  )

  const tabs = useMemo(
    () => [
      { id: 'incoming' as const, label: t('grants.tab.incoming') },
      { id: 'outgoing' as const, label: t('grants.tab.outgoing') },
    ],
    [t],
  )

  const loadGrants = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    getGrants()
      .then((res) => {
        const data = (res as { data?: Grant[] }).data
        setAllGrants(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        setAllGrants([])
        setError('Failed to load grants')
      })
      .finally(() => {
        if (!silent) setLoading(false)
      })
  }, [])

  useEffect(() => {
    loadGrants()
  }, [loadGrants])

  const incomingGrants = useMemo(() => {
    if (orgId == null) return []
    return allGrants.filter((g) => isGrantIncoming(g, orgId))
  }, [allGrants, orgId])

  const outgoingGrants = useMemo(() => {
    if (orgId == null) return []
    return allGrants.filter((g) => isGrantOutgoing(g, orgId))
  }, [allGrants, orgId])

  const displayedGrants = activeTab === 'incoming' ? incomingGrants : outgoingGrants

  const closeCreateModal = () => {
    if (submitting) return
    setCreateOpen(false)
    setCreateForm(defaultCreateForm())
    setMessage('')
  }

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    const granteeId = Number(createForm.grantee_organization_id.trim())
    if (!Number.isInteger(granteeId) || granteeId <= 0) {
      setMessage('Grantee organization ID is required')
      return
    }

    const body: Parameters<typeof createGrant>[0] = {
      grantee_organization_id: granteeId,
      scope_type: createForm.scope_type,
      can_view: createForm.can_view,
      can_view_bills: createForm.can_view_bills,
      can_manage: createForm.can_manage,
      can_operate: createForm.can_operate,
      starts_at: createForm.starts_at.trim() || null,
      ends_at: createForm.ends_at.trim() || null,
    }

    if (createForm.scope_type === 'organization') {
      const targetOrgId = Number(createForm.target_organization_id.trim())
      if (!Number.isInteger(targetOrgId) || targetOrgId <= 0) {
        setMessage('Target organization ID is required')
        return
      }
      body.target_organization_id = targetOrgId
    } else if (createForm.scope_type === 'location') {
      const targetLocId = Number(createForm.target_location_id.trim())
      if (!Number.isInteger(targetLocId) || targetLocId <= 0) {
        setMessage('Target location ID is required')
        return
      }
      body.target_location_id = targetLocId
    } else {
      const targetChargerId = Number(createForm.target_charger_id.trim())
      if (!Number.isInteger(targetChargerId) || targetChargerId <= 0) {
        setMessage('Target charger ID is required')
        return
      }
      body.target_charger_id = targetChargerId
    }

    setSubmitting(true)
    createGrant(body)
      .then((res) => {
        if (res.success) {
          closeCreateModal()
          loadGrants(true)
        } else {
          setMessage((res as { message?: string }).message || 'Failed to create grant')
        }
      })
      .catch(() => setMessage('Request failed'))
      .finally(() => setSubmitting(false))
  }

  const handleRevoke = (grant: Grant) => {
    if (!platformAdmin) return
    if (!confirm(`Revoke grant #${grant.id}? This will disable access for the grantee organization.`)) return
    setRevokingId(grant.id)
    revokeGrant(grant.id)
      .then((res) => {
        if (res.success) loadGrants(true)
        else setError((res as { message?: string }).message || 'Failed to revoke grant')
      })
      .catch(() => setError('Failed to revoke grant'))
      .finally(() => setRevokingId(null))
  }

  const renderTable = (rows: Grant[], showActions: boolean) => {
    if (rows.length === 0) {
      return (
        <EmptyState
          icon={<Share2 className="h-16 w-16 stroke-[1.5]" />}
          title={t('grants.empty')}
          className="py-12"
        />
      )
    }

    return (
      <div className="rounded-xl border border-border overflow-hidden table-wrap table-wrapper">
        <table className="w-full text-sm border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              <th className="text-start py-3 px-4 font-semibold">{t('grants.col.resource')}</th>
              <th className="text-start py-3 px-4 font-semibold">{t('grants.col.scope')}</th>
              <th className="text-start py-3 px-4 font-semibold">{t('grants.col.permissions')}</th>
              <th className="text-start py-3 px-4 font-semibold">{t('grants.col.period')}</th>
              <th className="text-start py-3 px-4 font-semibold">{t('grants.col.status')}</th>
              {showActions ? (
                <th className="text-end py-3 px-4 font-semibold">{t('grants.col.actions')}</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr
                key={g.id}
                className="border-b border-border/80 last:border-0 hover:bg-muted/20"
              >
                <td className="py-3 px-4 font-medium text-foreground">{grantResourceLabel(g)}</td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium capitalize text-foreground">
                    {t(`grants.scope.${g.scope_type}`)}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <PermissionBadges grant={g} t={t} />
                </td>
                <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                  {formatPeriod(g.starts_at, g.ends_at)}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      g.status === 'active'
                        ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {g.status === 'active' ? t('grants.status.active') : t('grants.status.disabled')}
                  </span>
                </td>
                {showActions ? (
                  <td className="py-3 px-4 text-end">
                    {platformAdmin && g.status === 'active' ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-destructive hover:text-destructive"
                        disabled={revokingId === g.id}
                        onClick={() => handleRevoke(g)}
                      >
                        {t('grants.revoke')}
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-6 text-start">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('grants.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('grants.subtitle')}</p>
      </div>

      <PageTabs tabs={tabs} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as TabId)} />

      <Card className="border border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Share2 className="h-5 w-5" />
              {activeTab === 'incoming' ? t('grants.tab.incoming') : t('grants.tab.outgoing')}
            </CardTitle>
            {platformAdmin && activeTab === 'outgoing' ? (
              <Button type="button" className="shrink-0" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                {t('grants.newGrant')}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {error ? <p className="text-sm text-destructive py-2 mb-2">{error}</p> : null}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
                aria-hidden
              />
            </div>
          ) : (
            renderTable(displayedGrants, activeTab === 'outgoing')
          )}
        </CardContent>
      </Card>

      {createOpen &&
        createPortal(
          <div
            className="fixed inset-0 top-0 left-0 right-0 bottom-0 min-h-[100dvh] min-h-[100vh] z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
            onClick={() => !submitting && closeCreateModal()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-grant-title"
          >
            <div
              className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl p-6 transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2 mb-6">
                <h2 id="create-grant-title" className="text-lg font-bold text-foreground">
                  {t('grants.newGrant')}
                </h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={closeCreateModal}
                  disabled={submitting}
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="grantee-org-id">{t('grants.granteeOrgId')}</Label>
                  <Input
                    id="grantee-org-id"
                    inputMode="numeric"
                    value={createForm.grantee_organization_id}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, grantee_organization_id: e.target.value }))
                    }
                    placeholder="e.g. 42"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('grants.scopeType')}</Label>
                  <AppSelect
                    options={scopeSelectOptions}
                    value={createForm.scope_type}
                    onChange={(v) => setCreateForm((f) => ({ ...f, scope_type: v as ScopeType }))}
                    className="bg-background"
                  />
                </div>

                {createForm.scope_type === 'organization' ? (
                  <div className="space-y-2">
                    <Label htmlFor="target-org-id">{t('grants.targetOrgId')}</Label>
                    <Input
                      id="target-org-id"
                      inputMode="numeric"
                      value={createForm.target_organization_id}
                      onChange={(e) =>
                        setCreateForm((f) => ({ ...f, target_organization_id: e.target.value }))
                      }
                      required
                    />
                  </div>
                ) : null}

                {createForm.scope_type === 'location' ? (
                  <div className="space-y-2">
                    <Label htmlFor="target-loc-id">{t('grants.targetLocationId')}</Label>
                    <Input
                      id="target-loc-id"
                      inputMode="numeric"
                      value={createForm.target_location_id}
                      onChange={(e) =>
                        setCreateForm((f) => ({ ...f, target_location_id: e.target.value }))
                      }
                      required
                    />
                  </div>
                ) : null}

                {createForm.scope_type === 'charger' ? (
                  <div className="space-y-2">
                    <Label htmlFor="target-charger-id">{t('grants.targetChargerId')}</Label>
                    <Input
                      id="target-charger-id"
                      inputMode="numeric"
                      value={createForm.target_charger_id}
                      onChange={(e) =>
                        setCreateForm((f) => ({ ...f, target_charger_id: e.target.value }))
                      }
                      required
                    />
                  </div>
                ) : null}

                <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">{t('grants.col.permissions')}</p>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={createForm.can_view}
                      onChange={(e) => setCreateForm((f) => ({ ...f, can_view: e.target.checked }))}
                    />
                    {t('grants.canView')}
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={createForm.can_view_bills}
                      onChange={(e) =>
                        setCreateForm((f) => ({ ...f, can_view_bills: e.target.checked }))
                      }
                    />
                    {t('grants.canViewBills')}
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={createForm.can_manage}
                      onChange={(e) => setCreateForm((f) => ({ ...f, can_manage: e.target.checked }))}
                    />
                    {t('grants.canManage')}
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={createForm.can_operate}
                      onChange={(e) => setCreateForm((f) => ({ ...f, can_operate: e.target.checked }))}
                    />
                    {t('grants.canOperate')}
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="starts-at">{t('grants.startsAt')}</Label>
                    <Input
                      id="starts-at"
                      type="date"
                      value={createForm.starts_at}
                      onChange={(e) => setCreateForm((f) => ({ ...f, starts_at: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ends-at">{t('grants.endsAt')}</Label>
                    <Input
                      id="ends-at"
                      type="date"
                      value={createForm.ends_at}
                      onChange={(e) => setCreateForm((f) => ({ ...f, ends_at: e.target.value }))}
                    />
                  </div>
                </div>

                {message ? <p className="text-sm text-destructive">{message}</p> : null}

                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={submitting} className="flex-1 rounded-lg">
                    {submitting ? t('common.loading') : t('grants.createGrant')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeCreateModal}
                    disabled={submitting}
                    className="rounded-lg"
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
