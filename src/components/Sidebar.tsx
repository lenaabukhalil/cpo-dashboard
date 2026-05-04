import { useCallback, useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Building2, LogOut, Pencil } from 'lucide-react'
import { cn } from '../lib/utils'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { canAccessPath, getNavItems } from '../lib/permissions'
import { usePermission } from '../hooks/usePermission'
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
  const { user, logout, permissions } = useAuth()
  const { t } = useTranslation()
  const canEditOrgLogo = usePermission('organizations.view', 'RW')

  const roleName = (user?.role_name || 'Admin').toString()
  const first = (user?.f_name || '').toString().trim()
  const last = (user?.l_name || '').toString().trim()
  const fullName = [first, last].filter(Boolean).join(' ')

  const title = `${roleName === 'Owner' ? 'Admin' : roleName} Dashboard`
  const subtitle = `Hello, ${fullName || roleName}`

  const nav = getNavItems(user?.role_name).filter((it) =>
    canAccessPath(user?.role_name, it.to, permissions),
  )
  const groups = Array.from(
    nav.reduce((m, it) => {
      const key = it.group || ''
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(it)
      return m
    }, new Map<string, typeof nav>()),
  ).filter(([, items]) => items.length > 0)

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
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-2 shrink-0">
              <button
                type="button"
                title={
                  orgId == null
                    ? undefined
                    : canEditOrgLogo
                      ? 'Edit organization logo'
                      : t('common.readOnlyAccess')
                }
                disabled={orgId != null && !canEditOrgLogo}
                className={cn(
                  'relative h-10 w-10 rounded-xl border border-border bg-background flex items-center justify-center shrink-0 overflow-hidden transition-all duration-200',
                  orgId != null && canEditOrgLogo
                    ? 'cursor-pointer group/logo hover:bg-muted/40 hover:border-primary/45 hover:ring-2 hover:ring-ring/60 hover:ring-offset-2 hover:ring-offset-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card'
                    : 'cursor-default opacity-90',
                )}
                onClick={() => {
                  if (orgId != null && canEditOrgLogo) setLogoDialogOpen(true)
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
                  <Building2
                    className="h-[1.125rem] w-[1.125rem] text-muted-foreground"
                    strokeWidth={2}
                    aria-hidden
                  />
                )}
                {orgId != null && canEditOrgLogo ? (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[inherit] bg-background/55 opacity-0 transition-opacity duration-200 group-hover/logo:opacity-100"
                  >
                    <Pencil className="h-3.5 w-3.5 text-foreground drop-shadow-sm" strokeWidth={2.25} aria-hidden />
                  </span>
                ) : null}
              </button>
            </div>

            <div className="min-w-0 pt-0.5 flex-1">
              <div className="text-base font-semibold text-foreground truncate">{title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground truncate">{subtitle}</div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-2 pb-3">
          {groups.map(([groupLabel, items]) => (
            <div key={groupLabel || 'root'} className="mt-3 first:mt-0">
              {groupLabel ? (
                <div className="px-3 py-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  {groupLabel}
                </div>
              ) : null}

              <div className="mt-1 space-y-1">
                {items.map((it) => {
                  const Icon = it.icon
                  const label = it.labelKey ? t(it.labelKey) : it.label
                  return (
                    <div key={it.to} className="space-y-1">
                      <NavLink
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

                      {it.to === '/settings' ? (
                        <button
                          type="button"
                          onClick={handleLogout}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-destructive transition-colors outline-none',
                            'hover:bg-destructive/10',
                            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                          )}
                        >
                          <LogOut className="h-4 w-4 shrink-0" />
                          <span className="min-w-0 truncate">Logout</span>
                        </button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto border-t border-gray-200 pt-4 mt-4 px-4 pb-5">
          <div className="cursor-pointer transition-colors duration-150 hover:text-gray-600">
            <div className="flex items-center gap-2">
              <span className="inline-flex w-5 h-5 items-center justify-center overflow-hidden rounded-md">
                <img
                  src="/favicon.png"
                  alt="App icon"
                  className="w-5 h-5 object-contain"
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                  }}
                />
              </span>
              <span className="text-sm text-gray-500">Powered by: ION</span>
            </div>
            <div className="mt-1 text-xs text-gray-400">Electric Vehicle Charging Systems</div>

            {mobile ? (
              <div className="pt-3">
                <Button variant="ghost" className="w-full justify-center" onClick={() => onOpenChange?.(false)}>
                  Close
                </Button>
              </div>
            ) : null}
          </div>
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

