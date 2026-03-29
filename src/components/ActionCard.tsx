import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../lib/utils'

export interface ActionCardProps {
  to: string
  icon: ReactNode
  title: string
  className?: string
}

const actionCardStyles = [
  'flex flex-col items-center justify-center gap-3',
  'min-h-[120px] h-[120px] p-6',
  'rounded-2xl border border-border bg-muted/20',
  'text-foreground no-underline',
  'cursor-pointer transition-all duration-200 ease-out',
  'hover:bg-muted/35 hover:border-border',
].join(' ')

export function ActionCard({ to, icon, title, className }: ActionCardProps) {
  return (
    <Link to={to} className={cn(actionCardStyles, className)}>
      <span className="flex shrink-0 [&>svg]:h-8 [&>svg]:w-8 text-foreground/90" aria-hidden>
        {icon}
      </span>
      <span className="text-base font-semibold leading-tight text-foreground">{title}</span>
    </Link>
  )
}
