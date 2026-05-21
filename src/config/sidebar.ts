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
  ScrollText,
} from 'lucide-react'
import type { NavItem } from '../lib/permissions'

export type RoleCode =
  | 'platform_admin'
  | 'org_admin'
  | 'org_accountant'
  | 'manager'
  | 'engineer'

export interface SidebarItemConfig {
  key: string
  path: string
  label: string
  labelKey: string
  icon: ComponentType<{ className?: string }>
  section: string
  groupKey: string
  roles: RoleCode[]
  end?: boolean
}

/** Single source of truth for sidebar visibility by `role_code`. */
export const SIDEBAR_ITEMS: SidebarItemConfig[] = [
  {
    key: 'dashboard',
    path: '/',
    label: 'Dashboard',
    labelKey: 'nav.dashboard',
    icon: Home,
    section: 'Monitor',
    groupKey: 'group.monitor',
    roles: ['platform_admin', 'org_admin', 'manager', 'engineer'],
  },
  {
    key: 'map',
    path: '/map',
    label: 'Map View',
    labelKey: 'nav.mapView',
    icon: Map,
    section: 'Monitor',
    groupKey: 'group.monitor',
    roles: ['platform_admin', 'org_admin', 'manager', 'engineer'],
  },
  {
    key: 'organization',
    path: '/org',
    label: 'Organization',
    labelKey: 'nav.organization',
    icon: Building2,
    section: 'Organizations',
    groupKey: 'group.organizations',
    roles: ['platform_admin', 'org_admin', 'manager'],
  },
  {
    key: 'stations',
    path: '/details',
    label: 'Locations & Stations',
    labelKey: 'nav.stations',
    icon: List,
    section: 'Organizations',
    groupKey: 'group.organizations',
    roles: ['platform_admin', 'org_admin', 'org_accountant', 'manager', 'engineer'],
  },
  {
    key: 'users_org',
    path: '/partner-users',
    label: 'Users of Organization',
    labelKey: 'nav.partnerUsers',
    icon: Users,
    section: 'Organizations',
    groupKey: 'group.organizations',
    roles: ['platform_admin', 'org_admin', 'manager'],
  },
  {
    key: 'grants',
    path: '/grants',
    label: 'Resource Grants',
    labelKey: 'nav.grants',
    icon: Share2,
    section: 'Organizations',
    groupKey: 'group.organizations',
    roles: ['platform_admin', 'org_admin', 'manager'],
  },
  {
    key: 'op_monitor',
    path: '/sessions',
    label: 'Monitor',
    labelKey: 'nav.monitor',
    icon: Activity,
    section: 'Operation',
    groupKey: 'group.operation',
    roles: ['platform_admin', 'org_admin', 'manager', 'engineer'],
  },
  {
    key: 'reports',
    path: '/reports',
    label: 'Reports & Analytics',
    labelKey: 'nav.reports',
    icon: FileText,
    section: 'Reports',
    groupKey: 'group.reports',
    roles: ['platform_admin', 'org_admin', 'org_accountant'],
  },
  {
    key: 'audit_log',
    path: '/audit-log',
    label: 'Audit Log',
    labelKey: 'nav.auditLog',
    icon: ScrollText,
    section: 'Reports',
    groupKey: 'group.reports',
    roles: ['platform_admin', 'org_admin', 'engineer'],
  },
  {
    key: 'tickets',
    path: '/support',
    label: 'Maintenance Tickets',
    labelKey: 'nav.maintenanceTickets',
    icon: Wrench,
    section: 'Support',
    groupKey: 'group.support',
    roles: ['platform_admin', 'org_admin', 'manager', 'engineer'],
    end: true,
  },
]

/** Routes not in the sidebar but still guarded for admin roles. */
export const ADMIN_EXTRA_PATHS = ['/billing', '/predictive-ai'] as const

export const ACCOUNTANT_HOME_PATH = '/details?view=table'

const ROLE_CODES: RoleCode[] = [
  'platform_admin',
  'org_admin',
  'org_accountant',
  'manager',
  'engineer',
]

function isRoleCode(value: string): value is RoleCode {
  return (ROLE_CODES as string[]).includes(value)
}

/** Resolve JWT `role_code`, with legacy fallback from `role_name`. */
export function normalizeRoleCode(
  roleCode?: string | null,
  roleName?: string | null,
): RoleCode | null {
  const code = (roleCode ?? '').toLowerCase().trim().replace(/\s+/g, '_')
  if (isRoleCode(code)) return code

  const r = (roleName ?? '').toLowerCase().trim().replace(/\s+/g, ' ')
  if (
    r === 'platform_admin' ||
    r === 'platform admin' ||
    r === 'super_admin' ||
    r === 'super admin'
  ) {
    return 'platform_admin'
  }
  if (r === 'org_admin' || r === 'organization admin' || r === 'admin' || r === 'owner') {
    return 'org_admin'
  }
  if (r === 'org_accountant' || r === 'organization accountant' || r === 'accountant') {
    return 'org_accountant'
  }
  if (r === 'manager') return 'manager'
  if (r === 'engineer') return 'engineer'
  if (r === 'operator') return 'manager'
  return null
}

export function isFullAccessRole(role: RoleCode | null): boolean {
  return role === 'platform_admin' || role === 'org_admin'
}

export function isSidebarItemVisible(item: SidebarItemConfig, role: RoleCode | null): boolean {
  if (!role) return false
  if (isFullAccessRole(role)) return true
  return item.roles.includes(role)
}

export function getSidebarNavItems(
  roleCode?: string | null,
  roleName?: string | null,
): NavItem[] {
  const role = normalizeRoleCode(roleCode, roleName)
  return SIDEBAR_ITEMS.filter((item) => isSidebarItemVisible(item, role)).map((item) => ({
    to: item.path,
    label: item.label,
    labelKey: item.labelKey,
    icon: item.icon,
    group: item.section,
    groupKey: item.groupKey,
    end: item.end,
  }))
}

export function isPathAllowedForRole(
  roleCode?: string | null,
  roleName?: string | null,
  path?: string,
): boolean {
  const role = normalizeRoleCode(roleCode, roleName)
  if (!role) return false
  const p = (path ?? '').replace(/\/$/, '') || '/'

  if (isFullAccessRole(role)) {
    return (
      SIDEBAR_ITEMS.some((item) => item.path === p) ||
      (ADMIN_EXTRA_PATHS as readonly string[]).includes(p)
    )
  }

  return SIDEBAR_ITEMS.some((item) => item.path === p && item.roles.includes(role))
}

export function getDefaultHomePath(
  roleCode?: string | null,
  roleName?: string | null,
): string {
  const role = normalizeRoleCode(roleCode, roleName)
  if (role === 'org_accountant') return ACCOUNTANT_HOME_PATH
  return '/'
}
