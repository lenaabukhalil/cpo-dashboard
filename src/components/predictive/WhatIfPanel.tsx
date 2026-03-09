import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Label } from '../ui/label'
import { formatValue, type PredictionType } from '../../utils/predictiveAi'

type WhatIfPanelProps = {
  type: PredictionType
  predictedNextWeek: number
  predictedNext4Weeks: number[]
}

const MIN = { revenue: 0.8, sessions: 0.8, kwh: 0.8 }
const MAX = { revenue: 1.5, sessions: 1.5, kwh: 1.2 }

const labelMap = {
  revenue: 'Price multiplier',
  sessions: 'Session growth multiplier',
  kwh: 'Energy efficiency multiplier',
}

export function WhatIfPanel({ type, predictedNextWeek, predictedNext4Weeks }: WhatIfPanelProps) {
  const [multiplier, setMultiplier] = useState(1)
  const min = MIN[type]
  const max = MAX[type]

  const simNext = useMemo(
    () => Math.max(0, predictedNextWeek * multiplier),
    [predictedNextWeek, multiplier]
  )
  const sim4 = useMemo(
    () => predictedNext4Weeks.map((v) => Math.max(0, v * multiplier)),
    [predictedNext4Weeks, multiplier]
  )

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">What-if Simulation</CardTitle>
        <p className="text-xs text-muted-foreground">
          Simulation (what-if) — not actual forecast
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm">{labelMap[type]} ({min}–{max})</Label>
          <input
            type="range"
            min={min}
            max={max}
            step={0.05}
            value={multiplier}
            onChange={(e) => setMultiplier(parseFloat(e.target.value))}
            className="w-full"
          />
          <span className="text-sm text-muted-foreground">{multiplier.toFixed(2)}x</span>
        </div>
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-sm">
          <p className="text-muted-foreground">Simulated next week: {formatValue(type, simNext)}</p>
          <p className="text-muted-foreground mt-1">
            Simulated next 4 weeks: {formatValue(type, sim4.reduce((a, b) => a + b, 0))}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
