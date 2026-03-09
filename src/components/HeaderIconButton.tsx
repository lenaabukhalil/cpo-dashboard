import type { ReactNode } from 'react'
import { Button } from './ui/button'
import { cn } from '../lib/utils'

type HeaderIconButtonProps = {
  label: string
  icon: ReactNode
  onClick?: () => void
  'aria-label': string
  className?: string
  children?: ReactNode
  /** Show badge (e.g. notification count) over the icon */
  badge?: ReactNode
}

/**
 * Top bar icon: dark black by default, on hover blue circle + white icon + white rounded label below.
 */
export function HeaderIconButton({
  label,
  icon,
  onClick,
  'aria-label': ariaLabel,
  className,
  children,
  badge,
}: HeaderIconButtonProps) {
  return (
    <div className="relative group">
      <Button
        variant="ghost"
        size="icon"
        onClick={onClick}
        aria-label={ariaLabel}
        className={cn(
          'rounded-full text-foreground transition-colors',
          'hover:bg-primary hover:text-primary-foreground',
          className
        )}
      >
        <span className="relative inline-flex items-center justify-center">
          {icon}
          {badge}
        </span>
      </Button>
      {/* Tooltip label below: white (light) / card (dark) rounded box, dark text - visible on hover */}
      <span
        className="pointer-events-none absolute left-1/2 top-full z-50 -translate-x-1/2 mt-1.5 whitespace-nowrap rounded-md bg-card px-2.5 py-1 text-sm font-medium text-foreground shadow-md ring-1 ring-border/50 opacity-0 transition-opacity duration-150 group-hover:opacity-100 rtl:left-auto rtl:right-1/2 rtl:translate-x-1/2"
        role="presentation"
      >
        {label}
      </span>
      {children}
    </div>
  )
}
