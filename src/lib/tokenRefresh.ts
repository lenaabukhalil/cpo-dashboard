import { refreshToken, type PermissionMap, type AuthUser } from '../services/api'

type RefreshSuccessHandler = (user: AuthUser, permissions: PermissionMap) => void
type RefreshFailureHandler = () => void

/** Refresh this many ms BEFORE the JWT actually expires. 5 minutes. */
const REFRESH_LEAD_MS = 5 * 60 * 1000

/** Minimum gap between refresh attempts to avoid hammering on errors. */
const MIN_REFRESH_INTERVAL_MS = 60 * 1000

let scheduledTimer: ReturnType<typeof setTimeout> | null = null
let lastRefreshAt = 0
let inFlight: Promise<boolean> | null = null
let onSuccess: RefreshSuccessHandler | null = null
let onFailure: RefreshFailureHandler | null = null
let visibilityHandler: (() => void) | null = null

/** Parse JWT payload (no signature verification — purely to read `exp`). */
function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null // seconds → ms
  } catch {
    return null
  }
}

/** Public: trigger an immediate refresh attempt. Deduped: concurrent callers
 *  share one in-flight promise. Returns true on success. */
export async function performRefresh(): Promise<boolean> {
  if (inFlight) return inFlight
  if (Date.now() - lastRefreshAt < MIN_REFRESH_INTERVAL_MS) return true
  inFlight = (async () => {
    try {
      const res = await refreshToken()
      const newToken = (res as { token?: string }).token
                     ?? (res as { data?: { token?: string } }).data?.token
      const user = (res as { user?: AuthUser }).user
                 ?? (res as { data?: { user?: AuthUser } }).data?.user
      const perms = (res as { permissions?: PermissionMap }).permissions
                 ?? (res as { data?: { permissions?: PermissionMap } }).data?.permissions
                 ?? {}
      if (res.success && newToken && user) {
        localStorage.setItem('cpo_token', newToken)
        lastRefreshAt = Date.now()
        onSuccess?.(user, perms)
        scheduleNextRefresh() // re-schedule based on new token's exp
        return true
      }
      onFailure?.()
      return false
    } catch {
      onFailure?.()
      return false
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

/** Internal: schedule the next refresh based on the current token's exp. */
function scheduleNextRefresh() {
  if (scheduledTimer) {
    clearTimeout(scheduledTimer)
    scheduledTimer = null
  }
  const token = localStorage.getItem('cpo_token')
  if (!token) return
  const expMs = decodeJwtExp(token)
  if (!expMs) return
  const fireAt = expMs - REFRESH_LEAD_MS
  const delay = Math.max(1000, fireAt - Date.now())
  scheduledTimer = setTimeout(() => {
    void performRefresh()
  }, delay)
}

/** Start the refresh manager. Wire up visibility listener + initial schedule. */
export function startTokenRefresh(
  successHandler: RefreshSuccessHandler,
  failureHandler: RefreshFailureHandler,
) {
  stopTokenRefresh()
  onSuccess = successHandler
  onFailure = failureHandler
  visibilityHandler = () => {
    if (document.visibilityState === 'visible') {
      const token = localStorage.getItem('cpo_token')
      if (!token) return
      const expMs = decodeJwtExp(token)
      if (!expMs) return
      if (expMs - Date.now() < REFRESH_LEAD_MS) {
        void performRefresh()
      } else {
        scheduleNextRefresh()
      }
    }
  }
  document.addEventListener('visibilitychange', visibilityHandler)
  scheduleNextRefresh()
}

/** Stop everything (on logout). */
export function stopTokenRefresh() {
  if (scheduledTimer) {
    clearTimeout(scheduledTimer)
    scheduledTimer = null
  }
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler)
    visibilityHandler = null
  }
  onSuccess = null
  onFailure = null
  inFlight = null
}
