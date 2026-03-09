import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { getOrg, updateOrg, type Org } from '../services/api'
import Profile from './Profile'

export default function Settings() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [org, setOrg] = useState<Org | null>(null)
  const [logoUrl, setLogoUrl] = useState('')
  const [savingLogo, setSavingLogo] = useState(false)
  const [logoMessage, setLogoMessage] = useState('')

  useEffect(() => {
    if (user?.organization_id == null) return
    getOrg(user.organization_id)
      .then((r) => {
        const o = (r as { data?: Org }).data ?? (r as unknown as Org)
        if (o && typeof o === 'object' && 'organization_id' in o) {
          setOrg(o as Org)
          setLogoUrl((o as Org).logo?.trim() ?? '')
        }
      })
      .catch(() => setOrg(null))
  }, [user?.organization_id])

  const handleSaveLogo = (e: React.FormEvent) => {
    e.preventDefault()
    if (user?.organization_id == null) return
    setSavingLogo(true)
    setLogoMessage('')
    // Send only logo so backend partial update does not touch other org fields
    updateOrg(user.organization_id, { logo: logoUrl.trim() || undefined })
      .then((r) => {
        if (r.success) {
          setOrg((prev) => (prev ? { ...prev, logo: logoUrl.trim() || undefined } : null))
          setLogoMessage(t('settings.savedLogo'))
          window.dispatchEvent(new CustomEvent('org-updated'))
        } else {
          setLogoMessage((r as { message?: string }).message ?? 'Failed to save')
        }
      })
      .catch(() => setLogoMessage('Request failed'))
      .finally(() => setSavingLogo(false))
  }

  return (
    <div className="space-y-8 text-start">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('settings.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('settings.subtitle')}</p>
      </div>

      {/* Profile section – shown inside Settings */}
      <section aria-labelledby="settings-profile-heading">
        <h2 id="settings-profile-heading" className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          {t('settings.profile')}
        </h2>
        <Profile embedded />
      </section>

      {/* Organization logo – only for users with an organization */}
      {user?.organization_id != null && (
        <section aria-labelledby="settings-org-logo-heading">
          <h2 id="settings-org-logo-heading" className="text-lg font-semibold text-foreground mb-4">
            {t('settings.orgLogo')}
          </h2>
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="text-base">{t('settings.logoUrl')}</CardTitle>
              <p className="text-sm text-muted-foreground font-normal">
                {t('settings.logoUrlHint')}
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveLogo} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="org-logo-url">{t('settings.logoUrl')}</Label>
                  <Input
                    id="org-logo-url"
                    type="url"
                    placeholder="https://example.com/logo.png"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    className="max-w-md"
                  />
                </div>
                {(logoUrl.trim() || org?.logo) && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">{t('settings.preview')}</span>
                    <img
                      src={logoUrl.trim() || org?.logo || ''}
                      alt="Organization logo"
                      className="h-10 w-10 object-contain border border-border rounded"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  </div>
                )}
                {logoMessage && <p className="text-sm text-muted-foreground">{logoMessage}</p>}
                <Button type="submit" disabled={savingLogo}>
                  {savingLogo ? t('settings.saving') : t('settings.saveLogo')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      )}

      <Card className="border border-border">
        <CardHeader>
          <CardTitle>{t('settings.preferences')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('settings.preferencesHint')}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
