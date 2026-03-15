import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import {
  getLocations,
  getChargers,
  getConnectors,
  getConnectorsStatus,
  getTariffs,
  getOrg,
  type Location as LocationType,
  type Charger,
  type Connector,
  type Tariff,
} from '../services/api'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import {
  MapPin,
  Zap,
  Plug,
  Building2,
} from 'lucide-react'
import { cn } from '../lib/utils'

interface ChargerWithConnectors extends Charger {
  connectors: Connector[]
}

interface LocationWithChargers extends LocationType {
  chargers: ChargerWithConnectors[]
}

/** Gradient badges: available (green), preparing (amber), busy (blue), error/unavailable (red) */
function StatusBadge({ status, className }: { status: string; className?: string }) {
  const v = (status ?? '').toLowerCase()
  const isOnline = ['online', 'available', 'free'].includes(v)
  const isOffline = ['offline', 'unavailable', 'faulted', 'error'].includes(v)
  const isBusy = ['busy', 'charging'].includes(v)
  const isPreparing = ['preparing', 'booked', 'suspended', 'reserved', 'finishing'].includes(v)
  const gradientStyle = isOnline
    ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0 shadow-sm'
    : isOffline
      ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white border-0 shadow-sm'
      : isPreparing
        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white border-0 shadow-sm'
        : isBusy
          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0 shadow-sm'
          : 'bg-muted text-muted-foreground border border-border'
  return (
    <Badge variant="outline" className={cn('font-medium transition-transform hover:scale-105', gradientStyle, className)}>
      {status || '—'}
    </Badge>
  )
}

