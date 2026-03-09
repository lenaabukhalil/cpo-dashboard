import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Cpu, Upload } from 'lucide-react'

export default function SupportFirmware() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Firmware Upgrade</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage and deploy firmware updates for chargers</p>
      </div>

      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="h-5 w-5" />
            Firmware Management
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Upload new firmware, select target chargers or connectors, and run upgrades. Track version and rollout status.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
            <Upload className="h-5 w-5 shrink-0" />
            <span>Firmware upgrade workflow will be available when the backend/OCPP supports remote firmware update.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
