/**
 * CPO role-based permissions.
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
  Settings,
  Users,
  Map,
  Table,
  ScrollText,
} from 'lucide-react'

export type Role = 'admin' | 'operator' | 'accountant' | 'engineer' | 'manager'

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
  const r = (roleName || '').toLowerCase()
  if (r === 'admin' || r === 'owner') return 'admin'
  if (r === 'operator') return 'operator'
  if (r === 'accountant') return 'accountant'
  if (r === 'engineer') return 'engineer'
  if (r === 'manager') return 'manager'
  return null
}

export function getRole(roleName: string | undefined): Role | null {
  return normalizeRole(roleName)
}

const ADMIN_PATHS = [
  '/', '/org', '/details', '/list',
  '/sessions', '/reports', '/support', '/settings',
  '/map', '/partner-users', '/audit-log',
]
/** Operator: A. Monitor, B. Organizations, C. Operation, D. Support (Maintenance), Settings. No D. Reports. */
const OPERATOR_PATHS = [
  '/', '/map', '/org', '/details', '/list', '/sessions', '/support', '/settings',
]
/** Engineer: Dashboard, Map, Organization, Details, List, Monitor, Maintenance. No Reports, Users, Audit Log, Settings. */
const ENGINEER_PATHS = ['/', '/map', '/org', '/details', '/list', '/sessions', '/support']
/** Manager: same as Engineer – Dashboard, Map, Org, Details, List, Monitor, Support. */
const MANAGER_PATHS = ['/', '/map', '/org', '/details', '/list', '/sessions', '/support']
/** Accountant: Dashboard, Organization, List, D. Reports (Reports & Analytics). No Predictive AI, Map, Users, Monitor, Maintenance, Settings. */
const ACCOUNTANT_PATHS = ['/', '/org', '/list', '/reports']

export function canAccessPath(roleName: string | undefined, path: string): boolean {
  const role = normalizeRole(roleName)
  if (!role) return false
  const p = path.replace(/\/$/, '') || '/'
  if (role === 'accountant') return ACCOUNTANT_PATHS.includes(p)
  if (role === 'engineer') return ENGINEER_PATHS.includes(p)
  if (role === 'manager') return MANAGER_PATHS.includes(p)
  if (role === 'operator') return OPERATOR_PATHS.includes(p)
  if (role === 'admin') return ADMIN_PATHS.includes(p) && p !== '/billing'
  return false
}

/** Nav items with optional group (section label). Order: A → B → C → D → E. */
function adminNav(): NavItem[] {
  return [
    { to: '/', label: 'Dashboard', labelKey: 'nav.dashboard', icon: Home, group: 'A. Monitor', groupKey: 'group.monitor' },
    { to: '/map', label: 'Map View', labelKey: 'nav.mapView', icon: Map, group: 'A. Monitor', groupKey: 'group.monitor' },
    { to: '/org', label: 'Organization', labelKey: 'nav.organization', icon: Building2, group: 'B. Organizations', groupKey: 'group.organizations' },
    { to: '/details', label: 'Location, Charger, Connector, Tariffs', labelKey: 'nav.details', icon: List, group: 'B. Organizations', groupKey: 'group.organizations' },
    { to: '/list', label: 'List of Location, Charger, Connector, Tariffs', labelKey: 'nav.list', icon: Table, group: 'B. Organizations', groupKey: 'group.organizations' },
    { to: '/partner-users', label: 'Users of Organization', labelKey: 'nav.partnerUsers', icon: Users, group: 'B. Organizations', groupKey: 'group.organizations' },
    { to: '/sessions', label: 'Monitor', labelKey: 'nav.monitor', icon: Activity, group: 'C. Operation', groupKey: 'group.operation' },
    { to: '/reports', label: 'Reports & Analytics', labelKey: 'nav.reports', icon: FileText, group: 'D. Reports', groupKey: 'group.reports' },
    { to: '/audit-log', label: 'Audit Log', labelKey: 'nav.auditLog', icon: ScrollText, group: 'D. Reports', groupKey: 'group.reports' },
    { to: '/support', label: 'Maintenance Tickets', labelKey: 'nav.maintenanceTickets', icon: Wrench, group: 'E. Support', groupKey: 'group.support', end: true },
    { to: '/settings', label: 'Settings', labelKey: 'nav.settings', icon: Settings },
  ]
}

