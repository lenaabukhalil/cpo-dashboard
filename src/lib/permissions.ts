/**
 * CPO role-based permissions + JWT permission map (RBAC).
 * Structure aligned to: A.Organizations | B.Operation | C.Monitor | D.Reports | E.Support | F.ION Users
 */

import type { ComponentType } from 'react'
import {
  Home,
  Building2,
  List,
  Activity,
  FileText,
  Wrench,
  Users,
  Share2,
  Map,
  Table,
  ScrollText,
} from 'lucide-react'

export type Access = 'R' | 'RW'
export type { PermissionMap, PermissionValue } from '../services/api'
import type { PermissionMap } from '../services/api'

/** Map UI route → required permission code + minimum access. Codes must match `ocpp_CSGO.Permissions.code` exactly. */
export const ROUTE_PERMISSIONS: Record<string, { code: string; access: Access }> = {
  '/org': { code: 'organizations.view', access: 'R' },
  '/details': { code: 'stations.view', access: 'R' },
  '/list': { code: 'stations.view', access: 'R' },
  '/sessions': { code: 'sessions.view', access: 'R' },
  '/reports': { code: 'reports.view', access: 'R' },
  '/support': { code: 'support.view', access: 'R' },
  '/map': { code: 'map.view', access: 'R' },
  // TODO(rbac): confirm — list GET may be R-only; mutations still enforced server-side as RW.
  '/partner-users': { code: 'users.manage', access: 'R' },
  '/audit-log': { code: 'audit.view', access: 'R' },
}

// TODO(rbac): No RBAC matrix settings page in this repo. When added, use:
// GET /api/v4/rbac/permissions | GET /api/v4/rbac/roles | GET/PUT /api/v4/rbac/roles/permissions?roleId

/** Read access: boolean true, legacy R, or legacy RW. */
export function canRead(perms: PermissionMap | undefined | null, code: string): boolean {
  if (!perms || typeof perms !== 'object') return false
  if (perms['global.access'] === true) return true
  const v = perms[code]
  return v === true || v === 'R' || v === 'RW'
}

/** Write / manage access: boolean true or legacy RW. */
export function hasWritePermission(perms: PermissionMap | undefined | null, code: string): boolean {
  if (!perms || typeof perms !== 'object') return false
  if (perms['global.access'] === true) return true
  const v = perms[code]
  return v === true || v === 'RW'
}

export function hasPermission(perms: PermissionMap | undefined, code: string, need: Access = 'R'): boolean {
  return need === 'RW' ? hasWritePermission(perms, code) : canRead(perms, code)
}

export type Role = 'admin' | 'operator' | 'accountant' | 'engineer' | 'manager' | 'viewer'

export interface NavItem {
  to: string
  label: string
  /** Translation key for locale (en/ar). When set, Sidebar uses this instead of label. */
  labelKey?: string
  icon: ComponentType<{ className?: string }>
  /** Section heading (A–F). When present, render as grouped nav. */
  group?: string
  groupKey?: string
  /** If true, NavLink is active only when path matches exactly (e.g. /support not /support/maintenance). */
  end?: boolean
}

function normalizeRole(roleName: string | undefined): Role | null {
  const r = (roleName || '').toLowerCase().trim().replace(/\s+/g, ' ')
  if (r === 'admin' || r === 'owner' || r === 'super_admin' || r === 'super admin' || r === 'platform_admin' || r === 'platform admin' || r === 'org_admin' || r === 'organization admin') return 'admin'
  if (r === 'operator') return 'operator'
  if (r === 'accountant' || r === 'org_accountant' || r === 'organization accountant') return 'accountant'
  if (r === 'engineer') return 'engineer'
  if (r === 'manager') return 'manager'
  if (r === 'viewer') return 'viewer'
  return null
}

export function getRole(roleName: string | undefined): Role | null {
  return normalizeRole(roleName)
}

const ADMIN_PATHS = [
  '/', '/org', '/details', '/list',
  '/sessions', '/reports', '/support',
  '/map', '/partner-users', '/grants', '/audit-log',
]
/** Operator: A. Monitor, B. Organizations, C. Operation, D. Support (Maintenance), Settings. No D. Reports. */
const OPERATOR_PATHS = [
  '/', '/map', '/org', '/details', '/list', '/sessions', '/support',
]
/** Engineer: Dashboard, Map, Organization, Details, List, Monitor, Maintenance. No Reports, Users, Audit Log, Settings. */
const ENGINEER_PATHS = ['/', '/map', '/org', '/details', '/list', '/sessions', '/support']
/** Manager: same as Engineer – Dashboard, Map, Org, Details, List, Monitor, Support. */
const MANAGER_PATHS = ['/', '/map', '/org', '/details', '/list', '/sessions', '/support']
/** Organization Accountant: Organization, List, Reports only (no Dashboard / A. Monitor). */
const ACCOUNTANT_PATHS = ['/org', '/list', '/reports']
/** Viewer: read-focused default (includes Dashboard). */
const VIEWER_PATHS = ['/', '/org', '/list', '/reports']

