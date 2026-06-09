/** Storage keys kept in sync with AuthContext / useAccessibleOrgs. */
const CPO_TOKEN_KEY = 'cpo_token'
const CPO_PERMISSIONS_KEY = 'cpo_permissions'
const CPO_USER_KEY = 'cpo_user'
const CPO_SELECTED_ORG_PK_KEY = 'cpo_selected_org_pk'

/** Prevents concurrent 401 handlers from firing multiple redirects. */
let sessionExpiredHandling = false

export const CPO_SESSION_EXPIRED_EVENT = 'cpo-session-expired'

/** Clear persisted auth/session data (no redirect). */
export function clearAuthStorage(): void {
  localStorage.removeItem(CPO_TOKEN_KEY)
  localStorage.removeItem(CPO_PERMISSIONS_KEY)
  localStorage.removeItem(CPO_USER_KEY)
  try {
    sessionStorage.removeItem(CPO_SELECTED_ORG_PK_KEY)
  } catch {
    /* private mode / blocked storage */
  }
}

/** Reset guard after a successful login so a future expiry can redirect again. */
export function resetSessionExpiredGuard(): void {
  sessionExpiredHandling = false
}

/**
 * Idempotent auth-state transition on expired/invalid JWT.
 * Clears storage, notifies React auth layer, stops refresh loop, redirects to /login.
 */
export function handleSessionExpired(): void {
  if (sessionExpiredHandling) return
  sessionExpiredHandling = true

  clearAuthStorage()
  void import('./tokenRefresh').then(({ stopTokenRefresh }) => stopTokenRefresh())
  window.dispatchEvent(new CustomEvent(CPO_SESSION_EXPIRED_EVENT))

  const path = window.location.pathname.replace(/\/$/, '') || '/'
  if (path !== '/login') {
    window.location.replace('/login')
  }
}
