import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Calendar, Clock } from 'lucide-react'

export default function OperationsSchedule() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Charger Schedule</h1>
        <p className="text-sm text-muted-foreground mt-1">Set working schedule for chargers (available hours per location or per charger)</p>
      </div>

      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-5 w-5" />
            Working Schedule
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Define when chargers are available: 24/7 or specific time windows (e.g. 06:00–22:00). Connect to backend to apply per location or per charger.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
            <Clock className="h-5 w-5 shrink-0" />
            <span>Schedule rules will be configurable here once the API supports charger/location availability windows.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
