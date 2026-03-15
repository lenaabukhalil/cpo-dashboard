import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { login } from '../services/api'
import { Card, CardContent, CardHeader } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'

export default function Login() {
  const { user, setUser } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    let id = identifier.trim().replace(/\s+/g, '')
    if (!id.includes('@') && id.length >= 8) {
      if (!id.startsWith('+')) id = '+' + id
    }
    const res = await login(id || identifier.trim(), password)
    setLoading(false)
    const token = (res as { token?: string }).token ?? (res as { data?: { token?: string } }).data?.token
    const userObj = (res as { user?: unknown }).user ?? (res as { data?: { user?: unknown } }).data?.user
    if (res.success && token) {
      localStorage.setItem('cpo_token', token)
      if (userObj) setUser(userObj as Parameters<typeof setUser>[0])
      navigate('/')
    } else {
      const err = res as { message?: string; details?: string; error?: string; statusCode?: number }
      const apiMsg = (err.message || err.error || err.details || '').trim().toLowerCase()
      if (apiMsg.includes('invalid email') || apiMsg.includes('user not found')) {
        setError(t('login.errorInvalidEmail'))
      } else if (apiMsg.includes('wrong password') || apiMsg.includes('invalid password')) {
        setError(t('login.errorWrongPassword'))
      } else {
        setError(err.message || err.error || err.details || t('login.errorGeneric'))
      }
    }
  }

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm border border-border shadow-md">
        <CardHeader className="space-y-1 text-center">
          <h1 className="text-xl font-semibold text-foreground">CPO Dashboard</h1>
          <p className="text-sm text-muted-foreground">Charging Point Operator</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">Email or Mobile</Label>
              <Input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="email@example.com or 07xxxxxxxx"
                required
                className="border-input focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder={t('login.placeholderPassword')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-input focus-visible:ring-ring"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
