import { useAuth } from '../context/AuthContext'
import { hasPermission, type Access } from '../lib/permissions'

export function usePermission(code: string, need: Access = 'R'): boolean {
  const { permissions } = useAuth()
  return hasPermission(permissions, code, need)
}
