import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { useAuth } from '../context/AuthContext'
import { useNotifications, type Notification } from '../contexts/NotificationContext'
import {
  fetchChargerNotifications,
  markNotificationAsReadApi,
  type ChargerNotificationItem,
} from '../services/api'

function displayField(value: string | undefined | null): string {
  if (value === undefined || value === null) return '—'
  const trimmed = String(value).trim()
  return trimmed ? trimmed : '—'
}

function toDetailTime(item: ChargerNotificationItem): string {
  if (item.timestamp != null && Number.isFinite(Number(item.timestamp))) {
    return new Date(Number(item.timestamp)).toLocaleString()
  }
  if (typeof item.createdAt === 'string' && item.createdAt.trim()) {
    const date = new Date(item.createdAt)
    if (Number.isFinite(date.getTime())) return date.toLocaleString()
  }
  return '—'
}

function heading(item: ChargerNotificationItem): string {
  const chargerName = displayField(item.chargerName)
  if (chargerName !== '—') return chargerName
  if (displayField(item.chargerId) !== '—') return `Charger ${String(item.chargerId).trim()}`
  return 'Notification'
}

function fromStoredNotification(item: Notification): ChargerNotificationItem {
  return {
    id: item.id,
    timestamp: item.timestamp.getTime(),
    createdAt: item.timestamp.toISOString(),
    message: item.message,
    online: item.type === 'success' ? true : item.type === 'info' ? false : undefined,
    chargerId: item.chargerId,
    chargerName: item.chargerName,
    organizationName: item.organizationName,
    locationName: item.locationName,
    read: item.read,
    isNew: item.isNew,
  }
}

export default function NotificationDetail() {
  const { notificationId: rawParam } = useParams<{ notificationId: string }>()
  const notificationId = rawParam ? decodeURIComponent(rawParam) : ''
  const navigate = useNavigate()
  const { user } = useAuth()
  const { notifications } = useNotifications()

  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState<ChargerNotificationItem | null>(null)

  useEffect(() => {
    if (!notificationId || !user?.user_id) return
    void markNotificationAsReadApi(notificationId, user.user_id)
  }, [notificationId, user?.user_id])

  useEffect(() => {
    if (!notificationId) {
      setNotification(null)
      setLoading(false)
      return
    }

    const localItem = notifications.find((item) => item.id === notificationId)
    if (localItem) {
      setNotification(fromStoredNotification(localItem))
      setLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const { items } = await fetchChargerNotifications({ since: 0, userId: user?.user_id })
        if (cancelled) return
        const found = items.find((item) => String(item.id ?? '').trim() === notificationId) ?? null
        setNotification(found)
      } catch {
        if (!cancelled) setNotification(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [notificationId, notifications, user?.user_id])

  const statusBadge = useMemo(() => {
    if (notification?.online === true) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Online
        </span>
      )
    }
    if (notification?.online === false) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          Offline
        </span>
      )
    }
    return <span className="text-sm text-muted-foreground">—</span>
  }, [notification])

  const messageText = useMemo(() => {
    if (!notification) return '—'
    return notification.message && notification.message.trim() && notification.message.trim() !== '—'
      ? notification.message.trim()
      : notification.online === true
        ? 'Charger is online'
        : notification.online === false
          ? 'Charger is offline'
          : '—'
  }, [notification])

  // TODO: add permission guard for notifications read action when granular permission component is available.
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => navigate(-1)}
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">
            {loading ? 'Notification' : notification ? heading(notification) : 'Notification'}
          </h1>
          {!loading && notification && (
            <div className="space-y-0.5 text-sm text-muted-foreground">
              <p>
                <span className="text-foreground/80">Organization:</span>{' '}
                {displayField(notification.organizationName)}
              </p>
              <p>
                <span className="text-foreground/80">Location:</span>{' '}
                {displayField(notification.locationName)}
              </p>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">Loading notification...</CardContent>
        </Card>
      ) : !notification ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            This notification could not be loaded.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notification</CardTitle>
            <p className="text-sm text-muted-foreground">Charger status event and context</p>
          </CardHeader>
          <CardContent className="space-y-0 text-sm">
            <dl className="divide-y divide-border rounded-lg border border-border bg-muted/20">
              <div className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr] sm:items-center">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Charger</dt>
                <dd className="font-medium text-foreground">
                  {displayField(notification.chargerName) !== '—'
                    ? displayField(notification.chargerName)
                    : displayField(notification.chargerId) !== '—'
                      ? `Charger ${String(notification.chargerId).trim()}`
                      : '—'}
                </dd>
              </div>
              <div className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr] sm:items-center">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Organization</dt>
                <dd className="text-foreground">{displayField(notification.organizationName)}</dd>
              </div>
              <div className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr] sm:items-center">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Location</dt>
                <dd className="text-foreground">{displayField(notification.locationName)}</dd>
              </div>
              <div className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr] sm:items-start">
                <dt className="pt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</dt>
                <dd>{statusBadge}</dd>
              </div>
              <div className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr] sm:items-center">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Time</dt>
                <dd className="tabular-nums text-foreground">{toDetailTime(notification)}</dd>
              </div>
            </dl>
            <div className="mt-4 rounded-lg border border-border bg-card px-4 py-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Message</p>
              <p className="whitespace-pre-wrap leading-relaxed text-foreground">{messageText}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
