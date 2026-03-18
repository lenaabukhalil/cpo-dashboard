import { useCallback, useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { cn } from '../lib/utils'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { getNavItems } from '../lib/permissions'
import { Button } from './ui/button'
import OrganizationLogoDialog from './OrganizationLogoDialog'
import { getOrg, type Org } from '../services/api'

type Props = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  side?: 'left' | 'right'
  mobile?: boolean
}

export default function Sidebar({ open: _open = true, onOpenChange, side = 'left', mobile = false }: Props) {
  const { user, logout } = useAuth()
  const { t } = useTranslation()

  const roleName = (user?.role_name || 'Admin').toString()
  const first = (user?.f_name || '').toString().trim()
  const last = (user?.l_name || '').toString().trim()
  const fullName = [first, last].filter(Boolean).join(' ')

  const title = `${roleName === 'Owner' ? 'Admin' : roleName} Dashboard`
  const subtitle = `Hello, ${fullName || roleName}`

  const nav = getNavItems(user?.role_name)
  const groups = Array.from(
    nav.reduce((m, it) => {
      const key = it.group || ''
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(it)
      return m
    }, new Map<string, typeof nav>()),
  )

  const handleNavigate = () => {
    if (mobile) onOpenChange?.(false)
  }

  const handleLogout = () => {
    logout()
    if (mobile) onOpenChange?.(false)
  }

  const orgId = user?.organization_id ?? null
  const [org, setOrg] = useState<Org | null>(null)
  const [savedLogoUrl, setSavedLogoUrl] = useState('')
  const [logoDialogOpen, setLogoDialogOpen] = useState(false)

  const loadOrg = useCallback(() => {
    if (orgId == null) return
    getOrg(orgId)
      .then((r) => {
        if (r.success && r.data) {
          const o = r.data as Org
          setOrg(o)
          const initial = (o.logo || '').trim()
          setSavedLogoUrl(initial)
        }
      })
      .catch(() => {
        setOrg(null)
        setSavedLogoUrl('')
      })
  }, [orgId])

  useEffect(() => {
    loadOrg()
  }, [loadOrg])

  useEffect(() => {
    const onOrgUpdated = () => loadOrg()
    window.addEventListener('org-updated', onOrgUpdated)
    return () => window.removeEventListener('org-updated', onOrgUpdated)
  }, [loadOrg])

  return (
    <aside
      className={cn(
        'bg-card border-border',
        mobile ? 'w-full h-full' : 'hidden lg:flex lg:fixed lg:inset-y-0 lg:w-64 lg:flex-col',
        !mobile && side === 'left' ? 'lg:left-0 lg:border-r' : '',
        !mobile && side === 'right' ? 'lg:right-0 lg:border-l' : '',
      )}
      aria-label="Sidebar"
    >
      <div className="flex flex-col h-full min-h-0">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={cn(
                'h-10 w-10 rounded-xl border border-border bg-background flex items-center justify-center shrink-0 overflow-hidden',
                orgId != null ? 'cursor-pointer hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2' : '',
              )}
              onClick={() => {
                if (orgId != null) setLogoDialogOpen(true)
              }}
              aria-label={orgId != null ? 'Change organization logo' : 'Logo'}
            >
              {savedLogoUrl ? (
                <img
                  src={savedLogoUrl}
                  alt={org?.name || 'Organization logo'}
                  className="h-full w-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : (
                <span className="text-sm font-semibold text-foreground">go.</span>
              )}
            </button>
            <div className="min-w-0">
              <div className="text-base font-semibold text-foreground truncate">{title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground truncate">{subtitle}</div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-2 pb-3">
          {groups.map(([groupLabel, items]) => (
            <div key={groupLabel || 'root'} className="mt-3 first:mt-0">
              {groupLabel ? (
                <div className="px-3 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground/80 uppercase">
                  {groupLabel}
                </div>
              ) : null}

              <div className="mt-1 space-y-1">
                {items.map((it) => {
                  const Icon = it.icon
                  const label = it.labelKey ? t(it.labelKey) : it.label
                  return (
                    <NavLink
                      key={it.to}
                      to={it.to}
                      end={it.end}
                      onClick={handleNavigate}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none',
                          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                        )
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 truncate">{label}</span>
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border p-3 pb-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 px-4 pt-1">
            <button
              type="button"
              className="flex items-center gap-3 rounded-lg py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 px-3 -mx-3"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5 shrink-0" />
              <span>Logout</span>
            </button>
            <div className="flex flex-col items-start leading-none text-muted-foreground">
              <div className="text-[11px] font-normal text-muted-foreground/80 whitespace-nowrap">Powered by ION</div>
              <img
                src="/ion-powered.png"
                alt="ION Logo"
                className="mt-1 w-[72px] h-auto object-contain opacity-90"
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
          </div>

          {mobile ? (
            <div className="px-4 pt-3">
              <Button variant="ghost" className="w-full justify-center" onClick={() => onOpenChange?.(false)}>
                Close
              </Button>
            </div>
          ) : null}
        </div>

        {orgId != null ? (
          <OrganizationLogoDialog
            open={logoDialogOpen}
            onOpenChange={setLogoDialogOpen}
            organizationId={orgId}
            currentLogoUrl={savedLogoUrl}
            onSaved={(newUrl) => {
              setSavedLogoUrl(newUrl.trim())
              setOrg((prev) => (prev ? { ...prev, logo: newUrl.trim() || null } : prev))
              window.dispatchEvent(new CustomEvent('org-updated'))
            }}
          />
        ) : null}
      </div>
    </aside>
  )
}

