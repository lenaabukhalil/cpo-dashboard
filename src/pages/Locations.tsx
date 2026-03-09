import { useEffect, useState, useMemo } from 'react'
import { Search, ChevronDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  type Location as LocationType,
  type CreateLocationBody,
} from '../services/api'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Switch } from '../components/ui/switch'
import { MapSelector } from '../components/MapSelector'
import { LogoUpload } from '../components/LogoUpload'
import { PageTabs } from '../components/PageTabs'
import { EmptyState } from '../components/EmptyState'
import { TablePagination } from '../components/TablePagination'
import { EntityFormActions } from '../components/EntityFormActions'
import { AppSelect } from '../components/shared/AppSelect'
import { cn } from '../lib/utils'

const PAYMENT_OPTIONS = ['ION', 'Cash', 'ION & Cash', 'All'] as const
const AVAILABILITY_OPTIONS = ['available', 'coming_soon', 'unavailable', 'offline'] as const
const SUBSCRIPTION_OPTIONS = ['free', 'premium'] as const
const NUM_CHARGERS_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

const LOCATIONS_TABS = [
  { id: 'list', label: 'List' },
  { id: 'manage', label: 'Locations' },
]

const emptyLocationForm = (orgId: number): CreateLocationBody => ({
  organization_id: orgId,
  name: '',
  name_ar: '',
  lat: '',
  lng: '',
  num_chargers: undefined,
  description: '',
  logo_url: '',
  ad_url: '',
  payment_types: '',
  availability: '',
  subscription: 'free',
  visible_on_map: false,
  ocpi_id: '',
  ocpi_name: '',
  ocpi_address: '',
  ocpi_city: '',
  ocpi_postal_code: '',
  ocpi_country: '',
  ocpi_visible: false,
  ocpi_facility: '',
  ocpi_parking_restrictions: '',
  ocpi_directions: '',
  ocpi_directions_en: '',
})

const inputSelectClass =
  'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

function AvailabilityPill({ value }: { value: string }) {
  const v = (value || '').toLowerCase()
  const style =
    v === 'available'
      ? 'bg-emerald-100 text-emerald-800'
      : v === 'unavailable' || v === 'offline'
        ? 'bg-rose-100 text-rose-800'
        : v === 'coming_soon'
          ? 'bg-amber-100 text-amber-800'
          : 'bg-muted text-muted-foreground'
  return (
    <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ring-black/5 shadow-sm', style)}>
      {value || '—'}
    </span>
  )
}

