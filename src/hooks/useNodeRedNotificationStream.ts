import { useEffect, useRef } from "react"
import { useAuth } from "../context/AuthContext"
import { useNotifications } from "../contexts/NotificationContext"
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

function showToast(title: string, message: string) {
  // Lightweight fallback toast without introducing a new toast framework.
  const node = document.createElement("div")
  node.className =
    "fixed right-4 top-4 z-[120] max-w-sm rounded-md border border-border bg-card px-4 py-3 text-sm shadow-lg"
  node.innerHTML = `<div class="font-semibold">${title}</div><div class="text-muted-foreground mt-1">${message}</div>`
  document.body.appendChild(node)
  window.setTimeout(() => {
    node.style.opacity = "0"
    node.style.transform = "translateY(-6px)"
    node.style.transition = "all 200ms ease"
  }, 2600)
  window.setTimeout(() => {
    node.remove()
  }, 2900)
}

export function useNodeRedNotificationStream() {
  const { user, loading } = useAuth()
  const { mergeNotificationsFromApi } = useNotifications()
  const pollTimerRef = useRef<number | null>(null)
  const lastPollTsRef = useRef<number>(0)

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

          const title =
            (item.chargerName ?? "").trim() ||
            ((item.chargerId ?? "").trim() ? `Charger ${String(item.chargerId).trim()}` : "Charger")
          const message =
            (item.message ?? "").trim() ||
            (item.online === true ? "Charger is online" : "Charger is offline")
          showToast(title, message)
        })
      } catch {
        // ignore poll errors
      }

      pollTimerRef.current = window.setTimeout(poll, POLL_INTERVAL_MS)
    }

    void poll()

    return () => {
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
      lastPollTsRef.current = 0
      seenNotificationIds = new Set()
    }
  }, [loading, user, mergeNotificationsFromApi])
}
