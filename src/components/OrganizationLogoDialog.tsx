import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { cn } from '../lib/utils'
import { updateOrg } from '../services/api'
import { isValidLogoUrl } from './ChangeLogoModal'
import { usePermission } from '../hooks/usePermission'
import { useTranslation } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'

type PreviewState = 'empty' | 'invalid-url' | 'loading' | 'loaded' | 'load-error'

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
  const { t } = useTranslation()
  const { user } = useAuth()
  const organizationsViewRw = usePermission('organizations.view', 'RW')
  const roleLower = user?.role_name?.toLowerCase() ?? ''
  const isAdmin = roleLower.includes('admin') || roleLower.includes('owner')
  const canSaveLogo = isAdmin || organizationsViewRw
  const [urlInput, setUrlInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [previewState, setPreviewState] = useState<PreviewState>('empty')
  const [errorMessage, setErrorMessage] = useState('')

  const previewUrl = urlInput.trim()
  const urlLooksValid = previewUrl.length > 0 && isValidLogoUrl(previewUrl)

  useEffect(() => {
    if (!open) return
    const url = currentLogoUrl?.trim() || ''
    setUrlInput(url)
    setErrorMessage('')
    setSaving(false)
    if (!url) {
      setPreviewState('empty')
    } else if (!isValidLogoUrl(url)) {
      setPreviewState('invalid-url')
    } else {
      setPreviewState('loading')
    }
  }, [open, currentLogoUrl])

  const handleUrlChange = (value: string) => {
    setUrlInput(value)
    setErrorMessage('')
    const t = value.trim()
    if (!t) {
      setPreviewState('empty')
      return
    }
    if (!isValidLogoUrl(t)) {
      setPreviewState('invalid-url')
      return
    }
    setPreviewState('loading')
  }

  const clearUrl = () => handleUrlChange('')

  const handlePreviewLoad = () => setPreviewState('loaded')
  const handlePreviewError = () => setPreviewState('load-error')

  const handleSave = async () => {
    if (!canSaveLogo) return
    setErrorMessage('')
    const trimmed = urlInput.trim()
    if (trimmed && !isValidLogoUrl(trimmed)) {
      setErrorMessage('URL must start with http:// or https://')
      return
    }
    setSaving(true)
    try {
      const valueToSave = trimmed || undefined
      const r = await updateOrg(organizationId, { logo_url: valueToSave })
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
            <div className="relative">
              <Input
                id="org-logo-url"
                type="url"
                dir="ltr"
                placeholder="https://example.com/logo.png"
                value={urlInput}
                onChange={(e) => handleUrlChange(e.target.value)}
                disabled={saving || !canSaveLogo}
                title={!canSaveLogo ? t('common.readOnlyAccess') : undefined}
                aria-describedby="org-logo-url-hint"
                className={cn('truncate', urlInput.trim() ? 'pr-10' : 'pr-3')}
              />
              {urlInput.trim().length > 0 && (
                <button
                  type="button"
                  onClick={clearUrl}
                  disabled={saving || !canSaveLogo}
                  title={!canSaveLogo ? t('common.readOnlyAccess') : undefined}
                  className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
                  aria-label="Clear URL"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <p id="org-logo-url-hint" className="text-xs text-muted-foreground">
              Enter a direct image URL (PNG, JPG, SVG)
            </p>
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium">Preview</span>
            <div
              className={cn(
                'flex min-h-[200px] w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/20 px-4 py-6'
              )}
            >
              {previewState === 'empty' && (
                <span className="text-sm text-muted-foreground">Logo preview</span>
              )}

              {previewState === 'invalid-url' && (
                <span className="text-center text-sm text-muted-foreground">
                  URL must start with http:// or https://
                </span>
              )}

              {urlLooksValid && previewState === 'load-error' && (
                <span className="text-sm text-destructive">Invalid image URL</span>
              )}

              {urlLooksValid && previewState !== 'load-error' && (
                <>
                  {previewState === 'loading' && (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
                      <span className="text-xs">Loading…</span>
                    </div>
                  )}
                  <img
                    key={previewUrl}
                    src={previewUrl}
                    alt="Logo preview"
                    onLoad={handlePreviewLoad}
                    onError={handlePreviewError}
                    className={cn(
                      'max-h-[180px] max-w-full object-contain',
                      previewState === 'loading' && 'sr-only'
                    )}
                  />
                </>
              )}
            </div>
          </div>

          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !canSaveLogo}
            title={!canSaveLogo ? t('common.readOnlyAccess') : undefined}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
