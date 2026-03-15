import { useEffect, useState, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getLocations } from '../services/api'
import {
  getChargers,
  createCharger,
  updateCharger,
  deleteCharger,
  type Charger as ChargerType,
  type CreateChargerBody,
} from '../services/api'
import { Card } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import { EntityFormActions } from '../components/EntityFormActions'
import { AppSelect } from '../components/shared/AppSelect'
import { PageTabs } from '../components/PageTabs'
import { cn } from '../lib/utils'
import { formatDateTime } from '../lib/dateFormat'

const CHARGER_TABS = [
  { id: 'status', label: 'Status' },
  { id: 'chargers', label: 'Chargers' },
]

const CHARGER_STATUS_OPTIONS = [
  { value: 'online', label: 'Online' },
  { value: 'available', label: 'Available' },
  { value: 'offline', label: 'Offline' },
  { value: 'unavailable', label: 'Unavailable' },
  { value: 'error', label: 'Error' },
] as const

type PageTab = 'status' | 'chargers'

const inputSelectClass =
  'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

function getChargerTimeRaw(c: ChargerType): string | number | null | undefined {
  const rec = c as unknown as Record<string, unknown>
  const raw =
    rec.last_updated ?? rec.updated_at ?? rec.last_seen ?? rec.last_heartbeat ??
    rec.timestamp ?? rec.created_at ?? rec.time
  return raw as string | number | null | undefined
}

