import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'
import { cn } from '../lib/utils'

function isValidLogoUrl(url: string): boolean {
  const u = url.trim()
  if (!u) return true
  try {
    const parsed = new URL(u)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

type PreviewState = 'idle' | 'loading' | 'loaded' | 'error'

export type ChangeLogoModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentLogoUrl: string
  onSave: (url: string) => Promise<void>
  saving?: boolean
}

export default function ChangeLogoModal({
  open,
  onOpenChange,
  currentLogoUrl,
  onSave,
  saving = false,
}: ChangeLogoModalProps) {
  const [urlInput, setUrlInput] = useState('')
  const [previewState, setPreviewState] = useState<PreviewState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (open) {
      const url = currentLogoUrl?.trim() || ''
      setUrlInput(url)
      setPreviewState(url && isValidLogoUrl(url) ? 'loading' : 'idle')
      setErrorMessage('')
    }
  }, [open, currentLogoUrl])

  const previewUrl = urlInput.trim()
  const showPreview = previewUrl.length > 0

  const handlePreviewLoad = () => setPreviewState('loaded')
  const handlePreviewError = () => setPreviewState('error')

  const handleSave = async () => {
    setErrorMessage('')
    const trimmed = urlInput.trim()
    if (trimmed && !isValidLogoUrl(trimmed)) {
      setErrorMessage('URL must start with http:// or https://')
      return
    }
    try {
      await onSave(trimmed || '')
      onOpenChange(false)
    } catch {
      setErrorMessage('Failed to save')
    }
  }

  const handleUrlChange = (value: string) => {
    setUrlInput(value)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change Logo</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <label htmlFor="change-logo-url" className="text-sm font-medium">
              Logo URL
            </label>
            <input
              id="change-logo-url"
              type="url"
              dir="ltr"
              placeholder="https://..."
              value={urlInput}
              onChange={(e) => handleUrlChange(e.target.value)}
              className={cn(
                'flex h-10 w-full min-w-0 max-w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background',
                'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50 box-border text-left',
                'truncate'
              )}
              style={{ direction: 'ltr' }}
              disabled={saving}
            />
          </div>

          {showPreview && (
            <div className="grid gap-2">
              <span className="text-sm font-medium">Preview</span>
              <div className="flex h-24 w-full items-center justify-center rounded-lg border border-border bg-muted/30">
                {/* Hidden img to trigger load/error and drive preview state */}
                <img
                  src={previewUrl}
                  alt=""
                  className="sr-only"
                  onLoad={handlePreviewLoad}
                  onError={handlePreviewError}
                />
                {previewState === 'loading' && (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
                    <span className="text-xs">Loading…</span>
                  </div>
                )}
                {previewState === 'loaded' && (
                  <img
                    src={previewUrl}
                    alt="Logo preview"
                    className="max-h-20 max-w-full object-contain"
                  />
                )}
                {previewState === 'error' && (
                  <span className="text-xs text-destructive">
                    {previewUrl && !isValidLogoUrl(previewUrl)
                      ? 'URL must be http:// or https://'
                      : 'Image failed to load'}
                  </span>
                )}
              </div>
            </div>
          )}

          {errorMessage && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
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

export { isValidLogoUrl }
