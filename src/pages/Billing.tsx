import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { FileText, DollarSign, Share2 } from 'lucide-react'

export default function Billing() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Billing & Revenue Share</h1>
        <p className="text-sm text-muted-foreground mt-1">Financial insights: revenue summary, invoices, and revenue share income per partner (D. Reports)</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-5 w-5" />
              Revenue summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Session revenue and tariff-based totals by location, charger, plug — per month, week, day, hour. Export PDF/CSV from Reports.
            </p>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5" />
              Invoices & settlements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Partner billing and settlement reports. Detailed revenue report PDF or CSV available in Reports & Analytics.
            </p>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Share2 className="h-5 w-5" />
              Revenue share income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Revenue share income report per partner. Connect to backend to show actual share amounts and history.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
