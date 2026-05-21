import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { AppMultiSelect } from '../../components/shared/AppMultiSelect'
import { SessionsReportDateTimeField } from '../../components/SessionsReportDateTimeField'
import { BillsTable, exportBillsCsv, sortBillsRows, type BillsSortKey } from '../../components/financial/BillsTable'
import {
  getFinancialBills,
  type FinancialBillRow,
  type FinancialReportQueryParams,
} from '../../api/financial'
import { OrgSelector } from '../../components/shared/OrgSelector'
import { useAccessibleOrgs } from '../../hooks/useAccessibleOrgs'
import type { AccessibleOrg } from '../../types/org'
import { getChargers, getConnectors, getLocations, type Charger, type Connector, type Location } from '../../services/api'
import { useTranslation } from '../../context/LanguageContext'
import {
  getNowDatetimeLocal,
  getTodayMidnightDatetimeLocal,
  sanitizeFilenameDateRange,
  validateSessionsDatetimeRange,
  type SessionsRangeValidationError,
} from '../../lib/sessionsReportRange'

function financialRangeValidationMessage(code: SessionsRangeValidationError, t: (key: string) => string): string {
  switch (code) {
    case 'required':
      return t('reports.validationDateRequired')
    case 'invalidFormat':
      return t('reports.validationInvalidDateTimeFormat')
    case 'fromAfterTo':
      return t('reports.validationFromBeforeTo')
    default:
      return t('reports.validationInvalidDate')
  }
}

const BILLS_PER_PAGE = 10

/** Locations use business `organization_id`; API may return rows for other orgs when grants exist. */
function filterLocationsForOrg(list: Location[], org: AccessibleOrg): Location[] {
  const bizId = org.biz_id
  const pk = org.id
  return list.filter((loc) => {
    const oid = Number(loc.organization_id)
    return oid === bizId || oid === pk
  })
}

function chargerLocationId(charger: Charger): number {
  const rec = charger as Charger & { location_id?: number }
  const raw = charger.locationId ?? rec.location_id
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim())
  return Number.isFinite(n) ? n : 0
}

