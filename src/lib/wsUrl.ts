/** WebSocket URL for real-time notifications. */
export function getNotificationsWsUrl(): string {
  if (import.meta.env.DEV) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/ws/notifications`
  }

  const configured = import.meta.env.VITE_WS_URL
  if (typeof configured === 'string' && configured.trim()) {
    return configured.trim()
  }

  return 'wss://dash.evse.cloud/ws/notifications'
}
