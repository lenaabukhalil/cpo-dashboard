import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import {
  normalizeChargerNotificationItem,
  type ChargerNotificationItem,
} from "../services/api"

export type NotificationType = "info" | "success" | "warning" | "error"

export interface Notification {
  id: string
  title: string
  message: string
  type: NotificationType
  timestamp: Date
  read: boolean
  isNew: boolean
  chargerId?: string
  chargerName?: string
  organizationName?: string
  locationName?: string
}

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  addNotification: (
    notification: Omit<Notification, "id" | "read" | "isNew" | "timestamp"> & {
      timestamp?: Date
      id?: string
      read?: boolean
      isNew?: boolean
    }
  ) => void
  mergeNotificationsFromApi: (items: ChargerNotificationItem[], unreadCount?: number) => void
  markAsRead: (id: string) => void
  removeNotification: (id: string) => void
  clearAll: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const addNotification = useCallback(
    (
      notification: Omit<Notification, "id" | "read" | "isNew" | "timestamp"> & {
        timestamp?: Date
        id?: string
        read?: boolean
        isNew?: boolean
      }
    ) => {
      const nextItem: Notification = {
        ...notification,
        id: notification.id ?? `notif-${Date.now()}-${Math.random()}`,
        timestamp: notification.timestamp ?? new Date(),
        read: notification.read ?? false,
        isNew: notification.isNew ?? true,
      }
      setNotifications((prev) =>
        [nextItem, ...prev].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
      )
      setUnreadCount((prev) => prev + (nextItem.read ? 0 : 1))
    },
    [],
  )

  const mergeNotificationsFromApi = useCallback(
    (items: ChargerNotificationItem[], unreadCountFromApi?: number) => {
      if (typeof unreadCountFromApi === "number" && Number.isFinite(unreadCountFromApi)) {
        setUnreadCount(Math.max(0, unreadCountFromApi))
      }
      if (!items.length) return

      setNotifications((prev) => {
        const byId = new Map(prev.map((n) => [n.id, n]))
        for (const raw of items) {
          const item = normalizeChargerNotificationItem(raw)
          const id = item.id ?? `${item.timestamp ?? item.createdAt}-${item.chargerId ?? "charger"}`
          const existing = byId.get(id)
          const chargerName = item.chargerName ?? existing?.chargerName
          const chargerId = item.chargerId ?? existing?.chargerId
          const title =
            (chargerName ?? "").trim() ||
            ((chargerId ?? "").trim() ? `Charger ${String(chargerId).trim()}` : "Charger")

          const timeFromTimestamp =
            item.timestamp != null && Number.isFinite(Number(item.timestamp))
              ? Number(item.timestamp)
              : undefined
          const timeFromCreatedAt =
            typeof item.createdAt === "string" && item.createdAt
              ? new Date(item.createdAt).getTime()
              : undefined
          const timeMs =
            typeof timeFromTimestamp === "number" && Number.isFinite(timeFromTimestamp)
              ? timeFromTimestamp
              : typeof timeFromCreatedAt === "number" && Number.isFinite(timeFromCreatedAt)
                ? timeFromCreatedAt
                : Date.now()

          const apiRead = item.read === true || Number(item.read) === 1
          const read = existing?.read === true || apiRead
          const isNew = item.isNew === true || Number(item.isNew) === 1
          const online = item.online === true

          byId.set(id, {
            id,
            title,
            message:
              (item.message ?? "").trim() ||
              (item.online === true ? "Charger is online" : "Charger is offline"),
            type: online ? "success" : "info",
            timestamp: new Date(timeMs),
            read,
            isNew,
            chargerId,
            chargerName,
            organizationName: item.organizationName ?? existing?.organizationName,
            locationName: item.locationName ?? existing?.locationName,
          })
        }
        return [...byId.values()].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      })
    },
    [],
  )

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const target = prev.find((item) => item.id === id)
      if (!target || target.read) return prev
      setUnreadCount((count) => Math.max(0, count - 1))
      return prev.map((item) => (item.id === id ? { ...item, read: true } : item))
    })
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => {
      const removed = prev.find((n) => n.id === id)
      if (removed && !removed.read) setUnreadCount((count) => Math.max(0, count - 1))
      return prev.filter((n) => n.id !== id)
    })
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
    setUnreadCount(0)
  }, [])

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      addNotification,
      mergeNotificationsFromApi,
      markAsRead,
      removeNotification,
      clearAll,
    }),
    [notifications, unreadCount, addNotification, mergeNotificationsFromApi, markAsRead, removeNotification, clearAll],
  )

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) throw new Error("useNotifications must be used within NotificationProvider")
  return context
}