export default function Locations() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'list' | 'manage'>('list')
  const [list, setList] = useState<LocationType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [listSearch, setListSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [selectedLocationId, setSelectedLocationId] = useState<number | 'new'>('new')
  const [form, setForm] = useState<CreateLocationBody>(() => emptyLocationForm(user?.organization_id ?? 0))
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [locationToDelete, setLocationToDelete] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const orgId = user?.organization_id

  const load = () => {
    if (orgId == null) return
    setLoading(true)
    getLocations(orgId)
      .then((r) => {
        if (r.success && r.data) setList(Array.isArray(r.data) ? r.data : [])
        else setError(r.message || 'Failed to load')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (orgId != null) load()
    else setLoading(false)
  }, [orgId])

  useEffect(() => {
    if (orgId != null) setForm((f) => ({ ...f, organization_id: orgId }))
  }, [orgId])

  const openEdit = (loc: LocationType) => {
    setActiveTab('manage')
    setSelectedLocationId(loc.location_id)
    setForm({
      organization_id: loc.organization_id,
      name: loc.name ?? '',
      name_ar: loc.name_ar ?? '',
      lat: loc.lat ?? '',
      lng: loc.lng ?? '',
      num_chargers: loc.num_chargers ?? undefined,
      description: loc.description ?? '',
      logo_url: loc.logo_url ?? '',
      ad_url: loc.ad_url ?? '',
      payment_types: loc.payment_types ?? '',
      availability: loc.availability ?? '',
      subscription: (loc.subscription as string) ?? 'free',
      visible_on_map: !!loc.visible_on_map,
      ocpi_id: loc.ocpi_id ?? '',
      ocpi_name: loc.ocpi_name ?? '',
      ocpi_address: loc.ocpi_address ?? '',
      ocpi_city: loc.ocpi_city ?? '',
      ocpi_postal_code: loc.ocpi_postal_code ?? '',
      ocpi_country: loc.ocpi_country ?? '',
      ocpi_visible: !!loc.ocpi_visible,
      ocpi_facility: loc.ocpi_facility ?? '',
      ocpi_parking_restrictions: loc.ocpi_parking_restrictions ?? '',
      ocpi_directions: loc.ocpi_directions ?? '',
      ocpi_directions_en: loc.ocpi_directions_en ?? '',
    })
  }

  useEffect(() => {
    if (selectedLocationId === 'new') {
      setForm((f) => ({ ...emptyLocationForm(orgId ?? 0), organization_id: f.organization_id }))
      return
    }
    const loc = list.find((l) => l.location_id === selectedLocationId)
    if (loc) {
      setForm({
        organization_id: loc.organization_id,
        name: loc.name ?? '',
        name_ar: loc.name_ar ?? '',
        lat: loc.lat ?? '',
        lng: loc.lng ?? '',
        num_chargers: loc.num_chargers ?? undefined,
        description: loc.description ?? '',
        logo_url: loc.logo_url ?? '',
        ad_url: loc.ad_url ?? '',
        payment_types: loc.payment_types ?? '',
        availability: loc.availability ?? '',
        subscription: (loc.subscription as string) ?? 'free',
        visible_on_map: !!loc.visible_on_map,
        ocpi_id: loc.ocpi_id ?? '',
        ocpi_name: loc.ocpi_name ?? '',
        ocpi_address: loc.ocpi_address ?? '',
        ocpi_city: loc.ocpi_city ?? '',
        ocpi_postal_code: loc.ocpi_postal_code ?? '',
        ocpi_country: loc.ocpi_country ?? '',
        ocpi_visible: !!loc.ocpi_visible,
        ocpi_facility: loc.ocpi_facility ?? '',
        ocpi_parking_restrictions: loc.ocpi_parking_restrictions ?? '',
        ocpi_directions: loc.ocpi_directions ?? '',
        ocpi_directions_en: loc.ocpi_directions_en ?? '',
      })
    }
  }, [selectedLocationId, orgId])

  const filteredList = useMemo(() => {
    if (!listSearch.trim()) return list
    const q = listSearch.toLowerCase()
    return list.filter(
      (l) =>
        (l.name ?? '').toLowerCase().includes(q) ||
        (l.name_ar ?? '').toLowerCase().includes(q)
    )
  }, [list, listSearch])

  const totalPages = Math.max(1, Math.ceil(filteredList.length / perPage))
  const paginatedList = useMemo(
    () => filteredList.slice((page - 1) * perPage, page * perPage),
    [filteredList, page, perPage]
  )

  useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(1)
  }, [page, totalPages])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSubmitting(true)
    setMessage('')
    if (selectedLocationId !== 'new') {
      const res = await updateLocation(selectedLocationId, form)
      setSubmitting(false)
      if (res.success) {
        setMessage('Location updated.')
        load()
      } else setMessage(res.message || 'Update failed')
    } else {
      const res = await createLocation({ ...form, organization_id: orgId! })
      setSubmitting(false)
      if (res.success) {
        setMessage('Location created.')
        setSelectedLocationId('new')
        setForm(emptyLocationForm(orgId!))
        load()
      } else setMessage(res.message || 'Create failed')
    }
    setTimeout(() => setMessage(''), 3000)
  }

  const handleDiscard = () => {
    if (selectedLocationId !== 'new') {
      const loc = list.find((l) => l.location_id === selectedLocationId)
      if (loc) {
        setForm({
          organization_id: loc.organization_id,
          name: loc.name ?? '',
          name_ar: loc.name_ar ?? '',
          lat: loc.lat ?? '',
          lng: loc.lng ?? '',
          num_chargers: loc.num_chargers ?? undefined,
          description: loc.description ?? '',
          logo_url: loc.logo_url ?? '',
          ad_url: loc.ad_url ?? '',
          payment_types: loc.payment_types ?? '',
          availability: loc.availability ?? '',
          subscription: (loc.subscription as string) ?? 'free',
          visible_on_map: !!loc.visible_on_map,
          ocpi_id: loc.ocpi_id ?? '',
          ocpi_name: loc.ocpi_name ?? '',
          ocpi_address: loc.ocpi_address ?? '',
          ocpi_city: loc.ocpi_city ?? '',
          ocpi_postal_code: loc.ocpi_postal_code ?? '',
          ocpi_country: loc.ocpi_country ?? '',
          ocpi_visible: !!loc.ocpi_visible,
          ocpi_facility: loc.ocpi_facility ?? '',
          ocpi_parking_restrictions: loc.ocpi_parking_restrictions ?? '',
          ocpi_directions: loc.ocpi_directions ?? '',
          ocpi_directions_en: loc.ocpi_directions_en ?? '',
        })
      }
    } else setForm(emptyLocationForm(orgId ?? 0))
  }

  const handleDeleteLocation = async () => {
    if (selectedLocationId === 'new') return
    const res = await deleteLocation(selectedLocationId)
    if (res.success) {
      setMessage('Location deleted.')
      setSelectedLocationId('new')
      setForm(emptyLocationForm(orgId ?? 0))
      load()
    } else setMessage(res.message || 'Delete failed')
    setTimeout(() => setMessage(''), 3000)
  }

  const isEditMode = selectedLocationId !== 'new'

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
        <h1 className="text-2xl font-bold mb-1">Locations</h1>
        <p className="text-sm text-muted-foreground mb-6">Manage charging station locations and operations</p>
        <PageTabs tabs={LOCATIONS_TABS} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as 'list' | 'manage')} />
        <div className="text-xs text-muted-foreground pt-5 pb-4 border-b border-border">ION Dashboard / Locations</div>
      </div>

      <div className="pt-2">
        {message && (
          <div className={cn('mb-4 p-3 rounded-lg text-sm', message.toLowerCase().includes('fail') || message.toLowerCase().includes('error') ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-800 dark:text-green-200')}>{message}</div>
        )}

        {activeTab === 'list' && (
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="text-base">Locations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-lg bg-destructive/10 text-destructive p-3 text-sm flex items-center justify-between">
                  <span>{error}</span>
                  <Button type="button" variant="outline" size="sm" onClick={load}>Retry</Button>
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search by Locations" className="pl-10" value={listSearch} onChange={(e) => setListSearch(e.target.value)} />
              </div>
              {loading ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Loading...</div>
              ) : filteredList.length === 0 ? (
                <EmptyState title="No Locations" description="No locations found." />
              ) : (
                <>
                  <div className="overflow-x-auto border rounded-lg border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/30">
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name (AR)</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Chargers</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Payment</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Availability</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Show on map</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedList.map((loc) => (
                          <tr key={loc.location_id} className="hover:bg-muted/50 border-t border-border">
                            <td className="py-3 px-4 font-medium">{loc.name}</td>
                            <td className="py-3 px-4 text-muted-foreground">{loc.name_ar ?? '—'}</td>
                            <td className="py-3 px-4">{loc.num_chargers ?? '—'}</td>
                            <td className="py-3 px-4">{loc.payment_types ?? '—'}</td>
                            <td className="py-3 px-4">
                              <AvailabilityPill value={loc.availability ?? ''} />
                            </td>
                            <td className="py-3 px-4">{loc.visible_on_map ? 'Yes' : 'No'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <TablePagination
                    total={filteredList.length}
                    page={page}
                    perPage={perPage}
                    onPageChange={setPage}
                    onPerPageChange={(n) => { setPerPage(n); setPage(1) }}
                  />
                </>
              )}
            </CardContent>
          </Card>
        )}

        {locationToDelete != null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-location-title">
            <div className="bg-card rounded-2xl border border-border p-6 shadow-lg max-w-sm w-full">
              <h3 id="delete-location-title" className="text-lg font-semibold text-foreground">Delete this location?</h3>
              <p className="mt-2 text-sm text-muted-foreground">This action cannot be undone.</p>
              <div className="mt-6 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setLocationToDelete(null)} disabled={deleting}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={async () => {
                    if (locationToDelete == null) return
                    setDeleting(true)
                    const res = await deleteLocation(locationToDelete)
                    setDeleting(false)
                    if (res.success) {
                      setLocationToDelete(null)
                      load()
                    }
                  }}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'manage' && (
          <Card className="relative z-10 bg-card rounded-2xl p-6 shadow-sm border border-border">
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Organization</label>
                  <div className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground cursor-default pointer-events-none">
                    <span>{loading ? 'Loading...' : (orgId != null ? `Organization ${orgId}` : '—')}</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Location</label>
                  <AppSelect
                    options={[
                      { value: 'new', label: '--- Add New Location ---' },
                      ...list.map((loc) => ({ value: String(loc.location_id), label: loc.name })),
                    ]}
                    value={selectedLocationId === 'new' ? 'new' : String(selectedLocationId)}
                    onChange={(v) => setSelectedLocationId(v === 'new' ? 'new' : Number(v))}
                    placeholder={loading ? 'Loading...' : undefined}
                  />
                </div>
              </div>
              {loading && (
                <p className="text-xs text-muted-foreground">Loading location details...</p>
              )}
              {isEditMode && (
                <div>
                  <label className="block text-sm font-medium mb-1">Location ID (Edit Mode)</label>
                  <Input value={selectedLocationId} readOnly className="w-full bg-muted" />
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Location Name (EN) *</label>
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.trim() }))} placeholder="Enter location name in English" required className="w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Location Name (AR)</label>
                  <Input value={form.name_ar ?? ''} onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}                   placeholder="أدخل اسم الموقع بالعربية" dir="rtl" className="w-full" />
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <h3 className="text-base font-semibold text-foreground pb-2">Map & coordinates</h3>
              </div>
              <MapSelector lat={form.lat ?? ''} lng={form.lng ?? ''} onLatLngChange={(lat: string, lng: string) => setForm((f) => ({ ...f, lat, lng }))} disabled={submitting} onMessage={(msg: string) => setMessage(msg)} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Num Chargers</label>
                  <AppSelect
                    options={[
                      { value: '', label: 'Select number of chargers' },
                      ...NUM_CHARGERS_OPTIONS.map((n) => ({ value: String(n), label: `${n} ${n === 1 ? 'charger' : 'chargers'}` })),
                    ]}
                    value={form.num_chargers != null ? String(form.num_chargers) : ''}
                    onChange={(v) => setForm((f) => ({ ...f, num_chargers: v ? Number(v) : undefined }))}
                    placeholder="Select number of chargers"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea value={form.description ?? ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={cn(inputSelectClass, 'min-h-[80px] resize-y')} rows={2} placeholder="Enter location description" />
                </div>
              </div>
              <LogoUpload value={form.logo_url} onChange={(_: File | null, dataUrl?: string) => setForm((f) => ({ ...f, logo_url: dataUrl ?? '' }))} disabled={submitting} />
              <div>
                <label className="block text-sm font-medium mb-1">Ad URL</label>
                <Input value={form.ad_url ?? ''} onChange={(e) => setForm((f) => ({ ...f, ad_url: e.target.value }))} placeholder="https://example.com/ad.png" className="w-full" />
              </div>

              <div className="border-t border-border pt-6">
                <h3 className="text-base font-semibold text-foreground pb-2">Payment & availability</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Payment Type</label>
                  <AppSelect
                    options={[{ value: '', label: '—' }, ...PAYMENT_OPTIONS.map((o) => ({ value: o, label: o }))]}
                    value={form.payment_types ?? ''}
                    onChange={(v) => setForm((f) => ({ ...f, payment_types: v }))}
                    placeholder="—"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Availability</label>
                  <AppSelect
                    options={[{ value: '', label: '—' }, ...AVAILABILITY_OPTIONS.map((o) => ({ value: o, label: o.replace('_', ' ') }))]}
                    value={form.availability ?? ''}
                    onChange={(v) => setForm((f) => ({ ...f, availability: v }))}
                    placeholder="—"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Subscription</label>
                  <AppSelect
                    options={SUBSCRIPTION_OPTIONS.map((o) => ({ value: o, label: o }))}
                    value={form.subscription ?? 'free'}
                    onChange={(v) => setForm((f) => ({ ...f, subscription: v }))}
                    placeholder="free"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                <div>
                  <label className="text-base font-medium">Visible on Map</label>
                  <p className="text-sm text-muted-foreground">Show location on map for users</p>
                </div>
                <Switch checked={!!form.visible_on_map} onCheckedChange={(v: boolean) => setForm((f) => ({ ...f, visible_on_map: v }))} disabled={submitting} />
              </div>

              <div className="pt-6 border-t border-border">
                <h3 className="text-lg font-semibold text-foreground mb-4">OCPI Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input placeholder="OCPI ID" value={form.ocpi_id ?? ''} onChange={(e) => setForm((f) => ({ ...f, ocpi_id: e.target.value }))} />
                  <Input placeholder="OCPI Name" value={form.ocpi_name ?? ''} onChange={(e) => setForm((f) => ({ ...f, ocpi_name: e.target.value }))} />
                  <Input placeholder="OCPI Address" className="md:col-span-2" value={form.ocpi_address ?? ''} onChange={(e) => setForm((f) => ({ ...f, ocpi_address: e.target.value }))} />
                  <Input placeholder="OCPI City" value={form.ocpi_city ?? ''} onChange={(e) => setForm((f) => ({ ...f, ocpi_city: e.target.value }))} />
                  <Input placeholder="OCPI Postal Code" value={form.ocpi_postal_code ?? ''} onChange={(e) => setForm((f) => ({ ...f, ocpi_postal_code: e.target.value }))} />
                  <Input placeholder="OCPI Country (e.g. JO)" value={form.ocpi_country ?? ''} onChange={(e) => setForm((f) => ({ ...f, ocpi_country: e.target.value }))} />
                  <Input placeholder="OCPI Facility" value={form.ocpi_facility ?? ''} onChange={(e) => setForm((f) => ({ ...f, ocpi_facility: e.target.value }))} />
                  <Input placeholder="Parking restrictions" value={form.ocpi_parking_restrictions ?? ''} onChange={(e) => setForm((f) => ({ ...f, ocpi_parking_restrictions: e.target.value }))} />
                  <Input placeholder="OCPI Directions (EN)" value={form.ocpi_directions_en ?? ''} onChange={(e) => setForm((f) => ({ ...f, ocpi_directions_en: e.target.value }))} />
                  <Input placeholder="التوجيهات بالعربية" dir="rtl" value={form.ocpi_directions ?? ''} onChange={(e) => setForm((f) => ({ ...f, ocpi_directions: e.target.value }))} />
                </div>
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl mt-4">
                  <div>
                    <label className="text-base font-medium">OCPI Visible</label>
                    <p className="text-sm text-muted-foreground">Make location visible in OCPI</p>
                  </div>
                  <Switch checked={!!form.ocpi_visible} onCheckedChange={(v: boolean) => setForm((f) => ({ ...f, ocpi_visible: v }))} disabled={submitting} />
                </div>
              </div>
              <EntityFormActions
                mode={isEditMode ? 'edit' : 'add'}
                entityLabel="location"
                isSubmitting={submitting}
                disableSaveWhenInvalid={!form.name.trim()}
                onDiscard={handleDiscard}
                onDelete={handleDeleteLocation}
                hasExistingEntity={isEditMode}
              />
            </form>
          </Card>
        )}
      </div>
    </div>
  )
}
