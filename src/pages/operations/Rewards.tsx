import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Gift } from 'lucide-react'

export default function OperationsRewards() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Rewards Program</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure rewards and loyalty program for charging sessions</p>
      </div>

      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gift className="h-5 w-5" />
            Rewards Settings
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Set points per kWh, redemption rules, and partner-specific rewards. Integrates with ION app when API is available.
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
            Rewards program configuration will be available once the backend supports loyalty and points.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
