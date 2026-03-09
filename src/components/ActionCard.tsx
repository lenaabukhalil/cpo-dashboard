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
  'rounded-2xl border border-[#E5E7EB] bg-[#F5F7FA]',
  'dark:border-gray-700 dark:bg-gray-800/80',
  'text-[#111827] dark:text-gray-100 no-underline',
  'cursor-pointer transition-all duration-200 ease-out',
  'hover:bg-[#E8ECF1] hover:border-[#D1D5DB] dark:hover:bg-gray-700/80 dark:hover:border-gray-600',
].join(' ')

export function ActionCard({ to, icon, title, className }: ActionCardProps) {
  return (
    <Link to={to} className={cn(actionCardStyles, className)}>
      <span className="flex shrink-0 [&>svg]:h-8 [&>svg]:w-8 text-[#111827] dark:text-gray-200" aria-hidden>
        {icon}
      </span>
      <span className="text-base font-semibold leading-tight text-[#111827] dark:text-gray-100">{title}</span>
    </Link>
  )
}
