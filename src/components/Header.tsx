import { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Sun, Moon, User, Languages } from 'lucide-react'
import { useTheme } from 'next-themes'
import { HeaderIconButton } from './HeaderIconButton'
import NotificationBell from './NotificationBell'
import { useLanguage } from '../context/LanguageContext'
import { getLabel } from '../lib/translations'
import type { Locale } from '../lib/translations'

type HeaderProps = {
  onMenuClick?: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const { locale, setLocale } = useLanguage()
  const [langOpen, setLangOpen] = useState(false)
  const langRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!langOpen) return
    const onOutside = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [langOpen])

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
        <div className="flex-1 lg:flex-none" />
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
          <HeaderIconButton
            label={getLabel('header.profile', locale)}
            icon={<User className="h-5 w-5" />}
            onClick={() => navigate('/profile')}
            aria-label={getLabel('header.profile', locale)}
          />
        </div>
      </div>
    </header>
  )
}
