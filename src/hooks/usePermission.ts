import { useAuth } from '../context/AuthContext'
import { hasPermission, type Access } from '../lib/permissions'

/**
 * Write/action gating by permission code. During RBAC rollout, if `permissions` is empty
 * (e.g. older token) or the map has no entry for `code`, returns **true** so controls stay
 * enabled and the API remains authoritative (403 + `requiredPermission` → `cpo-api-forbidden` toast).
 * TODO(rbac): remove this permissive default once every role receives full maps from the backend.
 */
export function usePermission(code: string, need: Access = 'R'): boolean {
  const { permissions } = useAuth()
  if (!permissions || Object.keys(permissions).length === 0) return true
  if (permissions[code] === undefined) return true
  return hasPermission(permissions, code, need)
}
