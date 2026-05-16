const BASE = import.meta.env.VITE_API_URL || ''

/** Client-side fetch timeout (maps to 504-shaped response for callers e.g. login). */
const REQUEST_TIMEOUT_MS = 15_000

/** JWT / API permission values: boolean (current API) or legacy R/RW strings. */
export type PermissionValue = boolean | 'R' | 'RW'
export type PermissionMap = Record<string, PermissionValue>

/** GET cache: same URL within TTL returns cached response so data appears faster on revisit */
const GET_CACHE_TTL_MS = 20_000 // 20 seconds
const getCache = new Map<string, { data: unknown; at: number }>()

function combineAbortSignals(user: AbortSignal | undefined, timeout: AbortSignal): AbortSignal {
  if (!user) return timeout
  const c = new AbortController()
  const onAbort = () => {
    if (!c.signal.aborted) c.abort()
  }
  if (user.aborted || timeout.aborted) {
    onAbort()
    return c.signal
  }
  user.addEventListener('abort', onAbort, { once: true })
  timeout.addEventListener('abort', onAbort, { once: true })
  return c.signal
}

export function getToken(): string | null {
  return localStorage.getItem('cpo_token')
}

/** Clear GET cache (e.g. after logout or force refresh). */
export function clearGetCache(): void {
  getCache.clear()
}

export async function request<T>(
  path: string,
  opts: RequestInit & { params?: Record<string, string>; noAuth?: boolean; skipCache?: boolean } = {}
): Promise<{
  data?: T
  success: boolean
  message?: string
  statusCode?: number
  requiredPermission?: string
}> {
  const { params, noAuth, skipCache, signal: userSignal, ...init } = opts
  const url = new URL(path, window.location.origin)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const fullPath = url.pathname + url.search
  const method = (init.method || 'GET').toUpperCase()
  const isGet = method === 'GET'

  if (isGet && !skipCache) {
    const key = fullPath
    const hit = getCache.get(key)
    if (hit && Date.now() - hit.at < GET_CACHE_TTL_MS) {
      return hit.data as { data?: T; success: boolean; message?: string; statusCode?: number }
    }
  }

  const token = noAuth ? null : getToken()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const timeoutCtrl = new AbortController()
  const timeoutId = window.setTimeout(() => timeoutCtrl.abort(), REQUEST_TIMEOUT_MS)
  const combinedSignal = combineAbortSignals(userSignal ?? undefined, timeoutCtrl.signal)

  let res: Response
  try {
    res = await fetch(BASE + fullPath, { ...init, headers, signal: combinedSignal })
  } catch (e) {
    window.clearTimeout(timeoutId)
    const name = (e as Error)?.name
    if (name === 'AbortError') {
      if (timeoutCtrl.signal.aborted) {
        return { success: false, statusCode: 504, message: 'Request timed out' }
      }
      return { success: false, message: (e as Error)?.message || 'Network error' }
    }
    return { success: false, message: (e as Error)?.message || 'Network error' }
  }
  window.clearTimeout(timeoutId)

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const message = typeof json.message === 'string' ? json.message : res.statusText
    const requiredPermission =
      typeof json.requiredPermission === 'string' ? json.requiredPermission : undefined

    if (res.status === 403 && requiredPermission != null) {
      window.dispatchEvent(
        new CustomEvent('cpo-api-forbidden', {
          detail: { message: message || undefined },
        }),
      )
      return {
        ...json,
        success: false,
        message,
        statusCode: res.status,
        requiredPermission,
      } as { data?: T; success: boolean; message?: string; statusCode?: number; requiredPermission?: string }
    }

    if (res.status === 401 && !fullPath.includes('auth/login')) {
      clearGetCache()
      localStorage.removeItem('cpo_token')
      localStorage.removeItem('cpo_permissions')
      window.location.href = '/login'
    }
    return {
      ...json,
      success: false,
      message,
      statusCode: res.status,
      ...(requiredPermission !== undefined ? { requiredPermission } : {}),
    } as { data?: T; success: boolean; message?: string; statusCode?: number; requiredPermission?: string }
  }
  const out = { ...json, success: json.success !== false }
  if (isGet && res.ok) getCache.set(fullPath, { data: out, at: Date.now() })
  return out
}

// Auth
export async function login(identifier: string, password: string) {
  return request<{ token: string; user: AuthUser; permissions: PermissionMap }>('/api/v4/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
    noAuth: true,
  })
}

export async function me(opts?: { skipCache?: boolean }) {
  return request<{ user: AuthUser; permissions: PermissionMap }>('/api/v4/auth/me', {
    ...(opts?.skipCache && { skipCache: true }),
  })
}

