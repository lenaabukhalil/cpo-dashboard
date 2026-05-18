import { useCallback, useEffect, useMemo, useState } from 'react'
import { CreditCard } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { AppMultiSelect } from './shared/AppMultiSelect'
import { createRfidUser, getLocations, type Location } from '../services/api'
import { useTranslation } from '../context/LanguageContext'
import {
  defaultAddRfidUserFormValues,
  normalizeRfidUid,
  RFID_CARD_TYPES,
  RFID_STATUSES,
  stripDigits,
  validateAddRfidUserForm,
  type AddRfidUserFormValues,
} from '../lib/rfidUserFormValidation'

export interface AddRfidUserModalProps {
  open: boolean
  organizationId: number | undefined
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

/**
 * Modal form to create an RFID user (card) for the current organization.
 */
export function AddRfidUserModal({ open, organizationId, onOpenChange, onSuccess }: AddRfidUserModalProps) {
  const { t } = useTranslation()
  const [values, setValues] = useState<AddRfidUserFormValues>(() => defaultAddRfidUserFormValues())
  const [touched, setTouched] = useState<Partial<Record<keyof AddRfidUserFormValues, boolean>>>({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [locations, setLocations] = useState<Location[]>([])

  const validationMessages = useMemo(
    () => ({
      rfidUidRequired: t('rfid.errors.invalidUid'),
      rfidUidInvalid: t('rfid.errors.invalidUid'),
      firstNameRequired: t('users.required'),
      firstNameLength: t('users.required'),
      lastNameRequired: t('users.required'),
      lastNameLength: t('users.required'),
      emailInvalid: t('users.email'),
      notesMaxLength: t('rfid.notes'),
    }),
    [t],
  )

  const locationOptions = useMemo(
    () => locations.map((loc) => ({ value: String(loc.location_id), label: loc.name })),
    [locations],
  )

  const resetForm = useCallback(() => {
    setValues(defaultAddRfidUserFormValues())
    setTouched({})
    setFormError('')
  }, [])

  useEffect(() => {
    if (!open || organizationId == null) return
    getLocations(organizationId)
      .then((res) => {
        const data = (res as { data?: Location[] }).data ?? (res as unknown as Location[])
        setLocations(Array.isArray(data) ? data : [])
      })
      .catch(() => setLocations([]))
  }, [open, organizationId])

  const runValidation = useCallback(
    (v: AddRfidUserFormValues) => validateAddRfidUserForm(v, validationMessages),
    [validationMessages],
  )

  const fieldErrors = useMemo(() => runValidation(values), [values, runValidation])

  const close = () => {
    if (submitting) return
    onOpenChange(false)
    resetForm()
  }

  const handleBlur = (field: keyof AddRfidUserFormValues) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  const showError = (field: keyof AddRfidUserFormValues) =>
    touched[field] && fieldErrors[field] ? fieldErrors[field] : undefined

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (organizationId == null) return

    const allTouched = Object.keys(defaultAddRfidUserFormValues()).reduce(
      (acc, key) => ({ ...acc, [key]: true }),
      {} as Partial<Record<keyof AddRfidUserFormValues, boolean>>,
    )
    setTouched(allTouched)

    const nextErrors = runValidation(values)
    if (Object.keys(nextErrors).length > 0) return

    setFormError('')
    setSubmitting(true)

    const countryCodeRaw = values.country_code.trim()
    const mobileRaw = values.mobile.trim()
    const emailRaw = values.email.trim()
    const notesRaw = values.notes.trim()
    const allowedIds = values.allowed_location_ids.map((id) => Number(id)).filter((n) => Number.isFinite(n))

    try {
      const res = await createRfidUser({
        organization_id: organizationId,
        rfid_uid: normalizeRfidUid(values.rfid_uid),
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        country_code: countryCodeRaw ? Number(countryCodeRaw) : null,
        mobile: mobileRaw ? Number(mobileRaw) : null,
        email: emailRaw || null,
        card_type: values.card_type,
        status: values.status,
        allowed_locations: allowedIds.length > 0 ? allowedIds : null,
        notes: notesRaw || null,
      })

      if (res.success) {
        onOpenChange(false)
        resetForm()
        onSuccess()
        return
      }

      const status = res.statusCode
      if (status === 409) {
        setFormError(t('rfid.errors.duplicateUid'))
      } else {
        setFormError(res.message || t('users.requestFailed'))
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('users.requestFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
        else onOpenChange(true)
      }}
    >
      <DialogContent showClose className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <DialogTitle>{t('rfid.modalTitleCreate')}</DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {formError ? (
            <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
              {formError}
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="rfid-uid">{t('rfid.uid')}</Label>
            <Input
              id="rfid-uid"
              value={values.rfid_uid}
              onChange={(e) =>
                setValues((v) => ({ ...v, rfid_uid: normalizeRfidUid(e.target.value) }))
              }
              onBlur={() => handleBlur('rfid_uid')}
              placeholder={t('rfid.uidPlaceholder')}
              className="rounded-lg font-mono uppercase"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">{t('rfid.uidHint')}</p>
            {showError('rfid_uid') ? <p className="text-sm text-destructive">{showError('rfid_uid')}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rfid-first">{t('rfid.firstName')}</Label>
              <Input
                id="rfid-first"
                value={values.first_name}
                onChange={(e) => setValues((v) => ({ ...v, first_name: e.target.value }))}
                onBlur={() => handleBlur('first_name')}
                className="rounded-lg"
              />
              {showError('first_name') ? (
                <p className="text-sm text-destructive">{showError('first_name')}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="rfid-last">{t('rfid.lastName')}</Label>
              <Input
                id="rfid-last"
                value={values.last_name}
                onChange={(e) => setValues((v) => ({ ...v, last_name: e.target.value }))}
                onBlur={() => handleBlur('last_name')}
                className="rounded-lg"
              />
              {showError('last_name') ? (
                <p className="text-sm text-destructive">{showError('last_name')}</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rfid-cc">{t('rfid.countryCode')}</Label>
              <Input
                id="rfid-cc"
                inputMode="numeric"
                type="number"
                value={values.country_code}
                onChange={(e) => setValues((v) => ({ ...v, country_code: stripDigits(e.target.value) }))}
                placeholder="962"
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rfid-mobile">{t('rfid.mobile')}</Label>
              <Input
                id="rfid-mobile"
                inputMode="numeric"
                value={values.mobile}
                onChange={(e) => setValues((v) => ({ ...v, mobile: stripDigits(e.target.value) }))}
                className="rounded-lg"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rfid-email">{t('rfid.email')}</Label>
            <Input
              id="rfid-email"
              type="email"
              value={values.email}
              onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
              onBlur={() => handleBlur('email')}
              className="rounded-lg"
            />
            {showError('email') ? <p className="text-sm text-destructive">{showError('email')}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rfid-card-type">{t('rfid.cardType')}</Label>
              <select
                id="rfid-card-type"
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                value={values.card_type}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    card_type: e.target.value as AddRfidUserFormValues['card_type'],
                  }))
                }
              >
                {RFID_CARD_TYPES.map((ct) => (
                  <option key={ct} value={ct}>
                    {t(`rfid.cardType.${ct}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rfid-status">{t('rfid.status')}</Label>
              <select
                id="rfid-status"
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                value={values.status}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    status: e.target.value as AddRfidUserFormValues['status'],
                  }))
                }
              >
                {RFID_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {t(`rfid.status.${st}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('rfid.allowedLocations')}</Label>
            <AppMultiSelect
              options={locationOptions}
              value={values.allowed_location_ids}
              onChange={(ids) => setValues((v) => ({ ...v, allowed_location_ids: ids }))}
              placeholder={t('reports.allLocations')}
              className="bg-background"
            />
            <p className="text-xs text-muted-foreground">{t('rfid.allowedLocationsHint')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rfid-notes">{t('rfid.notes')}</Label>
            <textarea
              id="rfid-notes"
              value={values.notes}
              onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value.slice(0, 500) }))}
              onBlur={() => handleBlur('notes')}
              placeholder={t('rfid.notesPlaceholder')}
              rows={3}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-y min-h-[80px]"
            />
            {showError('notes') ? <p className="text-sm text-destructive">{showError('notes')}</p> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={submitting}>
              {t('rfid.cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t('support.saving') : t('rfid.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
