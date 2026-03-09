import { useEffect, useState, useMemo } from 'react'
import { Search, ChevronDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getLocations } from '../services/api'
import { getChargers } from '../services/api'
import {
  getConnectors,
  createConnector,
  updateConnector,
  deleteConnector,
  type Connector as ConnectorType,
  type CreateConnectorBody,
} from '../services/api'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { PageTabs } from '../components/PageTabs'
import { EmptyState } from '../components/EmptyState'
import { TablePagination } from '../components/TablePagination'
import { EntityFormActions } from '../components/EntityFormActions'
import { AppSelect } from '../components/shared/AppSelect'
import { cn } from '../lib/utils'

const CONNECTOR_TABS = [
  { id: 'status', label: 'Connectors Status' },
  { id: 'connectors', label: 'Connectors' },
]

const CONNECTOR_TYPES = ['Type 1', 'Type 2', 'GBT AC', 'GBT DC', 'CHAdeMO', 'CCS1', 'CCS2'] as const
const CONNECTOR_STATUSES = ['available', 'preparing', 'unavailable', 'busy', 'booked', 'error'] as const

interface ConnectorRow {
  locationName: string
  chargerName: string
  chargerId: number
  connector: ConnectorType
}

function StatusPill({ value }: { value: string }) {
  const v = (value || '').toLowerCase()
  const style =
    v === 'available' || v === 'online'
      ? 'bg-emerald-50 text-emerald-700 border-0'
      : v === 'unavailable' || v === 'offline'
        ? 'bg-red-50 text-red-700 border-0'
        : v === 'error' || v === 'faulted'
          ? 'bg-amber-50 text-amber-700 border-0'
          : v === 'busy' || v === 'charging'
            ? 'bg-blue-50 text-blue-700 border-0'
            : 'bg-muted text-muted-foreground'
  return (
    <Badge className={cn('rounded-full', style)} variant="secondary">
      {value || '—'}
    </Badge>
  )
}

