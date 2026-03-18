import { Link, useLocation } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { cn } from '../lib/utils'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { Button } from './ui/button'
import { Separator } from './ui/separator'

type Props = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  side?: 'left' | 'right'
  mobile?: boolean
}

type NavItem = { to: string; label: string }

export default function Sidebar({ open = true, onOpenChange, side = 'left', mobile = false }: Props) {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const { t } = useTranslation()

  const roleName = (user?.role_name || 'Admin').toString()
  const first = (user?.f_name || '').toString().trim()
  const last = (user?.l_name || '').toString().trim()
  const helloName = [first, last].filter(Boolean).join(' ')

  const title = `${roleName === 'Owner' ? 'Admin Operator' : roleName} Dashboard`
  const subtitle = `Hello, ${helloName || roleName}`

  const nav: NavItem[] = [
    { to: '/', label: t('nav.dashboard') || 'Dashboard' },
    { to: '/monitor', label: t('nav.monitor') || 'Monitor' },
    { to: '/reports', label: t('nav.reports') || 'Reports & Analytics' },
    { to: '/audit-log', label: t('nav.auditLog') || 'Audit Log' },
    { to: '/settings', label: t('nav.settings') || 'Settings' },
  ]

  const handleNavigate = () => {
    if (mobile) onOpenChange?.(false)
  }

  const handleLogout = () => {
    logout()
    if (mobile) onOpenChange?.(false)
  }

  // Desktop: always mounted, but hidden on small screens
  if (!mobile && !open) return null

  return (
    <aside
      className={cn(
        'bg-card border-border',
        mobile ? 'w-full h-full' : 'hidden lg:flex lg:fixed lg:inset-y-0 lg:w-64 lg:flex-col',
        !mobile && side === 'left' ? 'lg:left-0 lg:border-r' : '',
        !mobile && side === 'right' ? 'lg:right-0 lg:border-l' : ''
      )}
      aria-label="Sidebar"
    >
      <div className="flex flex-col h-full min-h-0">
        <div className="p-5">
          <div className="text-base font-semibold text-foreground truncate">{title}</div>
          <div className="mt-0.5 text-xs text-muted-foreground truncate">{subtitle}</div>
        </div>

        <Separator />

        <nav className="flex-1 min-h-0 overflow-auto p-3 space-y-1">
          {nav.map((it) => {
            const active = pathname === it.to || (it.to !== '/' && pathname.startsWith(it.to))
            return (
              <Link
                key={it.to}
                to={it.to}
                onClick={handleNavigate}
                className={cn(
                  'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                )}
              >
                {it.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-border p-3 pb-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 px-4 pt-1">
            <button
              type="button"
              className="flex items-center gap-3 rounded-lg py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 px-3 -mx-3"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5 shrink-0" />
              <span>{t('common.logout') || 'Logout'}</span>
            </button>
            <div className="flex flex-col items-start leading-none text-muted-foreground">
              <div className="text-[11px] font-normal text-muted-foreground/80 whitespace-nowrap">Powered by :</div>
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
      </div>
    </aside>
  )
}

