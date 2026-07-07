import type { ChargerNotificationItem } from '../services/api'

const MAX_SEEN_IDS = 500
let seenNotificationIds = new Set<string>()

export function notificationItemId(item: {
  id?: string
  timestamp?: number
  createdAt?: string
  chargerId?: string
}): string {
  return item.id ?? `${item.timestamp ?? item.createdAt}-${item.chargerId ?? 'charger'}`
}

export function markNotificationSeen(id: string): void {
  seenNotificationIds.add(id)
  if (seenNotificationIds.size > MAX_SEEN_IDS) {
    const tail = [...seenNotificationIds].slice(-MAX_SEEN_IDS)
    seenNotificationIds = new Set(tail)
  }
}

/** Returns false when this id was already consumed (skip toast). */
export function consumeNotificationToast(id: string): boolean {
  if (seenNotificationIds.has(id)) return false
  markNotificationSeen(id)
  return true
}

export function resetNotificationSeenIds(): void {
  seenNotificationIds = new Set()
}

export function notificationToastContent(item: ChargerNotificationItem): {
  title: string
  message: string
} {
  const title =
    (item.chargerName ?? '').trim() ||
    ((item.chargerId ?? '').trim() ? `Charger ${String(item.chargerId).trim()}` : 'Charger')
  const message =
    (item.message ?? '').trim() ||
    (item.online === true ? 'Charger is online' : 'Charger is offline')
  return { title, message }
}
