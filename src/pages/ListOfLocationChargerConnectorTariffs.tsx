import { useEffect, useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import {
  getLocations,
  getChargers,
  getConnectors,
  getTariffs,
  type Location as LocationType,
  type Charger,
  type Connector,
  type Tariff,
} from '../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { TablePagination } from '../components/TablePagination'
import { EmptyState } from '../components/EmptyState'
import { PageTabs } from '../components/PageTabs'
import { cn } from '../lib/utils'

const TAB_IDS = ['location', 'charger', 'connector', 'tariff'] as const
function useListTabs(): { id: (typeof TAB_IDS)[number]; labelKey: string }[] {
  return [
    { id: 'location', labelKey: 'list.tabLocation' },
    { id: 'charger', labelKey: 'list.tabCharger' },
    { id: 'connector', labelKey: 'list.tabConnector' },
    { id: 'tariff', labelKey: 'list.tabTariff' },
  ]
}

type TabId = (typeof TAB_IDS)[number]

function availabilityLabel(v: string, t: (k: string) => string): string {
  if (v === 'available') return t('list.available')
  if (v === 'unavailable' || v === 'offline') return t('list.unavailable')
  return v || '—'
}

function statusLabel(v: string, t: (k: string) => string): string {
  if (v === 'available' || v === 'online') return t('list.available')
  if (v === 'unavailable' || v === 'offline') return t('list.unavailable')
  if (v === 'busy' || v === 'charging') return t('list.busy')
  return v || '—'
}

function AvailabilityPill({ value }: { value: string }) {
  const { t } = useTranslation()
  const v = (value || '').toLowerCase()
  const style =
    v === 'available'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
      : v === 'unavailable' || v === 'offline'
        ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300'
        : v === 'coming_soon'
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
          : 'bg-muted text-muted-foreground'
  return (
    <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ring-black/5 shadow-sm', style)}>
      {availabilityLabel(v, t)}
    </span>
  )
}

function StatusPill({ value }: { value: string }) {
  const { t } = useTranslation()
  const v = (value || '').toLowerCase()
  const style =
    v === 'available' || v === 'online'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
      : v === 'unavailable' || v === 'offline'
        ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300'
        : v === 'busy' || v === 'charging'
          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
          : v === 'error' || v === 'faulted'
            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
            : 'bg-muted text-muted-foreground'
  return (
    <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ring-black/5 shadow-sm', style)}>
      {statusLabel(v, t)}
    </span>
  )
}

function formatChargerTime(c: Charger): string {
  const raw = c.last_updated ?? (c as Record<string, unknown>).updated_at ?? (c as Record<string, unknown>).last_seen ?? (c as Record<string, unknown>).last_heartbeat ?? (c as Record<string, unknown>).created_at
  if (raw == null || raw === '') return '—'
  const d = new Date(typeof raw === 'string' ? raw : Number(raw) * (Number(raw) > 1e12 ? 1 : 1000))
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' })
}

interface ChargerRow extends Charger {
  locationName: string
}
interface ConnectorRow {
  locationName: string
  chargerName: string
  chargerId: number
  connector: Connector
}
interface TariffRow {
  locationName: string
  chargerName: string
  connectorId: number
  tariff: Tariff
}

const PER_PAGE_DEFAULT = 10

export default function ListOfLocationChargerConnectorTariffs() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const tabs = useListTabs()
  const orgId = user?.organization_id ?? null

  const [activeTab, setActiveTab] = useState<TabId>('location')
  const [locations, setLocations] = useState<LocationType[]>([])
  const [chargerRows, setChargerRows] = useState<ChargerRow[]>([])
  const [connectorRows, setConnectorRows] = useState<ConnectorRow[]>([])
  const [tariffRows, setTariffRows] = useState<TariffRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [chargerOfflineSearch, setChargerOfflineSearch] = useState('')
  const [chargerOnlineSearch, setChargerOnlineSearch] = useState('')

  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(PER_PAGE_DEFAULT)
  const [pageChargerOffline, setPageChargerOffline] = useState(1)
  const [pageChargerOnline, setPageChargerOnline] = useState(1)
  const [perPageChargerOffline, setPerPageChargerOffline] = useState(PER_PAGE_DEFAULT)
  const [perPageChargerOnline, setPerPageChargerOnline] = useState(PER_PAGE_DEFAULT)

  useEffect(() => {
    if (orgId == null) {
      setLoading(false)
      return
    }
    setLoading(true)
    getLocations(orgId)
      .then((r) => {
        if (!r.success || !r.data) return []
        return Array.isArray(r.data) ? r.data : []
      })
      .then((locList) => {
        setLocations(locList)
        return Promise.all(
          locList.map((loc: LocationType) =>
            getChargers(loc.location_id).then((chRes) => {
              const chList = (chRes as { data?: Charger[] }).data ?? []
              const arr = Array.isArray(chList) ? chList : []
              return arr.map((c: Charger) => ({ ...c, locationName: loc.name ?? '' }))
            })
          )
        ).then((arrays) => {
          const flat = arrays.flat()
          setChargerRows(flat)
          return { locList, chargerArrays: arrays }
        })
      })
      .then(({ locList }) => {
        return Promise.all(
          locList.map((loc: LocationType) =>
            getChargers(loc.location_id).then((chRes) => {
              const chList = (chRes as { data?: Charger[] }).data ?? []
              const chargers = Array.isArray(chList) ? chList : []
              return Promise.all(
                chargers.map((ch: Charger) =>
                  getConnectors(ch.id).then((connRes) => {
                    const connList = (connRes as { data?: Connector[] }).data ?? []
                    const conns = Array.isArray(connList) ? connList : []
                    return conns.map((conn: Connector) => ({
                      locationName: loc.name ?? '',
                      chargerName: ch.name ?? '',
                      chargerId: ch.id,
                      connector: conn,
                    }))
                  })
                )
              ).then((rows) => rows.flat())
            })
          )
        ).then((arrays) => {
          const flat = (arrays ?? []).flat()
          setConnectorRows(flat)
          return flat
        })
      })
      .then((connRows: ConnectorRow[]) => {
        return Promise.all(
          connRows.map((r) =>
            getTariffs(r.connector.id).then((tRes) => {
              const list = (tRes as { data?: Tariff[] }).data ?? []
              const tariffs = Array.isArray(list) ? list : []
              return tariffs.map((t: Tariff) => ({
                locationName: r.locationName,
                chargerName: r.chargerName,
                connectorId: r.connector.id,
                tariff: t,
              }))
            })
          )
        ).then((arrays) => setTariffRows(arrays.flat()))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [orgId])

  const filteredLocations = useMemo(() => {
    if (!search.trim()) return locations
    const q = search.toLowerCase()
    return locations.filter(
      (l) =>
        (l.name ?? '').toLowerCase().includes(q) ||
        (l.name_ar ?? '').toLowerCase().includes(q)
    )
  }, [locations, search])

  const filteredChargers = useMemo(() => {
    if (!search.trim()) return chargerRows
    const q = search.toLowerCase()
    return chargerRows.filter(
      (c) =>
        (c.name ?? '').toLowerCase().includes(q) ||
        (c.chargerID ?? '').toLowerCase().includes(q) ||
        (c.locationName ?? '').toLowerCase().includes(q)
    )
  }, [chargerRows, search])

  const chargerOfflineList = useMemo(() => {
    const base = chargerRows.filter((c) => {
      const s = (c.status ?? '').toLowerCase()
      return s !== 'online' && s !== 'available'
    })
    if (!chargerOfflineSearch.trim()) return base
    const q = chargerOfflineSearch.toLowerCase()
    return base.filter(
      (c) =>
        (c.name ?? '').toLowerCase().includes(q) ||
        String(c.chargerID ?? c.id).toLowerCase().includes(q)
    )
  }, [chargerRows, chargerOfflineSearch])

  const chargerOnlineList = useMemo(() => {
    const base = chargerRows.filter((c) => {
      const s = (c.status ?? '').toLowerCase()
      return s === 'online' || s === 'available'
    })
    if (!chargerOnlineSearch.trim()) return base
    const q = chargerOnlineSearch.toLowerCase()
    return base.filter(
      (c) =>
        (c.name ?? '').toLowerCase().includes(q) ||
        String(c.chargerID ?? c.id).toLowerCase().includes(q)
    )
  }, [chargerRows, chargerOnlineSearch])

  const totalChargerOfflinePages = Math.max(1, Math.ceil(chargerOfflineList.length / perPageChargerOffline))
  const totalChargerOnlinePages = Math.max(1, Math.ceil(chargerOnlineList.length / perPageChargerOnline))
  const paginatedChargerOffline = useMemo(
    () => chargerOfflineList.slice((pageChargerOffline - 1) * perPageChargerOffline, pageChargerOffline * perPageChargerOffline),
    [chargerOfflineList, pageChargerOffline, perPageChargerOffline]
  )
  const paginatedChargerOnline = useMemo(
    () => chargerOnlineList.slice((pageChargerOnline - 1) * perPageChargerOnline, pageChargerOnline * perPageChargerOnline),
    [chargerOnlineList, pageChargerOnline, perPageChargerOnline]
  )

  const filteredConnectors = useMemo(() => {
    if (!search.trim()) return connectorRows
    const q = search.toLowerCase()
    return connectorRows.filter(
      (r) =>
        r.locationName.toLowerCase().includes(q) ||
        r.chargerName.toLowerCase().includes(q) ||
        String(r.connector.id).includes(q) ||
        (r.connector.type ?? '').toLowerCase().includes(q)
    )
  }, [connectorRows, search])

  const filteredTariffs = useMemo(() => {
    if (!search.trim()) return tariffRows
    const q = search.toLowerCase()
    return tariffRows.filter(
      (r) =>
        r.locationName.toLowerCase().includes(q) ||
        r.chargerName.toLowerCase().includes(q) ||
        String(r.tariff.type).toLowerCase().includes(q) ||
        String(r.tariff.tariff_id).includes(q)
    )
  }, [tariffRows, search])

  const locationTotalPages = Math.max(1, Math.ceil(filteredLocations.length / perPage))
  const chargerTotalPages = Math.max(1, Math.ceil(filteredChargers.length / perPage))
  const connectorTotalPages = Math.max(1, Math.ceil(filteredConnectors.length / perPage))
  const tariffTotalPages = Math.max(1, Math.ceil(filteredTariffs.length / perPage))

  const paginatedLocations = useMemo(
    () => filteredLocations.slice((page - 1) * perPage, page * perPage),
    [filteredLocations, page, perPage]
  )
  const paginatedChargers = useMemo(
    () => filteredChargers.slice((page - 1) * perPage, page * perPage),
    [filteredChargers, page, perPage]
  )
  const paginatedConnectors = useMemo(
    () => filteredConnectors.slice((page - 1) * perPage, page * perPage),
    [filteredConnectors, page, perPage]
  )
  const paginatedTariffs = useMemo(
    () => filteredTariffs.slice((page - 1) * perPage, page * perPage),
    [filteredTariffs, page, perPage]
  )

  const totalPages =
    activeTab === 'location'
      ? locationTotalPages
      : activeTab === 'charger'
        ? chargerTotalPages
        : activeTab === 'connector'
          ? connectorTotalPages
          : tariffTotalPages
  useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(1)
  }, [page, totalPages])

  const handleTabChange = (id: string) => {
    setActiveTab(id as TabId)
    setPage(1)
    setSearch('')
  }

  if (orgId == null) {
    return (
      <div className="space-y-6">
        <p className="text-destructive">No organization assigned.</p>
      </div>
    )
  }

  const tabsWithLabels = useMemo(() => tabs.map((tab) => ({ id: tab.id, label: t(tab.labelKey) })), [tabs, t])

  return (
    <div className="space-y-6 text-start">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('list.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('list.subtitle')}
        </p>
        <PageTabs tabs={tabsWithLabels} activeTab={activeTab} onTabChange={handleTabChange} />
      </div>

      <Card className="border border-border rounded-2xl shadow-sm bg-card">
        {activeTab !== 'charger' && (
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">
                {activeTab === 'location' ? t('list.locations') : activeTab === 'connector' ? t('list.connectors') : t('list.tariffs')}
              </CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground rtl:left-auto rtl:right-3" />
                <Input
                  placeholder={
                    activeTab === 'location'
                      ? t('list.searchByLocations')
                      : activeTab === 'connector'
                        ? t('list.searchByOrgLocationChargerConnector')
                        : t('list.searchTariffs')
                  }
                  className="pl-9 bg-muted/30 border-border rounded-lg"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                />
              </div>
            </div>
          </CardHeader>
        )}
        <CardContent className="space-y-4">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
          ) : activeTab === 'location' && filteredLocations.length === 0 ? (
            <EmptyState title="No locations" description="No locations found." />
          ) : activeTab === 'charger' && chargerOfflineList.length === 0 && chargerOnlineList.length === 0 ? (
            <EmptyState title="No chargers" description="No chargers found." />
          ) : activeTab === 'connector' && filteredConnectors.length === 0 ? (
            <EmptyState title="No connectors" description="No connectors found." />
          ) : activeTab === 'tariff' && filteredTariffs.length === 0 ? (
            <EmptyState title="No tariffs" description="No tariffs found." />
          ) : (
            <>
              {activeTab === 'location' && (
                <div className="overflow-x-auto border rounded-lg border-border bg-white">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#f3f4f6] dark:bg-muted/50">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground rtl:text-right">{t('list.name')}</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground rtl:text-right">{t('list.nameAr')}</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground rtl:text-right">{t('list.chargersCount')}</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground rtl:text-right">{t('list.payment')}</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground rtl:text-right">{t('list.availability')}</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground rtl:text-right">{t('list.visibility')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLocations.map((loc, i) => (
                        <tr
                          key={loc.location_id}
                          className={cn(
                            'border-t border-border',
                            i % 2 === 0 ? 'bg-white' : 'bg-muted/20',
                            'hover:bg-muted/40'
                          )}
                        >
                          <td className="py-3 px-4 font-medium text-foreground">{loc.name}</td>
                          <td className="py-3 px-4 text-muted-foreground">{loc.name_ar ?? '—'}</td>
                          <td className="py-3 px-4">{loc.num_chargers ?? '—'}</td>
                          <td className="py-3 px-4">{loc.payment_types ?? '—'}</td>
                          <td className="py-3 px-4">
                            <AvailabilityPill value={loc.availability ?? ''} />
                          </td>
                          <td className="py-3 px-4">{loc.visible_on_map ? 1 : 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'charger' && (
                <div className="flex flex-col lg:flex-row gap-6 items-stretch">
                  <Card className="rounded-2xl border border-border shadow-sm bg-white overflow-hidden flex flex-col flex-1 min-h-0">
                    <CardContent className="p-6 flex flex-col flex-1 min-h-0 flex-grow">
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shrink-0" aria-hidden />
                        <span className="inline-flex items-center rounded-full bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 px-3 py-1.5 text-xs font-semibold ring-1 ring-rose-200/50">
                          {t('list.offline')}
                        </span>
                      </div>
                      <div className="relative shrink-0 mt-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          placeholder={t('common.search')}
                          className="pl-9 bg-muted/30 border-border rounded-lg h-10"
                          value={chargerOfflineSearch}
                          onChange={(e) => { setChargerOfflineSearch(e.target.value); setPageChargerOffline(1) }}
                        />
                      </div>
                      <div className="flex-1 flex flex-col min-h-0 border rounded-xl border-border bg-white mt-4 overflow-hidden">
                        {paginatedChargerOffline.length === 0 ? (
                          <div className="flex-1 flex items-center justify-center min-h-0 p-4">
                            <div className="text-center">
                              <p className="text-muted-foreground text-sm font-medium">{t('list.noOfflineChargers')}</p>
                              <p className="text-muted-foreground/80 text-xs mt-1">All chargers are online or no data yet</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 min-h-0 overflow-auto">
                            <table className="w-full text-sm border-collapse">
                              <thead className="sticky top-0 bg-[#f3f4f6] dark:bg-muted/50 border-b border-border z-10">
                                <tr>
                                  <th className="text-start py-3 px-4 font-medium text-muted-foreground">{t('list.name')}</th>
                                  <th className="text-start py-3 px-4 font-medium text-muted-foreground">{t('list.id')}</th>
                                  <th className="text-start py-3 px-4 font-medium text-muted-foreground">{t('list.time')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {paginatedChargerOffline.map((c, i) => (
                                  <tr
                                    key={c.id}
                                    className={cn(
                                      'border-b border-border/50 last:border-0 transition-colors',
                                      i % 2 === 0 ? 'bg-white' : 'bg-muted/20',
                                      'hover:bg-muted/30'
                                    )}
                                  >
                                    <td className="py-3 px-4 font-medium text-foreground">{c.name}</td>
                                    <td className="py-3 px-4 text-muted-foreground font-mono text-xs">{c.chargerID ?? c.id}</td>
                                    <td className="py-3 px-4 text-muted-foreground text-xs">{formatChargerTime(c)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 mt-4">
                        <TablePagination
                          total={chargerOfflineList.length}
                          page={pageChargerOffline}
                          perPage={perPageChargerOffline}
                          onPageChange={setPageChargerOffline}
                          onPerPageChange={(n) => { setPerPageChargerOffline(n); setPageChargerOffline(1) }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl border border-border shadow-sm bg-white overflow-hidden flex flex-col flex-1 min-h-0">
                    <CardContent className="p-6 flex flex-col flex-1 min-h-0 flex-grow">
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" aria-hidden />
                        <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 px-3 py-1.5 text-xs font-semibold ring-1 ring-emerald-200/50">
                          {t('list.online')}
                        </span>
                      </div>
                      <div className="relative shrink-0 mt-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          placeholder={t('common.search')}
                          className="pl-9 bg-muted/30 border-border rounded-lg h-10"
                          value={chargerOnlineSearch}
                          onChange={(e) => { setChargerOnlineSearch(e.target.value); setPageChargerOnline(1) }}
                        />
                      </div>
                      <div className="flex-1 flex flex-col min-h-0 border rounded-xl border-border bg-white mt-4 overflow-hidden">
                        {paginatedChargerOnline.length === 0 ? (
                          <div className="flex-1 flex items-center justify-center min-h-0 p-4">
                            <div className="text-center">
                              <p className="text-muted-foreground text-sm font-medium">No online chargers</p>
                              <p className="text-muted-foreground/80 text-xs mt-1">No chargers currently online</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 min-h-0 overflow-auto">
                            <table className="w-full text-sm border-collapse">
                              <thead className="sticky top-0 bg-[#f3f4f6] dark:bg-muted/50 border-b border-border z-10">
                                <tr>
                                  <th className="text-start py-3 px-4 font-medium text-muted-foreground">{t('list.name')}</th>
                                  <th className="text-start py-3 px-4 font-medium text-muted-foreground">{t('list.id')}</th>
                                  <th className="text-start py-3 px-4 font-medium text-muted-foreground">{t('list.time')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {paginatedChargerOnline.map((c, i) => (
                                  <tr
                                    key={c.id}
                                    className={cn(
                                      'border-b border-border/50 last:border-0 transition-colors',
                                      i % 2 === 0 ? 'bg-white' : 'bg-muted/20',
                                      'hover:bg-muted/30'
                                    )}
                                  >
                                    <td className="py-3 px-4 font-medium text-foreground">{c.name}</td>
                                    <td className="py-3 px-4 text-muted-foreground font-mono text-xs">{c.chargerID ?? c.id}</td>
                                    <td className="py-3 px-4 text-muted-foreground text-xs">{formatChargerTime(c)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 mt-4">
                        <TablePagination
                          total={chargerOnlineList.length}
                          page={pageChargerOnline}
                          perPage={perPageChargerOnline}
                          onPageChange={setPageChargerOnline}
                          onPerPageChange={(n) => { setPerPageChargerOnline(n); setPageChargerOnline(1) }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === 'connector' && (
                <div className="overflow-x-auto border rounded-lg border-border bg-white">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#f3f4f6] dark:bg-muted/50">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground rtl:text-right">{t('list.organization')}</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground rtl:text-right">{t('list.location')}</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground rtl:text-right">{t('list.charger')}</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground rtl:text-right">{t('list.connectorId')}</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground rtl:text-right">{t('list.type')}</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground rtl:text-right">{t('list.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedConnectors.map((r, i) => (
                        <tr
                          key={`${r.chargerId}-${r.connector.id}`}
                          className={cn(
                            'border-t border-border',
                            i % 2 === 0 ? 'bg-white' : 'bg-muted/20',
                            'hover:bg-muted/40'
                          )}
                        >
                          <td className="py-3 px-4 text-muted-foreground">CPO</td>
                          <td className="py-3 px-4">{r.locationName}</td>
                          <td className="py-3 px-4">{r.chargerName}</td>
                          <td className="py-3 px-4 font-medium">{r.connector.id}</td>
                          <td className="py-3 px-4">{r.connector.type ?? r.connector.connector_type ?? '—'}</td>
                          <td className="py-3 px-4">
                            <StatusPill value={r.connector.status ?? ''} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'tariff' && (
                <div className="overflow-x-auto border rounded-lg border-border bg-white">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#f3f4f6] dark:bg-muted/50">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground rtl:text-right">{t('list.location')}</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground rtl:text-right">{t('list.charger')}</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground rtl:text-right">{t('list.connectorId')}</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground rtl:text-right">{t('list.tariffId')}</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground rtl:text-right">{t('list.type')}</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground rtl:text-right">{t('list.buySell')}</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground rtl:text-right">{t('list.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedTariffs.map((r, i) => (
                        <tr
                          key={`${r.connectorId}-${r.tariff.tariff_id}`}
                          className={cn(
                            'border-t border-border',
                            i % 2 === 0 ? 'bg-white' : 'bg-muted/20',
                            'hover:bg-muted/40'
                          )}
                        >
                          <td className="py-3 px-4">{r.locationName}</td>
                          <td className="py-3 px-4">{r.chargerName}</td>
                          <td className="py-3 px-4">{r.connectorId}</td>
                          <td className="py-3 px-4 font-medium">{r.tariff.tariff_id}</td>
                          <td className="py-3 px-4">{r.tariff.type ?? '—'}</td>
                          <td className="py-3 px-4">{r.tariff.buy_rate ?? 0} / {r.tariff.sell_rate ?? 0}</td>
                          <td className="py-3 px-4">{r.tariff.status ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab !== 'charger' && (
                <TablePagination
                  total={
                    activeTab === 'location'
                      ? filteredLocations.length
                      : activeTab === 'connector'
                        ? filteredConnectors.length
                        : filteredTariffs.length
                  }
                  page={page}
                  perPage={perPage}
                  onPageChange={setPage}
                  onPerPageChange={(n) => { setPerPage(n); setPage(1) }}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