/** Default landing route when Organization Accountant cannot use "/". */
export const ACCOUNTANT_HOME_PATH = '/org'

export function canAccessPath(
  roleName: string | undefined,
  path: string,
  permissions?: PermissionMap,
): boolean {
  const p = path.replace(/\/$/, '') || '/'

  const rule = ROUTE_PERMISSIONS[p]
  const hasPerms = Boolean(permissions && Object.keys(permissions).length > 0)
  if (rule && hasPerms && permissions && rule.code in permissions) {
    // Backend has provisioned this code → enforce strictly.
    return hasPermission(permissions, rule.code, rule.access)
  }
  // Permission code not yet provisioned on backend — fall back to role whitelist.
  // TODO(rbac): remove this fallback once all codes in ROUTE_PERMISSIONS exist in
  // ocpp_CSGO.Permissions and are assigned in Role_Permissions.

  const role = normalizeRole(roleName)
  if (!role) return false
  if (role === 'accountant') return ACCOUNTANT_PATHS.includes(p)
  if (role === 'viewer') return VIEWER_PATHS.includes(p)
  if (role === 'engineer') return ENGINEER_PATHS.includes(p)
  if (role === 'manager') return MANAGER_PATHS.includes(p)
  if (role === 'operator') return OPERATOR_PATHS.includes(p)
  if (role === 'admin') return ADMIN_PATHS.includes(p) && p !== '/billing'
  return false
}

/** Nav items with optional group (section label). Order: A → B → C → D → E. */
function adminNav(): NavItem[] {
  return [
    { to: '/', label: 'Dashboard', labelKey: 'nav.dashboard', icon: Home, group: 'Monitor', groupKey: 'group.monitor' },
    { to: '/map', label: 'Map View', labelKey: 'nav.mapView', icon: Map, group: 'Monitor', groupKey: 'group.monitor' },
    { to: '/org', label: 'Organization', labelKey: 'nav.organization', icon: Building2, group: 'Organizations', groupKey: 'group.organizations' },
    { to: '/details', label: 'Location, Charger, Connector, Tariffs', labelKey: 'nav.details', icon: List, group: 'Organizations', groupKey: 'group.organizations' },
    { to: '/list', label: 'List of Location, Charger, Connector, Tariffs', labelKey: 'nav.list', icon: Table, group: 'Organizations', groupKey: 'group.organizations' },
    { to: '/partner-users', label: 'Users of Organization', labelKey: 'nav.partnerUsers', icon: Users, group: 'Organizations', groupKey: 'group.organizations' },
    { to: '/grants', label: 'Resource Grants', labelKey: 'nav.grants', icon: Share2, group: 'Organizations', groupKey: 'group.organizations' },
    { to: '/sessions', label: 'Monitor', labelKey: 'nav.monitor', icon: Activity, group: 'Operation', groupKey: 'group.operation' },
    { to: '/reports', label: 'Reports & Analytics', labelKey: 'nav.reports', icon: FileText, group: 'Reports', groupKey: 'group.reports' },
    { to: '/audit-log', label: 'Audit Log', labelKey: 'nav.auditLog', icon: ScrollText, group: 'Reports', groupKey: 'group.reports' },
    { to: '/support', label: 'Maintenance Tickets', labelKey: 'nav.maintenanceTickets', icon: Wrench, group: 'Support', groupKey: 'group.support', end: true },
  ]
}

/** Operator: A. Monitor (Dashboard, Map) | B. Organizations (Org, Details, List) | C. Operation (Monitor) | D. Support (Maintenance Tickets) | Settings. No D. Reports. */
function operatorNav(): NavItem[] {
  return [
    { to: '/', label: 'Dashboard', labelKey: 'nav.dashboard', icon: Home, group: 'Monitor', groupKey: 'group.monitor' },
    { to: '/map', label: 'Map View', labelKey: 'nav.mapView', icon: Map, group: 'Monitor', groupKey: 'group.monitor' },
    { to: '/org', label: 'Organization', labelKey: 'nav.organization', icon: Building2, group: 'Organizations', groupKey: 'group.organizations' },
    { to: '/details', label: 'Location, Charger, Connector, Tariffs', labelKey: 'nav.details', icon: List, group: 'Organizations', groupKey: 'group.organizations' },
    { to: '/list', label: 'List of Location, Charger, Connector, Tariffs', labelKey: 'nav.list', icon: Table, group: 'Organizations', groupKey: 'group.organizations' },
    { to: '/sessions', label: 'Monitor', labelKey: 'nav.monitor', icon: Activity, group: 'Operation', groupKey: 'group.operation' },
    { to: '/support', label: 'Maintenance Tickets', labelKey: 'nav.maintenanceTickets', icon: Wrench, group: 'Support', groupKey: 'group.support', end: true },
  ]
}

