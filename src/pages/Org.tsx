import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { getOrg, type Org as OrgType } from '../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

export default function Org() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [org, setOrg] = useState<OrgType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadOrg = useCallback(() => {
    const orgId = user?.organization_id
    if (orgId == null) {
      setLoading(false)
      setError(t('org.noOrgAssigned'))
      return
    }
    getOrg(orgId)
      .then((r) => {
        if (r.success && r.data) setOrg(r.data as OrgType)
        else setError(r.message || t('org.loadFailed'))
      })
      .finally(() => setLoading(false))
  }, [user?.organization_id, t])

  useEffect(() => {
    loadOrg()
  }, [loadOrg])

  useEffect(() => {
    const onOrgUpdated = () => loadOrg()
    window.addEventListener('org-updated', onOrgUpdated)
    return () => window.removeEventListener('org-updated', onOrgUpdated)
  }, [loadOrg])

  if (loading) {
    return (
      <div className="space-y-6 text-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('org.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('org.subtitle')}</p>
        </div>
        <Card className="border border-border flex flex-col items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">{t('org.loading')}</p>
        </Card>
      </div>
    )
  }
  if (error) {
    return (
      <div className="space-y-6 text-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('org.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('org.subtitle')}</p>
        </div>
        <Card className="border border-border p-6">
          <p className="text-destructive">{error}</p>
        </Card>
      </div>
    )
  }
  if (!org) {
    return (
      <div className="space-y-6 text-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('org.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('org.subtitle')}</p>
        </div>
        <Card className="border border-border p-6">
          <p className="text-muted-foreground">{t('org.noData')}</p>
        </Card>
      </div>
    )
  }

  const contactFullName = [org.contact_first_name, org.contact_last_name].filter(Boolean).join(' ') || '—'

  return (
    <div className="space-y-6 text-start">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('org.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('org.subtitle')}</p>
      </div>

      {/* Overview / General */}
      <Card className="border border-border">
        <CardHeader>
          <CardTitle>{t('org.overview')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('org.overviewDesc')}</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Logo block – left column */}
            {org.logo && (
              <div className="lg:col-span-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('org.logo')}</p>
                <div className="flex flex-col sm:flex-row lg:flex-col items-start gap-4">
                  <img
                    src={org.logo}
                    alt={org.name}
                    className="h-24 w-24 shrink-0 rounded-lg border border-border object-contain bg-muted/30"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                  <div className="min-w-0 flex-1 w-full">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">{t('org.logoUrl')}</p>
                    <div className="rounded-md border border-border bg-muted/20 px-3 py-2 font-mono text-xs text-foreground overflow-hidden">
                      <p className="truncate" dir="ltr" title={org.logo}>
                        {org.logo}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Org details – right column */}
            <div className={org.logo ? 'lg:col-span-8' : 'lg:col-span-12'}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{t('org.organizationId')}</p>
                  <p className="font-mono text-sm text-foreground">{org.organization_id}</p>
                </div>
                <div className="sm:col-span-2 sm:col-start-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{t('org.name')}</p>
                  <p className="font-medium text-foreground">{org.name || '—'}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{t('org.nameAr')}</p>
                  <p className="text-foreground" dir="rtl">{org.name_ar || '—'}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card className="border border-border">
        <CardHeader>
          <CardTitle>{t('org.contact')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('org.contactDesc')}</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">{t('org.contactName')}</p>
              <p className="text-foreground">{contactFullName}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">{t('org.firstName')}</p>
              <p className="text-foreground">{org.contact_first_name || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">{t('org.lastName')}</p>
              <p className="text-foreground">{org.contact_last_name || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">{t('org.phoneNumber')}</p>
              <p className="text-foreground">{org.contact_phoneNumber || '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional details */}
      <Card className="border border-border">
        <CardHeader>
          <CardTitle>{t('org.additionalDetails')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('org.additionalDetailsDesc')}</p>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-muted/30 border border-border p-4">
            <p className="text-sm text-foreground whitespace-pre-wrap">{org.details || '—'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