export default function OrgDetails() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [locations, setLocations] = useState<LocationWithChargers[]>([])
  const [orgName, setOrgName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [wizardStep, setWizardStep] = useState(0)
  const [wizardLocation, setWizardLocation] = useState<LocationWithChargers | null>(null)
  const [wizardCharger, setWizardCharger] = useState<ChargerWithConnectors | null>(null)
  const [wizardConnector, setWizardConnector] = useState<Connector | null>(null)
  const [tariffs, setTariffs] = useState<Tariff[]>([])
  const [tariffsLoading, setTariffsLoading] = useState(false)
  const [connectorTariffCounts, setConnectorTariffCounts] = useState<Record<number, number>>({})

  useEffect(() => {
    const orgId = user?.organization_id
    if (orgId == null) {
      setLoading(false)
      setError(t('details.noOrgAssigned'))
      return
    }

    setLoading(true)
    setError('')

    const loadOrg = getOrg(orgId).then((o) => {
      if (o.success && o.data && typeof (o.data as { name?: string }).name === 'string') {
        setOrgName((o.data as { name: string }).name)
      }
    })

    const loadLocations = getLocations(orgId).then((locRes) => {
      if (!locRes.success || !locRes.data) return [] as LocationWithChargers[]
      const locList = Array.isArray(locRes.data) ? locRes.data : []
      return Promise.all(
        locList.map((loc: LocationType) =>
          getChargers(loc.location_id).then((chRes) => {
            const chList = (chRes as { data?: Charger[] }).data ?? []
            const chargers = Array.isArray(chList) ? chList : []
            return Promise.all(
              chargers.map((ch: Charger) =>
                getConnectors(ch.id, undefined, { skipCache: true }).then((connRes) => {
                  const connList = (connRes as { data?: Connector[] }).data ?? []
                  return { ...ch, connectors: Array.isArray(connList) ? connList : [] }
                })
              )
            ).then((chargersWithConns) => ({
              ...loc,
              chargers: chargersWithConns as ChargerWithConnectors[],
            }))
          })
        )
      ) as Promise<LocationWithChargers[]>
    })

    Promise.all([loadOrg, loadLocations])
      .then(async ([, locWithChargers]) => {
        const tree = locWithChargers ?? []
        try {
          const statusRes = await getConnectorsStatus({ skipCache: true })
          const statusList = (statusRes as { data?: { chargerId?: number; connectorId?: number; status?: string }[] }).data ?? []
          const statusMap = new Map<string, string>()
          statusList.forEach((s) => {
            const cid = s.chargerId ?? (s as Record<string, unknown>).charger_id
            const connId = s.connectorId ?? (s as Record<string, unknown>).connector_id
            if (cid != null && connId != null) statusMap.set(`${cid}-${connId}`, (s.status ?? '').trim())
          })
          const merged = tree.map((loc) => ({
            ...loc,
            chargers: loc.chargers.map((ch) => ({
              ...ch,
              connectors: ch.connectors.map((conn) => {
                const liveStatus = statusMap.get(`${ch.id}-${conn.id}`)
                if (liveStatus !== undefined && liveStatus !== '') {
                  return { ...conn, status: liveStatus }
                }
                return conn
              }),
            })),
          }))
          setLocations(merged)
        } catch {
          setLocations(tree)
        }
      })
      .catch(() => setError(t('details.loadFailed')))
      .finally(() => setLoading(false))
  }, [user?.organization_id])

  // Load tariff counts per connector when on step 2 (connector selection)
  useEffect(() => {
    if (wizardStep !== 2 || !wizardCharger?.connectors?.length) {
      setConnectorTariffCounts({})
      return
    }
    const conns = wizardCharger.connectors
    conns.forEach((conn) => {
      getTariffs(conn.id)
        .then((res) => {
          const list = (res as { data?: Tariff[] }).data
          const count = Array.isArray(list) ? list.length : 0
          setConnectorTariffCounts((prev) => ({ ...prev, [conn.id]: count }))
        })
        .catch(() => setConnectorTariffCounts((prev) => ({ ...prev, [conn.id]: 0 })))
    })
  }, [wizardStep, wizardCharger])

  // Load tariffs when a connector is selected (step 3)
  useEffect(() => {
    if (wizardStep !== 3 || !wizardConnector) {
      setTariffs([])
      return
    }
    setTariffsLoading(true)
    getTariffs(wizardConnector.id)
      .then((res) => {
        const list = (res as { data?: Tariff[] }).data
        setTariffs(Array.isArray(list) ? list : [])
      })
      .catch(() => setTariffs([]))
      .finally(() => setTariffsLoading(false))
  }, [wizardStep, wizardConnector])

  const totals = useMemo(() => {
    let chargers = 0
    let connectors = 0
    locations.forEach((loc) => {
      loc.chargers.forEach((ch) => {
        chargers += 1
        connectors += ch.connectors.length
      })
    })
    return { locations: locations.length, chargers, connectors }
  }, [locations])

  if (loading) {
    return (
      <div className="space-y-6 font-poppins text-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('details.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('details.browse')}</p>
        </div>
        <Card className="border border-border flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6 font-poppins text-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('details.title')}</h1>
        </div>
        <Card className="border border-border p-6">
          <p className="text-destructive">{error}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-10 font-poppins text-start">
      {/* Page header – clear hierarchy + org name */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('details.title')}</h1>
        {orgName && (
          <p className="text-base font-semibold text-primary">
            {orgName}
          </p>
        )}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t('details.browse')}
        </p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { labelKey: 'details.locations' as const, value: totals.locations, icon: Building2, color: 'bg-primary/10 text-primary' },
          { labelKey: 'details.chargers' as const, value: totals.chargers, icon: Zap, color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
          { labelKey: 'details.connectors' as const, value: totals.connectors, icon: Plug, color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
        ].map(({ labelKey, value, icon: Icon, color }) => (
          <Card
            key={labelKey}
            className={cn(
              'border border-border bg-card transition-all duration-200 hover:shadow-lg hover:scale-[1.02] cursor-default'
            )}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', color)}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
                <p className="text-xs text-muted-foreground font-medium">{t(labelKey)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Step by step: Location → Charger → Connectors */}
        <div className="space-y-8 rounded-2xl border border-border bg-card shadow-sm p-6 sm:p-8">
          {/* Step indicator */}
          <div className="flex items-center justify-between gap-2 max-w-2xl">
            {[
              { step: 0, labelKey: 'details.location' as const },
              { step: 1, labelKey: 'details.charger' as const },
              { step: 2, labelKey: 'details.connector' as const },
              { step: 3, labelKey: 'details.tariffs' as const },
            ].map(({ step, labelKey: stepLabelKey }, i) => (
              <div key={step} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <span
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors',
                      wizardStep === step ? 'bg-primary text-primary-foreground ring-2 ring-primary/30' : wizardStep > step ? 'bg-primary/90 text-primary-foreground' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {step + 1}
                  </span>
                  <span className={cn('text-xs font-medium', wizardStep === step ? 'text-foreground' : 'text-muted-foreground')}>{t(stepLabelKey)}</span>
                </div>
                {i < 3 && <div className={cn('flex-1 h-0.5 mx-0.5 min-w-[8px]', wizardStep > step ? 'bg-primary' : 'bg-muted')} />}
              </div>
            ))}
          </div>

          {wizardStep === 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">{t('details.chooseLocation')}</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {locations.map((loc) => (
                  <button
                    key={loc.location_id}
                    type="button"
                    onClick={() => {
                      setWizardLocation(loc)
                      setWizardStep(1)
                      setWizardCharger(null)
                    }}
                    className="flex items-center gap-4 rounded-2xl border-2 border-border bg-muted/20 p-5 text-left transition-all hover:border-primary hover:bg-muted/30 hover:shadow-md"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                      <MapPin className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate">{loc.name}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{loc.chargers.length} charger{loc.chargers.length !== 1 ? 's' : ''}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {wizardStep === 1 && wizardLocation && (
            <div className="space-y-5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mb-2 -ml-1 rtl:mr-1 rtl:ml-0"
                onClick={() => { setWizardStep(0); setWizardLocation(null); setWizardCharger(null); }}
              >
                ← {t('details.backToLocations')}
              </Button>
              <div className="rounded-xl bg-muted/20 border border-border px-4 py-3 mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('details.locationName')}</p>
                <h3 className="text-xl font-bold text-foreground mt-0.5">{wizardLocation.name}</h3>
              </div>
              <p className="text-sm text-muted-foreground">{t('details.chooseCharger')}</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {wizardLocation.chargers.map((ch, idx) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      setWizardCharger(ch)
                      setWizardStep(2)
                    }}
                    className="group flex items-start gap-4 rounded-2xl border-2 border-border bg-muted/20 p-5 text-left transition-all hover:border-amber-500 hover:bg-amber-500/5 hover:shadow-md"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold text-lg">
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="font-bold text-foreground truncate">{ch.name ?? '—'}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-mono font-semibold text-primary">
                          {ch.chargerID ?? ch.id ?? '—'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {ch.type ?? '—'} · {ch.connectors.length} connector{ch.connectors.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <Zap className="h-5 w-5 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {wizardStep === 2 && wizardCharger && (
            <div className="space-y-5">
              <Button type="button" variant="outline" size="sm" className="mb-2 -ml-1 rtl:mr-1 rtl:ml-0" onClick={() => { setWizardStep(1); setWizardCharger(null); setWizardConnector(null); }}>
                ← {t('details.backToChargers')}
              </Button>
              <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 px-4 py-3 mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('details.chargerLabel')}</p>
                <h3 className="text-xl font-bold text-foreground mt-0.5">{wizardCharger.name ?? wizardCharger.chargerID}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t('details.chooseConnectorToViewTariffs')}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {wizardCharger.connectors.map((conn) => (
                  <button
                    key={conn.id}
                    type="button"
                    onClick={() => {
                      setWizardConnector(conn)
                      setWizardStep(3)
                    }}
                    className="group flex items-center gap-4 rounded-2xl border-2 border-border bg-muted/20 p-4 text-left transition-all hover:border-blue-500 hover:bg-blue-500/5 hover:shadow-md"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 font-mono font-bold">
                      {conn.id}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">{conn.connector_type ?? conn.type ?? '—'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={conn.status} className="text-xs" />
                        <span className="text-xs text-muted-foreground">
                          {conn.power != null ? `${conn.power} ${conn.power_unit ?? 'kW'}` : '—'}
                          {' · '}
                          {connectorTariffCounts[conn.id] !== undefined
                            ? `${connectorTariffCounts[conn.id]} tariff${connectorTariffCounts[conn.id] !== 1 ? 's' : ''}`
                            : '…'}
                        </span>
                      </div>
                    </div>
                    <Plug className="h-5 w-5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {wizardStep === 3 && wizardCharger && wizardConnector && (
            <div className="space-y-5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mb-2 -ml-1 rtl:mr-1 rtl:ml-0"
                onClick={() => { setWizardStep(2); setWizardConnector(null); setTariffs([]); }}
              >
                ← {t('details.backToConnectors')}
              </Button>
              <div className="rounded-xl bg-blue-500/5 border border-blue-500/20 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('details.connectorLabel')}</p>
                <h3 className="text-xl font-bold text-foreground mt-0.5">
                  {wizardConnector.connector_type ?? wizardConnector.type ?? '—'} (ID {wizardConnector.id})
                </h3>
                <p className="text-sm text-muted-foreground mt-1">{t('details.tariffsForThisConnector')}</p>
              </div>

              {tariffsLoading ? (
                <div className="py-8 flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" /></div>
              ) : (
                <div className="rounded-xl border border-border overflow-hidden shadow-sm table-wrap table-wrapper">
                  {tariffs.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">{t('details.noTariffsForConnector')}</div>
                  ) : (
                    <table className="w-full text-sm border-collapse min-w-[400px]">
                      <thead>
                        <tr className="bg-muted/40">
                          <th className="text-left py-3 px-4 font-semibold rtl:text-right">{t('details.tariffType')}</th>
                          <th className="text-left py-3 px-4 font-semibold rtl:text-right">{t('details.buySellRate')}</th>
                          <th className="text-left py-3 px-4 font-semibold rtl:text-right">{t('details.fees')}</th>
                          <th className="text-left py-3 px-4 font-semibold rtl:text-right">{t('list.status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tariffs.map((t) => (
                          <tr key={t.tariff_id} className="border-t border-border">
                            <td className="py-3 px-4 font-medium">{t.type ?? '—'}</td>
                            <td className="py-3 px-4">{t.buy_rate != null ? t.buy_rate : '—'} / {t.sell_rate != null ? t.sell_rate : '—'}</td>
                            <td className="py-3 px-4">{t.transaction_fees != null ? t.transaction_fees : '—'}</td>
                            <td className="py-3 px-4"><StatusBadge status={t.status} className="text-xs" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}

          {locations.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">No locations to show.</p>
          )}
        </div>
    </div>
  )
}
