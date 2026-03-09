import { cn } from '../lib/utils'
import { Button } from './ui/button'

export interface EmptyStateProps {
  title: string
  description?: string
  className?: string
  icon?: React.ReactNode
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ title, description, className, icon, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 text-center text-muted-foreground',
        className
      )}
    >
      {icon && <div className="mb-4 text-muted-foreground/50">{icon}</div>}
      <p className="font-semibold text-foreground">{title}</p>
      {description && <p className="mt-2 text-sm max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
