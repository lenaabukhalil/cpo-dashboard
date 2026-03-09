import { useEffect, useState, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getLocations } from '../services/api'
import { getChargers } from '../services/api'
import { getConnectors } from '../services/api'
import {
  getTariffs,
  createTariff,
  updateTariff,
  deleteTariff,
  type Tariff as TariffType,
  type CreateTariffBody,
} from '../services/api'
import { Card } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { PageTabs } from '../components/PageTabs'
import { EntityFormActions } from '../components/EntityFormActions'
import { AppSelect } from '../components/shared/AppSelect'

const TARIFF_TABS = [{ id: 'tariffs', label: 'Tariffs' }]

const TARIFF_TYPES = ['energy', 'time', 'fixed'] as const
const TARIFF_STATUSES = ['active', 'inactive'] as const
const PEAK_TYPES = ['NA', 'Peak-On_AC', 'Peak-Off_AC', 'Partial-Peak_AC', 'Partial-Peak-Night_AC', 'Peak-On_DC', 'Peak-Off_DC', 'Partial-Peak_DC', 'Partial-Peak-Night_DC'] as const

export default function Tariffs() {
  const { user } = useAuth()
  const orgId = user?.organization_id

  const [locations, setLocations] = useState<{ location_id: number; name: string }[]>([])
  const [formLocationId, setFormLocationId] = useState<number | ''>('')
  const [formChargers, setFormChargers] = useState<{ id: number; name: string; chargerID: string }[]>([])
  const [formChargerId, setFormChargerId] = useState<number | ''>('')
  const [formConnectors, setFormConnectors] = useState<{ id: number; chargerId: number; type: string }[]>([])
  const [connectorTariffs, setConnectorTariffs] = useState<TariffType[]>([])
  const [selectedTariffId, setSelectedTariffId] = useState<number | 'new'>('new')
  const [form, setForm] = useState<CreateTariffBody>({
    connector_id: 0,
    type: 'energy',
    buy_rate: 0,
    sell_rate: 0,
    status: 'active',
  })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (orgId == null) return
    getLocations(orgId).then((r) => {
      if (r.success && r.data) setLocations(Array.isArray(r.data) ? r.data : [])
    })
  }, [orgId])

  useEffect(() => {
    if (formLocationId === '') {
      setFormChargers([])
      setFormChargerId('')
      setFormConnectors([])
      setForm((f) => ({ ...f, connector_id: 0 }))
      setSelectedTariffId('new')
      return
    }
    getChargers(Number(formLocationId)).then((r) => {
      if (r.success && r.data) setFormChargers(Array.isArray(r.data) ? r.data : [])
      else setFormChargers([])
    })
    setFormChargerId('')
  }, [formLocationId])

  useEffect(() => {
    if (formChargerId === '') {
      setFormConnectors([])
      setForm((f) => ({ ...f, connector_id: 0 }))
      setConnectorTariffs([])
      setSelectedTariffId('new')
      return
    }
    getConnectors(Number(formChargerId)).then((r) => {
      if (r.success && r.data) setFormConnectors(Array.isArray(r.data) ? r.data : [])
      else setFormConnectors([])
    })
    setForm((f) => ({ ...f, connector_id: 0 }))
  }, [formChargerId])

  useEffect(() => {
    if (!form.connector_id) {
      setConnectorTariffs([])
      setSelectedTariffId('new')
      return
    }
    getTariffs(form.connector_id).then((r) => {
      if (r.success && r.data) setConnectorTariffs(Array.isArray(r.data) ? r.data : [])
      else setConnectorTariffs([])
    })
  }, [form.connector_id])

  const currentTariff = useMemo(
    () => connectorTariffs.find((t) => t.tariff_id === selectedTariffId),
    [connectorTariffs, selectedTariffId]
  )

  useEffect(() => {
    if (selectedTariffId === 'new') {
      setForm((f) => ({
        ...f,
        type: 'energy',
        buy_rate: 0,
        sell_rate: 0,
        status: 'active',
        transaction_fees: undefined,
        client_percentage: undefined,
        partner_percentage: undefined,
        peak_type: undefined,
      }))
      return
    }
    const t = connectorTariffs.find((x) => x.tariff_id === selectedTariffId)
    if (t) {
      setForm((f) => ({
        ...f,
        type: t.type || 'energy',
        buy_rate: t.buy_rate ?? 0,
        sell_rate: t.sell_rate ?? 0,
        status: t.status || 'active',
        transaction_fees: t.transaction_fees,
        client_percentage: t.client_percentage,
        partner_percentage: t.partner_percentage,
        peak_type: t.peak_type,
      }))
    }
  }, [selectedTariffId, connectorTariffs])

  const isEditMode = selectedTariffId !== 'new' && !!currentTariff

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.connector_id) return
    setSubmitting(true)
    setMessage('')
    if (isEditMode && currentTariff) {
      const res = await updateTariff(currentTariff.tariff_id, {
        type: form.type,
        buy_rate: form.buy_rate,
        sell_rate: form.sell_rate,
        status: form.status,
        transaction_fees: form.transaction_fees,
        client_percentage: form.client_percentage,
        partner_percentage: form.partner_percentage,
        peak_type: form.peak_type,
      })
      setSubmitting(false)
      if (res.success) {
        setMessage('Tariff updated.')
        const listRes = await getTariffs(form.connector_id)
        if (listRes.success && listRes.data) setConnectorTariffs(Array.isArray(listRes.data) ? listRes.data : [])
      } else setMessage(res.message || 'Update failed')
    } else {
      const res = await createTariff(form)
      setSubmitting(false)
      if (res.success) {
        setMessage('Tariff created.')
        setSelectedTariffId('new')
        setForm((f) => ({ ...f, type: 'energy', buy_rate: 0, sell_rate: 0, status: 'active' }))
        const listRes = await getTariffs(form.connector_id)
        if (listRes.success && listRes.data) setConnectorTariffs(Array.isArray(listRes.data) ? listRes.data : [])
      } else setMessage(res.message || 'Create failed')
    }
    setTimeout(() => setMessage(''), 3000)
  }

  const handleDiscard = () => {
    if (isEditMode && currentTariff) {
      setForm((f) => ({
        ...f,
        type: currentTariff.type || 'energy',
        buy_rate: currentTariff.buy_rate ?? 0,
        sell_rate: currentTariff.sell_rate ?? 0,
        status: currentTariff.status || 'active',
        transaction_fees: currentTariff.transaction_fees,
        client_percentage: currentTariff.client_percentage,
        partner_percentage: currentTariff.partner_percentage,
        peak_type: currentTariff.peak_type,
      }))
    } else {
      setForm((f) => ({ ...f, type: 'energy', buy_rate: 0, sell_rate: 0, status: 'active' }))
    }
  }

  const handleDeleteTariff = async () => {
    if (!currentTariff) return
    const res = await deleteTariff(currentTariff.tariff_id)
    if (res.success) {
      setMessage('Tariff deleted.')
      setSelectedTariffId('new')
      const listRes = await getTariffs(form.connector_id)
      if (listRes.success && listRes.data) setConnectorTariffs(Array.isArray(listRes.data) ? listRes.data : [])
    } else setMessage(res.message || 'Delete failed')
    setTimeout(() => setMessage(''), 3000)
  }

  if (orgId == null) {
    return (
      <div className="space-y-6">
        <p className="text-destructive">No organization assigned.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Tariffs</h1>
        <p className="text-sm text-muted-foreground mb-6">Configure pricing and tariffs</p>
        <PageTabs tabs={TARIFF_TABS} activeTab="tariffs" onTabChange={() => {}} />
        <div className="text-xs text-muted-foreground pt-5 pb-4 border-b border-border">CPO Dashboard / Tariffs / Add Tariffs</div>
      </div>

      <div className="pt-2">
        {message && (
          <div className="mb-4 p-3 rounded-lg bg-muted text-muted-foreground text-sm">{message}</div>
        )}

        <Card className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <form onSubmit={handleSave} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Organization</label>
                <div className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground cursor-default pointer-events-none">
                  <span>{orgId != null ? `Organization ${orgId}` : '—'}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Location</label>
                <AppSelect
                  options={[{ value: '', label: 'Select location' }, ...locations.map((loc) => ({ value: String(loc.location_id), label: loc.name }))]}
                  value={formLocationId === '' ? '' : String(formLocationId)}
                  onChange={(v) => setFormLocationId(v === '' ? '' : Number(v))}
                  placeholder="Select location"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Charger</label>
                <AppSelect
                  options={[{ value: '', label: 'Select charger' }, ...formChargers.map((c) => ({ value: String(c.id), label: `${c.name} (${c.chargerID})` }))]}
                  value={formChargerId === '' ? '' : String(formChargerId)}
                  onChange={(v) => setFormChargerId(v === '' ? '' : Number(v))}
                  placeholder="Select charger"
                  isDisabled={!formLocationId}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Connector</label>
                <AppSelect
                  options={[{ value: '', label: 'Select connector' }, ...formConnectors.map((c) => ({ value: String(c.id), label: `Connector ${c.id} (${c.type})` }))]}
                  value={form.connector_id ? String(form.connector_id) : ''}
                  onChange={(v) => {
                    setForm((f) => ({ ...f, connector_id: Number(v) }))
                    setSelectedTariffId('new')
                  }}
                  placeholder="Select connector"
                  isDisabled={!formChargerId}
                />
              </div>
            </div>

            {form.connector_id > 0 && (
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <label className="block text-sm font-medium">Tariff for this connector</label>
                <AppSelect
                  options={[
                    { value: 'new', label: '+ Add new Tariffs' },
                    ...connectorTariffs.map((t) => ({
                      value: String(t.tariff_id),
                      label: `${t.type} — Buy: ${t.buy_rate ?? 0} / Sell: ${t.sell_rate ?? 0}`,
                    })),
                  ]}
                  value={selectedTariffId === 'new' ? 'new' : String(selectedTariffId)}
                  onChange={(v) => setSelectedTariffId(v === 'new' ? 'new' : Number(v))}
                  placeholder="+ Add new Tariffs"
                />
                {selectedTariffId === 'new' && (
                  <p className="text-sm text-muted-foreground">Fill the form below and save to create a new tariff.</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Type *</label>
                <AppSelect
                  options={TARIFF_TYPES.map((t) => ({ value: t, label: t }))}
                  value={form.type}
                  onChange={(v) => setForm((f) => ({ ...f, type: v }))}
                  placeholder="energy"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <AppSelect
                  options={TARIFF_STATUSES.map((s) => ({ value: s, label: s }))}
                  value={form.status ?? 'active'}
                  onChange={(v) => setForm((f) => ({ ...f, status: v }))}
                  placeholder="active"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Buy Rate ($/kWh) *</label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.buy_rate}
                  onChange={(e) => setForm((f) => ({ ...f, buy_rate: Number(e.target.value) || 0 }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sell Rate ($/kWh) *</label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.sell_rate}
                  onChange={(e) => setForm((f) => ({ ...f, sell_rate: Number(e.target.value) || 0 }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Transaction Fees ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.transaction_fees ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, transaction_fees: e.target.value ? Number(e.target.value) : undefined }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Client Percentage (%)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.client_percentage ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, client_percentage: e.target.value ? Number(e.target.value) : undefined }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Partner Percentage (%)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.partner_percentage ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, partner_percentage: e.target.value ? Number(e.target.value) : undefined }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Peak Type</label>
                <AppSelect
                  options={[{ value: '', label: '—' }, ...PEAK_TYPES.map((p) => ({ value: p, label: p }))]}
                  value={form.peak_type ?? ''}
                  onChange={(v) => setForm((f) => ({ ...f, peak_type: v || undefined }))}
                  placeholder="—"
                />
              </div>
            </div>

            <EntityFormActions
              mode={isEditMode ? 'edit' : 'add'}
              entityLabel="tariff"
              isSubmitting={submitting}
              disableSaveWhenInvalid={!form.connector_id}
              onDiscard={handleDiscard}
              onDelete={handleDeleteTariff}
              hasExistingEntity={isEditMode}
            />
          </form>
        </Card>
      </div>
    </div>
  )
}
