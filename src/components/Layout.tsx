import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { Sheet, SheetContent } from './ui/sheet'
import { useLanguage } from '../context/LanguageContext'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { isRtl } = useLanguage()
  const sidebarSide = isRtl ? 'right' : 'left'
  const contentMargin = isRtl ? 'mr-0 lg:mr-64' : 'ml-0 lg:ml-64'

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
    </div>
  )
}
