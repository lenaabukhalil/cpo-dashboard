import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Eye, EyeOff, Pencil, Plus, Users, X } from 'lucide-react'
import { EmptyState } from '../EmptyState'
import { canManagePartnerUsers, hasWritePermission } from '../../lib/permissions'
import { useAuth } from '../../context/AuthContext'
import { useTranslation } from '../../context/LanguageContext'
import {
  getPartnerUsers,
  createPartnerUser,
  getRoles,
  type RbacRole,
  updatePartnerUser,
  deletePartnerUser,
  type PartnerUser,
} from '../../services/api'
import { useToast } from '../../contexts/ToastContext'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import {
  defaultAddPartnerUserFormValues,
  stripMobileDigits,
  validateAddPartnerUserForm,
  USER_TYPE_OPTIONS,
  type AddPartnerUserFormValues,
  type PartnerUserType,
} from '../../lib/partnerUserFormValidation'

const ROLE_OPTIONS: { value: number; labelKey: string; user_type: string }[] = [
  { value: 1, labelKey: 'users.admin', user_type: 'admin' },
  { value: 2, labelKey: 'users.operator', user_type: 'operator' },
  { value: 4, labelKey: 'users.manager', user_type: 'operator' },
  { value: 5, labelKey: 'users.engineer', user_type: 'operator' },
  { value: 6, labelKey: 'users.accountant', user_type: 'accountant' },
]

function partnerUserId(u: PartnerUser): number {
  return u.user_id ?? u.id ?? 0
}

function formatPartnerUserName(user: PartnerUser): string {
  const full = `${user.first_name ?? user.f_name ?? ''} ${user.last_name ?? user.l_name ?? ''}`.trim()
  return full || '—'
}