/** Call backend logout so audit_log records a logout event. Uses current token; safe to call even if token is missing/expired. */
export async function logoutApi() {
  return request<{ message?: string }>('/api/v4/auth/logout', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function updateProfile(body: { f_name?: string; l_name?: string; email?: string; mobile?: string }) {
  return request<{ message?: string }>('/api/v4/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export interface AuthUser {
  user_id: number
  organization_id: number
  mobile: string
  role_name: string
  f_name: string
  l_name: string
  email?: string
  profile_img_url?: string | null
  /** Optional copy of server `permissions` when merged onto context user; primary map lives on AuthContext. */
  permissions?: PermissionMap
}

// Org (read only for CPO) — skipCache so sidebar logo updates after save
export async function getOrg(id: number) {
  return request<Org>('/api/v4/org', { params: { id: String(id) }, skipCache: true })
}

// Partner users (org-scoped)
export interface PartnerUser {
  user_id: number
  organization_id: number
  f_name: string
  l_name: string
  mobile: string
  email?: string | null
  role_id: number
  user_type?: string
  is_active?: number
  last_login_at?: string | null
  profile_img_url?: string | null
  subs_plan?: string
  provider_user_id?: string | null
  language?: string
}

export async function getPartnerUsers(
  organizationId: number,
  params?: { q?: string; limit?: number; offset?: number; is_active?: boolean; skipCache?: boolean }
) {
  const p: Record<string, string> = { organization_id: String(organizationId) }
  if (params?.q) p.q = params.q
  if (params?.limit != null) p.limit = String(params.limit)
  if (params?.offset != null) p.offset = String(params.offset)
  if (params?.is_active !== undefined) p.is_active = params.is_active ? '1' : '0'
  const skipCache = params?.skipCache === true
  return request<{ data: PartnerUser[] }>('/api/v4/users/partner', { params: p, skipCache })
}

export interface RbacRole {
  id: number
  name: string
  code: string
  description?: string
}

let rolesCache: RbacRole[] | null = null
let rolesFetchPromise: Promise<RbacRole[]> | null = null

/** GET /api/v4/roles — cached in memory after first successful load. */
export async function getRoles(): Promise<RbacRole[]> {
  if (rolesCache) return rolesCache
  if (rolesFetchPromise) return rolesFetchPromise
  rolesFetchPromise = request<{ data: RbacRole[] }>('/api/v4/roles', { skipCache: true })
    .then((res) => {
      const data = (res as { data?: RbacRole[] }).data
      const list = Array.isArray(data) ? data : []
      if (res.success && list.length > 0) rolesCache = list
      return list
    })
    .catch(() => [] as RbacRole[])
    .finally(() => {
      rolesFetchPromise = null
    })
  return rolesFetchPromise
}

export function clearRolesCache() {
  rolesCache = null
}

export async function createPartnerUser(body: {
  first_name: string
  last_name: string
  country_code: number
  mobile: string
  email: string
  password: string
  role_id: number
  user_type: string
}) {
  return request<{ success: boolean; message?: string; insertId?: number }>('/api/v4/users/partner', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updatePartnerUser(
  userId: number,
  body: Partial<{ f_name: string; l_name: string; mobile: string; email: string; role_id: number; user_type: string; password: string; is_active: boolean }>
) {
  return request<{ success: boolean; message?: string }>('/api/v4/users/partner', {
    method: 'PUT',
    params: { id: String(userId) },
    body: JSON.stringify(body),
  })
}

export async function deletePartnerUser(userId: number) {
  return request<{ success: boolean; message?: string }>('/api/v4/users/partner', {
    method: 'DELETE',
    params: { id: String(userId) },
  })
}

// Organization resource grants
export interface Grant {
  id: number
  grantee_organization_id: number
  grantee_org_name?: string
  scope_type: 'organization' | 'location' | 'charger'
  target_organization_id?: number | null
  target_org_name?: string | null
  target_location_id?: number | null
  target_location_name?: string | null
  target_charger_id?: number | null
  target_charger_name?: string | null
  relationship_type: string
  can_view: number
  can_manage: number
  can_operate: number
  can_view_bills: number
  status: 'active' | 'disabled'
  starts_at?: string | null
  ends_at?: string | null
  created_at?: string
}

export async function getGrants() {
  return request<{ count: number; data: Grant[] }>('/api/v4/grants', { skipCache: true })
}

export async function createGrant(body: {
  grantee_organization_id: number
  scope_type: 'organization' | 'location' | 'charger'
  target_organization_id?: number | null
  target_location_id?: number | null
  target_charger_id?: number | null
  relationship_type?: string
  can_view?: boolean
  can_manage?: boolean
  can_operate?: boolean
  can_view_bills?: boolean
  starts_at?: string | null
  ends_at?: string | null
}) {
  return request<{ success: boolean; insertId?: number }>('/api/v4/grants', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function revokeGrant(id: number) {
  return request<{ success: boolean }>('/api/v4/grants', {
    method: 'DELETE',
    params: { id: String(id) },
  })
}

export interface Org {
  organization_id: number
  name: string
  name_ar?: string
  contact_first_name?: string
  contact_last_name?: string
  contact_phoneNumber?: string
  details?: string
  logo_url?: string | null
}

export async function updateOrg(id: number, body: Partial<Pick<Org, 'name' | 'name_ar' | 'contact_first_name' | 'contact_last_name' | 'contact_phoneNumber' | 'details' | 'logo_url'>>) {
  return request<{ success: boolean; message?: string }>('/api/v4/org', {
    method: 'PUT',
    params: { id: String(id) },
    body: JSON.stringify(body),
  })
}

// Locations
export async function getLocations(organizationId: number) {
  return request<Location[]>('/api/v4/location', { params: { organizationId: String(organizationId) } })
}

export async function getLocation(id: number) {
  return request<Location>('/api/v4/location', { params: { id: String(id) } })
}

export async function createLocation(body: CreateLocationBody) {
  return request<{ insertId?: number }>('/api/v4/location', { method: 'POST', body: JSON.stringify(body) })
}

export async function updateLocation(id: number, body: Partial<CreateLocationBody>) {
  return request('/api/v4/location', { method: 'PUT', params: { id: String(id) }, body: JSON.stringify(body) })
}

export async function deleteLocation(id: number) {
  return request('/api/v4/location', { method: 'DELETE', params: { id: String(id) } })
}

export interface Location {
  location_id: number
  organization_id: number
  name: string
  name_ar?: string
  lat?: string
  lng?: string
  num_chargers?: number
  description?: string
  logo_url?: string
  ad_url?: string
  payment_types?: string
  availability?: string
  subscription?: string
  visible_on_map?: number
  ocpi_id?: string
  ocpi_name?: string
  ocpi_address?: string
  ocpi_city?: string
  ocpi_postal_code?: string
  ocpi_country?: string
  ocpi_visible?: number
  ocpi_facility?: string
  ocpi_parking_restrictions?: string
  ocpi_directions?: string
  ocpi_directions_en?: string
}

export interface CreateLocationBody {
  organization_id: number
  name: string
  name_ar?: string
  lat?: string
  lng?: string
  num_chargers?: number | null
  description?: string
  logo_url?: string
  ad_url?: string
  payment_types?: string
  availability?: string
  subscription?: string
  visible_on_map?: boolean
  ocpi_id?: string
  ocpi_name?: string
  ocpi_address?: string
  ocpi_city?: string
  ocpi_postal_code?: string
  ocpi_country?: string
  ocpi_visible?: boolean
  ocpi_facility?: string
  ocpi_parking_restrictions?: string
  ocpi_directions?: string
  ocpi_directions_en?: string
}

// Chargers
export async function getChargers(locationId?: number, id?: number) {
  const params: Record<string, string> = {}
  if (id != null) params.id = String(id)
  else if (locationId != null) params.locationId = String(locationId)
  return request<{ data: Charger[] }>('/api/v4/charger', { params })
}

export async function createCharger(body: CreateChargerBody) {
  return request<{ insertId?: number; chargerID?: string }>('/api/v4/charger', { method: 'POST', body: JSON.stringify(body) })
}

export async function updateCharger(id: number, body: Partial<CreateChargerBody>) {
  return request('/api/v4/charger', { method: 'PUT', params: { id: String(id) }, body: JSON.stringify(body) })
}

export async function deleteCharger(id: number) {
  return request('/api/v4/charger', { method: 'DELETE', params: { id: String(id) } })
}

export interface Charger {
  id: number
  /** DB column charger_id (matches Partner_Bill.charger_id); use for sessions-report filter when present */
  charger_id?: number
  name: string
  chargerID: string
  type: string
  status: string
  locationId: number
  max_session_time?: number
  num_connectors?: number
  description?: string
  /** Last updated from API (ocpi_last_update) - used for List "Time" column */
  time?: string | number
  /** Last updated / last seen / heartbeat - ISO string or Unix timestamp from API */
  last_updated?: string | number
  updated_at?: string | number
  last_seen?: string | number
  last_heartbeat?: string | number
  timestamp?: string | number
  created_at?: string | number
}

export interface CreateChargerBody {
  name: string
  type: string
  status: string
  location_id: number
  organization_id?: number
  chargerID?: string
  num_connectors?: number
  max_session_time?: number
  description?: string
}

// Connectors (skipCache: use true when listing so status matches DB / Monitor)
export async function getConnectors(
  chargerId?: number,
  id?: number,
  opts?: { skipCache?: boolean }
) {
  const params: Record<string, string> = {}
  if (id != null) params.id = String(id)
  else if (chargerId != null) params.chargerId = String(chargerId)
  return request<{ data: Connector[] }>('/api/v4/connector', {
    params,
    ...(opts?.skipCache && { skipCache: true }),
  })
}

export async function createConnector(body: CreateConnectorBody) {
  return request<{ insertId?: number }>('/api/v4/connector', { method: 'POST', body: JSON.stringify(body) })
}

export async function updateConnector(id: number, body: Partial<CreateConnectorBody>) {
  return request('/api/v4/connector', { method: 'PUT', params: { id: String(id) }, body: JSON.stringify(body) })
}

export async function deleteConnector(id: number) {
  return request('/api/v4/connector', { method: 'DELETE', params: { id: String(id) } })
}

export interface Connector {
  id: number
  chargerId: number
  type: string
  connector_type?: string
  status: string
  power?: number | string
  power_unit?: string
  time_limit?: number
  enabled?: number
  pin?: string
  stop_on80?: number | boolean
  ocpi_id?: string
  ocpi_standard?: string
  ocpi_format?: string
  ocpi_power_type?: string
  ocpi_max_voltage?: string
  ocpi_max_amperage?: string
  ocpi_tariff_ids?: string
}

export interface CreateConnectorBody {
  charger_id: number
  connector_type: string
  type?: string
  status: string
  power: number | string
  power_unit?: string
  time_limit?: number
  pin?: string
  enabled?: boolean
  stop_on80?: boolean
  ocpi_id?: string
  ocpi_standard?: string
  ocpi_format?: string
  ocpi_power_type?: string
  ocpi_max_voltage?: string
  ocpi_max_amperage?: string
  ocpi_tariff_ids?: string
}

// Tariffs
export async function getTariffs(connectorId?: number, id?: number) {
  const params: Record<string, string> = {}
  if (id != null) params.id = String(id)
  else if (connectorId != null) params.connectorId = String(connectorId)
  return request<{ data: Tariff[] }>('/api/v4/tariff', params ? { params } : {})
}

export async function getAllTariffs() {
  return request<{ data: Tariff[] }>('/api/v4/tariff')
}

export async function createTariff(body: CreateTariffBody) {
  return request<{ insertId?: number }>('/api/v4/tariff', { method: 'POST', body: JSON.stringify(body) })
}

export async function updateTariff(id: number, body: Partial<CreateTariffBody>) {
  return request('/api/v4/tariff', { method: 'PUT', params: { id: String(id) }, body: JSON.stringify(body) })
}

export async function deleteTariff(id: number) {
  return request('/api/v4/tariff', { method: 'DELETE', params: { id: String(id) } })
}

export interface Tariff {
  tariff_id: number
  type: string
  buy_rate?: number
  sell_rate?: number
  transaction_fees?: number
  client_percentage?: number
  partner_percentage?: number
  peak_type?: string
  status: string
  created_at?: string
}

export interface CreateTariffBody {
  connector_id: number
  type: string
  buy_rate: number
  sell_rate: number
  transaction_fees?: number
  client_percentage?: number
  partner_percentage?: number
  peak_type?: string
  status?: string
}

// Support / Maintenance tickets
export interface MaintenanceTicket {
  id: string
  title: string
  description?: string
  priority: string
  status: string
  team?: string
  organization_id?: number
  location_id?: number
  charger_id?: number
  connector_id?: number
  created_at?: string
  updated_at?: string
}

export async function getMaintenanceTickets(params?: { organization_id?: number }) {
  const query: Record<string, string> = {}
  if (params?.organization_id != null) query.organization_id = String(params.organization_id)
  return request<{ data: MaintenanceTicket[] }>('/api/v4/support/maintenance-tickets', {
    params: Object.keys(query).length ? query : undefined,
    skipCache: true,
  })
}

export async function createMaintenanceTicket(body: {
  title: string
  description?: string
  priority?: string
  team?: string
  organization_id?: number
  location_id?: number
  charger_id?: number
  connector_id?: number
}) {
  return request<{ data: MaintenanceTicket }>('/api/v4/support/maintenance-ticket', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateMaintenanceTicket(
  id: string,
  body: Partial<Pick<MaintenanceTicket, 'title' | 'description' | 'priority' | 'status' | 'team' | 'organization_id' | 'location_id' | 'charger_id' | 'connector_id'>>
) {
  return request<{ data: MaintenanceTicket }>('/api/v4/support/maintenance-ticket', {
    method: 'PUT',
    params: { id },
    body: JSON.stringify(body),
  })
}

export async function deleteMaintenanceTicket(id: string) {
  return request('/api/v4/support/maintenance-ticket', {
    method: 'DELETE',
    params: { id },
  })
}

// Periodic (Preventive) Maintenance
export interface PeriodicMaintenance {
  id: string
  organization_id: string
  title: string
  description: string
  priority: string
  team: string
  scope: 'location' | 'charger' | 'connector'
  location_id?: string | null
  charger_id?: string | null
  connector_id?: string | null
  interval_days: number
  last_run_at?: string | null
  next_due_at: string
  is_active: number
  created_at?: string
  updated_at?: string
}

export async function getPeriodicMaintenanceList(organizationId?: string) {
  return request<{ data: PeriodicMaintenance[] }>(
    '/api/v4/support/periodic-maintenance',
    organizationId != null ? { params: { organizationId } } : {}
  )
}

export async function getPeriodicMaintenance(id: string) {
  return request<{ data: PeriodicMaintenance }>('/api/v4/support/periodic-maintenance', { params: { id } })
}

export async function createPeriodicMaintenance(body: {
  title: string
  description: string
  priority?: string
  team?: string
  scope: 'location' | 'charger' | 'connector'
  location_id?: string | null
  charger_id?: string | null
  connector_id?: string | null
  interval_days: number
  next_due_at: string
  organization_id: string
}) {
  return request<{ data: PeriodicMaintenance }>('/api/v4/support/periodic-maintenance', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updatePeriodicMaintenance(
  id: string,
  body: Partial<Pick<PeriodicMaintenance, 'title' | 'description' | 'priority' | 'team' | 'scope' | 'location_id' | 'charger_id' | 'connector_id' | 'interval_days' | 'next_due_at' | 'is_active'>>
) {
  return request<{ data: PeriodicMaintenance }>('/api/v4/support/periodic-maintenance', {
    method: 'PUT',
    params: { id },
    body: JSON.stringify(body),
  })
}

export async function deletePeriodicMaintenance(id: string) {
  return request('/api/v4/support/periodic-maintenance', {
    method: 'DELETE',
    params: { id },
  })
}

/** إنشاء تذكرة صيانة من الجدول الدوري الآن وتحديث last_run_at و next_due_at (query: action=run&id=) */
export async function runPeriodicMaintenance(id: string) {
  return request<{ data: { ticket_id: string } }>('/api/v4/support/periodic-maintenance', {
    method: 'POST',
    params: { action: 'run', id },
  })
}

// Dashboard (Operator)
export interface DashboardStats {
  activeSessions?: number
  utilization?: number
  chargersOnline?: number
  totalConnectors?: number
  busyConnectors?: number
  newUsers?: number
  sessions?: number
  payments?: number
  faults?: number
  revenue?: number
  tariffAC?: number
  tariffDC?: number
  eFawateerCom?: number
  ni?: number
  orangeMoney?: number
  totalCashIn?: number
  expendature?: number
}

// CPO API
const CPO_API = '/api/v4/cpo'

export async function getDashboardStats() {
  return request<{ data: DashboardStats }>(`${CPO_API}/stats`)
}

export async function getActiveSessions() {
  return request<{ count: number; data: ActiveSessionRow[] }>(`${CPO_API}/active-sessions`)
}

export async function getLocalSessions() {
  return request<{ count: number; data: LocalSessionRow[] }>(`${CPO_API}/local-sessions`)
}

export interface ActiveSessionRow {
  'Start Date/Time'?: string
  'Session ID'?: string
  Location?: string
  Charger?: string
  Connector?: string
  'Energy (KWH)'?: number
  'Amount (JOD)'?: number
  mobile?: string
  end_date?: string
  duration?: string
  stop_reason?: string
}

export interface LocalSessionRow {
  'Start Date/Time'?: string
  session_id?: string
  Location?: string
  Charger?: string
  Connector?: string
  'Energy (KWH)'?: number
  'Amount (JOD)'?: number
  'User ID'?: string
  end_date?: string
  duration?: string
  stop_reason?: string
}

/** `from` / `to` as sent to CPO API: `YYYY-MM-DD` (full local days) or `YYYY-MM-DDTHH:mm` / `YYYY-MM-DD HH:mm:ss` for a precise range (Node-RED parser). */
export interface SessionsReportParams {
  from: string
  to: string
  /** Comma-separated location IDs e.g. "1,2,3" */
  locationIds?: string
  /** Comma-separated charger IDs e.g. "1,2,3" */
  chargerIds?: string
  /** Comma-separated connector IDs e.g. "1,2,3" */
  connectorIds?: string
  energyMin?: string
  energyMax?: string
  /** Match DB sort: `asc` = oldest first, `desc` = newest first (default) */
  dateOrder?: 'asc' | 'desc'
}

export async function getSessionsReport(params: SessionsReportParams) {
  const query: Record<string, string> = { from: params.from, to: params.to }
  if (params.locationIds != null && String(params.locationIds).trim() !== '') query.locationIds = String(params.locationIds).trim()
  if (params.chargerIds != null && String(params.chargerIds).trim() !== '') query.chargerIds = String(params.chargerIds).trim()
  if (params.connectorIds != null && String(params.connectorIds).trim() !== '') query.connectorIds = String(params.connectorIds).trim()
  if (params.energyMin != null && String(params.energyMin).trim() !== '') query.energyMin = String(params.energyMin).trim()
  if (params.energyMax != null && String(params.energyMax).trim() !== '') query.energyMax = String(params.energyMax).trim()
  if (params.dateOrder === 'asc') query.dateOrder = 'asc'
  return request<{ success?: boolean; count: number; data: SessionsReportRow[] }>(`${CPO_API}/sessions-report`, { params: query })
}

/** Export sessions report as XLSX (backend-generated; avoids WPS/Excel re-parsing issues). */
export async function exportSessionsReport(params: SessionsReportParams): Promise<{ blob: Blob; filename?: string }> {
  const query: Record<string, string> = { from: params.from, to: params.to }
  if (params.locationIds != null && String(params.locationIds).trim() !== '') query.locationIds = String(params.locationIds).trim()
  if (params.chargerIds != null && String(params.chargerIds).trim() !== '') query.chargerIds = String(params.chargerIds).trim()
  if (params.connectorIds != null && String(params.connectorIds).trim() !== '') query.connectorIds = String(params.connectorIds).trim()
  if (params.energyMin != null && String(params.energyMin).trim() !== '') query.energyMin = String(params.energyMin).trim()
  if (params.energyMax != null && String(params.energyMax).trim() !== '') query.energyMax = String(params.energyMax).trim()
  if (params.dateOrder === 'asc') query.dateOrder = 'asc'
  const qs = new URLSearchParams(query).toString()
  const token = getToken()
  const url = `${BASE}${CPO_API}/sessions-report/export?${qs}`
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) throw new Error(res.statusText)
  const blob = await res.blob()
  let filename: string | undefined
  const disp = res.headers.get('Content-Disposition')
  if (disp) {
    const m = disp.match(/filename="?([^";\n]+)"?/i)
    if (m) filename = m[1].trim()
  }
  return { blob, filename }
}

export interface SessionsReportRow {
  'Start Date/Time'?: string
  'Session ID'?: string
  Location?: string
  Charger?: string
  Connector?: string
  'Energy (KWH)'?: number
  'Amount (JOD)'?: number
  mobile?: string
}

export async function getUserSessions(mobile: string) {
  return request<{ count: number; data: unknown[] }>(`${CPO_API}/user-sessions`, { params: { mobile } })
}

export async function getActiveSessionsHistory(hours?: number) {
  return request<{ count: number; data: { ts: number; count: number }[] }>(`${CPO_API}/active-sessions-history`, {
    params: hours != null ? { hours: String(hours) } : undefined,
  })
}

/** Server-aggregated counts from the same query as connectors-status rows (window functions). */
export interface ConnectorsStatusSummary {
  totalConnectors: number
  availableCount: number
  busyCount: number
}

/** Full JSON from GET /cpo/connectors-status (`request` spreads the body; summary is top-level). */
export type ConnectorsStatusApiResponse = {
  success: boolean
  count?: number
  data?: ConnectorStatusRow[]
  summary?: ConnectorsStatusSummary
  message?: string
  statusCode?: number
}

export async function getConnectorsStatus(opts?: { skipCache?: boolean }): Promise<ConnectorsStatusApiResponse> {
  const res = await request<ConnectorStatusRow[]>(`${CPO_API}/connectors-status`, {
    ...(opts?.skipCache && { skipCache: true }),
  })
  return res as ConnectorsStatusApiResponse
}

export interface ConnectorStatusRow {
  connectorId?: number
  connectorType?: string
  status?: string
  chargerId?: number
  chargerName?: string
  chargerStatus?: string
  /** Snake_case variant from some APIs */
  charger_status?: string
  charger_name?: string
  location_name?: string
  locationName?: string
  organizationName?: string
  enabled?: number | boolean
}

export async function getChargerStatus(chargerId: number) {
  return request<{ status: string | null }>(`${CPO_API}/charger-status`, { params: { chargerId: String(chargerId) } })
}

export async function getConnectorStatus(connectorId: number) {
  return request<{ status: string | null }>(`${CPO_API}/connector-status`, { params: { connectorId: String(connectorId) } })
}

export async function getSmsBalance() {
  return request<{ data: { smsBalance: number } }>('/api/v4/dashboard/sms-balance')
}

export interface LeadershipRow {
  firstName?: string
  lastName?: string
  count?: number
  mobile?: string
  energy?: number
  amount?: number
}

export async function getLeadership() {
  return request<{ count: number; data: LeadershipRow[] }>('/api/v4/users/leadership')
}

export async function sendChargerCommand(chargerId: string, command: 'restart' | 'stop' | 'unlock') {
  return request('/api/v4/dashboard/charger-command', {
    method: 'POST',
    body: JSON.stringify({ chargerId, command }),
  })
}

export async function getChargerComparison(params: { start: string; end: string; locationId?: string; chargerIds?: string }) {
  return request<{ count: number; data: ChargerComparisonRow[] }>(`${CPO_API}/charger-comparison`, { params: { start: params.start, end: params.end, ...(params.locationId && { locationId: params.locationId }), ...(params.chargerIds && { chargerIds: params.chargerIds }) } })
}

export interface ChargerComparisonRow {
  chargerId?: number | string
  name?: string
  type?: string
  status?: string
  locationId?: number | string
  locationName?: string
  connectorsCount?: number
  onlineFlag?: boolean
  lastUpdate?: string | null
  sessionsCount?: number
  totalKwh?: number
  totalAmount?: number
}

export async function getConnectorComparison(params: { start: string; end: string; locationId?: string; chargerId?: string; connectorIds?: string }) {
  return request<{ count: number; data: ConnectorComparisonRow[] }>(`${CPO_API}/connector-comparison`, { params: { start: params.start, end: params.end, ...(params.locationId && { locationId: params.locationId }), ...(params.chargerId && { chargerId: params.chargerId }), ...(params.connectorIds && { connectorIds: params.connectorIds }) } })
}

export interface ConnectorComparisonRow {
  connectorId?: number | string
  chargerId?: number | string
  chargerName?: string
  connectorType?: string
  status?: string
  locationName?: string
  sessionsCount?: number
  totalKwh?: number
  totalAmount?: number
  avgSessionKwh?: number
  avgSessionAmount?: number
  avgSessionMinutes?: number
}

// Notifications (organization-scoped: only chargers belonging to the org)
export interface ChargerNotificationItem {
  id?: string
  chargerId?: string
  chargerName?: string
  organizationName?: string
  locationName?: string
  online?: boolean
  message?: string
  level?: string
  timestamp?: number
  createdAt?: string
  read?: boolean | number
  isNew?: boolean | number
}

export interface FetchChargerNotificationsResult {
  items: ChargerNotificationItem[]
  unreadCount?: number
}

function pickNotificationString(
  input: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = input[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (value != null && typeof value !== 'object') {
      const asText = String(value).trim()
      if (asText) return asText
    }
  }
  return undefined
}

export function normalizeChargerNotificationItem(raw: unknown): ChargerNotificationItem {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const source = raw as Record<string, unknown>
  const base = { ...(source as unknown as ChargerNotificationItem) }
  const organizationName = pickNotificationString(source, ['organizationName', 'organization_name'])
  const locationName = pickNotificationString(source, ['locationName', 'location_name'])
  const chargerName = pickNotificationString(source, ['chargerName', 'charger_name', 'charger'])
  const chargerId = pickNotificationString(source, ['chargerId', 'charger_id', 'chargerID'])

  if (organizationName !== undefined) base.organizationName = organizationName
  if (locationName !== undefined) base.locationName = locationName
  if (chargerName !== undefined) base.chargerName = chargerName
  if (chargerId !== undefined) base.chargerId = chargerId
  return base
}

export function parseNotificationsResponsePayload(data: unknown): FetchChargerNotificationsResult {
  if (Array.isArray(data)) {
    return { items: data.map(normalizeChargerNotificationItem) }
  }
  if (data && typeof data === 'object') {
    const body = data as Record<string, unknown>
    const rawList = body.data ?? body.notifications
    const items = Array.isArray(rawList) ? rawList.map(normalizeChargerNotificationItem) : []
    const uc = body.unreadCount
    const unreadCount = typeof uc === 'number' && Number.isFinite(uc) ? uc : undefined
    return { items, unreadCount }
  }
  return { items: [] }
}

export async function fetchChargerNotifications(params?: {
  since?: number
  userId?: string | number
}): Promise<FetchChargerNotificationsResult> {
  const query: Record<string, string> = {}
  if (params?.since != null) query.since = String(params.since)
  if (params?.userId != null && params.userId !== '') query.userId = String(params.userId)

  const res = await request<unknown>('/api/v4/notifications', {
    params: Object.keys(query).length ? query : undefined,
    skipCache: true,
  })
  return parseNotificationsResponsePayload(res.data)
}

const NOTIFICATIONS_API_TIMEOUT_MS = 30000

export async function markNotificationAsReadApi(
  notificationId: string,
  userId: string | number,
): Promise<{ success: boolean; message?: string }> {
  const ac = new AbortController()
  const timeout = setTimeout(() => ac.abort(), NOTIFICATIONS_API_TIMEOUT_MS)
  try {
    const res = await request<{ success?: boolean; message?: string }>('/api/v4/notifications/mark-read', {
      method: 'POST',
      body: JSON.stringify({ notificationId, userId: Number(userId) }),
      signal: ac.signal,
    })
    if (!res.success) return { success: false, message: res.message || 'Failed' }
    return { success: true, message: res.message }
  } finally {
    clearTimeout(timeout)
  }
}

export async function markNotificationsSeenApi(
  userId: string | number,
): Promise<{ success: boolean; seenAt?: number }> {
  const ac = new AbortController()
  const timeout = setTimeout(() => ac.abort(), NOTIFICATIONS_API_TIMEOUT_MS)
  try {
    const res = await request<{ success?: boolean; seenAt?: number }>('/api/v4/notifications/mark-seen', {
      method: 'POST',
      body: JSON.stringify({ userId: Number(userId) }),
      signal: ac.signal,
    })
    return { success: res.success !== false, seenAt: res.data?.seenAt ?? (res as unknown as { seenAt?: number }).seenAt }
  } finally {
    clearTimeout(timeout)
  }
}

// Backward-compatible wrappers for existing pages.
export type NotificationItem = ChargerNotificationItem

export async function getNotifications(params: {
  organizationId: number
  userId?: number
  since?: number
}) {
  const res = await fetchChargerNotifications({
    since: params.since,
    userId: params.userId,
  })
  return { success: true, data: res.items }
}

export async function markNotificationRead(notificationId: string, userId: number) {
  return markNotificationAsReadApi(notificationId, userId)
}

export async function markAllNotificationsRead(userId: number) {
  return markNotificationsSeenApi(userId)
}

// Audit Log (entity changes + authentication events where entity_type = auth)
export interface AuditLogEntry {
  id: number
  timestamp: string
  user_id: number | null
  organization_id: number | null
  action: string
  entity_type: string
  entity_id: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  ip: string | null
  source: string | null
  correlation_id: string | null
  user_name?: string | null
}

export interface AuditLogFilters {
  from?: string
  to?: string
  action?: string
  entity_type?: string
  user_id?: number
  organization_id?: number
  limit?: number
  offset?: number
}

export async function getAuditLogs(filters: AuditLogFilters) {
  const params: Record<string, string> = {}
  if (filters.from) params.from = filters.from
  if (filters.to) params.to = filters.to
  if (filters.action) params.action = filters.action
  if (filters.entity_type) params.entity_type = filters.entity_type
  if (filters.user_id != null) params.user_id = String(filters.user_id)
  if (filters.organization_id != null) params.organization_id = String(filters.organization_id)
  if (filters.limit != null) params.limit = String(filters.limit)
  if (filters.offset != null) params.offset = String(filters.offset)
  return request<{ data: AuditLogEntry[]; total: number }>('/api/v4/audit-log', {
    params,
    skipCache: true,
  })
}

/** Result of audit log export: blob and optional filename from server (e.g. .html when PDF is served as HTML). */
export interface AuditLogExportResult {
  blob: Blob
  filename?: string
}

export async function exportAuditLogs(
  format: 'csv' | 'pdf',
  filters: Omit<AuditLogFilters, 'limit' | 'offset'>
): Promise<AuditLogExportResult> {
  const params: Record<string, string> = { format }
  if (filters.from) params.from = filters.from
  if (filters.to) params.to = filters.to
  if (filters.action) params.action = filters.action
  if (filters.entity_type) params.entity_type = filters.entity_type
  if (filters.user_id != null) params.user_id = String(filters.user_id)
  if (filters.organization_id != null) params.organization_id = String(filters.organization_id)
  const token = getToken()
  const qs = new URLSearchParams(params).toString()
  const url = `${BASE}/api/v4/audit-log/export?${qs}`
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error(res.statusText)
  const blob = await res.blob()
  let filename: string | undefined
  const disp = res.headers.get('Content-Disposition')
  if (disp) {
    const m = disp.match(/filename="?([^";\n]+)"?/i)
    if (m) filename = m[1].trim()
  }
  return { blob, filename }
}
