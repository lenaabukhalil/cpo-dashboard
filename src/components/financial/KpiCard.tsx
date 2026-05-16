import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '../ui/card'

export function KpiCard({
  title,
  valueDisplay,
  icon: Icon,
}: {
  title: string
  valueDisplay: string
  icon: LucideIcon
}) {
  return (
    <Card className="border border-border">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="text-lg font-semibold tracking-tight text-foreground">{valueDisplay}</p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="h-4 w-4" aria-hidden />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
