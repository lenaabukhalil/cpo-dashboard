import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { usePermission } from '../hooks/usePermission'
import { getOrg, updateOrg, type Org } from '../services/api'

/** Normalize for dirty comparison: trim and treat empty string consistently */
function normalizedLogoUrl(value: string): string {
  return (value ?? '').trim()
}

export default function Settings() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const canWriteSettings = usePermission('settings.view', 'RW')
  const [, setOrg] = useState<Org | null>(null)
  /** Value last saved to server (source of truth for "original") */
  const [savedLogoUrl, setSavedLogoUrl] = useState('')
  /** Current input value – may be dirty when in edit mode */
  const [logoUrl, setLogoUrl] = useState('')
  const [savingLogo, setSavingLogo] = useState(false)
  /** Transient success message shown after save, then cleared */
  const [saveSuccess, setSaveSuccess] = useState(false)
  /** When true, show edit UI (input + actions); when false, show read-only view + "Change logo" */
  const [isEditingLogo, setIsEditingLogo] = useState(false)

  useEffect(() => {
    if (user?.organization_id == null) return
    getOrg(user.organization_id)
      .then((r) => {
        const o = (r as { data?: Org }).data ?? (r as unknown as Org)
        if (o && typeof o === 'object' && 'organization_id' in o) {
          setOrg(o as Org)
          const initial = (o as Org).logo?.trim() ?? ''
          setSavedLogoUrl(initial)
          setLogoUrl(initial)
        }
      })
      .catch(() => setOrg(null))
  }, [user?.organization_id])

  const isDirty = normalizedLogoUrl(logoUrl) !== normalizedLogoUrl(savedLogoUrl)

  /** Preview uses current input (live) in edit mode; in view mode use saved value */
  const previewUrl = isEditingLogo
    ? (logoUrl.trim() || savedLogoUrl || '')
    : (savedLogoUrl || '')

  const handleSaveLogo = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!canWriteSettings) return
      if (user?.organization_id == null || !isDirty) return
      setSavingLogo(true)
      setSaveSuccess(false)
      const valueToSave = logoUrl.trim() || undefined
      updateOrg(user.organization_id, { logo: valueToSave })
        .then((r) => {
          if (r.success) {
            const newSaved = valueToSave ?? ''
            setSavedLogoUrl(newSaved)
            setLogoUrl(newSaved)
            setOrg((prev) => (prev ? { ...prev, logo: valueToSave } : null))
            setSaveSuccess(true)
            setIsEditingLogo(false)
            window.dispatchEvent(new CustomEvent('org-updated'))
            window.setTimeout(() => setSaveSuccess(false), 3000)
          } else {
            setSaveSuccess(false)
          }
        })
        .catch(() => setSaveSuccess(false))
        .finally(() => setSavingLogo(false))
    },
    [user?.organization_id, logoUrl, isDirty, canWriteSettings]
  )

  const handleDiscard = useCallback(() => {
    setLogoUrl(savedLogoUrl)
    setIsEditingLogo(false)
  }, [savedLogoUrl])

  const handleCancelEdit = useCallback(() => {
    setLogoUrl(savedLogoUrl)
    setIsEditingLogo(false)
  }, [savedLogoUrl])

  return (
    <div className="space-y-8 text-start">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('settings.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('settings.subtitle')}</p>
      </div>

      {/* Organization logo – only for users with an organization */}
      {user?.organization_id != null && (
        <section aria-labelledby="settings-org-logo-heading">
          <h2 id="settings-org-logo-heading" className="text-lg font-semibold text-foreground mb-4">
            {t('settings.orgLogo')}
          </h2>
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">{t('settings.orgLogo')}</CardTitle>
              <p className="text-sm text-muted-foreground font-normal mt-1">
                {t('settings.logoUrlHint')}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isEditingLogo ? (
                /* View mode: read-only display + "Change logo" */
                <>
                  <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3 min-h-[52px]">
                    {savedLogoUrl ? (
                      <>
                        <img
                          src={savedLogoUrl}
                          alt="Organization logo"
                          className="h-10 w-10 object-contain border border-border rounded flex-shrink-0"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                        <p className="text-sm text-muted-foreground truncate max-w-md" title={savedLogoUrl}>
                          {savedLogoUrl}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t('settings.noLogoSet')}</p>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!canWriteSettings}
                      title={!canWriteSettings ? t('common.readOnlyAccess') : undefined}
                      onClick={() => canWriteSettings && setIsEditingLogo(true)}
                      className="ml-auto flex-shrink-0"
                    >
                      {t('settings.changeLogo')}
                    </Button>
                  </div>
                  {saveSuccess && (
                    <p className="text-sm text-green-600 dark:text-green-400" role="status">
                      {t('settings.logoSaved')}
                    </p>
                  )}
                </>
              ) : (
                /* Edit mode: input + preview + unsaved actions when dirty */
                <form onSubmit={handleSaveLogo} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="org-logo-url">{t('settings.logoUrl')}</Label>
                    <Input
                      id="org-logo-url"
                      type="url"
                      placeholder="https://example.com/logo.png"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      disabled={!canWriteSettings}
                      className="max-w-md"
                      aria-describedby={isDirty ? 'org-logo-unsaved' : undefined}
                      autoFocus
                    />
                  </div>

                  {previewUrl && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">{t('settings.preview')}</span>
                      <img
                        src={previewUrl}
                        alt="Organization logo"
                        className="h-10 w-10 object-contain border border-border rounded"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                  )}

                  {isDirty ? (
                    <div
                      id="org-logo-unsaved"
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-3"
                      role="region"
                      aria-live="polite"
                    >
                      <span className="text-sm text-amber-800 dark:text-amber-200">
                        {t('settings.unsavedChanges')}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="submit"
                          disabled={savingLogo || !canWriteSettings}
                          title={!canWriteSettings ? t('common.readOnlyAccess') : undefined}
                          size="sm"
                        >
                          {savingLogo ? t('settings.saving') : t('settings.saveChanges')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleDiscard}
                          disabled={savingLogo || !canWriteSettings}
                          title={!canWriteSettings ? t('common.readOnlyAccess') : undefined}
                        >
                          {t('settings.discard')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={handleCancelEdit}>
                        {t('common.cancel')}
                      </Button>
                    </div>
                  )}
                </form>
              )}
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

      <p className="text-xs text-muted-foreground mt-4">
        {t('settings.appVersion')}: {import.meta.env.VITE_APP_VERSION || '0.1.9'}
      </p>
    </div>
  )
}