function formatPartnerUserRole(user: PartnerUser): string {
  if (user.role_name?.trim()) return user.role_name.trim()
  if (user.user_type?.trim()) {
    const t = user.user_type.trim()
    return t.charAt(0).toUpperCase() + t.slice(1)
  }
  return '—'
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-border/80">
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="py-3 px-4">
              <div className="h-4 bg-muted/60 rounded animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function PartnerUsersTab() {
  const { user, permissions } = useAuth()
  const { t } = useTranslation()
  const { pushToast } = useToast()
  const roleOptions = ROLE_OPTIONS.map((opt) => ({ value: opt.value, label: t(opt.labelKey), user_type: opt.user_type }))
  const canCreateUsers = hasWritePermission(permissions, 'users.manage')
  const legacyCanManage = canManagePartnerUsers(user?.role_name)
  const showWriteUi = canCreateUsers || legacyCanManage
  const writeActionsEnabled = canCreateUsers

  const [list, setList] = useState<PartnerUser[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [roles, setRoles] = useState<RbacRole[] | null>(null)
  const [rolesLoading, setRolesLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [addValues, setAddValues] = useState<AddPartnerUserFormValues>(() => defaultAddPartnerUserFormValues())
  const [addErrors, setAddErrors] = useState<Partial<Record<keyof AddPartnerUserFormValues, string>>>({})
  const [editOpen, setEditOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<PartnerUser | null>(null)
  const [editForm, setEditForm] = useState({
    f_name: '',
    l_name: '',
    mobile: '',
    email: '',
    role_id: 2,
    user_type: 'operator',
    password: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const orgId = user?.organization_id

  const loadUsers = (forceRefresh = false, silent = false) => {
    if (orgId == null) return
    if (!silent) setLoading(true)
    getPartnerUsers(orgId, forceRefresh ? { skipCache: true } : undefined)
      .then((res) => {
        if (res.success && res.data) setList(Array.isArray(res.data) ? res.data : [])
        else setList([])
      })
      .catch(() => setList([]))
      .finally(() => {
        if (!silent) setLoading(false)
      })
  }

  useEffect(() => {
    loadUsers()
  }, [orgId])

  const loadRolesOnce = async () => {
    if (roles || rolesLoading) return
    setRolesLoading(true)
    try {
      const list = await getRoles()
      setRoles(Array.isArray(list) ? list : [])
    } finally {
      setRolesLoading(false)
    }
  }

  const closeAddDialog = () => {
    if (submitting) return
    setAddOpen(false)
    setAddValues(defaultAddPartnerUserFormValues())
    setAddErrors({})
    setShowPassword(false)
    setMessage('')
  }

  const currentValidation = useMemo(() => validateAddPartnerUserForm(addValues), [addValues])
  const canSubmitAdd = !submitting && canCreateUsers && Object.keys(currentValidation).length === 0

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canCreateUsers) return
    setMessage('')

    const nextErrors = validateAddPartnerUserForm(addValues)
    setAddErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    const mobileDigits = stripMobileDigits(addValues.mobile)
    createPartnerUser({
      first_name: addValues.first_name.trim(),
      last_name: addValues.last_name.trim(),
      country_code: Number(addValues.country_code),
      mobile: mobileDigits,
      email: addValues.email.trim(),
      password: addValues.password,
      role_id: Number(addValues.role_id),
      user_type: addValues.user_type,
    })
      .then((res) => {
        if (res.success) {
          closeAddDialog()
          loadUsers(true, true)
          pushToast(t('users.partnerCreated'), '')
        } else {
          const apiMsg = (res as { message?: string }).message || ''
          const status = (res as { statusCode?: number }).statusCode
          if (status === 403) {
            pushToast(t('common.readOnlyAccess'), t('users.addUserFailed'))
            closeAddDialog()
            return
          }
          if (status === 400 && /mobile|duplicate|already/i.test(apiMsg)) {
            setAddErrors((prev) => ({ ...prev, mobile: t('users.mobileAlreadyExists') }))
            return
          }
          pushToast(t('common.error'), apiMsg || t('users.addUserFailed'))
        }
      })
      .catch(() => pushToast(t('common.error'), t('users.requestFailed')))
      .finally(() => setSubmitting(false))
  }

  const openEdit = (u: PartnerUser) => {
    setEditingUser(u)
    setEditForm({
      f_name: u.first_name ?? u.f_name ?? '',
      l_name: u.last_name ?? u.l_name ?? '',
      mobile: u.mobile || '',
      email: u.email || '',
      role_id: u.role_id ?? 2,
      user_type: u.user_type || 'operator',
      password: '',
    })
    setEditOpen(true)
    setMessage('')
    void loadRolesOnce()
  }

  const handleEditRoleChange = (roleId: number) => {
    const opt = ROLE_OPTIONS.find((o) => o.value === roleId)
    setEditForm((f) => ({ ...f, role_id: roleId, user_type: opt?.user_type ?? 'operator' }))
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    setMessage('')
    if (!editForm.f_name.trim() || !editForm.l_name.trim()) {
      setMessage(t('users.required'))
      return
    }
    if (!editForm.mobile.trim() || editForm.mobile.trim().length < 10) {
      setMessage(t('users.mobileRequired'))
      return
    }
    setSubmitting(true)
    const body: Parameters<typeof updatePartnerUser>[1] = {
      f_name: editForm.f_name.trim(),
      l_name: editForm.l_name.trim(),
      mobile: editForm.mobile.trim(),
      email: editForm.email.trim() || undefined,
      role_id: editForm.role_id,
      user_type: editForm.user_type,
    }
    if (editForm.password && editForm.password.length >= 8) body.password = editForm.password
    updatePartnerUser(partnerUserId(editingUser), body)
      .then((res) => {
        if (res.success) {
          setEditOpen(false)
          setEditingUser(null)
          loadUsers(true, true)
          pushToast(t('users.partnerUpdated'), '')
        } else {
          setMessage((res as { message?: string }).message || t('users.updateFailed'))
        }
      })
      .catch(() => setMessage(t('users.requestFailed')))
      .finally(() => setSubmitting(false))
  }

  const handleDelete = (userId: number) => {
    if (!confirm(t('users.removeConfirm'))) return
    deletePartnerUser(userId)
      .then((res) => {
        if (res.success) {
          loadUsers(true, true)
          pushToast(t('users.partnerRemoved'), '')
        } else {
          pushToast(t('common.error'), (res as { message?: string }).message || t('users.deleteFailed'))
        }
      })
      .catch(() => pushToast(t('common.error'), t('users.requestFailed')))
  }

  const colCount = showWriteUi ? 5 : 4

  return (
    <>
      <Card className="border border-border">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">{t('users.tabPartnerTitle')}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{t('users.tabPartnerSubtitle')}</p>
            </div>
            {canCreateUsers ? (
              <Button
                type="button"
                className="shrink-0 gap-2"
                onClick={() => {
                  setAddOpen(true)
                  void loadRolesOnce()
                }}
              >
                <Plus className="h-4 w-4" />
                {t('users.addPartnerUser')}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="rounded-xl border border-border overflow-hidden table-wrap table-wrapper">
              <table className="w-full text-sm border-collapse min-w-[640px]">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-start py-3 px-4 font-semibold">{t('list.name')}</th>
                    <th className="text-start py-3 px-4 font-semibold">{t('users.mobile')}</th>
                    <th className="text-start py-3 px-4 font-semibold">{t('users.email')}</th>
                    <th className="text-start py-3 px-4 font-semibold">{t('users.role')}</th>
                    {showWriteUi ? (
                      <th className="text-end py-3 px-4 font-semibold">{t('users.actions')}</th>
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
              title={t('users.partnerEmptyTitle')}
              description={t('users.partnerEmptyDescription')}
              icon={<Users className="h-12 w-12" />}
              actionLabel={canCreateUsers ? t('users.addPartnerUser') : undefined}
              onAction={canCreateUsers ? () => setAddOpen(true) : undefined}
            />
          ) : (
            <div className="rounded-xl border border-border overflow-hidden table-wrap table-wrapper">
              <table className="w-full text-sm border-collapse min-w-[640px]">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-start py-3 px-4 font-semibold">{t('list.name')}</th>
                    <th className="text-start py-3 px-4 font-semibold">{t('users.mobile')}</th>
                    <th className="text-start py-3 px-4 font-semibold">{t('users.email')}</th>
                    <th className="text-start py-3 px-4 font-semibold">{t('users.role')}</th>
                    {showWriteUi ? (
                      <th className="text-end py-3 px-4 font-semibold">{t('users.actions')}</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {list.map((u, index) => (
                    <tr
                      key={partnerUserId(u) || u.email?.trim() || index}
                      className="border-b border-border/80 last:border-0 hover:bg-muted/20"
                    >
                      <td className="py-3 px-4 font-medium">{formatPartnerUserName(u)}</td>
                      <td className="py-3 px-4 text-muted-foreground">{u.mobile}</td>
                      <td className="py-3 px-4 text-muted-foreground">{u.email ?? '—'}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                          {formatPartnerUserRole(u)}
                        </span>
                      </td>
                      {showWriteUi ? (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8"
                              disabled={!writeActionsEnabled}
                              title={!writeActionsEnabled ? t('common.readOnlyAccess') : t('users.editUser')}
                              onClick={() => writeActionsEnabled && openEdit(u)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 text-destructive hover:text-destructive"
                              disabled={!writeActionsEnabled}
                              title={!writeActionsEnabled ? t('common.readOnlyAccess') : t('support.remove')}
                              onClick={() => writeActionsEnabled && handleDelete(partnerUserId(u))}
                            >
                              {t('support.remove')}
                            </Button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {editOpen && editingUser && createPortal(
        <div
          className="fixed inset-0 top-0 left-0 right-0 bottom-0 min-h-[100dvh] min-h-[100vh] z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
          onClick={() => !submitting && (setEditOpen(false), setEditingUser(null))}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 mb-6">
              <h2 className="text-lg font-bold text-foreground">{t('users.editUser')}</h2>
              <Button type="button" variant="ghost" size="icon" onClick={() => !submitting && (setEditOpen(false), setEditingUser(null))}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-fname">{t('users.firstName')}</Label>
                  <Input id="edit-fname" value={editForm.f_name} onChange={(e) => setEditForm((f) => ({ ...f, f_name: e.target.value }))} required className="rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-lname">{t('users.lastName')}</Label>
                  <Input id="edit-lname" value={editForm.l_name} onChange={(e) => setEditForm((f) => ({ ...f, l_name: e.target.value }))} required className="rounded-lg" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-mobile">{t('users.mobileMinChars')}</Label>
                <Input id="edit-mobile" value={editForm.mobile} onChange={(e) => setEditForm((f) => ({ ...f, mobile: e.target.value }))} required className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">{t('users.emailOptional')}</Label>
                <Input id="edit-email" type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label>{t('users.role')}</Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  value={editForm.role_id}
                  onChange={(e) => handleEditRoleChange(Number(e.target.value))}
                >
                  {(roles ?? []).length > 0
                    ? (roles ?? []).map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))
                    : roleOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-password">{t('users.newPasswordOptional')}</Label>
                <Input id="edit-password" type="password" autoComplete="new-password" value={editForm.password} onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))} minLength={8} className="rounded-lg" />
              </div>
              {message ? <p className="text-sm text-destructive">{message}</p> : null}
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting} className="flex-1 rounded-lg">
                  {submitting ? t('support.saving') : t('support.saveChanges')}
                </Button>
                <Button type="button" variant="outline" onClick={() => !submitting && (setEditOpen(false), setEditingUser(null))} disabled={submitting}>
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      <Dialog open={addOpen} onOpenChange={(open) => { if (!open) closeAddDialog(); else setAddOpen(true) }}>
        <DialogContent showClose className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('users.addPartnerUser')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pu-first_name">{t('users.firstName')}</Label>
                <Input id="pu-first_name" value={addValues.first_name} onChange={(e) => setAddValues((v) => ({ ...v, first_name: e.target.value }))} />
                {addErrors.first_name ? <p className="text-sm text-destructive">{addErrors.first_name}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="pu-last_name">{t('users.lastName')}</Label>
                <Input id="pu-last_name" value={addValues.last_name} onChange={(e) => setAddValues((v) => ({ ...v, last_name: e.target.value }))} />
                {addErrors.last_name ? <p className="text-sm text-destructive">{addErrors.last_name}</p> : null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pu-country_code">{t('rfid.countryCode')}</Label>
                <Input id="pu-country_code" inputMode="numeric" value={addValues.country_code} onChange={(e) => setAddValues((v) => ({ ...v, country_code: stripMobileDigits(e.target.value) }))} />
                {addErrors.country_code ? <p className="text-sm text-destructive">{addErrors.country_code}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="pu-mobile">{t('users.mobile')}</Label>
                <Input id="pu-mobile" inputMode="numeric" value={addValues.mobile} onChange={(e) => setAddValues((v) => ({ ...v, mobile: stripMobileDigits(e.target.value) }))} />
                {addErrors.mobile ? <p className="text-sm text-destructive">{addErrors.mobile}</p> : null}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pu-email">{t('users.email')}</Label>
              <Input id="pu-email" type="email" value={addValues.email} onChange={(e) => setAddValues((v) => ({ ...v, email: e.target.value }))} />
              {addErrors.email ? <p className="text-sm text-destructive">{addErrors.email}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pu-password">{t('users.password')}</Label>
              <div className="relative">
                <Input id="pu-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={addValues.password} onChange={(e) => setAddValues((v) => ({ ...v, password: e.target.value }))} />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {addErrors.password ? <p className="text-sm text-destructive">{addErrors.password}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pu-role_id">{t('users.role')}</Label>
              <select id="pu-role_id" className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={addValues.role_id} onChange={(e) => setAddValues((v) => ({ ...v, role_id: e.target.value }))} disabled={rolesLoading}>
                <option value="">{rolesLoading ? '…' : t('users.selectRole')}</option>
                {(roles ?? []).map((r) => (
                  <option key={r.id} value={String(r.id)}>{r.name}</option>
                ))}
              </select>
              {addErrors.role_id ? <p className="text-sm text-destructive">{addErrors.role_id}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pu-user_type">User type</Label>
              <select id="pu-user_type" className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={addValues.user_type} onChange={(e) => setAddValues((v) => ({ ...v, user_type: e.target.value as PartnerUserType }))}>
                {USER_TYPE_OPTIONS.map((ut) => (
                  <option key={ut} value={ut}>{ut}</option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeAddDialog} disabled={submitting}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={!canSubmitAdd}>{submitting ? t('support.saving') : t('users.createUser')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
