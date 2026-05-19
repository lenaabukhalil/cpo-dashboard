import { useCallback, useEffect, useState } from 'react'
import { Building2, Pencil } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { getOrg, updateOrg, type Org as OrgType } from '../services/api'
import { hasWritePermission } from '../lib/permissions'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import OrganizationLogoDialog from '../components/OrganizationLogoDialog'

type EditSection = 'overview' | 'contact' | 'details' | null

export default function Organization() {
  const { user, permissions } = useAuth()
  const { t } = useTranslation()
  const canEditOrganization = hasWritePermission(permissions, 'organizations.manage')

  const [org, setOrg] = useState<OrgType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [logoOpen, setLogoOpen] = useState(false)
  const [editSection, setEditSection] = useState<EditSection>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [overviewForm, setOverviewForm] = useState({ name: '', name_ar: '' })
  const [contactForm, setContactForm] = useState({
    contact_first_name: '',
    contact_last_name: '',
    contact_phoneNumber: '',
  })
  const [detailsForm, setDetailsForm] = useState('')

  const orgId = user?.organization_id

  const loadOrg = useCallback(() => {
    if (orgId == null) {
      setLoading(false)
      setError(t('org.noOrgAssigned'))
      return
    }
    setLoading(true)
    getOrg(orgId)
      .then((r) => {
        if (r.success && r.data) setOrg(r.data as OrgType)
        else setError(r.message || t('org.loadFailed'))
      })
      .catch(() => setError(t('org.loadFailed')))
      .finally(() => setLoading(false))
  }, [orgId, t])

  useEffect(() => {
    loadOrg()
  }, [loadOrg])

  useEffect(() => {
    const onOrgUpdated = () => loadOrg()
    window.addEventListener('org-updated', onOrgUpdated)
    return () => window.removeEventListener('org-updated', onOrgUpdated)
  }, [loadOrg])

  useEffect(() => {
    if (!canEditOrganization) {
      setLogoOpen(false)
      setEditSection(null)
    }
  }, [canEditOrganization])

  const openOverviewEdit = () => {
    if (!org || !canEditOrganization) return
    setOverviewForm({ name: org.name ?? '', name_ar: org.name_ar ?? '' })
    setFormError('')
    setEditSection('overview')
  }

  const openContactEdit = () => {
    if (!org || !canEditOrganization) return
    setContactForm({
      contact_first_name: org.contact_first_name ?? '',
      contact_last_name: org.contact_last_name ?? '',
      contact_phoneNumber: org.contact_phoneNumber ?? '',
    })
    setFormError('')
    setEditSection('contact')
  }

  const openDetailsEdit = () => {
    if (!org || !canEditOrganization) return
    setDetailsForm(org.details ?? '')
    setFormError('')
    setEditSection('details')
  }

  const closeEdit = () => {
    if (submitting) return
    setEditSection(null)
    setFormError('')
  }

  const notifyOrgUpdated = () => {
    window.dispatchEvent(new CustomEvent('org-updated'))
  }

  const handleSaveOverview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEditOrganization || orgId == null) return
    setSubmitting(true)
    setFormError('')
    try {
      const r = await updateOrg(orgId, {
        name: overviewForm.name.trim(),
        name_ar: overviewForm.name_ar.trim() || undefined,
      })
      if (!r.success) {
        setFormError(r.message || t('users.requestFailed'))
        return
      }
      closeEdit()
      notifyOrgUpdated()
    } catch {
      setFormError(t('users.requestFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEditOrganization || orgId == null) return
    setSubmitting(true)
    setFormError('')
    try {
      const r = await updateOrg(orgId, {
        contact_first_name: contactForm.contact_first_name.trim() || undefined,
        contact_last_name: contactForm.contact_last_name.trim() || undefined,
        contact_phoneNumber: contactForm.contact_phoneNumber.trim() || undefined,
      })
      if (!r.success) {
        setFormError(r.message || t('users.requestFailed'))
        return
      }
      closeEdit()
      notifyOrgUpdated()
    } catch {
      setFormError(t('users.requestFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEditOrganization || orgId == null) return
    setSubmitting(true)
    setFormError('')
    try {
      const r = await updateOrg(orgId, { details: detailsForm.trim() || undefined })
      if (!r.success) {
        setFormError(r.message || t('users.requestFailed'))
        return
      }
      closeEdit()
      notifyOrgUpdated()
    } catch {
      setFormError(t('users.requestFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const pageHeader = (
    <div className="flex flex-wrap items-center gap-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('org.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('org.subtitle')}</p>
      </div>
      {!canEditOrganization ? (
        <Badge variant="secondary" className="shrink-0 font-normal" title={t('common.viewOnlyDescription')}>
          {t('common.viewOnly')}
        </Badge>
      ) : null}
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-6 text-start">
        {pageHeader}
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
        {pageHeader}
        <Card className="border border-border p-6">
          <p className="text-destructive">{error}</p>
        </Card>
      </div>
    )
  }

  if (!org) {
    return (
      <div className="space-y-6 text-start">
        {pageHeader}
        <Card className="border border-border p-6">
          <p className="text-muted-foreground">{t('org.noData')}</p>
        </Card>
      </div>
    )
  }

  const contactFullName = [org.contact_first_name, org.contact_last_name].filter(Boolean).join(' ') || '—'
  const logoUrl = (org.logo_url || '').trim()

  const sectionEditButton = (onClick: () => void) =>
    canEditOrganization ? (
      <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={onClick}>
        <Pencil className="h-4 w-4" />
        {t('support.edit')}
      </Button>
    ) : null

  return (
    <div className="space-y-6 text-start">
      {pageHeader}

      <Card className="border border-border">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle>{t('org.overview')}</CardTitle>
            <p className="text-sm text-muted-foreground">{t('org.overviewDesc')}</p>
          </div>
          {sectionEditButton(openOverviewEdit)}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('org.logo')}</p>
              <div className="flex flex-col sm:flex-row lg:flex-col items-start gap-4">
                {canEditOrganization ? (
                  <button
                    type="button"
                    className="group/logo relative h-24 w-24 shrink-0 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden transition-colors hover:border-primary/45 hover:ring-2 hover:ring-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setLogoOpen(true)}
                    aria-label={t('org.editLogo')}
                  >
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={org.name}
                        className="h-full w-full object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <Building2 className="h-10 w-10 text-muted-foreground" aria-hidden />
                    )}
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[inherit] bg-background/55 opacity-0 transition-opacity group-hover/logo:opacity-100">
                      <Pencil className="h-4 w-4 text-foreground" aria-hidden />
                    </span>
                  </button>
                ) : logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={org.name}
                    className="h-24 w-24 shrink-0 rounded-lg border border-border object-contain bg-muted/30"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="h-24 w-24 shrink-0 rounded-lg border border-border bg-muted/30 flex items-center justify-center">
                    <Building2 className="h-10 w-10 text-muted-foreground" aria-hidden />
                  </div>
                )}
                {logoUrl ? (
                  <div className="min-w-0 flex-1 w-full">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                      {t('org.logoUrl')}
                    </p>
                    <div className="rounded-md border border-border bg-muted/20 px-3 py-2 font-mono text-xs text-foreground overflow-hidden">
                      <p className="truncate" dir="ltr" title={logoUrl}>
                        {logoUrl}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="lg:col-span-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    {t('org.organizationId')}
                  </p>
                  <p className="font-mono text-sm text-foreground">{org.id}</p>
                </div>
                <div className="sm:col-span-2 sm:col-start-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{t('org.name')}</p>
                  <p className="font-medium text-foreground">{org.name || '—'}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{t('org.nameAr')}</p>
                  <p className="text-foreground" dir="rtl">
                    {org.name_ar || '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle>{t('org.contact')}</CardTitle>
            <p className="text-sm text-muted-foreground">{t('org.contactDesc')}</p>
          </div>
          {sectionEditButton(openContactEdit)}
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

      <Card className="border border-border">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle>{t('org.additionalDetails')}</CardTitle>
            <p className="text-sm text-muted-foreground">{t('org.additionalDetailsDesc')}</p>
          </div>
          {sectionEditButton(openDetailsEdit)}
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-muted/30 border border-border p-4">
            <p className="text-sm text-foreground whitespace-pre-wrap">{org.details || '—'}</p>
          </div>
        </CardContent>
      </Card>

      {canEditOrganization && orgId != null ? (
        <OrganizationLogoDialog
          open={logoOpen}
          onOpenChange={setLogoOpen}
          organizationId={orgId}
          currentLogoUrl={logoUrl}
          canEdit={canEditOrganization}
          onSaved={() => notifyOrgUpdated()}
        />
      ) : null}

      {canEditOrganization && editSection === 'overview' ? (
        <Dialog open onOpenChange={(open) => !open && closeEdit()}>
          <DialogContent showClose className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('org.editOverview')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void handleSaveOverview(e)} className="space-y-4">
              {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
              <div className="space-y-2">
                <Label htmlFor="org-name">{t('org.name')}</Label>
                <Input
                  id="org-name"
                  value={overviewForm.name}
                  onChange={(e) => setOverviewForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-name-ar">{t('org.nameAr')}</Label>
                <Input
                  id="org-name-ar"
                  value={overviewForm.name_ar}
                  onChange={(e) => setOverviewForm((f) => ({ ...f, name_ar: e.target.value }))}
                  dir="rtl"
                  className="rounded-lg"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeEdit} disabled={submitting}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? t('support.saving') : t('support.saveChanges')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}

      {canEditOrganization && editSection === 'contact' ? (
        <Dialog open onOpenChange={(open) => !open && closeEdit()}>
          <DialogContent showClose className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('org.editContact')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void handleSaveContact(e)} className="space-y-4">
              {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="org-cf">{t('org.firstName')}</Label>
                  <Input
                    id="org-cf"
                    value={contactForm.contact_first_name}
                    onChange={(e) => setContactForm((f) => ({ ...f, contact_first_name: e.target.value }))}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-cl">{t('org.lastName')}</Label>
                  <Input
                    id="org-cl"
                    value={contactForm.contact_last_name}
                    onChange={(e) => setContactForm((f) => ({ ...f, contact_last_name: e.target.value }))}
                    className="rounded-lg"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-phone">{t('org.phoneNumber')}</Label>
                <Input
                  id="org-phone"
                  value={contactForm.contact_phoneNumber}
                  onChange={(e) => setContactForm((f) => ({ ...f, contact_phoneNumber: e.target.value }))}
                  className="rounded-lg"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeEdit} disabled={submitting}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? t('support.saving') : t('support.saveChanges')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}

      {canEditOrganization && editSection === 'details' ? (
        <Dialog open onOpenChange={(open) => !open && closeEdit()}>
          <DialogContent showClose className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('org.editDetails')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => void handleSaveDetails(e)} className="space-y-4">
              {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
              <div className="space-y-2">
                <Label htmlFor="org-details">{t('org.additionalDetails')}</Label>
                <textarea
                  id="org-details"
                  value={detailsForm}
                  onChange={(e) => setDetailsForm(e.target.value)}
                  rows={5}
                  className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-y min-h-[100px]"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeEdit} disabled={submitting}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? t('support.saving') : t('support.saveChanges')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}