export default function FinancialReport() {
  const { t } = useTranslation()
  const {
    orgs,
    ownOrg,
    selectedOrgPK,
    setSelectedOrgPK,
    getTargetOrgIdParam,
    hasGrants,
    loading: orgsLoading,
  } = useAccessibleOrgs()

  /** Resolve from dropdown PK (same value OrgSelector uses), not hook selectedOrg alone. */
  const activeOrg = useMemo((): AccessibleOrg | null => {
    if (orgs.length === 0) return null
    if (selectedOrgPK == null) return ownOrg
    return orgs.find((o) => o.id === selectedOrgPK) ?? ownOrg
  }, [orgs, selectedOrgPK, ownOrg])

  const bizId = useMemo(() => {
    const id = activeOrg?.biz_id
    return id != null && Number.isFinite(id) ? id : undefined
  }, [activeOrg?.biz_id])

  const [from, setFrom] = useState(() => getTodayMidnightDatetimeLocal())
  const [to, setTo] = useState(() => getNowDatetimeLocal())
  const [locationIds, setLocationIds] = useState<string[]>([])
  const [chargerIds, setChargerIds] = useState<string[]>([])
  const [connectorIds, setConnectorIds] = useState<string[]>([])
  const [sessionType, setSessionType] = useState('')
  const [energyMin, setEnergyMin] = useState('')
  const [energyMax, setEnergyMax] = useState('')
  const [dateOrder, setDateOrder] = useState<'asc' | 'desc'>('desc')
  const [filterError, setFilterError] = useState<string | null>(null)

  const [locations, setLocations] = useState<Location[]>([])
  const [allOrgChargers, setAllOrgChargers] = useState<Charger[]>([])
  const [connectorsForFilter, setConnectorsForFilter] = useState<Connector[]>([])

  const [hasApplied, setHasApplied] = useState(false)
  const [bills, setBills] = useState<FinancialBillRow[]>([])
  const [billsCount, setBillsCount] = useState(0)

  const [mainLoading, setMainLoading] = useState(false)

  const [sortKey, setSortKey] = useState<BillsSortKey>('issueDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  const fetchFilteredLocationTree = useCallback(async (org: AccessibleOrg) => {
    const orgBizId = org.biz_id
    console.log('[FinancialReport] locations fetch', { selectedOrg: org, bizId: orgBizId })
    const r = await getLocations(orgBizId)
    const raw = Array.isArray(r.data) ? r.data : []
    const locList = filterLocationsForOrg(raw, org)
    if (!locList.length) {
      return { locations: locList, chargers: [] as Charger[] }
    }
    const locationIdSet = new Set(locList.map((l) => l.location_id))
    const results = await Promise.all(locList.map((loc) => getChargers(loc.location_id)))
    const chargers = results
      .map((res) => {
        const d = (res as { data?: Charger[] }).data ?? (res as unknown as Charger[])
        return Array.isArray(d) ? d : []
      })
      .flat()
      .filter((c) => locationIdSet.has(chargerLocationId(c)))
    return { locations: locList, chargers }
  }, [])

  useEffect(() => {
    if (orgsLoading || activeOrg == null || bizId == null) return

    setLocationIds([])
    setChargerIds([])
    setConnectorIds([])
    setConnectorsForFilter([])
    setBills([])
    setBillsCount(0)
    setHasApplied(false)
    setPage(1)

    let cancelled = false

    fetchFilteredLocationTree(activeOrg)
      .then(({ locations: locList, chargers }) => {
        if (cancelled) return
        setLocations(locList)
        setAllOrgChargers(chargers)
      })
      .catch(() => {
        if (!cancelled) {
          setLocations([])
          setAllOrgChargers([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedOrgPK, activeOrg, bizId, orgsLoading, fetchFilteredLocationTree])

  const chargerOptionsForFilter = useMemo(() => {
    if (locationIds.length === 0) return allOrgChargers
    const set = new Set(locationIds.map((id) => Number(id)))
    return allOrgChargers.filter((c) => set.has(chargerLocationId(c)))
  }, [allOrgChargers, locationIds])

  const locationOptions = useMemo(
    () => locations.map((l) => ({ value: String(l.location_id), label: l.name })),
    [locations]
  )
  const chargerFilterOptions = useMemo(
    () =>
      chargerOptionsForFilter.map((c) => ({
        value: String(c.charger_id ?? c.id),
        label: c.name ?? '',
      })),
    [chargerOptionsForFilter]
  )
  const connectorFilterOptions = useMemo(
    () =>
      connectorsForFilter.map((co) => ({
        value: String(co.id),
        label: co.connector_type || co.type || String(co.id),
      })),
    [connectorsForFilter]
  )

  useEffect(() => {
    if (chargerIds.length === 0) {
      setConnectorsForFilter([])
      setConnectorIds([])
      return
    }
    Promise.all(chargerIds.map((id) => getConnectors(Number(id))))
      .then((results) => {
        const lists = results.map((r) => {
          const d = (r as { data?: Connector[] }).data ?? (r as unknown as Connector[])
          return Array.isArray(d) ? d : []
        })
        const merged = lists.flat()
        const byId = new Map<number, Connector>()
        merged.forEach((co) => byId.set(co.id, co))
        setConnectorsForFilter(Array.from(byId.values()))
      })
      .catch(() => setConnectorsForFilter([]))
  }, [chargerIds])

  const buildFinancialParams = useCallback((): FinancialReportQueryParams => {
    const f = from.trim()
    const toVal = to.trim()
    const params: FinancialReportQueryParams = { from: f, to: toVal }
    const targetOrgId = getTargetOrgIdParam()
    if (targetOrgId) params.targetOrgId = targetOrgId
    if (locationIds.length > 0) params.locationIds = locationIds.join(',')
    if (chargerIds.length > 0) params.chargerIds = chargerIds.join(',')
    if (connectorIds.length > 0) params.connectorIds = connectorIds.join(',')
    if (sessionType) params.sessionType = sessionType
    if (energyMin.trim() !== '') params.energyMin = energyMin.trim()
    if (energyMax.trim() !== '') params.energyMax = energyMax.trim()
    if (dateOrder === 'asc') params.dateOrder = 'asc'
    return params
  }, [from, to, locationIds, chargerIds, connectorIds, sessionType, energyMin, energyMax, dateOrder, getTargetOrgIdParam])

  const validateFilters = useCallback((): boolean => {
    const f = from.trim()
    const toVal = to.trim()
    const rangeErr = validateSessionsDatetimeRange(f, toVal)
    if (rangeErr) {
      setFilterError(financialRangeValidationMessage(rangeErr, t))
      return false
    }
    const minKwh = energyMin.trim() !== '' ? parseFloat(energyMin) : NaN
    const maxKwh = energyMax.trim() !== '' ? parseFloat(energyMax) : NaN
    if (!Number.isNaN(minKwh) && !Number.isNaN(maxKwh) && minKwh > maxKwh) {
      setFilterError(t('reports.validationEnergyRange'))
      return false
    }
    setFilterError(null)
    return true
  }, [from, to, energyMin, energyMax, t])

  const handleApply = useCallback(async () => {
    if (!validateFilters()) return
    if (activeOrg == null || bizId == null || orgsLoading) return
    const orgForFetch = activeOrg
    const params = buildFinancialParams()
    setMainLoading(true)
    setPage(1)
    try {
      const { locations: locList, chargers } = await fetchFilteredLocationTree(orgForFetch)
      setLocations(locList)
      setAllOrgChargers(chargers)
      const bRes = await getFinancialBills(params)

      const bData = (bRes as { data?: FinancialBillRow[] }).data
      const list = Array.isArray(bData) ? bData : []
      setBills(list)
      const c = (bRes as { count?: number }).count
      setBillsCount(typeof c === 'number' && Number.isFinite(c) ? c : list.length)

      setHasApplied(true)
    } catch (e) {
      setFilterError((e as Error)?.message || t('reports.financial.loadFailed'))
      setBills([])
      setBillsCount(0)
      setHasApplied(false)
    } finally {
      setMainLoading(false)
    }
  }, [activeOrg, bizId, orgsLoading, buildFinancialParams, fetchFilteredLocationTree, t, validateFilters])

  const clearFilters = () => {
    setLocationIds([])
    setChargerIds([])
    setConnectorIds([])
    setSessionType('')
    setEnergyMin('')
    setEnergyMax('')
    setDateOrder('desc')
    setPage(1)
    setBills([])
    setBillsCount(0)
    setHasApplied(false)
    setFilterError(null)
  }

  const handleSort = (key: BillsSortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortDir('asc')
      return key
    })
    setPage(1)
  }

  const handleExportCsv = async () => {
    if (!validateFilters()) return
    const params = buildFinancialParams()
    try {
      const bRes = await getFinancialBills(params)
      const bData = (bRes as { data?: FinancialBillRow[] }).data
      const list = Array.isArray(bData) ? bData : []
      if (list.length === 0) return
      const sorted = sortBillsRows(list, sortKey, sortDir)
      const f = params.from
      const toVal = params.to
      exportBillsCsv(
        sorted,
        `financial-bills-${sanitizeFilenameDateRange(f)}_${sanitizeFilenameDateRange(toVal)}.csv`
      )
    } catch (e) {
      setFilterError((e as Error)?.message || t('reports.financial.loadFailed'))
    }
  }

  const hasActiveFilters =
    from.trim() ||
    to.trim() ||
    locationIds.length > 0 ||
    chargerIds.length > 0 ||
    connectorIds.length > 0 ||
    energyMin.trim() ||
    energyMax.trim()

  return (
    <div className="space-y-6">
      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="text-base">{t('reports.tab.financial')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('reports.financial.subtitle')}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 mb-2 pb-4 border-b border-border">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 shrink-0">
                <SessionsReportDateTimeField
                  fieldLabel={t('reports.from')}
                  value={from}
                  onChange={setFrom}
                  emptyTimeDefault="00:00"
                />
              </div>
              <div className="min-w-0 shrink-0">
                <SessionsReportDateTimeField
                  fieldLabel={t('reports.to')}
                  value={to}
                  onChange={setTo}
                  emptyTimeDefault="23:59"
                />
              </div>
              {hasGrants ? (
                <div className="min-w-[180px] max-w-[180px] shrink-0 [&>div>p]:hidden">
                  <OrgSelector
                    orgs={orgs}
                    value={selectedOrgPK}
                    onChange={setSelectedOrgPK}
                    loading={orgsLoading}
                    className="space-y-1.5 [&>div:first-child]:max-w-none [&>div:first-child]:w-full"
                  />
                </div>
              ) : null}
              <div className="space-y-1.5 min-w-[180px] max-w-[180px]">
                <Label className="text-xs text-muted-foreground">{t('list.location')}</Label>
                <AppMultiSelect
                  options={locationOptions}
                  value={locationIds}
                  onChange={setLocationIds}
                  placeholder={t('reports.allLocations')}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5 min-w-[180px] max-w-[180px]">
                <Label className="text-xs text-muted-foreground">{t('list.charger')}</Label>
                <AppMultiSelect
                  options={chargerFilterOptions}
                  value={chargerIds}
                  onChange={setChargerIds}
                  placeholder={t('reports.allChargers')}
                  className="bg-background"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5 min-w-[180px]">
                <Label className="text-xs text-muted-foreground">{t('list.connectors')}</Label>
                <AppMultiSelect
                  options={connectorFilterOptions}
                  value={connectorIds}
                  onChange={setConnectorIds}
                  placeholder={t('reports.allConnectors')}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Session Type</Label>
                <select
                  className="flex h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm min-w-[140px]"
                  value={sessionType}
                  onChange={(e) => setSessionType(e.target.value)}
                >
                  <option value="">All types</option>
                  <option value="ion">ION</option>
                  <option value="local">Local</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Energy (KWH)</Label>
                <div className="flex h-10 items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={energyMin}
                    onChange={(e) => setEnergyMin(e.target.value)}
                    className="h-10 w-24 text-sm rounded-lg"
                    min={0}
                    step="any"
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={energyMax}
                    onChange={(e) => setEnergyMax(e.target.value)}
                    className="h-10 w-24 text-sm rounded-lg"
                    min={0}
                    step="any"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('reports.dateSort')}</Label>
                <div
                  className="flex h-10 items-center rounded-lg border border-border bg-muted/30 p-0.5 gap-0.5"
                  role="group"
                  aria-label={t('reports.dateSort')}
                >
                  <Button
                    type="button"
                    variant={dateOrder === 'desc' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-9 shrink-0 px-3 text-xs sm:text-sm"
                    onClick={() => setDateOrder('desc')}
                  >
                    {t('reports.dateSortDesc')}
                  </Button>
                  <Button
                    type="button"
                    variant={dateOrder === 'asc' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-9 shrink-0 px-3 text-xs sm:text-sm"
                    onClick={() => setDateOrder('asc')}
                  >
                    {t('reports.dateSortAsc')}
                  </Button>
                </div>
              </div>
              <Button type="button" className="h-10" onClick={() => void handleApply()} disabled={mainLoading}>
                {mainLoading ? t('reports.loading') : t('reports.financial.apply')}
              </Button>
              {hasActiveFilters ? (
                <Button type="button" variant="outline" className="h-10" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null}
            </div>
          </div>

          {filterError ? <p className="text-sm text-destructive py-2">{filterError}</p> : null}
        </CardContent>
      </Card>

      {!hasApplied ? (
        <p className="text-sm text-muted-foreground">{t('reports.financial.hintApply')}</p>
      ) : (
        <>
          {mainLoading ? (
            <p className="text-sm text-muted-foreground py-4">{t('reports.loading')}</p>
          ) : null}
          <BillsTable
            bills={bills}
            apiTotalCount={billsCount}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            page={page}
            perPage={BILLS_PER_PAGE}
            onPageChange={setPage}
            onExportCsv={() => void handleExportCsv()}
          />
        </>
      )}
    </div>
  )
}
