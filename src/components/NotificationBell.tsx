import { useState } from 'react'
import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import {
  fetchChargerNotifications,
  markAllNotificationsReadApi,
  markNotificationAsReadApi,
  markNotificationsSeenApi,
} from '../services/api'
import { Button } from './ui/button'
import { HeaderIconButton } from './HeaderIconButton'
import { Badge } from './ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { ScrollArea } from './ui/scroll-area'
import { getLabel } from '../lib/translations'
import { cn } from '../lib/utils'
import { useLanguage } from '../context/LanguageContext'

export default function NotificationBell() {
  const { user } = useAuth()
  const { notifications, unreadCount, markAsRead, mergeNotificationsFromApi } =
    useNotifications()
  const { locale } = useLanguage()
  const [open, setOpen] = useState(false)
  const userId = user?.user_id
  const badgeLabel = unreadCount > 9 ? '9+' : unreadCount > 0 ? String(unreadCount) : null

  const loadNotificationsHistory = async () => {
    try {
      const { items, unreadCount: serverUnread } = await fetchChargerNotifications({
      since: 0,
        userId,
    })
      mergeNotificationsFromApi(items, serverUnread)
    } catch {
      // ignore
    }
  }

  const markAllReadAndRefresh = async () => {
    if (userId == null) return
    mergeNotificationsFromApi(
      notifications.map((n) => ({
        id: n.id,
        chargerId: n.chargerId,
        chargerName: n.chargerName,
        organizationName: n.organizationName,
        locationName: n.locationName,
        message: n.message,
        timestamp: n.timestamp.getTime(),
        read: true,
        isNew: n.isNew,
      })),
      0,
    )
    await Promise.allSettled([
      markAllNotificationsReadApi(userId),
      markNotificationsSeenApi(userId),
    ])
    await loadNotificationsHistory()
  }

  const handleNotificationClick = async (id: string) => {
    markAsRead(id)
    if (userId == null) return
    try {
      await markNotificationAsReadApi(id, userId)
      const { items, unreadCount: serverUnread } = await fetchChargerNotifications({
        since: 0,
        userId,
      })
      mergeNotificationsFromApi(items, serverUnread)
    } catch {
      // ignore optimistic update failures
    }
  }

  return (
    <>
      <Popover
        open={open}
        onOpenChange={async (nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen || userId == null) return
          try {
            const seen = await markNotificationsSeenApi(userId)
            if (seen.success) mergeNotificationsFromApi([], 0)
          } catch {
            // ignore
          }
          await loadNotificationsHistory()
        }}
      >
        <PopoverTrigger asChild>
          <div className="relative">
            <HeaderIconButton
              label={getLabel('header.notifications', locale)}
              icon={<Bell className="h-5 w-5" />}
              aria-label={
                badgeLabel != null
                  ? `${unreadCount} unread notifications`
                  : getLabel('header.notifications', locale)
              }
            />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] font-semibold"
              >
                {badgeLabel}
              </Badge>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="flex items-center justify-between gap-2 border-b p-4">
            <h3 className="text-sm font-semibold">{getLabel('header.notifications', locale)}</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 rounded-full px-3 text-xs font-medium text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
              onClick={() => void markAllReadAndRefresh()}
            >
              Mark all as read
            </Button>
          </div>
          <ScrollArea className="h-[400px]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No notifications</div>
            ) : (
              <div className="p-2">
                {notifications.map((notification) => {
                  const loc = (notification.locationName ?? '').trim()
                  const mainTitle = loc || notification.title
                  const chargerBadge = loc ? notification.title : null
                  return (
                  <div
                    key={notification.id}
                    className={cn(
                      'mb-1 cursor-pointer rounded-lg border-l-4 p-3 transition-colors hover:bg-muted',
                      !notification.read && 'border-l-primary bg-muted/30',
                      notification.read && notification.isNew && 'border-l-primary/25 bg-muted/15',
                      notification.read && !notification.isNew && 'border-l-transparent opacity-55',
                    )}
                    onClick={() => void handleNotificationClick(notification.id)}
                  >
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <p
                          className={cn(
                            'truncate text-sm',
                            !notification.read && 'font-semibold text-foreground',
                            notification.read && 'font-normal',
                          )}
                        >
                          {mainTitle}
                        </p>
                        {chargerBadge != null && (
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {chargerBadge}
                          </span>
                        )}
                        {notification.isNew && (
                          <span
                            className={cn(
                              'shrink-0 text-[10px] font-medium uppercase tracking-wide',
                              notification.read ? 'text-muted-foreground' : 'text-primary/80',
                            )}
                          >
                            New
                          </span>
                        )}
                      </div>
                      <p
                        className={cn(
                          'line-clamp-2 text-xs',
                          notification.read ? 'text-muted-foreground' : 'text-foreground/90',
                        )}
                      >
                        {notification.message}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                        </p>
                        <Link
                          to={`/notifications/${encodeURIComponent(notification.id)}`}
                          className="text-xs text-primary hover:underline"
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleNotificationClick(notification.id)
                          }}
                        >
                          Details
                        </Link>
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </>
  )
}