export default function Connectors() {
  const { user } = useAuth()
  const orgId = user?.organization_id

  const [activeTab, setActiveTab] = useState<'status' | 'connectors'>('status')
  const [locations, setLocations] = useState<{ location_id: number; name: string }[]>([])
  const [statusRows, setStatusRows] = useState<ConnectorRow[]>([])
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusSearch, setStatusSearch] = useState('')
  const [statusPage, setStatusPage] = useState(1)
  const [statusPerPage, setStatusPerPage] = useState(10)
  const [statusError, setStatusError] = useState('')
  const [statusRetry, setStatusRetry] = useState(0)
  const [deferredEdit, setDeferredEdit] = useState<{ chargerId: number; connectorId: number } | null>(null)

  const [formLocationId, setFormLocationId] = useState<number | ''>('')
  const [formChargers, setFormChargers] = useState<{ id: number; name: string; chargerID: string }[]>([])
  const [formConnectors, setFormConnectors] = useState<ConnectorType[]>([])
  const [selectedConnectorId, setSelectedConnectorId] = useState<number | 'new'>('new')
  const [form, setForm] = useState<CreateConnectorBody>({
    charger_id: 0,
    connector_type: 'Type 2',
    status: 'available',
    power: '22',
    power_unit: 'kw',
    enabled: true,
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
    if (activeTab !== 'status' || locations.length === 0) return
    setStatusLoading(true)
    setStatusError('')
    const load = async () => {
      const rows: ConnectorRow[] = []
      for (const loc of locations) {
        const chargersRes = await getChargers(loc.location_id)
        const chargers = chargersRes.success && chargersRes.data ? (Array.isArray(chargersRes.data) ? chargersRes.data : []) : []
        for (const ch of chargers) {
          const connRes = await getConnectors(ch.id)
          const conns = connRes.success && connRes.data ? (Array.isArray(connRes.data) ? connRes.data : []) : []
          for (const conn of conns) {
            rows.push({ locationName: loc.name, chargerName: ch.name, chargerId: ch.id, connector: conn })
          }
        }
      }
      setStatusRows(rows)
      setStatusLoading(false)
    }
    load().catch(() => {
      setStatusError('Failed to load connectors')
      setStatusLoading(false)
    })
  }, [activeTab, locations, statusRetry])

  useEffect(() => {
    if (formLocationId === '') {
      setFormChargers([])
      setFormConnectors([])
      setSelectedConnectorId('new')
      setDeferredEdit(null)
      return
    }
    getChargers(Number(formLocationId)).then((r) => {
      if (r.success && r.data) setFormChargers(Array.isArray(r.data) ? r.data : [])
      else setFormChargers([])
    })
    setSelectedConnectorId('new')
  }, [formLocationId])

  useEffect(() => {
    if (!deferredEdit || formChargers.length === 0) return
    const hasCharger = formChargers.some((c) => c.id === deferredEdit.chargerId)
    if (hasCharger) {
      setForm((f) => ({ ...f, charger_id: deferredEdit.chargerId }))
      setSelectedConnectorId(deferredEdit.connectorId)
      setDeferredEdit(null)
    }
  }, [deferredEdit, formChargers])

  useEffect(() => {
    if (!form.charger_id) {
      setFormConnectors([])
      setSelectedConnectorId('new')
      return
    }
    getConnectors(form.charger_id).then((r) => {
      if (r.success && r.data) setFormConnectors(Array.isArray(r.data) ? r.data : [])
      else setFormConnectors([])
    })
  }, [form.charger_id])

  const currentConnector = useMemo(
    () => formConnectors.find((c) => c.id === selectedConnectorId),
    [formConnectors, selectedConnectorId]
  )

  useEffect(() => {
    if (selectedConnectorId === 'new') {
      setForm({
        charger_id: form.charger_id || 0,
        connector_type: 'Type 2',
        status: 'available',
        power: '22',
        power_unit: 'kw',
        enabled: true,
      })
      return
    }
    const c = formConnectors.find((x) => x.id === selectedConnectorId)
    if (c) {
      setForm({
        charger_id: c.chargerId,
        connector_type: (c.connector_type || c.type) as string,
        status: c.status || 'available',
        power: c.power != null ? String(c.power) : '22',
        power_unit: c.power_unit ?? 'kw',
        time_limit: c.time_limit,
        enabled: c.enabled !== 0,
      })
    }
  }, [selectedConnectorId, form.charger_id, formConnectors])

  const filteredStatusRows = useMemo(() => {
    if (!statusSearch.trim()) return statusRows
    const q = statusSearch.toLowerCase()
    return statusRows.filter(
      (r) =>
        r.locationName.toLowerCase().includes(q) ||
        r.chargerName.toLowerCase().includes(q) ||
        String(r.connector.id).toLowerCase().includes(q) ||
        (r.connector.type ?? '').toLowerCase().includes(q) ||
        (r.connector.status ?? '').toLowerCase().includes(q)
    )
  }, [statusRows, statusSearch])

  const statusTotalPages = Math.max(1, Math.ceil(filteredStatusRows.length / statusPerPage))
  const paginatedStatusRows = useMemo(
    () => filteredStatusRows.slice((statusPage - 1) * statusPerPage, statusPage * statusPerPage),
    [filteredStatusRows, statusPage, statusPerPage]
  )

  useEffect(() => {
    if (statusPage > statusTotalPages && statusTotalPages > 0) setStatusPage(1)
  }, [statusPage, statusTotalPages])

  const isEditMode = selectedConnectorId !== 'new' && !!currentConnector

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.charger_id) return
    setSubmitting(true)
    setMessage('')
    const payload = { ...form, type: form.connector_type || form.type }
    if (isEditMode && currentConnector) {
      const res = await updateConnector(currentConnector.id, payload as Partial<CreateConnectorBody>)
      setSubmitting(false)
      if (res.success) {
        setMessage('Connector updated.')
        const listRes = await getConnectors(form.charger_id)
        if (listRes.success && listRes.data) setFormConnectors(Array.isArray(listRes.data) ? listRes.data : [])
      } else setMessage(res.message || 'Update failed')
    } else {
      const res = await createConnector(payload as CreateConnectorBody)
      setSubmitting(false)
      if (res.success) {
        setMessage('Connector created.')
        setSelectedConnectorId('new')
        setForm({ charger_id: form.charger_id, connector_type: 'Type 2', status: 'available', power: '22', power_unit: 'kw', enabled: true })
        const listRes = await getConnectors(form.charger_id)
        if (listRes.success && listRes.data) setFormConnectors(Array.isArray(listRes.data) ? listRes.data : [])
      } else setMessage(res.message || 'Create failed')
    }
    setTimeout(() => setMessage(''), 3000)
  }

  const handleDiscard = () => {
    if (isEditMode && currentConnector) {
      setForm({
        charger_id: currentConnector.chargerId,
        connector_type: (currentConnector.connector_type || currentConnector.type) as string,
        status: currentConnector.status || 'available',
        power: currentConnector.power != null ? String(currentConnector.power) : '22',
        power_unit: currentConnector.power_unit ?? 'kw',
        time_limit: currentConnector.time_limit,
        enabled: currentConnector.enabled !== 0,
      })
    } else {
      setForm({
        charger_id: form.charger_id || 0,
        connector_type: 'Type 2',
        status: 'available',
        power: '22',
        power_unit: 'kw',
        enabled: true,
      })
    }
  }

  const handleDeleteConnector = async () => {
    if (!currentConnector) return
    const res = await deleteConnector(currentConnector.id)
    if (res.success) {
      setMessage('Connector deleted.')
      setSelectedConnectorId('new')
      const listRes = await getConnectors(form.charger_id)
      if (listRes.success && listRes.data) setFormConnectors(Array.isArray(listRes.data) ? listRes.data : [])
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
        <h1 className="text-2xl font-bold mb-1">Connectors</h1>
        <p className="text-sm text-muted-foreground mb-6">Manage connector configurations and settings</p>
        <PageTabs tabs={CONNECTOR_TABS} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as 'status' | 'connectors')} />
        <div className="text-xs text-muted-foreground pt-5 pb-4 border-b border-border">CPO Dashboard / Connectors</div>
      </div>

      <div className="pt-2">
        {message && (
          <div className="mb-4 p-3 rounded-lg bg-muted text-muted-foreground text-sm">{message}</div>
        )}

        {activeTab === 'status' && (
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="text-base">Connectors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {statusError && (
                <div className="rounded-lg bg-destructive/10 text-destructive p-3 text-sm flex items-center justify-between">
                  <span>{statusError}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => setStatusRetry((r) => r + 1)}>Retry</Button>
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by Organization, Location, Charger, Connector, Tariffs..."
                  className="pl-10"
                  value={statusSearch}
                  onChange={(e) => setStatusSearch(e.target.value)}
                />
              </div>
              {statusLoading ? (
                <div className="py-12 text-center text-muted-foreground">Loading...</div>
              ) : filteredStatusRows.length === 0 ? (
                <EmptyState title="No Connectors" description="No connectors found." />
              ) : (
                <>
                  <div className="overflow-x-auto border rounded-lg border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/30">
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Organization</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Location</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Charger</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Connector ID</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedStatusRows.map((row) => (
                          <tr key={`${row.chargerId}-${row.connector.id}`} className="hover:bg-muted/50 border-t border-border">
                            <td className="py-3 px-4">CPO</td>
                            <td className="py-3 px-4">{row.locationName}</td>
                            <td className="py-3 px-4">{row.chargerName}</td>
                            <td className="py-3 px-4 font-medium">{row.connector.id}</td>
                            <td className="py-3 px-4">{row.connector.type ?? '—'}</td>
                            <td className="py-3 px-4">
                              <StatusPill value={row.connector.status ?? ''} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <TablePagination
                    total={filteredStatusRows.length}
                    page={statusPage}
                    perPage={statusPerPage}
                    onPageChange={setStatusPage}
                    onPerPageChange={(n) => { setStatusPerPage(n); setStatusPage(1) }}
                  />
                </>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'connectors' && (
          <Card className="bg-card rounded-2xl p-6 shadow-sm border border-border">
            <form onSubmit={handleSave} className="space-y-6">
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
                    onChange={(v) => {
                      const id = v === '' ? '' : Number(v)
                      setFormLocationId(id)
                      setForm((f) => ({ ...f, charger_id: 0 }))
                    }}
                    placeholder="Select location"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Charger</label>
                  <AppSelect
                    options={[{ value: '', label: 'Select charger' }, ...formChargers.map((c) => ({ value: String(c.id), label: `${c.name} (${c.chargerID})` }))]}
                    value={form.charger_id ? String(form.charger_id) : ''}
                    onChange={(v) => setForm((f) => ({ ...f, charger_id: Number(v) }))}
                    placeholder="Select charger"
                    isDisabled={!formLocationId}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Connector</label>
                  <AppSelect
                    options={[{ value: 'new', label: '--- New Connector ---' }, ...formConnectors.map((c) => ({ value: String(c.id), label: `Connector ${c.id} (${c.type})` }))]}
                    value={selectedConnectorId === 'new' ? 'new' : String(selectedConnectorId)}
                    onChange={(v) => setSelectedConnectorId(v === 'new' ? 'new' : Number(v))}
                    placeholder="--- New Connector ---"
                    isDisabled={!form.charger_id}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Connector Type *</label>
                  <AppSelect
                    options={CONNECTOR_TYPES.map((t) => ({ value: t, label: t }))}
                    value={form.connector_type ?? form.type ?? 'Type 2'}
                    onChange={(v) => setForm((f) => ({ ...f, connector_type: v }))}
                    placeholder="Type 2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status *</label>
                  <AppSelect
                    options={CONNECTOR_STATUSES.map((s) => ({ value: s, label: s }))}
                    value={form.status}
                    onChange={(v) => setForm((f) => ({ ...f, status: v }))}
                    placeholder="Status"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Power *</label>
                  <Input
                    value={form.power ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, power: e.target.value }))}
                    placeholder="22, 60, 120"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Power Unit</label>
                  <Input value={form.power_unit ?? 'kw'} onChange={(e) => setForm((f) => ({ ...f, power_unit: e.target.value }))} placeholder="kw" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Time Limit (min)</label>
                  <Input
                    type="number"
                    value={form.time_limit ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, time_limit: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="60, 90, 300"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-muted/50 p-4 space-y-3">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.enabled !== false} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} className="rounded border-input" />
                  <span className="text-sm font-medium">Enable Connector</span>
                </label>
              </div>

              <EntityFormActions
                mode={isEditMode ? 'edit' : 'add'}
                entityLabel="connector"
                isSubmitting={submitting}
                disableSaveWhenInvalid={!form.charger_id || !form.power}
                onDiscard={handleDiscard}
                onDelete={handleDeleteConnector}
                hasExistingEntity={isEditMode}
              />
            </form>
          </Card>
        )}
      </div>
    </div>
  )
}