export default function Chargers() {
  const { user } = useAuth()
  const orgId = user?.organization_id ?? null

  const [locations, setLocations] = useState<{ location_id: number; name: string }[]>([])
  const [allChargers, setAllChargers] = useState<ChargerType[]>([])
  const [loadingChargers, setLoadingChargers] = useState(false)
  const [, setLoadingLocations] = useState(false)
  const [activeTab, setActiveTab] = useState<PageTab>('status')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Form state: cascading Organization → Location → Charger
  const [_selectedOrgId, setSelectedOrgId] = useState<number | ''>(orgId ?? '')
  const [selectedLocationId, setSelectedLocationId] = useState<number | ''>('')
  const [selectedChargerId, setSelectedChargerId] = useState<number | '' | 'new'>('new')
  const [chargersInLocation, setChargersInLocation] = useState<ChargerType[]>([])

  const [form, setForm] = useState<CreateChargerBody>({
    name: '',
    type: 'AC',
    status: 'offline',
    location_id: 0,
  })

  // Status tab: search filters
  const [statusOnlineSearch, setStatusOnlineSearch] = useState('')
  const [statusOfflineSearch, setStatusOfflineSearch] = useState('')

  useEffect(() => {
    if (orgId == null) return
    setLoadingLocations(true)
    getLocations(orgId)
      .then((r) => {
        if (r.success && r.data) setLocations(Array.isArray(r.data) ? r.data : [])
      })
      .finally(() => setLoadingLocations(false))
  }, [orgId])

  useEffect(() => {
    if (orgId != null) setSelectedOrgId(orgId)
  }, [orgId])

  // Load chargers for selected location (Chargers tab)
  useEffect(() => {
    if (selectedLocationId === '') {
      setChargersInLocation([])
      return
    }
    getChargers(Number(selectedLocationId))
      .then((r) => {
        if (r.success && r.data) setChargersInLocation(Array.isArray(r.data) ? r.data : [])
        else setChargersInLocation([])
      })
  }, [selectedLocationId])

  // Load all chargers for Status tab (all locations)
  useEffect(() => {
    if (activeTab !== 'status' || locations.length === 0) return
    setLoadingChargers(true)
    Promise.all(locations.map((loc) => getChargers(loc.location_id)))
      .then((results) => {
        const merged: ChargerType[] = []
        results.forEach((r) => {
          if (r.success && r.data && Array.isArray(r.data)) merged.push(...r.data)
        })
        setAllChargers(merged)
      })
      .finally(() => setLoadingChargers(false))
  }, [activeTab, locations])

  const isEditMode = selectedChargerId !== '' && selectedChargerId !== 'new'
  const currentCharger = useMemo(
    () => chargersInLocation.find((c) => c.id === Number(selectedChargerId)),
    [chargersInLocation, selectedChargerId]
  )

  // When switching to "New Charger" or selecting a charger, sync form
  useEffect(() => {
    if (selectedLocationId === '') return
    if (selectedChargerId === 'new' || selectedChargerId === '') {
      setForm({
        name: '',
        type: 'AC',
        status: 'offline',
        location_id: Number(selectedLocationId),
        ...(orgId != null && { organization_id: orgId }),
      })
      return
    }
    const c = chargersInLocation.find((x) => x.id === Number(selectedChargerId))
    if (c) {
      setForm({
        name: c.name,
        type: c.type || 'AC',
        status: c.status || 'offline',
        location_id: c.locationId,
        num_connectors: c.num_connectors,
        max_session_time: c.max_session_time,
        description: c.description,
        ...(orgId != null && { organization_id: orgId }),
      })
    }
  }, [selectedChargerId, selectedLocationId, chargersInLocation, orgId])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.location_id) return
    setSubmitting(true)
    setMessage('')
    if (isEditMode && currentCharger) {
      const res = await updateCharger(currentCharger.id, form)
      setSubmitting(false)
      if (res.success) {
        setMessage('Charger updated.')
        const listRes = await getChargers(Number(selectedLocationId))
        if (listRes.success && listRes.data) setChargersInLocation(Array.isArray(listRes.data) ? listRes.data : [])
      } else setMessage(res.message || 'Update failed')
    } else {
      const res = await createCharger({ ...form, organization_id: orgId ?? undefined })
      setSubmitting(false)
      if (res.success) {
        setMessage('Charger created.')
        setSelectedChargerId('new')
        setForm({ name: '', type: 'AC', status: 'offline', location_id: form.location_id, organization_id: orgId ?? undefined })
        const listRes = await getChargers(Number(selectedLocationId))
        if (listRes.success && listRes.data) setChargersInLocation(Array.isArray(listRes.data) ? listRes.data : [])
      } else setMessage(res.message || 'Create failed')
    }
    setTimeout(() => setMessage(''), 4000)
  }

  const handleDiscard = () => {
    if (isEditMode && currentCharger) {
      setForm({
        name: currentCharger.name,
        type: currentCharger.type || 'AC',
        status: currentCharger.status || 'offline',
        location_id: currentCharger.locationId,
        num_connectors: currentCharger.num_connectors,
        max_session_time: currentCharger.max_session_time,
        description: currentCharger.description,
        ...(orgId != null && { organization_id: orgId }),
      })
    } else {
      setForm({
        name: '',
        type: 'AC',
        status: 'offline',
        location_id: Number(selectedLocationId) || 0,
        ...(orgId != null && { organization_id: orgId }),
      })
    }
  }

  const handleDeleteCharger = async () => {
    if (!currentCharger) return
    const res = await deleteCharger(currentCharger.id)
    if (res.success) {
      setMessage('Charger deleted.')
      setSelectedChargerId('new')
      const listRes = await getChargers(Number(selectedLocationId))
      if (listRes.success && listRes.data) setChargersInLocation(Array.isArray(listRes.data) ? listRes.data : [])
    } else setMessage(res.message || 'Delete failed')
    setTimeout(() => setMessage(''), 4000)
  }

  const onlineList = useMemo(() => {
    const base = allChargers.filter((c) => c.status === 'online' || c.status === 'available')
    if (!statusOnlineSearch.trim()) return base
    const q = statusOnlineSearch.toLowerCase()
    return base.filter((c) => c.name.toLowerCase().includes(q) || (c.chargerID || '').toLowerCase().includes(q))
  }, [allChargers, statusOnlineSearch])

  const offlineList = useMemo(() => {
    const base = allChargers.filter((c) => c.status !== 'online' && c.status !== 'available')
    if (!statusOfflineSearch.trim()) return base
    const q = statusOfflineSearch.toLowerCase()
    return base.filter((c) => c.name.toLowerCase().includes(q) || (c.chargerID || '').toLowerCase().includes(q))
  }, [allChargers, statusOfflineSearch])

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
        <h1 className="text-2xl font-bold text-foreground mb-1">Chargers</h1>
        <p className="text-sm text-muted-foreground mb-4">Manage your chargers and view status</p>
        <PageTabs tabs={CHARGER_TABS} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as PageTab)} />
        <div className="text-xs text-muted-foreground pt-5 pb-4 border-b border-border">ION Dashboard / Chargers</div>
      </div>

      <div className="pt-2">
        {activeTab === 'status' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Online card */}
            <Card className="rounded-2xl p-6 shadow-sm border border-border bg-card">
              <Badge className="mb-4 rounded-full bg-emerald-50 text-emerald-700 border-0">Online</Badge>
              <div className="relative mb-4">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <SearchIcon />
                </span>
                <Input
                  placeholder="Search"
                  className="pl-8"
                  value={statusOnlineSearch}
                  onChange={(e) => setStatusOnlineSearch(e.target.value)}
                />
              </div>
              <div className="overflow-x-auto table-wrap table-wrapper">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-left">
                      <th className="pb-2 pr-2 font-medium">Name</th>
                      <th className="pb-2 pr-2 font-medium">ID</th>
                      <th className="pb-2 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingChargers ? (
                      <tr><td colSpan={3} className="py-4 text-muted-foreground">Loading...</td></tr>
                    ) : onlineList.length === 0 ? (
                      <tr><td colSpan={3} className="py-4 text-muted-foreground">No online chargers</td></tr>
                    ) : (
                      onlineList.map((c) => (
                        <tr key={c.id} className="border-b border-border/50">
                          <td className="py-2 pr-2 font-medium">{c.name}</td>
                          <td className="py-2 pr-2 text-muted-foreground">{c.chargerID ?? c.id}</td>
                          <td className="py-2 text-muted-foreground">{formatDateTime(getChargerTimeRaw(c))}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Offline card */}
            <Card className="rounded-2xl p-6 shadow-sm border border-border bg-card">
              <Badge className="mb-4 rounded-full bg-red-50 text-red-700 border-0">Offline</Badge>
              <div className="relative mb-4">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <SearchIcon />
                </span>
                <Input
                  placeholder="Search"
                  className="pl-8"
                  value={statusOfflineSearch}
                  onChange={(e) => setStatusOfflineSearch(e.target.value)}
                />
              </div>
              <div className="overflow-x-auto table-wrap table-wrapper">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-left">
                      <th className="pb-2 pr-2 font-medium">Name</th>
                      <th className="pb-2 pr-2 font-medium">ID</th>
                      <th className="pb-2 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingChargers ? (
                      <tr><td colSpan={3} className="py-4 text-muted-foreground">Loading...</td></tr>
                    ) : offlineList.length === 0 ? (
                      <tr><td colSpan={3} className="py-4 text-muted-foreground">No offline chargers</td></tr>
                    ) : (
                      offlineList.map((c) => (
                        <tr key={c.id} className="border-b border-border/50">
                          <td className="py-2 pr-2 font-medium">{c.name}</td>
                          <td className="py-2 pr-2 text-muted-foreground">{c.chargerID ?? c.id}</td>
                          <td className="py-2 text-muted-foreground">{formatDateTime(getChargerTimeRaw(c))}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'chargers' && (
          <Card className="rounded-2xl p-6 shadow-sm border border-border bg-card">
            {message && (
              <div className="mb-4 p-3 rounded-lg bg-muted text-muted-foreground text-sm">{message}</div>
            )}
            <form className="space-y-6" onSubmit={handleSave}>
              {/* Cascading row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Organization</Label>
                  <div className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground cursor-default pointer-events-none">
                    <span>{orgId != null ? `Organization ${orgId}` : '—'}</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <AppSelect
                    options={[{ value: '', label: 'Select location' }, ...locations.map((loc) => ({ value: String(loc.location_id), label: loc.name }))]}
                    value={selectedLocationId === '' ? '' : String(selectedLocationId)}
                    onChange={(v) => {
                      const id = v === '' ? '' : Number(v)
                      setSelectedLocationId(id)
                      setSelectedChargerId('new')
                    }}
                    placeholder="Select location"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Charger</Label>
                  <AppSelect
                    options={[{ value: 'new', label: '--- New Charger ---' }, ...chargersInLocation.map((c) => ({ value: String(c.id), label: c.name }))]}
                    value={selectedChargerId === 'new' ? 'new' : selectedChargerId === '' ? '' : String(selectedChargerId)}
                    onChange={(v) => setSelectedChargerId(v === 'new' ? 'new' : v === '' ? '' : Number(v))}
                    placeholder="--- New Charger ---"
                    isDisabled={selectedLocationId === ''}
                  />
                </div>
              </div>

              {/* Form fields grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                    placeholder="Charger name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <AppSelect
                    options={[{ value: 'AC', label: 'AC' }, { value: 'DC', label: 'DC' }]}
                    value={form.type}
                    onChange={(v) => setForm((f) => ({ ...f, type: v }))}
                    placeholder="AC"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <AppSelect
                    options={CHARGER_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                    value={form.status}
                    onChange={(v) => setForm((f) => ({ ...f, status: v }))}
                    placeholder="Status"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Session Time (min)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.max_session_time ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, max_session_time: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="e.g. 120"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Connectors</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.num_connectors ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, num_connectors: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="Number of connectors"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Description</Label>
                  <textarea
                    rows={3}
                    value={form.description ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className={cn(inputSelectClass, 'min-h-[80px] resize-y')}
                    placeholder="Optional description"
                  />
                </div>
              </div>

              <EntityFormActions
                mode={isEditMode ? 'edit' : 'add'}
                entityLabel="charger"
                isSubmitting={submitting}
                disableSaveWhenInvalid={!form.name.trim() || !form.location_id}
                onDiscard={handleDiscard}
                onDelete={handleDeleteCharger}
                hasExistingEntity={isEditMode && !!currentCharger}
              />
            </form>
          </Card>
        )}
      </div>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}
