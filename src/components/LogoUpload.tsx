import { useRef, useState } from 'react'
import { Image, Upload, X } from 'lucide-react'
import { Button } from './ui/button'

const MAX_SIZE_MB = 5
const MAX_BYTES = MAX_SIZE_MB * 1024 * 1024

export interface LogoUploadProps {
  value?: string | null
  onChange?: (file: File | null, dataUrl?: string) => void
  disabled?: boolean
}

export function LogoUpload({ value, onChange, disabled }: LogoUploadProps) {
  const [preview, setPreview] = useState<string | null>(value || null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const displayUrl = preview || value
  const hasImage = !!displayUrl

  const handleFile = (file: File | null) => {
    setError('')
    if (!file) {
      setPreview(null)
      onChange?.(null)
      return
    }
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, or SVG).')
      return
    }
    if (file.size > MAX_BYTES) {
      setError(`File must be under ${MAX_SIZE_MB}MB.`)
      return
    }
    setUploading(true)
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setPreview(dataUrl)
      onChange?.(file, dataUrl)
      setUploading(false)
    }
    reader.onerror = () => {
      setError('Failed to read file.')
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }

  const handleRemove = () => {
    setPreview(null)
    setError('')
    onChange?.(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Organization Logo</label>
      <div className="flex flex-wrap items-start gap-4">
        <div className="relative w-32 h-32 rounded-lg border-2 border-border overflow-hidden bg-muted flex-shrink-0">
          {hasImage ? (
            <>
              <img src={displayUrl!} alt="Logo" className="w-full h-full object-cover" />
              {!disabled && onChange && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  onClick={handleRemove}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center border-dashed border-2 border-border rounded-lg">
              <Image className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            disabled={disabled}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || uploading}
          >
            {uploading ? (
              'Uploading...'
            ) : hasImage ? (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Change Logo
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload Logo
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            Recommended: Square image, max {MAX_SIZE_MB}MB (PNG, JPG, or SVG)
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>
    </div>
  )
}