/** Operator: A. Monitor (Dashboard, Map) | B. Organizations (Org, Details, List) | C. Operation (Monitor) | D. Support (Maintenance Tickets) | Settings. No D. Reports. */
function operatorNav(): NavItem[] {
  return [
    { to: '/', label: 'Dashboard', labelKey: 'nav.dashboard', icon: Home, group: 'A. Monitor', groupKey: 'group.monitor' },
    { to: '/map', label: 'Map View', labelKey: 'nav.mapView', icon: Map, group: 'A. Monitor', groupKey: 'group.monitor' },
    { to: '/org', label: 'Organization', labelKey: 'nav.organization', icon: Building2, group: 'B. Organizations', groupKey: 'group.organizations' },
    { to: '/details', label: 'Location, Charger, Connector, Tariffs', labelKey: 'nav.details', icon: List, group: 'B. Organizations', groupKey: 'group.organizations' },
    { to: '/list', label: 'List of Location, Charger, Connector, Tariffs', labelKey: 'nav.list', icon: Table, group: 'B. Organizations', groupKey: 'group.organizations' },
    { to: '/sessions', label: 'Monitor', labelKey: 'nav.monitor', icon: Activity, group: 'C. Operation', groupKey: 'group.operation' },
    { to: '/support', label: 'Maintenance Tickets', labelKey: 'nav.maintenanceTickets', icon: Wrench, group: 'D. Support', groupKey: 'group.support', end: true },
    { to: '/settings', label: 'Settings', labelKey: 'nav.settings', icon: Settings },
  ]
}

/** Engineer: Dashboard, Map, Organization, Details, List, Monitor, Maintenance. No Reports, Users, Predictive AI, Audit Log, Settings. */
function engineerNav(): NavItem[] {
  return [
    { to: '/', label: 'Dashboard', labelKey: 'nav.dashboard', icon: Home, group: 'A. Monitor', groupKey: 'group.monitor' },
    { to: '/map', label: 'Map View', labelKey: 'nav.mapView', icon: Map, group: 'A. Monitor', groupKey: 'group.monitor' },
    { to: '/org', label: 'Organization', labelKey: 'nav.organization', icon: Building2, group: 'B. Organizations', groupKey: 'group.organizations' },
    { to: '/details', label: 'Location, Charger, Connector, Tariffs', labelKey: 'nav.details', icon: List, group: 'B. Organizations', groupKey: 'group.organizations' },
    { to: '/list', label: 'List of Location, Charger, Connector, Tariffs', labelKey: 'nav.list', icon: Table, group: 'B. Organizations', groupKey: 'group.organizations' },
    { to: '/sessions', label: 'Monitor', labelKey: 'nav.monitor', icon: Activity, group: 'C. Operation', groupKey: 'group.operation' },
    { to: '/support', label: 'Maintenance Tickets', labelKey: 'nav.maintenanceTickets', icon: Wrench, group: 'E. Support', groupKey: 'group.support', end: true },
  ]
}

/** Manager: same as Engineer – A. Monitor, B. Organizations, C. Operation, E. Support. No D. Reports, Users, Audit Log, Settings. */
function managerNav(): NavItem[] {
  return [
    { to: '/', label: 'Dashboard', labelKey: 'nav.dashboard', icon: Home, group: 'A. Monitor', groupKey: 'group.monitor' },
    { to: '/map', label: 'Map View', labelKey: 'nav.mapView', icon: Map, group: 'A. Monitor', groupKey: 'group.monitor' },
    { to: '/org', label: 'Organization', labelKey: 'nav.organization', icon: Building2, group: 'B. Organizations', groupKey: 'group.organizations' },
    { to: '/details', label: 'Location, Charger, Connector, Tariffs', labelKey: 'nav.details', icon: List, group: 'B. Organizations', groupKey: 'group.organizations' },
    { to: '/list', label: 'List of Location, Charger, Connector, Tariffs', labelKey: 'nav.list', icon: Table, group: 'B. Organizations', groupKey: 'group.organizations' },
    { to: '/sessions', label: 'Monitor', labelKey: 'nav.monitor', icon: Activity, group: 'C. Operation', groupKey: 'group.operation' },
    { to: '/support', label: 'Maintenance Tickets', labelKey: 'nav.maintenanceTickets', icon: Wrench, group: 'E. Support', groupKey: 'group.support', end: true },
  ]
}

/** Accountant: Dashboard (A), Organization + List (B), D. Reports (Reports & Analytics). */
function accountantNav(): NavItem[] {
  return [
    { to: '/', label: 'Dashboard', labelKey: 'nav.dashboard', icon: Home, group: 'A. Monitor', groupKey: 'group.monitor' },
    { to: '/org', label: 'Organization', labelKey: 'nav.organization', icon: Building2, group: 'B. Organizations', groupKey: 'group.organizations' },
    { to: '/list', label: 'List of Location, Charger, Connector, Tariffs', labelKey: 'nav.list', icon: Table, group: 'B. Organizations', groupKey: 'group.organizations' },
    { to: '/reports', label: 'Reports & Analytics', labelKey: 'nav.reports', icon: FileText, group: 'D. Reports', groupKey: 'group.reports' },
  ]
}

export function getNavItems(roleName: string | undefined): NavItem[] {
  const role = normalizeRole(roleName)
  if (role === 'accountant') return accountantNav()
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
