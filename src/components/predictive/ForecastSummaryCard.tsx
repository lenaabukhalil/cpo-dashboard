import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import type { ForecastStats } from '../../utils/predictiveAi'
import { formatValue, type PredictionType } from '../../utils/predictiveAi'

type ForecastSummaryCardProps = {
  type: PredictionType
  stats: ForecastStats
}

export function ForecastSummaryCard({ type, stats }: ForecastSummaryCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Forecast Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground">Next week forecast</p>
          <p className="text-xl font-semibold">{formatValue(type, stats.predictedNextWeek)}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Change vs last week:</span>
          <span
            className={
              stats.percentChangeVsLastWeek > 0
                ? 'text-green-600'
                : stats.percentChangeVsLastWeek < 0
                  ? 'text-destructive'
                  : 'text-muted-foreground'
            }
          >
            {stats.percentChangeVsLastWeek >= 0 ? '+' : ''}
            {stats.percentChangeVsLastWeek.toFixed(1)}%
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
