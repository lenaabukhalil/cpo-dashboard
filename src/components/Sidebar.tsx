import { useCallback, useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut, Pencil } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { getOrg, updateOrg, type Org } from '../services/api'
import { getNavItems } from '../lib/permissions'
import { getLabel } from '../lib/translations'
import { cn } from '../lib/utils'
import ChangeLogoModal from './ChangeLogoModal'

type SidebarProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  mobile?: boolean
  /** 'left' | 'right' – when RTL (Arabic) sidebar is on the right */
  side?: 'left' | 'right'
}

const sidebarContainerClass =
  'flex flex-col h-screen max-h-[100dvh] w-64 bg-background text-foreground min-h-0 overflow-hidden'

const DEFAULT_LOGO = '/ion-logo.png'

export default function Sidebar({ mobile, onOpenChange, side = 'left' }: SidebarProps) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { locale } = useLanguage()
  const [org, setOrg] = useState<Org | null>(null)
  const [showLogoModal, setShowLogoModal] = useState(false)
  const [savingLogo, setSavingLogo] = useState(false)
  const [logoCacheBuster, setLogoCacheBuster] = useState(0)
  const navItems = getNavItems(user?.role_name)

  const loadOrg = useCallback(() => {
    if (user?.organization_id == null) return
    getOrg(user.organization_id)
      .then((r) => {
        const o = (r as { data?: Org }).data ?? (r as unknown as Org)
        if (o && typeof o === 'object' && 'organization_id' in o) {
          const raw = o as unknown as Record<string, unknown>
          const logo = (o.logo ?? raw.logo ?? raw.LOGO ?? '') as string | undefined
          setOrg({ ...o, logo: logo && String(logo).trim() ? String(logo).trim() : undefined } as Org)
        }
      })
      .catch(() => setOrg(null))
  }, [user?.organization_id])

  const handleSaveLogo = useCallback(
    async (url: string) => {
      if (user?.organization_id == null) return
      setSavingLogo(true)
      try {
        const logoUrl = url.trim() || undefined
        // Send only logo so backend partial update does not touch other org fields
        const res = await updateOrg(user.organization_id, { logo: logoUrl })
        if (res.success) {
          setLogoCacheBuster(Date.now())
          window.dispatchEvent(new CustomEvent('org-updated'))
          // Refetch org so sidebar and modal show new logo URL from DB
          getOrg(user.organization_id).then((r) => {
            const o = (r as { data?: Org }).data ?? (r as unknown as Org)
            if (o && typeof o === 'object' && 'organization_id' in o) {
              const raw = o as unknown as Record<string, unknown>
              const logo = (o.logo ?? raw.logo ?? raw.LOGO ?? '') as string | undefined
              setOrg({ ...o, logo: logo && String(logo).trim() ? String(logo).trim() : undefined } as Org)
            }
          }).catch(() => {})
        } else {
          throw new Error((res as { message?: string }).message ?? 'Failed to save')
        }
      } finally {
        setSavingLogo(false)
      }
    },
    [user?.organization_id]
  )

  useEffect(() => {
    loadOrg()
  }, [loadOrg])

  useEffect(() => {
    const onOrgUpdated = () => loadOrg()
    window.addEventListener('org-updated', onOrgUpdated)
    return () => window.removeEventListener('org-updated', onOrgUpdated)
  }, [loadOrg])

  // When user returns to the tab (e.g. after editing org in DB), refetch so sidebar shows latest
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && user?.organization_id != null) loadOrg()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [loadOrg, user?.organization_id])

  const hasCustomLogo = Boolean(org?.logo?.trim())
  const baseLogoUrl = org?.logo?.trim() || DEFAULT_LOGO
  const logoUrl = org?.logo?.trim()
    ? `${baseLogoUrl}${baseLogoUrl.includes('?') ? '&' : '?'}t=${logoCacheBuster}`
    : baseLogoUrl

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const content = (
    <>
      {/* Header: logo with hover edit icon; click logo or icon opens Change Logo modal */}
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowLogoModal(true)}
            className="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Change logo"
          >
            <div className="relative h-10 w-10">
              {hasCustomLogo ? (
                <>
                  <img
                    key={logoUrl}
                    src={logoUrl}
                    alt={org?.name ?? 'Logo'}
                    className="h-10 w-10 rounded object-contain"
                    onError={(e) => {
                      e.currentTarget.style.visibility = 'hidden'
                      const fallback = document.getElementById('sidebar-logo-fallback')
                      if (fallback) {
                        fallback.style.display = 'flex'
                        fallback.textContent = '?'
                      }
                    }}
                  />
                  <div
                    id="sidebar-logo-fallback"
                    className="absolute inset-0 hidden h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground text-lg"
                    style={{ display: 'none' }}
                    aria-hidden
                  >
                    ?
                  </div>
                </>
              ) : (
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xl"
                  aria-hidden
                >
                  ⚡
                </div>
              )}
            </div>
            {/* Edit icon overlay on hover */}
            <span
              className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden
            >
              <Pencil className="h-5 w-5 text-white" />
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-foreground">{getLabel('sidebar.cpoDashboard', locale)}</h2>
            <p className="text-xs text-muted-foreground">{getLabel('sidebar.evCharging', locale)}</p>
          </div>
        </div>
      </div>

      {/* Menu list with optional section groups — min-h-0 lets flex shrink so Logout stays visible */}
      <nav className="flex-1 min-h-0 space-y-4 overflow-y-auto px-3 py-4">
        {(() => {
          const groups = new Map<string | null, typeof navItems>()
          navItems.forEach((item) => {
            const g = item.group ?? null
            if (!groups.has(g)) groups.set(g, [])
            groups.get(g)!.push(item)
          })
          return Array.from(groups.entries()).map(([group, items]) => (
            <div key={group ?? 'main'} className="space-y-1">
              {group && (
                <p className="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {items[0]?.groupKey ? getLabel(items[0].groupKey, locale) : group}
                </p>
              )}
              {items.map(({ to, label, labelKey, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end ?? to === '/'}
                  onClick={() => mobile && onOpenChange?.(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-4 py-2 text-sm font-medium transition-all duration-200 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm [&>svg]:text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground [&>svg]:text-muted-foreground'
                    )
                  }
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {labelKey ? getLabel(labelKey, locale) : label}
                </NavLink>
              ))}
            </div>
          ))
        })()}
      </nav>

      {/* Logout pinned at bottom */}
      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {getLabel('nav.logout', locale)}
        </button>
      </div>

      <ChangeLogoModal
        open={showLogoModal}
        onOpenChange={setShowLogoModal}
        currentLogoUrl={org?.logo ?? ''}
        onSave={handleSaveLogo}
        saving={savingLogo}
      />
    </>
  )

  const borderClass = side === 'right' ? 'border-l border-border' : 'border-r border-border'
  const positionClass = side === 'right' ? 'fixed right-0 top-0 z-50 hidden lg:flex' : 'fixed left-0 top-0 z-50 hidden lg:flex'

  if (mobile) {
    return <div className={cn(sidebarContainerClass, borderClass, 'flex')}>{content}</div>
  }

  return (
    <aside className={cn(sidebarContainerClass, borderClass, positionClass)}>
      {content}
    </aside>
  )
}
