/**
 * CPO role-based permissions + JWT permission map (RBAC).
 * Structure aligned to: A.Organizations | B.Operation | C.Monitor | D.Reports | E.Support | F.ION Users
 */

import type { ComponentType } from 'react'

export type Access = 'R' | 'RW'
export type { PermissionMap, PermissionValue } from '../services/api'
import type { PermissionMap } from '../services/api'
import {
  getSidebarNavItems,
  isPathAllowedForRole,
  normalizeRoleCode,
  type RoleCode,
} from '../config/sidebar'

export { ACCOUNTANT_HOME_PATH } from '../config/sidebar'

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

function roleCodeToLegacyRole(role: RoleCode | null): Role | null {
  if (!role) return null
  if (role === 'platform_admin' || role === 'org_admin') return 'admin'
  if (role === 'org_accountant') return 'accountant'
  if (role === 'manager') return 'manager'
  if (role === 'engineer') return 'engineer'
  return null
}

export function getRole(
  roleCode?: string | null,
  roleName?: string | null,
): Role | null {
  return roleCodeToLegacyRole(normalizeRoleCode(roleCode, roleName)) ?? normalizeRole(roleName ?? undefined)
}

export function canAccessPath(
  roleCode: string | undefined | null,
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
  // Permission code not yet provisioned on backend — fall back to role_code sidebar config.
  // TODO(rbac): remove this fallback once all codes in ROUTE_PERMISSIONS exist in
  // ocpp_CSGO.Permissions and are assigned in Role_Permissions.

  return isPathAllowedForRole(roleCode, roleName, p)
}

export function getNavItems(
  roleCode?: string | null,
  roleName?: string | null,
): NavItem[] {
  return getSidebarNavItems(roleCode, roleName)
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

/** Audit Log visibility (sidebar + page). */
export function canAccessAuditLog(
  roleName: string | undefined,
  roleCode?: string | null,
): boolean {
  const code = normalizeRoleCode(roleCode, roleName)
  if (code === 'platform_admin' || code === 'org_admin' || code === 'engineer') return true
  const role = normalizeRole(roleName)
  return role === 'admin' || role === 'operator'
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
