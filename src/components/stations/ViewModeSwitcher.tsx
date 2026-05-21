import { Workflow, Table } from 'lucide-react'
import { useTranslation } from '../../context/LanguageContext'
import { cn } from '../../lib/utils'

export interface ViewModeSwitcherProps {
  value: 'wizard' | 'table'
  onChange: (next: 'wizard' | 'table') => void
}

export function ViewModeSwitcher({ value, onChange }: ViewModeSwitcherProps) {
  const { t } = useTranslation()

  const modes = [
    { id: 'wizard' as const, icon: Workflow, labelKey: 'stations.viewWizard' },
    { id: 'table' as const, icon: Table, labelKey: 'stations.viewTable' },
  ]

  return (
    <div
      role="group"
      aria-label="View mode"
      className="inline-flex gap-1 rounded-lg border border-border bg-muted/30 p-1"
    >
      {modes.map(({ id, icon: Icon, labelKey }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === id
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          {t(labelKey)}
        </button>
      ))}
    </div>
  )
}
