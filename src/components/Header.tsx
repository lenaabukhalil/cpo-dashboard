import { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Sun, Moon, User, Languages, LogOut, CircleUserRound } from 'lucide-react'
import { useTheme } from 'next-themes'
import { HeaderIconButton } from './HeaderIconButton'
import NotificationBell from './NotificationBell'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { getLabel } from '../lib/translations'
import type { Locale } from '../lib/translations'
import { cn } from '../lib/utils'

type HeaderProps = {
  onMenuClick?: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const { user, logout } = useAuth()
  const { locale, setLocale } = useLanguage()
  const [langOpen, setLangOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const langRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const fullName = [user?.f_name, user?.l_name].filter(Boolean).join(' ').trim()
  const userLabel = fullName || user?.role_name || 'User'

  useEffect(() => {
    if (!langOpen) return
    const onOutside = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [langOpen])

  useEffect(() => {
    if (!profileOpen) return
    const onOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProfileOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [profileOpen])

  return (
    <header className="app-header sticky top-0 z-50 w-full bg-background">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        <div className="lg:hidden">
          <HeaderIconButton
            label={getLabel('header.menu', locale)}
            icon={<Menu className="h-5 w-5" />}
            onClick={onMenuClick}
            aria-label={getLabel('header.menu', locale)}
          />
        </div>
        <div />
        <div className="flex items-center gap-1">
          {/* Language switcher - left of notifications */}
          <div className="relative" ref={langRef}>
            <HeaderIconButton
              label={getLabel('header.language', locale)}
              icon={<Languages className="h-5 w-5" />}
              onClick={() => setLangOpen((o) => !o)}
              aria-label={getLabel('header.language', locale)}
            />
            {langOpen && (
              <div className="absolute right-0 top-full mt-1 min-w-[140px] rounded-lg border border-border bg-card py-1 shadow-lg rtl:right-auto rtl:left-0">
                {(['en', 'ar'] as Locale[]).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-muted"
                    onClick={() => {
                      setLocale(loc)
                      setLangOpen(false)
                    }}
                  >
                    <span className={locale === loc ? 'h-2 w-2 rounded-full bg-primary' : 'h-2 w-2 rounded-full bg-transparent'} aria-hidden />
                    {getLabel(loc === 'en' ? 'language.english' : 'language.arabic', locale)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <NotificationBell />
          <HeaderIconButton
            label={getLabel('header.theme', locale)}
            icon={
              <>
                <Sun className="absolute h-5 w-5 scale-0 transition-all dark:scale-100 dark:rotate-0" />
                <Moon className="h-5 w-5 scale-100 transition-all dark:scale-0 dark:-rotate-90" />
              </>
            }
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={getLabel('header.theme', locale)}
          />
          <div className="relative" ref={profileRef}>
            <HeaderIconButton
              label={getLabel('header.profile', locale)}
              icon={<User className="h-5 w-5" />}
              onClick={() => setProfileOpen((o) => !o)}
              aria-label={getLabel('header.profile', locale)}
            />
            <div
              className={cn(
                'absolute right-0 top-full mt-2 w-56 rounded-xl border border-gray-200 bg-white shadow-lg transition-all duration-150',
                profileOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-1 pointer-events-none',
              )}
              role="menu"
              aria-hidden={!profileOpen}
            >
              <div className="border-b border-gray-100 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                    <CircleUserRound className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">{userLabel}</p>
                    {/* Role label intentionally hidden in profile dropdown */}
                  </div>
                </div>
              </div>

              <div className="p-1.5">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    setProfileOpen(false)
                    navigate('/profile')
                  }}
                  role="menuitem"
                >
                  <User className="h-4 w-4" />
                  <span>Profile</span>
                </button>
                <div className="my-1 h-px bg-gray-200" />

                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    setProfileOpen(false)
                    logout()
                  }}
                  role="menuitem"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
