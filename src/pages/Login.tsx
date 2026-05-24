import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useTheme } from 'next-themes'
import { Eye, EyeOff, Languages, Sun, Moon, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLanguage, useTranslation } from '../context/LanguageContext'
import { login, type AuthUser, type PermissionMap } from '../services/api'
import { getDefaultHomePath } from '../config/sidebar'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { cn } from '../lib/utils'

const ION_HALF_LOGO = '/half-logo.png'

type ErrorState = { type: 'key'; key: string } | { type: 'raw'; text: string } | null

export default function Login() {
  const { user, setAuth } = useAuth()
  const { t } = useTranslation()
  const { locale, setLocale } = useLanguage()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<ErrorState>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  if (user) return <Navigate to={getDefaultHomePath(user.role_code, user.role_name)} replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    let id = identifier.trim().replace(/\s+/g, '')
    if (!id.includes('@') && id.length >= 8) {
      if (!id.startsWith('+')) id = '+' + id
    }
    const res = await login(id || identifier.trim(), password)
    setLoading(false)
    const err = res as { message?: string; details?: string; error?: string; statusCode?: number }
    const msgLow = (res.message || '').toLowerCase()
    if (err.statusCode === 504 || res.message === 'Request timed out') {
      setError({ type: 'key', key: 'login.errorServiceSlow' })
      return
    }
    if (
      !err.statusCode &&
      (msgLow.includes('failed to fetch') || msgLow.includes('network error') || msgLow.includes('load failed'))
    ) {
      setError({ type: 'key', key: 'login.errorServiceSlow' })
      return
    }
    const token = (res as { token?: string }).token ?? (res as { data?: { token?: string } }).data?.token
    const userObj = (res as { user?: unknown }).user ?? (res as { data?: { user?: unknown } }).data?.user
    const perms =
      (res as { permissions?: PermissionMap }).permissions ??
      (res as { data?: { permissions?: PermissionMap } }).data?.permissions ??
      {}
    if (res.success && token) {
      localStorage.setItem('cpo_token', token)
      if (userObj) {
        const authUser = userObj as AuthUser
        setAuth(authUser, perms)
        navigate(getDefaultHomePath(authUser.role_code, authUser.role_name))
      } else {
        setAuth(null)
        navigate('/')
      }
    } else {
      const apiMsg = (err.message || err.error || err.details || '').trim().toLowerCase()
      const isCredentialError =
        apiMsg.includes('invalid email') ||
        apiMsg.includes('user not found') ||
        apiMsg.includes('wrong password') ||
        apiMsg.includes('invalid password') ||
        apiMsg.includes('invalid credentials') ||
        err.statusCode === 401
      if (isCredentialError) {
        setError({ type: 'key', key: 'login.errorInvalidCredentials' })
      } else {
        const fallbackText = (err.message || err.error || err.details || '').trim()
        if (fallbackText) {
          setError({ type: 'raw', text: fallbackText })
        } else {
          setError({ type: 'key', key: 'login.errorGeneric' })
        }
      }
    }
  }

  const inputRing =
    'transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

  const displayedError = error
    ? error.type === 'key'
      ? t(error.key)
      : error.text
    : ''

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-blue-100/60 px-4 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="absolute end-4 top-4 z-10 flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full hover:bg-muted"
          onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
          aria-label={locale === 'ar' ? 'English' : 'العربية'}
        >
          <Languages className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full hover:bg-muted"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          <Sun className="absolute h-4 w-4 scale-0 transition-all dark:scale-100" />
          <Moon className="h-4 w-4 scale-100 transition-all dark:scale-0" />
        </Button>
      </div>

      <div className="relative w-full max-w-sm">
        <div className="absolute -top-5 left-1/2 z-10 -translate-x-1/2">
          <img
            src={ION_HALF_LOGO}
            alt="ION"
            className="h-8 w-auto object-contain drop-shadow-[0_1px_4px_rgba(59,130,246,0.2)] dark:drop-shadow-[0_1px_6px_rgba(96,165,250,0.35)]"
          />
        </div>

        <Card className="relative rounded-2xl border border-border/60 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="space-y-6 p-8 pt-12">
            <div className="space-y-1.5 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {t('login.welcomeBack')}
              </h1>
              <p className="text-sm text-muted-foreground">{t('login.subtitle')}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identifier" className="text-sm font-medium">
                  {t('login.identifier')}
                </Label>
                <Input
                  id="identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value)
                    if (error) setError(null)
                  }}
                  placeholder={t('login.placeholderIdentifier')}
                  required
                  aria-invalid={!!displayedError}
                  aria-describedby={displayedError ? 'login-error' : undefined}
                  className={cn(
                    'border-input dark:border-slate-700 dark:bg-slate-950/50 dark:placeholder:text-slate-500',
                    inputRing,
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  {t('login.password')}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder={t('login.placeholderPassword')}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (error) setError(null)
                    }}
                    required
                    aria-invalid={!!displayedError}
                    aria-describedby={displayedError ? 'login-error' : undefined}
                    className={cn(
                      'border-input pe-10 rtl:pe-3 rtl:ps-10 dark:border-slate-700 dark:bg-slate-950/50 dark:placeholder:text-slate-500',
                      inputRing,
                    )}
                  />
                  <button
                    type="button"
                    className="absolute end-3 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                </div>
              </div>

              {displayedError && (
                <div
                  id="login-error"
                  role="alert"
                  aria-live="polite"
                  className="flex items-center gap-2 border-s-2 border-destructive py-1 ps-3 text-sm font-medium text-destructive animate-in fade-in slide-in-from-top-1 duration-200 dark:border-red-400 dark:text-red-400"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="leading-tight">{displayedError}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="h-11 w-full dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500"
              >
                {loading ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
                    {t('login.signingIn')}
                  </>
                ) : (
                  t('login.signIn')
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 space-y-1 text-center">
        <p className="text-xs text-muted-foreground">{t('login.tagline')}</p>
        <p className="text-[11px] text-muted-foreground/60">
          © {new Date().getFullYear()} ION
        </p>
      </div>
    </div>
  )
}
