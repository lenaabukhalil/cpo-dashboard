import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { formatValue, type PredictionType } from '../../utils/predictiveAi'

type Next4WeeksCardProps = {
  type: PredictionType
  weeksCount: 1 | 2 | 3 | 4
  values: number[]
}

const labelByIndex = (i: number, total: number) =>
  total === 1 ? 'Next (pred.)' : i === 0 ? 'Next (pred.)' : `W+${i + 1} (pred.)`

export function Next4WeeksCard({ type, weeksCount, values }: Next4WeeksCardProps) {
  const title = weeksCount === 1 ? 'Predicted Next 1 Week' : `Predicted Next ${weeksCount} Weeks`
  const list = values.slice(0, weeksCount)
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {list.map((val, i) => (
            <li key={i} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{labelByIndex(i, weeksCount)}</span>
              <span className="font-medium">{formatValue(type, val)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
