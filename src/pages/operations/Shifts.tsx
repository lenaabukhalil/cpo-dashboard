import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Clock, User } from 'lucide-react'

export default function OperationsShifts() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Operator Shifts</h1>
        <p className="text-sm text-muted-foreground mt-1">Set ION partner-operator shifts and schedule</p>
      </div>

      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-5 w-5" />
            Shift Schedule
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Assign operators to time slots and locations. Used for shift-closing revenue reports and accountability.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
            <User className="h-5 w-5 shrink-0" />
            <span>Shift management will appear here when the backend provides operator-shift endpoints.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
