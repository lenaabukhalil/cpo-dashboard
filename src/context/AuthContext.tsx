import React, { createContext, useContext, useEffect, useState } from 'react'
import type { AuthUser } from '../services/api'
import { clearGetCache, me } from '../services/api'

const API_BASE = import.meta.env.VITE_API_URL || ''

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  setUser: (u: AuthUser | null) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('cpo_token')
    if (!token) {
      setLoading(false)
      return
    }
    me()
      .then((r) => {
        const u = (r as { user?: AuthUser }).user ?? (r as { data?: { user?: AuthUser } }).data?.user
        if (r.success && u) setUser(u)
        else localStorage.removeItem('cpo_token')
      })
      .finally(() => setLoading(false))
  }, [])

  const logout = () => {
    const token = localStorage.getItem('cpo_token')
    localStorage.removeItem('cpo_token')
    clearGetCache()
    setUser(null)
    // Notify backend so audit_log records logout (use saved token; request is fire-and-forget)
    if (token) {
      fetch(API_BASE + '/api/v4/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: '{}',
      }).catch(() => {})
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
