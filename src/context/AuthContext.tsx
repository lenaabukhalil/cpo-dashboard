import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { AuthUser, PermissionMap, PermissionValue } from '../services/api'
import { me } from '../services/api'
import { clearSelectedOrgPk } from '../hooks/useAccessibleOrgs'
import { startTokenRefresh, stopTokenRefresh } from '../lib/tokenRefresh'
import {
  CPO_SESSION_EXPIRED_EVENT,
  handleSessionExpired,
  resetSessionExpiredGuard,
} from '../lib/sessionExpired'

const CPO_PERMISSIONS_KEY = 'cpo_permissions'
const CPO_USER_KEY = 'cpo_user'

function parsePermissionEntry(v: unknown): PermissionValue | undefined {
  if (v === true || v === false) return v
  if (v === 'R' || v === 'RW') return v
  return undefined
}

function readStoredPermissions(): PermissionMap {
  try {
    const raw = localStorage.getItem(CPO_PERMISSIONS_KEY)
    if (!raw) return {}
    const p = JSON.parse(raw) as unknown
    if (!p || typeof p !== 'object' || Array.isArray(p)) return {}
    const out: PermissionMap = {}
    for (const [k, v] of Object.entries(p)) {
      const entry = parsePermissionEntry(v)
      if (entry !== undefined) out[k] = entry
    }
    return out
  } catch {
    return {}
  }
}

function readStoredUser(): AuthUser | null {
  try {
    const cached = localStorage.getItem(CPO_USER_KEY)
    if (!cached) return null
    const parsed = JSON.parse(cached) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as AuthUser
  } catch {
    return null
  }
}

type AuthContextValue = {
  user: AuthUser | null
  permissions: PermissionMap
  loading: boolean
  /** @deprecated Prefer setAuth(user, permissions) so permission map stays in sync. */
  setUser: (u: AuthUser | null) => void
  setAuth: (user: AuthUser | null, permissions?: PermissionMap | null) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(readStoredUser)
  const [permissions, setPermissions] = useState<PermissionMap>(readStoredPermissions)
  const [loading, setLoading] = useState(true)

  const setUser = useCallback((u: AuthUser | null) => {
    setUserState(u)
    try {
      if (u) {
        localStorage.setItem(CPO_USER_KEY, JSON.stringify(u))
      } else {
        localStorage.removeItem(CPO_USER_KEY)
      }
    } catch {
      /* ignore */
    }
  }, [])

  const syncSessionCleared = useCallback(() => {
    stopTokenRefresh()
    clearSelectedOrgPk()
    setUserState(null)
    setPermissions({})
  }, [])

  const beginRefreshLoop = useCallback(() => {
    stopTokenRefresh()
    startTokenRefresh(
      (freshUser, freshPerms) => {
        setUser(freshUser)
        setPermissions(freshPerms)
        try {
          localStorage.setItem(CPO_PERMISSIONS_KEY, JSON.stringify(freshPerms))
        } catch {
          /* ignore */
        }
      },
      () => {
        handleSessionExpired()
      },
    )
  }, [setUser])

  const setAuth = useCallback(
    (u: AuthUser | null, perms?: PermissionMap | null) => {
      if (!u) {
        clearSelectedOrgPk()
        setUserState(null)
        setPermissions({})
        try {
          localStorage.removeItem(CPO_USER_KEY)
          localStorage.removeItem(CPO_PERMISSIONS_KEY)
        } catch {
          /* ignore */
        }
        return
      }
      resetSessionExpiredGuard()
      const next = perms ?? {}
      setUser(u)
      setPermissions(next)
      try {
        localStorage.setItem(CPO_USER_KEY, JSON.stringify(u))
        localStorage.setItem(CPO_PERMISSIONS_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      beginRefreshLoop()
    },
    [beginRefreshLoop, setUser],
  )

  useEffect(() => {
    const onSessionExpired = () => syncSessionCleared()
    window.addEventListener(CPO_SESSION_EXPIRED_EVENT, onSessionExpired)
    return () => window.removeEventListener(CPO_SESSION_EXPIRED_EVENT, onSessionExpired)
  }, [syncSessionCleared])

  useEffect(() => {
    const token = localStorage.getItem('cpo_token')

    if (!token) {
      setLoading(false)
      return
    }

    try {
      const cachedUser = localStorage.getItem(CPO_USER_KEY)
      if (cachedUser) {
        const parsed = JSON.parse(cachedUser) as AuthUser
        setUserState(parsed)
      }
      const cachedPerms = localStorage.getItem(CPO_PERMISSIONS_KEY)
      if (cachedPerms) {
        setPermissions(JSON.parse(cachedPerms) as PermissionMap)
      }
    } catch {
      /* ignore corrupt cache */
    }

    setLoading(false)

    me({ skipCache: true })
      .then((r) => {
        const u =
          (r as { user?: AuthUser }).user ?? (r as { data?: { user?: AuthUser } }).data?.user
        const perms =
          (r as { permissions?: PermissionMap }).permissions ??
          (r as { data?: { permissions?: PermissionMap } }).data?.permissions ??
          {}
        if (r.success && u) {
          setUser(u)
          setPermissions(perms)
          try {
            localStorage.setItem(CPO_USER_KEY, JSON.stringify(u))
            localStorage.setItem(CPO_PERMISSIONS_KEY, JSON.stringify(perms))
          } catch {
            /* ignore */
          }
          beginRefreshLoop()
        }
      })
      .catch(() => {
        /* network errors: keep cached user + token */
      })
  }, [beginRefreshLoop, setUser])

  const logout = useCallback(() => {
    stopTokenRefresh()
    clearSelectedOrgPk()
    localStorage.removeItem('cpo_token')
    localStorage.removeItem(CPO_USER_KEY)
    localStorage.removeItem(CPO_PERMISSIONS_KEY)
    setUserState(null)
    setPermissions({})
    window.location.href = '/login'
  }, [])

  return (
    <AuthContext.Provider value={{ user, permissions, loading, setUser, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
