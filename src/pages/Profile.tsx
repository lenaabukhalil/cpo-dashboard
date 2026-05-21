import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { User, Mail, Phone, Shield } from 'lucide-react'
import { updateProfile, changePassword, me, getToken } from '../services/api'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'

interface ProfileProps {
  /** When true, do not show the page title (e.g. when embedded in Settings) */
  embedded?: boolean
}

export default function Profile({ embedded }: ProfileProps) {
  const { user, setUser, logout } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    f_name: String(user?.f_name ?? ''),
    l_name: String(user?.l_name ?? ''),
    email: String(user?.email ?? ''),
    mobile: String(user?.mobile ?? ''),
  })

  const openEdit = () => {
    setForm({
      f_name: String(user?.f_name ?? ''),
      l_name: String(user?.l_name ?? ''),
      email: String(user?.email ?? ''),
      mobile: String(user?.mobile ?? ''),
    })
    setMessage('')
    setEditOpen(true)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!getToken()) {
      setMessage(t('profile.sessionExpired'))
      return
    }
    setSubmitting(true)
    setMessage('')
    updateProfile({
      f_name: String(form.f_name ?? '').trim(),
      l_name: String(form.l_name ?? '').trim(),
      email: String(form.email ?? '').trim(),
      mobile: String(form.mobile ?? '').trim(),
    })
      .then((r) => {
        if (r.success) {
          // Update UI immediately with the values we just saved (API /me may still return JWT-cached data)
          const savedUser = user ? {
            ...user,
            f_name: String(form.f_name ?? '').trim(),
            l_name: String(form.l_name ?? '').trim(),
            email: String(form.email ?? '').trim(),
            mobile: String(form.mobile ?? '').trim(),
          } : null
          if (savedUser) setUser(savedUser)
          setEditOpen(false)
          // Optionally refresh from server (when GET /me reads from DB, this will keep everything in sync)
          me({ skipCache: true }).then((res) => {
            const updated = (res as { user?: typeof user }).user ?? (res as { data?: { user?: typeof user } }).data?.user
            if (res.success && updated) setUser(updated)
          }).catch(() => {})
          return
        }

        const err = r as { message?: string; details?: string; error?: string }
        const text = err.details || err.error || err.message || t('profile.updateFailed')
        const isExpired = /expired|TokenExpiredError|jwt expired/i.test(text)
        if (isExpired) {
          setMessage(t('profile.sessionExpired'))
          logout()
          navigate('/login')
          return
        }
        setMessage(text)
      })
      .catch(() => setMessage(t('profile.requestFailed')))
      .finally(() => setSubmitting(false))
  }

  const fullName = user
    ? `${user.f_name || ''} ${user.l_name || ''}`.trim() || '—'
    : '—'
  const fName = user && user.f_name
  const lName = user && user.l_name
  const first = fName ? fName[0] : null
  const last = lName ? lName[0] : null
  const initials =
    first && last
      ? (first + last).toUpperCase()
      : first
      ? first.toUpperCase()
      : (user && user.mobile && user.mobile[0]) || '?'

  const avatarUrl = user && user.profile_img_url ? user.profile_img_url : null

  const cancelEdit = () => {
    setEditOpen(false)
    setMessage('')
    setForm({
      f_name: String(user?.f_name ?? ''),
      l_name: String(user?.l_name ?? ''),
      email: String(user?.email ?? ''),
      mobile: String(user?.mobile ?? ''),
    })
  }

  const [passwordOpen, setPasswordOpen] = useState(false)
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_new_password: '',
  })

  const resetPasswordForm = () => ({
    current_password: '',
    new_password: '',
    confirm_new_password: '',
  })

  const openPassword = () => {
    setPasswordForm(resetPasswordForm())
    setPasswordMessage('')
    setPasswordSuccess(false)
    setPasswordOpen(true)
  }

  const cancelPassword = () => {
    setPasswordOpen(false)
    setPasswordMessage('')
    setPasswordSuccess(false)
    setPasswordForm(resetPasswordForm())
  }

  const handlePasswordSave = (e: React.FormEvent) => {
    e.preventDefault()
    const { current_password, new_password, confirm_new_password } = passwordForm
    if (!current_password.trim() || !new_password.trim() || !confirm_new_password.trim()) {
      setPasswordSuccess(false)
      setPasswordMessage(t('profile.passwordFieldsRequired'))
      return
    }
    if (new_password.length < 8) {
      setPasswordSuccess(false)
      setPasswordMessage(t('profile.passwordMinLength'))
      return
    }
    if (new_password !== confirm_new_password) {
      setPasswordSuccess(false)
      setPasswordMessage(t('profile.passwordMismatch'))
      return
    }
    if (!getToken()) {
      setPasswordSuccess(false)
      setPasswordMessage(t('profile.sessionExpired'))
      return
    }
    setPasswordSubmitting(true)
    setPasswordMessage('')
    changePassword({
      current_password: current_password.trim(),
      new_password: new_password.trim(),
    })
      .then((r) => {
        if (r.success) {
          setPasswordOpen(false)
          setPasswordForm(resetPasswordForm())
          setPasswordSuccess(true)
          setPasswordMessage(r.message || t('profile.passwordChangeSuccess'))
          return
        }
        setPasswordSuccess(false)
        const err = r as { message?: string; details?: string; error?: string }
        const text = err.details || err.error || err.message || t('profile.passwordChangeFailed')
        const isExpired = /expired|TokenExpiredError|jwt expired/i.test(text)
        if (isExpired) {
          setPasswordMessage(t('profile.sessionExpired'))
          logout()
          navigate('/login')
          return
        }
        setPasswordMessage(text)
      })
      .catch(() => {
        setPasswordSuccess(false)
        setPasswordMessage(t('profile.requestFailed'))
      })
      .finally(() => setPasswordSubmitting(false))
  }

  return (
    <div className="space-y-6 text-start">
      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('profile.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('profile.subtitle')}</p>
        </div>
      )}

      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="text-xl">{t('profile.userInfo')}</CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">{t('profile.accountDetails')}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-20 w-20 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                <span className="text-xl font-semibold text-muted-foreground">{initials}</span>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <span className="text-2xl font-bold text-foreground">
                {editOpen ? `${form.f_name} ${form.l_name}`.trim() || fullName : fullName}
              </span>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-500" aria-hidden />
                <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-sm font-medium text-foreground">
                  {(user && user.role_name) || '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-6" />

          {editOpen ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="profile-fname">{t('org.firstName')}</Label>
                  <Input
                    id="profile-fname"
                    value={form.f_name}
                    onChange={(e) => setForm((f) => ({ ...f, f_name: e.target.value }))}
                    className="bg-muted/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-lname">{t('org.lastName')}</Label>
                  <Input
                    id="profile-lname"
                    value={form.l_name}
                    onChange={(e) => setForm((f) => ({ ...f, l_name: e.target.value }))}
                    className="bg-muted/50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-email">{t('users.email')}</Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-phone">{t('org.phoneNumber')}</Label>
                <Input
                  id="profile-phone"
                  type="tel"
                  value={form.mobile}
                  onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                  className="bg-muted/50"
                  placeholder="+962..."
                />
              </div>
              {message && <p className="text-sm text-destructive">{message}</p>}
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={cancelEdit} disabled={submitting}>
                  {t('users.cancel')}
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? t('settings.saving') : t('users.save')}
                </Button>
              </div>
            </form>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-5">
                  <div className="flex gap-3">
                    <User className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">{t('org.firstName')}</p>
                      <p className="mt-0.5 font-medium text-foreground">{(user && user.f_name) || '—'}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <User className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">{t('org.lastName')}</p>
                      <p className="mt-0.5 font-medium text-foreground">{(user && user.l_name) || '—'}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Phone className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">{t('org.phoneNumber')}</p>
                      <p className="mt-0.5 font-medium text-foreground">{(user && user.mobile) || '—'}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-5">
                  <div className="flex gap-3">
                    <Mail className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">{t('users.email')}</p>
                      <p className="mt-0.5 font-medium text-foreground">{(user && user.email) || '—'}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Shield className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">{t('users.role')}</p>
                      <p className="mt-0.5 font-medium text-foreground">{(user && user.role_name) || '—'}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-2">
                <Button type="button" variant="outline" onClick={openEdit}>
                  {t('profile.editProfile')}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="text-xl">{t('profile.changePassword')}</CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">{t('profile.changePasswordSubtitle')}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {passwordMessage && !passwordOpen && (
            <p className={`text-sm ${passwordSuccess ? 'text-green-600 dark:text-green-500' : 'text-destructive'}`}>
              {passwordMessage}
            </p>
          )}
          {passwordOpen ? (
            <form onSubmit={handlePasswordSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profile-current-password">{t('profile.currentPassword')}</Label>
                <Input
                  id="profile-current-password"
                  type="password"
                  autoComplete="current-password"
                  value={passwordForm.current_password}
                  onChange={(e) => setPasswordForm((f) => ({ ...f, current_password: e.target.value }))}
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-new-password">{t('profile.newPassword')}</Label>
                <Input
                  id="profile-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm((f) => ({ ...f, new_password: e.target.value }))}
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-confirm-password">{t('profile.confirmNewPassword')}</Label>
                <Input
                  id="profile-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.confirm_new_password}
                  onChange={(e) => setPasswordForm((f) => ({ ...f, confirm_new_password: e.target.value }))}
                  className="bg-muted/50"
                />
              </div>
              {passwordMessage && (
                <p className="text-sm text-destructive">{passwordMessage}</p>
              )}
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={cancelPassword} disabled={passwordSubmitting}>
                  {t('users.cancel')}
                </Button>
                <Button type="submit" disabled={passwordSubmitting}>
                  {passwordSubmitting ? t('settings.saving') : t('users.save')}
                </Button>
              </div>
            </form>
          ) : (
            <Button type="button" variant="outline" onClick={openPassword}>
              {t('profile.changePassword')}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
