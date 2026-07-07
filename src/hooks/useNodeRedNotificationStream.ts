import { useEffect, useRef } from "react"
import { useAuth } from "../context/AuthContext"
import { useNotifications } from "../contexts/NotificationContext"
import { useToast } from "../contexts/ToastContext"
import {
  consumeNotificationToast,
  hasNotificationBeenSeen,
  markNotificationSeen,
  notificationItemId,
  notificationToastContent,
  resetNotificationSeenIds,
} from "../lib/notificationSeenIds"
import type { NotificationsSocketStatus } from "./useNotificationsSocket"
import { fetchChargerNotifications } from "../services/api"

export function useNodeRedNotificationStream(socketStatus: NotificationsSocketStatus) {
  const { user, loading } = useAuth()
  const { mergeNotificationsFromApi } = useNotifications()
  const { pushToast } = useToast()
  const pollTimerRef = useRef<number | null>(null)
  const lastPollTsRef = useRef<number>(0)
  const isInitialLoadRef = useRef(true)
  const socketStatusRef = useRef(socketStatus)
  const pollFnRef = useRef<(() => void) | null>(null)

  socketStatusRef.current = socketStatus

  useEffect(() => {
    if (loading || !user) return
    const userId = user.user_id
    const POLL_INTERVAL_MS = 60000
    const MS_PER_DAY = 24 * 60 * 60 * 1000

    const toEpochMs = (x: { timestamp?: number; createdAt?: string }): number | undefined => {
      if (x.timestamp != null && Number.isFinite(Number(x.timestamp))) return Number(x.timestamp)
      if (typeof x.createdAt === "string" && x.createdAt) {
        const ms = new Date(x.createdAt).getTime()
        return Number.isFinite(ms) ? ms : undefined
      }
      return undefined
    }

    const scheduleNextPoll = () => {
      if (socketStatusRef.current === "open") {
        pollTimerRef.current = null
        return
      }
      pollTimerRef.current = window.setTimeout(() => {
        pollFnRef.current?.()
      }, POLL_INTERVAL_MS)
    }

    const poll = async () => {
      const suppressToasts = isInitialLoadRef.current
      try {
        const since = lastPollTsRef.current > 0 ? lastPollTsRef.current : Date.now() - MS_PER_DAY
        const { items, unreadCount } = await fetchChargerNotifications({ since, userId })
        mergeNotificationsFromApi(items, unreadCount)

        items.forEach((item) => {
          const id = notificationItemId(item)
          const ts = toEpochMs(item)
          if (ts != null) lastPollTsRef.current = Math.max(lastPollTsRef.current, ts)

          if (hasNotificationBeenSeen(id)) return

          if (suppressToasts) {
            markNotificationSeen(id)
            return
          }

          if (!consumeNotificationToast(id)) return

          const { title, message } = notificationToastContent(item)
          pushToast(title, message)
        })
      } catch {
        // ignore poll errors
      } finally {
        if (suppressToasts) {
          isInitialLoadRef.current = false
        }
      }

      scheduleNextPoll()
    }

    pollFnRef.current = () => {
      void poll()
    }

    void poll()

    return () => {
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
      pollFnRef.current = null
      lastPollTsRef.current = 0
      isInitialLoadRef.current = true
      resetNotificationSeenIds()
    }
  }, [loading, user, mergeNotificationsFromApi, pushToast])

  useEffect(() => {
    if (loading || !user) return

    if (socketStatus === "open") {
      if (pollTimerRef.current != null) {
        window.clearTimeout(pollTimerRef.current)
        pollTimerRef.current = null
      }
      return
    }

    if (pollTimerRef.current == null && !isInitialLoadRef.current) {
      pollTimerRef.current = window.setTimeout(() => {
        pollFnRef.current?.()
      }, 60000)
    }
  }, [socketStatus, loading, user])
}
