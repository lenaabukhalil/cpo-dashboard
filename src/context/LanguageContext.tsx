import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { getLabel, type Locale } from '../lib/translations'

const STORAGE_KEY = 'cpo_locale'

type LanguageContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  isRtl: boolean
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function readStoredLocale(): Locale {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'ar' || v === 'en') return v
  } catch (_) {}
  return 'en'
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale)
  const isRtl = locale === 'ar'

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch (_) {}
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    root.setAttribute('lang', locale === 'ar' ? 'ar' : 'en')
  }, [locale])

  return (
    <LanguageContext.Provider value={{ locale, setLocale, isRtl }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}

/** Translation function and locale for components. Use t('key') for all static text. */
export function useTranslation() {
  const { locale, isRtl } = useLanguage()
  const t = useCallback((key: string) => getLabel(key, locale), [locale])
  return { t, locale, isRtl }
}