/** Engineer: Dashboard, Map, Organization, Details, List, Monitor, Maintenance. No Reports, Users, Predictive AI, Audit Log, Settings. */
function engineerNav(): NavItem[] {
  return [
    { to: '/', label: 'Dashboard', labelKey: 'nav.dashboard', icon: Home, group: 'Monitor', groupKey: 'group.monitor' },
    { to: '/map', label: 'Map View', labelKey: 'nav.mapView', icon: Map, group: 'Monitor', groupKey: 'group.monitor' },
    { to: '/org', label: 'Organization', labelKey: 'nav.organization', icon: Building2, group: 'Organizations', groupKey: 'group.organizations' },
    { to: '/details', label: 'Location, Charger, Connector, Tariffs', labelKey: 'nav.details', icon: List, group: 'Organizations', groupKey: 'group.organizations' },
    { to: '/list', label: 'List of Location, Charger, Connector, Tariffs', labelKey: 'nav.list', icon: Table, group: 'Organizations', groupKey: 'group.organizations' },
    { to: '/sessions', label: 'Monitor', labelKey: 'nav.monitor', icon: Activity, group: 'Operation', groupKey: 'group.operation' },
    { to: '/support', label: 'Maintenance Tickets', labelKey: 'nav.maintenanceTickets', icon: Wrench, group: 'Support', groupKey: 'group.support', end: true },
  ]
}

/** Manager: same as Engineer – A. Monitor, B. Organizations, C. Operation, E. Support. No D. Reports, Users, Audit Log, Settings. */
function managerNav(): NavItem[] {
  return [
    { to: '/', label: 'Dashboard', labelKey: 'nav.dashboard', icon: Home, group: 'Monitor', groupKey: 'group.monitor' },
    { to: '/map', label: 'Map View', labelKey: 'nav.mapView', icon: Map, group: 'Monitor', groupKey: 'group.monitor' },
    { to: '/org', label: 'Organization', labelKey: 'nav.organization', icon: Building2, group: 'Organizations', groupKey: 'group.organizations' },
    { to: '/details', label: 'Location, Charger, Connector, Tariffs', labelKey: 'nav.details', icon: List, group: 'Organizations', groupKey: 'group.organizations' },
    { to: '/list', label: 'List of Location, Charger, Connector, Tariffs', labelKey: 'nav.list', icon: Table, group: 'Organizations', groupKey: 'group.organizations' },
    { to: '/sessions', label: 'Monitor', labelKey: 'nav.monitor', icon: Activity, group: 'Operation', groupKey: 'group.operation' },
    { to: '/support', label: 'Maintenance Tickets', labelKey: 'nav.maintenanceTickets', icon: Wrench, group: 'Support', groupKey: 'group.support', end: true },
  ]
}

/** Organization Accountant: B. Organizations + D. Reports (no A. Monitor / Dashboard). */
function accountantNav(): NavItem[] {
  return [
    { to: '/org', label: 'Organization', labelKey: 'nav.organization', icon: Building2, group: 'Organizations', groupKey: 'group.organizations' },
    { to: '/list', label: 'List of Location, Charger, Connector, Tariffs', labelKey: 'nav.list', icon: Table, group: 'Organizations', groupKey: 'group.organizations' },
    { to: '/reports', label: 'Reports & Analytics', labelKey: 'nav.reports', icon: FileText, group: 'Reports', groupKey: 'group.reports' },
  ]
}

export function getNavItems(roleName: string | undefined): NavItem[] {
  const role = normalizeRole(roleName)
  if (role === 'accountant' || role === 'viewer') return accountantNav()
  if (role === 'engineer') return engineerNav()
  if (role === 'manager') return managerNav()
  if (role === 'operator') return operatorNav()
  if (role === 'admin') return adminNav()
  return adminNav()
}

export function canManageLocations(roleName: string | undefined): boolean {
  return normalizeRole(roleName) === 'admin'
}

export function canManageChargers(roleName: string | undefined): boolean {
  return normalizeRole(roleName) === 'admin'
}

export function canManageConnectors(roleName: string | undefined): boolean {
  return normalizeRole(roleName) === 'admin'
}

export function canManageTariffs(roleName: string | undefined): boolean {
  return normalizeRole(roleName) === 'admin'
}

export function canDeleteSupportTicket(roleName: string | undefined): boolean {
  return normalizeRole(roleName) === 'admin'
}

export function canManageOrg(roleName: string | undefined): boolean {
  return normalizeRole(roleName) === 'admin'
}

export function canManagePartnerUsers(roleName: string | undefined): boolean {
  return normalizeRole(roleName) === 'admin'
}

/** Audit Log: admin and accountant see it in sidebar; operator (blocked at login) would have org-scoped access. Engineer/Manager do not see Audit Log. */
export function canAccessAuditLog(roleName: string | undefined): boolean {
  const role = normalizeRole(roleName)
  return role === 'admin' || role === 'accountant' || role === 'operator'
}

/** Full audit log (all orgs); only admin sees all. Operator/Accountant see only their organization's logs via organization_id filter. */
export function canAccessAuditLogFull(roleName: string | undefined): boolean {
  const role = normalizeRole(roleName)
  return role === 'admin'
}

/** ION app end-users management (customer support); admin only for now. */
export function canManageIONUsers(roleName: string | undefined): boolean {
  return normalizeRole(roleName) === 'admin'
}
