import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Pencil, Users, UserPlus, X } from 'lucide-react'
import { canManagePartnerUsers } from '../lib/permissions'
import { useAuth } from '../context/AuthContext'
import { usePermission } from '../hooks/usePermission'
import { useTranslation } from '../context/LanguageContext'
import {
  getPartnerUsers,
  createPartnerUser,
  updatePartnerUser,
  deletePartnerUser,
  type PartnerUser,
} from '../services/api'

const ROLE_OPTIONS: { value: number; labelKey: string; user_type: string }[] = [
  { value: 1, labelKey: 'users.admin', user_type: 'admin' },
  { value: 2, labelKey: 'users.operator', user_type: 'operator' },
  { value: 4, labelKey: 'users.manager', user_type: 'operator' },
  { value: 5, labelKey: 'users.engineer', user_type: 'operator' },
  { value: 6, labelKey: 'users.accountant', user_type: 'accountant' },
]

export default function PartnerUsers() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const roleOptions = ROLE_OPTIONS.map((opt) => ({ value: opt.value, label: t(opt.labelKey), user_type: opt.user_type }))
  /** Role label for display (by role_id); used in table so Engineer shows as "Engineer" not "Operator". */
  const getRoleLabel = (roleId: number) => {
    const opt = ROLE_OPTIONS.find((o) => o.value === roleId)
    return opt ? t(opt.labelKey) : String(roleId)
  }
  const canWriteUsers = usePermission('users.manage', 'RW')
  const legacyCanManage = canManagePartnerUsers(user?.role_name)
  const showWriteUi = canWriteUsers || legacyCanManage
  const writeActionsEnabled = canWriteUsers
  const [list, setList] = useState<PartnerUser[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [addOpen, setAddOpen] = useState(false)
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
  const [form, setForm] = useState({
    f_name: '',
    l_name: '',
    mobile: '',
    email: '',
    role_id: 2,
    user_type: 'operator',
    password: '',
  })

  const orgId = user?.organization_id

  /** @param silent If true, fetch in background without setting loading state — keeps page stable (AJAX refresh). */
  const loadUsers = (forceRefresh = false, silent = false) => {
    if (orgId == null) return
    if (!silent) setLoading(true)
    getPartnerUsers(orgId, forceRefresh ? { skipCache: true } : undefined)
      .then((res) => {
        if (res.success && res.data) setList(Array.isArray(res.data) ? res.data : [])
        else setList([])
      })
      .catch(() => setList([]))
      .finally(() => { if (!silent) setLoading(false) })
  }

  useEffect(() => {
    loadUsers()
  }, [orgId])

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId) return
    setMessage('')
    if (!form.f_name.trim() || !form.l_name.trim()) {
      setMessage(t('users.required'))
      return
    }
    if (!form.mobile.trim() || form.mobile.trim().length < 10) {
      setMessage(t('users.mobileRequired'))
      return
    }
    if (!form.password || form.password.length < 8) {
      setMessage(t('users.passwordRequired'))
      return
    }
    setSubmitting(true)
    createPartnerUser({
      organization_id: orgId,
      f_name: form.f_name.trim(),
      l_name: form.l_name.trim(),
      mobile: form.mobile.trim(),
      role_id: form.role_id,
      user_type: form.user_type,
      password: form.password,
      email: form.email.trim() || undefined,
    })
      .then((res) => {
        if (res.success) {
          setAddOpen(false)
          setForm({ f_name: '', l_name: '', mobile: '', email: '', role_id: 2, user_type: 'operator', password: '' })
          loadUsers(true, true)
          setMessage('')
        } else {
          const apiMsg = (res as { message?: string }).message || ''
          const isDuplicateMobile =
            /mobile number already registered|already exists|duplicate/i.test(apiMsg)
          setMessage(isDuplicateMobile ? t('users.mobileAlreadyExists') : apiMsg || t('users.addUserFailed'))
        }
      })
      .catch(() => setMessage(t('users.requestFailed')))
      .finally(() => setSubmitting(false))
  }

  const handleRoleChange = (roleId: number) => {
    const opt = ROLE_OPTIONS.find((o) => o.value === roleId)
    setForm((f) => ({ ...f, role_id: roleId, user_type: opt?.user_type ?? 'operator' }))
  }

  const openEdit = (u: PartnerUser) => {
    setEditingUser(u)
    setEditForm({
      f_name: u.f_name || '',
      l_name: u.l_name || '',
      mobile: u.mobile || '',
      email: u.email || '',
      role_id: u.role_id ?? 2,
      user_type: u.user_type || 'operator',
      password: '',
    })
    setEditOpen(true)
    setMessage('')
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
    updatePartnerUser(editingUser.user_id, body)
      .then((res) => {
        if (res.success) {
          setEditOpen(false)
          setEditingUser(null)
          loadUsers(true, true)
          setMessage('')
        } else {
          setMessage((res as { message?: string }).message || 'Failed to update user.')
        }
      })
      .catch(() => setMessage('Request failed.'))
      .finally(() => setSubmitting(false))
  }

  const handleDelete = (userId: number) => {
    if (!confirm('Remove this user from the organization?')) return
    deletePartnerUser(userId)
      .then((res) => {
        if (res.success) loadUsers(true, true)
        else setMessage((res as { message?: string }).message || 'Delete failed.')
      })
      .catch(() => setMessage('Request failed.'))
  }

  return (
    <div className="space-y-6 text-start">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('users.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('users.subtitle')}
        </p>
      </div>

      {showWriteUi && (
        <Card className="border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-5 w-5" />
              {t('users.addUser')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              disabled={!writeActionsEnabled}
              title={!writeActionsEnabled ? t('common.readOnlyAccess') : undefined}
              onClick={() => writeActionsEnabled && setAddOpen(true)}
            >
              {t('users.addUser')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add user modal – rendered in body to cover full viewport and avoid white strip */}
      {addOpen && createPortal(
        <div
          className="fixed inset-0 top-0 left-0 right-0 bottom-0 min-h-[100dvh] min-h-[100vh] z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
          onClick={() => !submitting && setAddOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-user-title"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl p-6 transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UserPlus className="h-5 w-5" />
              </div>
              <h2 id="add-user-title" className="text-lg font-bold text-foreground">
                {t('users.addUser')}
              </h2>
            </div>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pu-fname">{t('users.firstName')}</Label>
                  <Input
                    id="pu-fname"
                    value={form.f_name}
                    onChange={(e) => setForm((f) => ({ ...f, f_name: e.target.value }))}
                    placeholder={t('users.placeholderFirstName')}
                    required
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pu-lname">{t('users.lastName')}</Label>
                  <Input
                    id="pu-lname"
                    value={form.l_name}
                    onChange={(e) => setForm((f) => ({ ...f, l_name: e.target.value }))}
                    placeholder={t('users.placeholderLastName')}
                    required
                    className="rounded-lg"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pu-mobile">{t('users.mobileMinChars')}</Label>
                <Input
                  id="pu-mobile"
                  value={form.mobile}
                  onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                  placeholder={t('users.placeholderMobile')}
                  required
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pu-email">{t('users.emailOptional')}</Label>
                <Input
                  id="pu-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder={t('users.placeholderEmail')}
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('users.role')}</Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  value={form.role_id}
                  onChange={(e) => handleRoleChange(Number(e.target.value))}
                >
                  {roleOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pu-password">{t('users.passwordMinChars')}</Label>
                <Input
                  id="pu-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder={t('users.placeholderPassword')}
                  required
                  minLength={8}
                  className="rounded-lg"
                />
              </div>
              {message && <p className="text-sm text-destructive">{message}</p>}
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting} className="flex-1 rounded-lg">
                  {submitting ? t('common.loading') : t('users.addUser')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddOpen(false)}
                  disabled={submitting}
                  className="rounded-lg"
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {editOpen && editingUser && createPortal(
        <div
          className="fixed inset-0 top-0 left-0 right-0 bottom-0 min-h-[100dvh] min-h-[100vh] z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
          onClick={() => !submitting && (setEditOpen(false), setEditingUser(null))}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-user-title"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl p-6 transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 mb-6">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Pencil className="h-5 w-5" />
                </div>
                <h2 id="edit-user-title" className="text-lg font-bold text-foreground">
                  {t('users.editUser')}
                </h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => !submitting && (setEditOpen(false), setEditingUser(null))}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-fname">{t('users.firstName')}</Label>
                  <Input
                    id="edit-fname"
                    value={editForm.f_name}
                    onChange={(e) => setEditForm((f) => ({ ...f, f_name: e.target.value }))}
                    placeholder={t('users.placeholderFirstName')}
                    required
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-lname">{t('users.lastName')}</Label>
                  <Input
                    id="edit-lname"
                    value={editForm.l_name}
                    onChange={(e) => setEditForm((f) => ({ ...f, l_name: e.target.value }))}
                    placeholder={t('users.placeholderLastName')}
                    required
                    className="rounded-lg"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-mobile">{t('users.mobileMinChars')}</Label>
                <Input
                  id="edit-mobile"
                  value={editForm.mobile}
                  onChange={(e) => setEditForm((f) => ({ ...f, mobile: e.target.value }))}
                  placeholder={t('users.placeholderMobile')}
                  required
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">{t('users.emailOptional')}</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder={t('users.placeholderEmail')}
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('users.role')}</Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  value={editForm.role_id}
                  onChange={(e) => handleEditRoleChange(Number(e.target.value))}
                >
                  {roleOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-password">{t('users.newPasswordOptional')}</Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder={t('users.placeholderNewPassword')}
                  minLength={8}
                  className="rounded-lg"
                />
              </div>
              {message && <p className="text-sm text-destructive">{message}</p>}
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting} className="flex-1 rounded-lg">
                  {submitting ? t('support.saving') : t('support.saveChanges')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => !submitting && (setEditOpen(false), setEditingUser(null))}
                  disabled={submitting}
                  className="rounded-lg"
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      <Card className="border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5" />
            {t('users.inYourOrg')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
            </div>
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No users found for this organization.</p>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden table-wrap table-wrapper">
              <table className="w-full text-sm border-collapse min-w-[640px]">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-start py-3 px-4 font-semibold">{t('list.name')}</th>
                    <th className="text-start py-3 px-4 font-semibold">{t('users.mobile')}</th>
                    <th className="text-start py-3 px-4 font-semibold">{t('users.email')}</th>
                    <th className="text-start py-3 px-4 font-semibold">{t('users.role')}</th>
                    {showWriteUi && <th className="text-end py-3 px-4 font-semibold">{t('users.actions')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {list.map((u) => (
                    <tr key={u.user_id} className="border-b border-border/80 last:border-0 hover:bg-muted/20">
                      <td className="py-3 px-4 font-medium">
                        {u.f_name} {u.l_name}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{u.mobile}</td>
                      <td className="py-3 px-4 text-muted-foreground">{u.email ?? '—'}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                          {getRoleLabel(u.role_id ?? 2)}
                        </span>
                      </td>
                      {showWriteUi && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8"
                              disabled={!writeActionsEnabled}
                              title={!writeActionsEnabled ? t('common.readOnlyAccess') : 'Edit'}
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
                              onClick={() => writeActionsEnabled && handleDelete(u.user_id)}
                            >
                              {t('support.remove')}
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
