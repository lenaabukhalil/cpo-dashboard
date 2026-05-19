import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageTabs } from '../components/PageTabs'
import { PartnerUsersTab } from '../components/users/PartnerUsersTab'
import { RfidUsersTab } from '../components/users/RfidUsersTab'
import { useTranslation } from '../context/LanguageContext'

type UsersTabId = 'partner' | 'rfid'

export default function PartnerUsers() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab: UsersTabId = tabParam === 'rfid' ? 'rfid' : 'partner'
  const [rfidMounted, setRfidMounted] = useState(activeTab === 'rfid')
  const tabsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activeTab === 'rfid') setRfidMounted(true)
  }, [activeTab])

  const tabs = [
    { id: 'partner', label: t('users.tabPartner') },
    { id: 'rfid', label: t('users.tabRfid') },
  ]

  const setTab = (id: string) => {
    const next = id === 'rfid' ? 'rfid' : 'partner'
    setSearchParams(next === 'partner' ? {} : { tab: next }, { replace: true })
  }

  const onTabsKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const next: UsersTabId = activeTab === 'partner' ? 'rfid' : 'partner'
    setTab(next)
    const root = tabsRef.current
    if (!root) return
    const btn = root.querySelector<HTMLButtonElement>(`button[data-tab-id="${next}"]`)
    btn?.focus()
  }

  return (
    <div className="space-y-6 text-start">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('users.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('users.subtitle')}</p>
      </div>

      <div ref={tabsRef} onKeyDown={onTabsKeyDown} role="presentation">
        <PageTabs tabs={tabs} activeTab={activeTab} onTabChange={setTab} />
      </div>

      {activeTab === 'partner' ? <PartnerUsersTab /> : null}
      {rfidMounted && activeTab === 'rfid' ? <RfidUsersTab /> : null}
    </div>
  )
}
