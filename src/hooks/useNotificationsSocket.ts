import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { useToast } from '../contexts/ToastContext'
import {
  consumeNotificationToast,
  notificationItemId,
  notificationToastContent,
} from '../lib/notificationSeenIds'
import { getNotificationsWsUrl } from '../lib/wsUrl'
import { getToken, normalizeChargerNotificationItem } from '../services/api'

export type NotificationsSocketStatus = 'connecting' | 'open' | 'closed'

const PING_INTERVAL_MS = 30_000
const RECONNECT_BACKOFF_MS = [1000, 2000, 5000, 10000, 30000] as const

function parseWsMessage(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // ignore malformed frames
  }
  return null
}

export function useNotificationsSocket(): NotificationsSocketStatus {
  const { user, loading } = useAuth()
  const { mergeNotificationsFromApi, unreadCount } = useNotifications()
  const { pushToast } = useToast()
  const [status, setStatus] = useState<NotificationsSocketStatus>('closed')

  const wsRef = useRef<WebSocket | null>(null)
  const pingIntervalRef = useRef<number | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const backoffIndexRef = useRef(0)
  const authenticatedRef = useRef(false)
  const unreadCountRef = useRef(unreadCount)

  unreadCountRef.current = unreadCount

  useEffect(() => {
    let unmounted = false

    const clearPing = () => {
      if (pingIntervalRef.current != null) {
        window.clearInterval(pingIntervalRef.current)
        pingIntervalRef.current = null
      }
    }

    const clearReconnect = () => {
      if (reconnectTimerRef.current != null) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    const closeSocket = () => {
      const ws = wsRef.current
      if (!ws) return
      ws.onopen = null
      ws.onmessage = null
      ws.onclose = null
      ws.onerror = null
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
      wsRef.current = null
    }

    const scheduleReconnect = () => {
      if (unmounted || reconnectTimerRef.current != null) return
      const delay =
        RECONNECT_BACKOFF_MS[Math.min(backoffIndexRef.current, RECONNECT_BACKOFF_MS.length - 1)]
      backoffIndexRef.current = Math.min(
        backoffIndexRef.current + 1,
        RECONNECT_BACKOFF_MS.length - 1,
      )
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null
        connect()
      }, delay)
    }

    const startPing = () => {
      clearPing()
      pingIntervalRef.current = window.setInterval(() => {
        const ws = wsRef.current
        if (ws?.readyState === WebSocket.OPEN && authenticatedRef.current) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, PING_INTERVAL_MS)
    }

    const handleAuthFailure = () => {
      authenticatedRef.current = false
      clearPing()
      setStatus('connecting')
      closeSocket()
      scheduleReconnect()
    }

    const connect = () => {
      if (unmounted) return

      const token = getToken()
      if (!token) {
        authenticatedRef.current = false
        setStatus('closed')
        return
      }

      clearReconnect()
      closeSocket()
      authenticatedRef.current = false
      setStatus('connecting')

      const ws = new WebSocket(getNotificationsWsUrl())
      wsRef.current = ws

      ws.onopen = () => {
        if (unmounted) return
        const freshToken = getToken()
        if (!freshToken) {
          handleAuthFailure()
          return
        }
        ws.send(JSON.stringify({ type: 'auth', token: freshToken }))
      }

      ws.onmessage = (event) => {
        if (unmounted) return
        const msg = parseWsMessage(String(event.data))
        if (!msg) return

        const type = typeof msg.type === 'string' ? msg.type : ''

        if (type === 'auth_ok') {
          authenticatedRef.current = true
          backoffIndexRef.current = 0
          setStatus('open')
          startPing()
          return
        }

        if (type === 'auth_error' || type === 'auth_required') {
          handleAuthFailure()
          return
        }

        if (type === 'notification' && msg.data != null) {
          const item = normalizeChargerNotificationItem(msg.data)
          const id = notificationItemId(item)
          const shouldToast = consumeNotificationToast(id)
          const nextUnread = shouldToast ? unreadCountRef.current + 1 : unreadCountRef.current
          mergeNotificationsFromApi([{ ...item, isNew: true, read: false }], nextUnread)

          if (shouldToast) {
            const { title, message } = notificationToastContent(item)
            pushToast(title, message)
          }
        }
      }

      ws.onclose = () => {
        authenticatedRef.current = false
        clearPing()
        if (unmounted) return
        setStatus('closed')
        scheduleReconnect()
      }

      ws.onerror = () => {
        // onclose handles reconnect
      }
    }

    if (loading || !user) {
      authenticatedRef.current = false
      clearPing()
      clearReconnect()
      closeSocket()
      setStatus('closed')
      return () => {
        unmounted = true
        clearPing()
        clearReconnect()
        closeSocket()
      }
    }

    connect()

    return () => {
      unmounted = true
      authenticatedRef.current = false
      clearPing()
      clearReconnect()
      closeSocket()
      setStatus('closed')
    }
  }, [loading, user, mergeNotificationsFromApi, pushToast])

  return status
}
