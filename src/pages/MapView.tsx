import { useEffect, useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { getLocations, getConnectorsStatus, type ConnectorStatusRow } from '../services/api'
import { Card, CardContent } from '../components/ui/card'
import type { Location } from '../services/api'

const DEFAULT_CENTER: [number, number] = [31.9539, 35.9106]
const DEFAULT_ZOOM = 12

function chargerStatusColor(status?: string): string {
  const v = (status ?? '').toLowerCase().trim()
  if (v === 'online' || v === 'available' || v === 'free') return '#22c55e'
  if (v === 'offline' || v === 'unavailable' || v === 'faulted' || v === 'unavailable') return '#ef4444'
  if (v === 'busy' || v === 'charging') return '#3b82f6'
  return '#6b7280'
}

/** Unique charger from connectors status (one row per charger, status from first connector) */
function getChargersFromConnectors(rows: ConnectorStatusRow[]): { chargerId: number; chargerName: string; chargerStatus: string; locationName: string }[] {
  const byCharger = new Map<number, ConnectorStatusRow[]>()
  rows.forEach((r) => {
    const id = r.chargerId ?? 0
    if (!id) return
    if (!byCharger.has(id)) byCharger.set(id, [])
    byCharger.get(id)!.push(r)
  })
  return Array.from(byCharger.entries()).map(([chargerId, list]) => {
    const first = list[0]!
    const statusKey = Object.keys(first).find((k) => k.toLowerCase().replace(/_/g, '') === 'chargerstatus')
    const chargerStatus = statusKey ? (first as Record<string, string>)[statusKey] : first.chargerStatus ?? first.charger_status ?? ''
    return {
      chargerId,
      chargerName: first.chargerName ?? first.charger_name ?? `Charger ${chargerId}`,
      chargerStatus: String(chargerStatus ?? '').trim() || 'unknown',
      locationName: first.locationName ?? first.location_name ?? '',
    }
  })
}

type ChargerMarker = {
  chargerId: number
  chargerName: string
  chargerStatus: string
  locationName: string
  lat: number
  lng: number
}

function FitMapToChargers({
  markers,
  markerSignature,
  fallbackCenter,
  fallbackZoom,
}: {
  markers: ChargerMarker[]
  markerSignature: string
  fallbackCenter: [number, number]
  fallbackZoom: number
}) {
  const map = useMap()
  useEffect(() => {
    if (markers.length === 0) {
      map.setView(fallbackCenter, fallbackZoom, { animate: true })
      return
    }

    if (markers.length === 1) {
      map.setView([markers[0]!.lat, markers[0]!.lng], 14, { animate: true })
      return
    }

    const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
  }, [map, markerSignature, markers, fallbackCenter, fallbackZoom])
  return null
}

function HoverScrollWheelZoom() {
  const map = useMap()
  useEffect(() => {
    const container = map.getContainer()
    if (!container) return

    map.scrollWheelZoom.disable()
    let isInside = false
    const enable = () => {
      if (isInside) return
      isInside = true
      map.scrollWheelZoom.enable()
    }
    const disable = () => {
      if (!isInside) return
      isInside = false
      map.scrollWheelZoom.disable()
    }

    // Use native DOM events on the Leaflet container to reliably detect hover over map tiles.
    container.addEventListener('mouseenter', enable)
    container.addEventListener('mouseleave', disable)
    // Pointer events improve reliability on some devices/browsers.
    container.addEventListener('pointerenter', enable)
    container.addEventListener('pointerleave', disable)

    return () => {
      container.removeEventListener('mouseenter', enable)
      container.removeEventListener('mouseleave', disable)
      container.removeEventListener('pointerenter', enable)
      container.removeEventListener('pointerleave', disable)
      map.scrollWheelZoom.disable()
    }
  }, [map])
  return null
}

/** Calls Leaflet invalidateSize when the map container resizes (sidebar open/close, window resize). */
function MapResizeHandler() {
  const map = useMap()
  useEffect(() => {
    const container = map.getContainer()
    if (!container) return
    const ro = new ResizeObserver(() => {
      map.invalidateSize()
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [map])
  return null
}

export default function MapView() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [locations, setLocations] = useState<Location[]>([])
  const [connectorsStatus, setConnectorsStatus] = useState<ConnectorStatusRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.organization_id) {
      setLoading(false)
      return
    }
    Promise.all([getLocations(user.organization_id), getConnectorsStatus()])
      .then(([locRes, connRes]) => {
        if (locRes.success && locRes.data) setLocations(Array.isArray(locRes.data) ? locRes.data : [])
        const data = (connRes as { data?: ConnectorStatusRow[] }).data
        setConnectorsStatus(Array.isArray(data) ? data : [])
      })
      .finally(() => setLoading(false))
  }, [user?.organization_id])

  const locationByName = useMemo(() => {
    const m = new Map<string, { lat: number; lng: number }>()
    locations.forEach((loc) => {
      const lat = parseFloat(loc.lat ?? '')
      const lng = parseFloat(loc.lng ?? '')
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) m.set((loc.name ?? '').trim(), { lat, lng })
    })
    return m
  }, [locations])

  const chargersWithPosition = useMemo(() => {
    const chargers = getChargersFromConnectors(connectorsStatus)
    return chargers
      .map((c, index) => {
        const pos = locationByName.get(c.locationName.trim())
        if (!pos) return null
        const offset = 0.0001 * (index % 5)
        const lat = pos.lat + offset * Math.cos(index)
        const lng = pos.lng + offset * Math.sin(index)
        return { ...c, lat, lng }
      })
      .filter(Boolean) as { chargerId: number; chargerName: string; chargerStatus: string; locationName: string; lat: number; lng: number }[]
  }, [connectorsStatus, locationByName])

  const markerSignature = useMemo(() => {
    return chargersWithPosition
      .map((c) => `${c.chargerId}:${c.lat.toFixed(6)}:${c.lng.toFixed(6)}`)
      .sort()
      .join('|')
  }, [chargersWithPosition])

  const mapCenter = useMemo((): [number, number] => {
    const withCoords = locations.filter((loc) => {
      const lat = parseFloat(loc.lat ?? '')
      const lng = parseFloat(loc.lng ?? '')
      return !Number.isNaN(lat) && !Number.isNaN(lng)
    })
    if (withCoords.length === 0) return DEFAULT_CENTER
    const first = withCoords[0]!
    return [parseFloat(first.lat!), parseFloat(first.lng!)]
  }, [locations])

  if (loading) {
    return (
      <div className="space-y-6 text-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('map.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('map.subtitle')}</p>
        </div>
        <Card className="border border-border flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full max-w-full min-w-0 overflow-hidden space-y-4 sm:space-y-6 text-start">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('map.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('map.subtitle')}</p>
      </div>
      <Card className="border border-border overflow-hidden flex-1 min-h-[240px] min-w-0 flex flex-col max-h-[calc(100dvh-10rem)]">
        <div className="min-h-[240px] sm:min-h-[280px] flex-1 w-full min-w-0 max-h-[calc(100dvh-14rem)]">
          <MapContainer
            center={mapCenter}
            zoom={DEFAULT_ZOOM}
            className="h-full w-full min-h-[200px] max-w-full"
            scrollWheelZoom={false}
            dragging={true}
            doubleClickZoom={true}
            touchZoom={true}
            zoomControl={true}
            attributionControl={false}
          >
            <MapResizeHandler />
            <HoverScrollWheelZoom />
            <FitMapToChargers
              markers={chargersWithPosition}
              markerSignature={markerSignature}
              fallbackCenter={mapCenter}
              fallbackZoom={DEFAULT_ZOOM}
            />
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {chargersWithPosition.map((c) => {
              const color = chargerStatusColor(c.chargerStatus)
              const icon = L.divIcon({
                className: 'custom-marker',
                html: `<span style="background:${color};width:14px;height:14px;border-radius:50%;display:block;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></span>`,
                iconSize: [14, 14],
                iconAnchor: [7, 7],
              })
              return (
                <Marker key={c.chargerId} position={[c.lat, c.lng]} icon={icon}>
                  <Popup>
                    <strong>{c.chargerName}</strong>
                    <br />
                    {c.locationName && <span>{c.locationName}<br /></span>}
                    Status: <span style={{ fontWeight: 600 }}>{c.chargerStatus}</span>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>
        </div>
        <CardContent className="p-3 border-t border-border flex flex-wrap gap-4 text-sm shrink-0">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" /> {t('map.legendOnline')}
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" /> {t('map.legendOffline')}
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" /> {t('map.legendBusy')}
          </span>
        </CardContent>
      </Card>
    </div>
  )
}
