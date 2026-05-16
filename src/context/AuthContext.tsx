import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { AuthUser, PermissionMap, PermissionValue } from '../services/api'
import { clearGetCache, me } from '../services/api'

const API_BASE = import.meta.env.VITE_API_URL || ''
const CPO_PERMISSIONS_KEY = 'cpo_permissions'

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

function persistPermissions(perms: PermissionMap) {
  try {
    localStorage.setItem(CPO_PERMISSIONS_KEY, JSON.stringify(perms))
  } catch {
    /* ignore quota / private mode */
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
  const [user, setUser] = useState<AuthUser | null>(null)
  const [permissions, setPermissions] = useState<PermissionMap>(readStoredPermissions)
  const [loading, setLoading] = useState(true)

  const setAuth = useCallback((u: AuthUser | null, perms?: PermissionMap | null) => {
    setUser(u)
    if (!u) {
      setPermissions({})
      try {
        localStorage.removeItem(CPO_PERMISSIONS_KEY)
      } catch {
        /* ignore */
      }
      return
    }
    const next = perms ?? {}
    setPermissions(next)
    persistPermissions(next)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('cpo_token')
    if (!token) {
      setLoading(false)
      return
    }
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
          persistPermissions(perms)
        } else {
          localStorage.removeItem('cpo_token')
          localStorage.removeItem(CPO_PERMISSIONS_KEY)
          clearGetCache()
          setUser(null)
          setPermissions({})
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const logout = () => {
    const token = localStorage.getItem('cpo_token')
    localStorage.removeItem('cpo_token')
    localStorage.removeItem(CPO_PERMISSIONS_KEY)
    clearGetCache()
    setUser(null)
    setPermissions({})
    if (token) {
      fetch(API_BASE + '/api/v4/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: '{}',
      }).catch(() => {})
    }
  }

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
