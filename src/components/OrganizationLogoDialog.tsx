import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { cn } from '../lib/utils'
import { updateOrg } from '../services/api'
import { isValidLogoUrl } from './ChangeLogoModal'

type PreviewState = 'idle' | 'loading' | 'loaded' | 'error'

export type OrganizationLogoDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: number
  currentLogoUrl: string
  onSaved?: (newUrl: string) => void
}

export default function OrganizationLogoDialog({
  open,
  onOpenChange,
  organizationId,
  currentLogoUrl,
  onSaved,
}: OrganizationLogoDialogProps) {
  const [urlInput, setUrlInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [previewState, setPreviewState] = useState<PreviewState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!open) return
    const url = currentLogoUrl?.trim() || ''
    setUrlInput(url)
    setPreviewState(url && isValidLogoUrl(url) ? 'loading' : 'idle')
    setErrorMessage('')
    setSaving(false)
  }, [open, currentLogoUrl])

  const previewUrl = useMemo(() => urlInput.trim(), [urlInput])
  const showPreview = previewUrl.length > 0

  const handlePreviewLoad = () => setPreviewState('loaded')
  const handlePreviewError = () => setPreviewState('error')

  const handleUrlChange = (value: string) => {
    setUrlInput(value)
    setErrorMessage('')
    if (!value.trim()) {
      setPreviewState('idle')
      return
    }
    if (!isValidLogoUrl(value.trim())) {
      setPreviewState('error')
      return
    }
    setPreviewState('loading')
  }

  const handleSave = async () => {
    setErrorMessage('')
    const trimmed = urlInput.trim()
    if (trimmed && !isValidLogoUrl(trimmed)) {
      setErrorMessage('URL must start with http:// or https://')
      return
    }
    setSaving(true)
    try {
      const valueToSave = trimmed || undefined
      const r = await updateOrg(organizationId, { logo: valueToSave })
      if (!r.success) {
        setErrorMessage(r.message || 'Failed to save')
        return
      }
      onSaved?.(trimmed || '')
      onOpenChange(false)
    } catch {
      setErrorMessage('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit organization logo</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="org-logo-url">Organization logo URL</Label>
            <Input
              id="org-logo-url"
              type="url"
              dir="ltr"
              placeholder="https://..."
              value={urlInput}
              onChange={(e) => handleUrlChange(e.target.value)}
              disabled={saving}
              className={cn('truncate')}
            />
          </div>

          {showPreview && (
            <div className="grid gap-2">
              <span className="text-sm font-medium">Preview</span>
              <div className="flex h-24 w-full items-center justify-center rounded-lg border border-border bg-muted/30">
                <img src={previewUrl} alt="" className="sr-only" onLoad={handlePreviewLoad} onError={handlePreviewError} />

                {previewState === 'loading' && (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
                    <span className="text-xs">Loading…</span>
                  </div>
                )}
                {previewState === 'loaded' && <img src={previewUrl} alt="Logo preview" className="max-h-20 max-w-full object-contain" />}
                {previewState === 'error' && (
                  <span className="text-xs text-destructive">
                    {previewUrl && !isValidLogoUrl(previewUrl) ? 'URL must be http:// or https://' : 'Image failed to load'}
                  </span>
                )}
              </div>
            </div>
          )}

          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

