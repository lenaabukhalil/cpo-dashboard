import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { canAccessPath } from '../lib/permissions'
import { getDefaultHomePath } from '../config/sidebar'

export default function RoleGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, permissions } = useAuth()
  const location = useLocation()

  if (loading || !user) return null

  const path = location.pathname.replace(/\/$/, '') || '/'
  if (!canAccessPath(user.role_code, user.role_name, path, permissions)) {
    return <Navigate to={getDefaultHomePath(user.role_code, user.role_name)} replace />
  }

  return <>{children}</>
}
