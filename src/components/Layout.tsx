import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { Sheet, SheetContent } from './ui/sheet'
import { useLanguage, useTranslation } from '../context/LanguageContext'
import { useNodeRedNotificationStream } from '../hooks/useNodeRedNotificationStream'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [forbiddenMessage, setForbiddenMessage] = useState<string | null>(null)
  const { isRtl } = useLanguage()
  const { t } = useTranslation()
  const sidebarSide = isRtl ? 'right' : 'left'
  const contentMargin = isRtl ? 'mr-0 lg:mr-64' : 'ml-0 lg:ml-64'
  useNodeRedNotificationStream()

  useEffect(() => {
    let dismissTimer: ReturnType<typeof window.setTimeout>
    const onForbidden = (ev: Event) => {
      const detail = (ev as CustomEvent<{ message?: string }>).detail
      const msg = (detail?.message && String(detail.message).trim()) || t('errors.forbidden')
      window.clearTimeout(dismissTimer)
      setForbiddenMessage(msg)
      dismissTimer = window.setTimeout(() => setForbiddenMessage(null), 7000)
    }
    window.addEventListener('cpo-api-forbidden', onForbidden)
    return () => {
      window.removeEventListener('cpo-api-forbidden', onForbidden)
      window.clearTimeout(dismissTimer)
    }
  }, [t])

  return (
    <div className="min-h-screen min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden bg-background" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Sidebar: fixed, z-50 so it always stacks above main content (z-0) */}
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} side={sidebarSide} />
      {/* Main content: z-0 so it stays below sidebar; on lg width = viewport - sidebar to prevent overlap */}
      <div
        className={`${contentMargin} relative z-0 flex flex-col min-h-screen h-screen min-w-0 w-full lg:w-[calc(100vw-16rem)] max-w-full bg-background`}
      >
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 lg:p-8 overflow-auto overflow-x-hidden text-start bg-background min-w-0">
          <div className="max-w-[1400px] mx-auto w-full min-w-0 flex-1 flex flex-col min-h-0 space-y-6 overflow-x-hidden">
            <Outlet />
          </div>
        </main>
      </div>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side={sidebarSide} className="p-0 w-64 max-h-[100dvh] overflow-hidden flex flex-col">
          <Sidebar mobile onOpenChange={setSidebarOpen} side={sidebarSide} />
        </SheetContent>
      </Sheet>

      {forbiddenMessage ? (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-[100] max-w-md -translate-x-1/2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-foreground shadow-lg backdrop-blur-sm"
        >
          <p className="font-medium text-destructive">{t('errors.forbiddenTitle')}</p>
          <p className="mt-1 text-muted-foreground">{forbiddenMessage}</p>
        </div>
      ) : null}
    </div>
  )
}
