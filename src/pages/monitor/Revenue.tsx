import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { BarChart3, User, DollarSign } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function MonitorRevenue() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [placeholder, setPlaceholder] = useState<{ operator: string; revenue: number }[]>([])

  useEffect(() => {
    // Placeholder: replace with API e.g. GET /api/v4/cpo/revenue-per-operator
    const t = setTimeout(() => {
      setPlaceholder([
        { operator: 'Operator 1', revenue: 1250 },
        { operator: 'Operator 2', revenue: 980 },
      ])
      setLoading(false)
    }, 600)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Revenue per Operator</h1>
        <p className="text-sm text-muted-foreground mt-1">View revenue attributed to each ION partner-operator (shift-closing reports)</p>
      </div>

      {loading ? (
        <Card className="border border-border flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
        </Card>
      ) : (
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5" />
              Revenue by Operator
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Connect to <code className="text-xs bg-muted px-1 rounded">/api/v4/cpo/revenue-per-operator</code> for live data.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {placeholder.map((row, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <span className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {row.operator}
                  </span>
                  <span className="flex items-center gap-2 font-medium">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    {row.revenue.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
