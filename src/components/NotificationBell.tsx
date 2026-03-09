import { useEffect, useRef, useState } from 'react'
import { Bell, History, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationItem,
} from '../services/api'
import { Button } from './ui/button'
import { HeaderIconButton } from './HeaderIconButton'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet'
import { getLabel } from '../lib/translations'
import { cn } from '../lib/utils'

function formatTime(ts?: number | string): string {
  if (ts == null) return '—'
  const d = new Date(typeof ts === 'number' ? ts : Number(ts))
  if (Number.isNaN(d.getTime())) return '—'
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function NotificationBell() {
  const { user } = useAuth()
  const { locale } = useLanguage()
  const [list, setList] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [open, setOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const organizationId = user?.organization_id ?? (user as { organizationId?: number })?.organizationId
  const userId = user?.user_id ?? (user as { userId?: number })?.userId
  const unreadList = list.filter((n) => !n.read)
  const unreadCount = unreadList.length
  const badgeLabel = unreadCount > 9 ? '9+' : unreadCount > 0 ? String(unreadCount) : null

  const fetchNotifications = () => {
    if (organizationId == null) return
    setLoading(true)
    setLoadError(false)
    getNotifications({
      organizationId: Number(organizationId),
      userId: userId != null ? Number(userId) : undefined,
      since: 0,
    })
      .then((res) => {
        const data = (res as { data?: NotificationItem[] }).data
        setList(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        setList([])
        setLoadError(true)
      })
      .finally(() => setLoading(false))
  }

  const fetchHistory = () => {
    if (organizationId == null) return
    setHistoryLoading(true)
    getNotifications({
      organizationId: Number(organizationId),
      userId: userId != null ? Number(userId) : undefined,
      since: 0,
    })
      .then((res) => {
        const data = (res as { data?: NotificationItem[] }).data
        setList(Array.isArray(data) ? data : [])
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }

  useEffect(() => {
    if (!organizationId) return
    fetchNotifications()
    const intervalMs = open || historyOpen ? 15_000 : 60_000
    const t = setInterval(fetchNotifications, intervalMs)
    return () => clearInterval(t)
  }, [organizationId, userId, open, historyOpen])

  useEffect(() => {
    if (open && organizationId) fetchNotifications()
  }, [open, organizationId])

  useEffect(() => {
    if (historyOpen && organizationId) fetchHistory()
  }, [historyOpen, organizationId])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [open])

  const handleMarkRead = (n: NotificationItem) => {
    if (userId == null || n.read) return
    markNotificationRead(n.id, userId).then(() => {
      setList((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true, readAt: new Date().toISOString() } : x)))
    })
  }

  const handleDismiss = (e: React.MouseEvent, n: NotificationItem) => {
    e.stopPropagation()
    if (userId == null || n.read) return
    markNotificationRead(n.id, userId).then(() => {
      setList((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true, readAt: new Date().toISOString() } : x)))
    })
  }

  const handleMarkAllRead = () => {
    if (userId == null) return
    markAllNotificationsRead(userId).then((res) => {
      if (res.success) setList((prev) => prev.map((x) => ({ ...x, read: true, readAt: new Date().toISOString() })))
    })
  }

  const renderNotificationItem = (n: NotificationItem, _inHistory: boolean) => (
    <li
      key={n.id}
      role="button"
      tabIndex={0}
      className={cn(
        'flex items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/60',
        !n.read && 'bg-primary/5'
      )}
      onClick={() => handleMarkRead(n)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleMarkRead(n)
        }
      }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{n.message ?? 'Notification'}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{formatTime(n.timestamp ?? n.createdAt)}</p>
      </div>
      <button
        type="button"
        onClick={(e) => handleDismiss(e, n)}
        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Dismiss and mark as read"
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  )

  if (organizationId == null) return null

  return (
    <>
      <div className="relative flex items-center gap-1" ref={panelRef}>
        <HeaderIconButton
          label={getLabel('header.notifications', locale)}
          icon={<Bell className="h-5 w-5" />}
          onClick={() => setOpen((o) => !o)}
          aria-label={badgeLabel ? `${unreadCount} unread notifications` : getLabel('header.notifications', locale)}
          badge={
            badgeLabel != null ? (
              <span
                className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
                aria-hidden
              >
                {badgeLabel}
              </span>
            ) : undefined
          }
        />
        <HeaderIconButton
          label={getLabel('header.history', locale)}
          icon={<History className="h-5 w-5" />}
          onClick={() => setHistoryOpen(true)}
          aria-label={getLabel('header.history', locale)}
        />
      </div>

      {open && (
        <div className="absolute right-0 top-full z-[100] mt-2 w-[320px] overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
            <span className="text-sm font-medium text-foreground">{getLabel('header.notifications', locale)}</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={fetchNotifications} disabled={loading}>
                {loading ? '…' : getLabel('header.refresh', locale)}
              </Button>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-primary" onClick={handleMarkAllRead}>
                  Mark all read
                </Button>
              )}
            </div>
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {loading && list.length === 0 && !loadError ? (
              <p className="p-4 text-center text-sm text-muted-foreground">Loading...</p>
            ) : loadError ? (
              <div className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Couldn&apos;t load notifications</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={fetchNotifications}>
                  Retry
                </Button>
              </div>
            ) : unreadList.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">No unread notifications</p>
            ) : (
              <ul className="divide-y divide-border">
                {unreadList.map((n) => renderNotificationItem(n, false))}
              </ul>
            )}
          </div>
        </div>
      )}

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle>{getLabel('header.notificationHistory', locale)}</SheetTitle>
            <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={fetchHistory} disabled={historyLoading}>
              {historyLoading ? '…' : getLabel('header.refresh', locale)}
            </Button>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto mt-4">
            {historyLoading && list.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">Loading...</p>
            ) : list.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">No notifications</p>
            ) : (
              <ul className="divide-y divide-border">
                {list.map((n) => renderNotificationItem(n, true))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
