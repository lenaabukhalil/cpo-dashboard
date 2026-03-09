import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { ShieldCheck, AlertCircle } from 'lucide-react'

export default function SupportSLA() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">SLA Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Service Level Agreement tracking and performance monitoring</p>
      </div>

      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5" />
            SLA Dashboard
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor response time, resolution time, and availability targets. Set alerts when SLA is at risk.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>SLA metrics and targets will appear here when the backend provides support KPIs and agreements.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
