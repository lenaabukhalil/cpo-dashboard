import { useState } from 'react'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { useTranslation } from '../../context/LanguageContext'
import type { RfidUser } from '../../services/api'
import { formatDateTime } from '../../lib/dateFormat'

export interface RfidEnableDisableDialogProps {
  open: boolean
  user: RfidUser | null
  enabling: boolean
  submitting?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason?: string) => void
}

export function RfidEnableDisableDialog({
  open,
  user,
  enabling,
  submitting = false,
  onOpenChange,
  onConfirm,
}: RfidEnableDisableDialogProps) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')

  const close = () => {
    if (submitting) return
    setReason('')
    onOpenChange(false)
  }

  const handleConfirm = () => {
    onConfirm(enabling ? undefined : reason.trim() || undefined)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
        else onOpenChange(true)
      }}
    >
      <DialogContent showClose className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {enabling ? t('rfid.enableTitle') : t('rfid.disableTitle')}
          </DialogTitle>
        </DialogHeader>
        {user ? (
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              {enabling ? t('rfid.enableConfirm') : t('rfid.disableConfirm')}{' '}
              <span className="font-mono font-medium text-foreground">{user.rfid_uid}</span>?
            </p>
            {!enabling && user.disabled_reason ? (
              <p className="text-xs text-muted-foreground">
                {t('rfid.previousDisableReason')}: {user.disabled_reason}
                {user.disabled_at ? ` (${formatDateTime(user.disabled_at)})` : ''}
              </p>
            ) : null}
            {!enabling ? (
              <div className="space-y-2">
                <Label htmlFor="rfid-disable-reason">{t('rfid.disableReasonOptional')}</Label>
                <textarea
                  id="rfid-disable-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-y min-h-[80px]"
                  placeholder={t('rfid.disableReasonPlaceholder')}
                />
              </div>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={submitting}>
            {t('rfid.cancel')}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={submitting || !user}>
            {submitting ? t('support.saving') : enabling ? t('rfid.enableAction') : t('rfid.disableAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
