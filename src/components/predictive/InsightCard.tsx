import { Card, CardContent, CardHeader } from '../ui/card'
import type { InsightCard as InsightCardType } from '../../utils/predictiveAi'
import { AlertCircle, Info, CheckCircle, Lightbulb, TrendingUp } from 'lucide-react'

type InsightCardProps = {
  insight: InsightCardType
}

const iconMap = {
  alert: AlertCircle,
  info: Info,
  success: CheckCircle,
  trend: TrendingUp,
  revenue: Lightbulb,
}

const severityStyles = {
  info: 'border-l-4 border-l-primary bg-primary/5',
  warning: 'border-l-4 border-l-amber-500 bg-amber-500/5',
  success: 'border-l-4 border-l-green-600 bg-green-600/5',
  neutral: 'border-l-4 border-l-muted-foreground bg-muted/30',
}

export function InsightCard({ insight }: InsightCardProps) {
  const Icon = iconMap[insight.iconKey as keyof typeof iconMap] ?? Info
  const style = severityStyles[insight.severity]

  return (
    <Card className={style}>
      <CardHeader className="pb-1 pt-4">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">{insight.title}</span>
        </div>
      </CardHeader>
      <CardContent className="pb-4 pt-0">
        <p className="text-sm text-muted-foreground">{insight.message}</p>
      </CardContent>
    </Card>
  )
}
