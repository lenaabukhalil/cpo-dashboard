import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Label } from '../ui/label'
import { AppSelect } from '../shared/AppSelect'
import type { FinancialBreakdownGroupBy, FinancialBreakdownRow } from '../../api/financial'
import { useTranslation } from '../../context/LanguageContext'

function groupByOptions(t: (k: string) => string) {
  return [
    { value: 'location', label: t('reports.financial.groupBy.location') },
    { value: 'charger', label: t('reports.financial.groupBy.charger') },
    { value: 'tariff', label: t('reports.financial.groupBy.tariff') },
    { value: 'session_type', label: t('reports.financial.groupBy.session_type') },
    { value: 'connector', label: t('reports.financial.groupBy.connector') },
  ] as { value: FinancialBreakdownGroupBy; label: string }[]
}

type Props = {
  title: string
  data: FinancialBreakdownRow[]
  groupBy: FinancialBreakdownGroupBy
  onGroupByChange: (g: FinancialBreakdownGroupBy) => void
  loading?: boolean
}

export function FinancialBreakdownBarChart({ title, data, groupBy, onGroupByChange, loading }: Props) {
  const { t } = useTranslation()
  const opts = groupByOptions(t)
  const top = [...data].sort((a, b) => b.revenue - a.revenue).slice(0, 10)

  return (
    <Card className="border border-border">
      <CardHeader className="space-y-3 pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <div className="space-y-1.5 max-w-xs">
          <Label className="text-xs text-muted-foreground">{t('reports.financial.groupByLabel')}</Label>
          <AppSelect
            options={opts}
            value={groupBy}
            onChange={(v) => onGroupByChange(v as FinancialBreakdownGroupBy)}
            className="bg-background"
          />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">{t('reports.loading')}</div>
        ) : top.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">{t('reports.noData')}</div>
        ) : (
          <div className="h-[280px] w-full min-w-0" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={120}
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--card))',
                    fontSize: 12,
                  }}
                  formatter={(value: unknown) => {
                    const n = typeof value === 'number' ? value : Number(value)
                    return Number.isFinite(n) ? `${n.toFixed(2)} JOD` : String(value ?? '')
                  }}
                />
                <Bar dataKey="revenue" name={t('reports.financial.revenueJod')} fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
