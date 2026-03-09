import { useState } from 'react'
import { Button } from './ui/button'
import { cn } from '../lib/utils'

export type EntityFormActionsMode = 'add' | 'edit'

export interface EntityFormActionsProps {
  mode: EntityFormActionsMode
  entityLabel?: string
  isSubmitting?: boolean
  disableSaveWhenInvalid?: boolean
  onDiscard: () => void
  onDelete?: () => Promise<void> | void
  /** When true, show Delete button (e.g. editing an existing entity) */
  hasExistingEntity?: boolean
}

export function EntityFormActions({
  mode,
  entityLabel = 'item',
  isSubmitting = false,
  disableSaveWhenInvalid = false,
  onDiscard,
  onDelete,
  hasExistingEntity = false,
}: EntityFormActionsProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const showDelete = mode === 'edit' && hasExistingEntity && onDelete != null
  const saveLabel = mode === 'add' ? 'Add' : 'Save changes'
  const saveDisabled = isSubmitting || disableSaveWhenInvalid

  const handleDeleteClick = () => setDeleteDialogOpen(true)
  const handleDeleteCancel = () => {
    if (!deleting) setDeleteDialogOpen(false)
  }
  const handleDeleteConfirm = async () => {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete()
      setDeleteDialogOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div
        className={cn(
          'flex flex-col gap-3 pt-4 border-t border-border sm:flex-row sm:items-center sm:justify-between'
        )}
      >
        <div className="order-2 sm:order-1">
          {showDelete && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteClick}
              disabled={isSubmitting}
            >
              Delete
            </Button>
          )}
        </div>
        <div className="order-1 flex flex-col gap-2 sm:order-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            onClick={onDiscard}
            disabled={isSubmitting}
          >
            Discard changes
          </Button>
          <Button type="submit" disabled={saveDisabled}>
            {isSubmitting ? 'Saving...' : saveLabel}
          </Button>
        </div>
      </div>

      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="bg-card rounded-2xl border border-border p-6 shadow-lg max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-foreground">
              Delete {entityLabel}?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleDeleteCancel}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
