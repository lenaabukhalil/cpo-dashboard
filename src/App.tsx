import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ACCOUNTANT_HOME_PATH, canAccessPath, getRole } from './lib/permissions'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Org from './pages/Org'
import OrgDetails from './pages/OrgDetails'
import Sessions from './pages/Sessions'
import Reports from './pages/Reports'
import PredictiveAI from './pages/PredictiveAI'
import Support from './pages/Support'
import Billing from './pages/Billing'
import MapView from './pages/MapView'
import PartnerUsers from './pages/PartnerUsers'
import Grants from './pages/Grants'
import SupportLayout from './pages/support/SupportLayout'
import ListOfLocationChargerConnectorTariffs from './pages/ListOfLocationChargerConnectorTariffs'
import AuditLog from './pages/AuditLog'
import Profile from './pages/Profile'
import NotificationDetail from './pages/NotificationDetail'
import { NotificationProvider } from './contexts/NotificationContext'
import { ToastProvider } from './contexts/ToastContext'

function isOperator(roleName: string | undefined): boolean {
  return (roleName || '').toLowerCase() === 'operator'
}

function isEngineer(roleName: string | undefined): boolean {
  return (roleName || '').toLowerCase() === 'engineer'
}

function isManager(roleName: string | undefined): boolean {
  return (roleName || '').toLowerCase() === 'manager'
}

function isViewer(roleName: string | undefined): boolean {
  return (roleName || '').toLowerCase() === 'viewer'
}

function RoleGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, permissions } = useAuth()
  const location = useLocation()
  if (loading || !user) return null
  const path = location.pathname.replace(/\/$/, '') || '/'
  if (!canAccessPath(user.role_name, path, permissions)) {
    if (getRole(user.role_name) === 'accountant') return <Navigate to={ACCOUNTANT_HOME_PATH} replace />
    if (isViewer(user.role_name)) return <Navigate to="/" replace />
    if (isEngineer(user.role_name)) return <Navigate to="/" replace />
    if (isManager(user.role_name)) return <Navigate to="/" replace />
    if (isOperator(user.role_name)) return <Navigate to="/" replace />
    return <Navigate to="/details" replace />
  }
  return <>{children}</>
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function IndexRedirect() {
  const { user } = useAuth()
  if (getRole(user?.role_name) === 'accountant') {
    return <Navigate to={ACCOUNTANT_HOME_PATH} replace />
  }
  return <Dashboard />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<IndexRedirect />} />
        <Route path="org" element={<RoleGuard><Org /></RoleGuard>} />
        <Route path="details" element={<RoleGuard><OrgDetails /></RoleGuard>} />
        <Route path="list" element={<RoleGuard><ListOfLocationChargerConnectorTariffs /></RoleGuard>} />
        <Route path="sessions" element={<RoleGuard><Sessions /></RoleGuard>} />
        <Route path="reports" element={<RoleGuard><Reports /></RoleGuard>} />
        <Route path="predictive-ai" element={<RoleGuard><PredictiveAI /></RoleGuard>} />
        <Route path="support" element={<RoleGuard><SupportLayout /></RoleGuard>}>
          <Route index element={<Support />} />
        </Route>
        <Route path="billing" element={<RoleGuard><Billing /></RoleGuard>} />
        <Route path="map" element={<RoleGuard><MapView /></RoleGuard>} />
        <Route path="partner-users" element={<RoleGuard><PartnerUsers /></RoleGuard>} />
        <Route path="grants" element={<RoleGuard><Grants /></RoleGuard>} />
        <Route path="audit-log" element={<RoleGuard><AuditLog /></RoleGuard>} />
        <Route path="access-log" element={<Navigate to="/audit-log" replace />} />
        <Route path="profile" element={<Profile />} />
        <Route
          path="notifications/:notificationId"
          element={<ProtectedRoute><NotificationDetail /></ProtectedRoute>}
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </NotificationProvider>
    </AuthProvider>
  )
}
