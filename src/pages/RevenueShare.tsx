import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Share2 } from 'lucide-react'

export default function RevenueShare() {
  const [partnerPercent, setPartnerPercent] = useState('')
  const [saved, setSaved] = useState(false)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Revenue Share</h1>
        <p className="text-sm text-muted-foreground mt-1">Set the revenue share percentages per partner (if applicable)</p>
      </div>

      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Share2 className="h-5 w-5" />
            Partner Revenue Share %
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Configure the percentage of session revenue shared with each ION partner. Values are stored per organization when backend is connected.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4 max-w-sm">
            <div>
              <Label htmlFor="partner-pct">Partner share (%)</Label>
              <Input
                id="partner-pct"
                type="number"
                min={0}
                max={100}
                step={0.5}
                placeholder="e.g. 15"
                value={partnerPercent}
                onChange={(e) => setPartnerPercent(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button type="submit" disabled={saved}>
              {saved ? 'Saved' : 'Save percentage'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
