import { useEffect, useRef } from "react"
import { useAuth } from "../context/AuthContext"
import { useNotifications } from "../contexts/NotificationContext"
import { useToast } from "../contexts/ToastContext"
import { fetchChargerNotifications } from "../services/api"

const MAX_SEEN_IDS = 500
let seenNotificationIds = new Set<string>()

function markSeen(id: string) {
  seenNotificationIds.add(id)
  if (seenNotificationIds.size > MAX_SEEN_IDS) {
    const tail = [...seenNotificationIds].slice(-MAX_SEEN_IDS)
    seenNotificationIds = new Set(tail)
  }
}

export function useNodeRedNotificationStream() {
  const { user, loading } = useAuth()
  const { mergeNotificationsFromApi } = useNotifications()
  const { pushToast } = useToast()
  const pollTimerRef = useRef<number | null>(null)
  const lastPollTsRef = useRef<number>(0)
  const isInitialLoadRef = useRef(true)

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

    const poll = async () => {
      const suppressToasts = isInitialLoadRef.current
      try {
        const since = lastPollTsRef.current > 0 ? lastPollTsRef.current : Date.now() - MS_PER_DAY
        const { items, unreadCount } = await fetchChargerNotifications({ since, userId })
        mergeNotificationsFromApi(items, unreadCount)

        items.forEach((item) => {
          const id = item.id ?? `${item.timestamp ?? item.createdAt}-${item.chargerId ?? "charger"}`
          if (seenNotificationIds.has(id)) return
          markSeen(id)

          const ts = toEpochMs(item)
          if (ts != null) lastPollTsRef.current = Math.max(lastPollTsRef.current, ts)

          if (suppressToasts) return

          const title =
            (item.chargerName ?? "").trim() ||
            ((item.chargerId ?? "").trim() ? `Charger ${String(item.chargerId).trim()}` : "Charger")
          const message =
            (item.message ?? "").trim() ||
            (item.online === true ? "Charger is online" : "Charger is offline")
          pushToast(title, message)
        })
      } catch {
        // ignore poll errors
      } finally {
        if (suppressToasts) {
          isInitialLoadRef.current = false
        }
      }

      pollTimerRef.current = window.setTimeout(poll, POLL_INTERVAL_MS)
    }

    void poll()

    return () => {
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
      lastPollTsRef.current = 0
      isInitialLoadRef.current = true
      seenNotificationIds = new Set()
    }
  }, [loading, user, mergeNotificationsFromApi, pushToast])
}
