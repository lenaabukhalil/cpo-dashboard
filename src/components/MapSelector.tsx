import { useState, useCallback, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Search, Loader2, Locate } from 'lucide-react'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { cn } from '../lib/utils'
import { parseCoordinates, parseCoord } from '../lib/geocoding'
import { useGeocodingSearch } from '../hooks/useGeocodingSearch'

const DEFAULT_LAT = 31.9539
const DEFAULT_LNG = 35.9106

function MapViewUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom, { animate: true })
  }, [map, center[0], center[1], zoom])
  return null
}

function MapClickHandler({
  disabled,
  onLatLngChange,
  showMessage,
}: {
  disabled?: boolean
  onLatLngChange: (lat: string, lng: string) => void
  showMessage: (m: string) => void
}) {
  const map = useMap()
  useEffect(() => {
    if (disabled) return
    const handler = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng
      onLatLngChange(String(lat.toFixed(6)), String(lng.toFixed(6)))
      showMessage('Location set')
    }
    map.on('click', handler)
    return () => { map.off('click', handler) }
  }, [map, disabled, onLatLngChange, showMessage])
  return null
}

const bluePinIcon = new L.DivIcon({
  html: `<svg width="32" height="32" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24C24 5.373 18.627 0 12 0z" fill="#2563eb" stroke="#1d4ed8" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="4" fill="white"/>
  </svg>`,
  className: 'bg-transparent border-0',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

export interface MapSelectorProps {
  lat: string
  lng: string
  onLatLngChange: (lat: string, lng: string) => void
  disabled?: boolean
  onMessage?: (msg: string) => void
}

export function MapSelector({ lat, lng, onLatLngChange, disabled, onMessage }: MapSelectorProps) {
  const [inputValue, setInputValue] = useState('')

  const showMessage = useCallback(
    (msg: string) => {
      if (onMessage) onMessage(msg)
    },
    [onMessage]
  )

  const handleLocationSelect = useCallback(
    (latStr: string, lngStr: string) => {
      onLatLngChange(latStr, lngStr)
      showMessage('Location set')
    },
    [onLatLngChange, showMessage]
  )

  const {
    setQuery,
    search,
    suggestions,
    clearSuggestions,
    selectSuggestion,
    loading: geoLoading,
    error: geoError,
  } = useGeocodingSearch({ onLocationSelect: handleLocationSelect })

  // Apply first suggestion automatically when results arrive (no dropdown)
  useEffect(() => {
    if (suggestions.length === 0) return
    const first = suggestions[0]
    selectSuggestion(first)
  }, [suggestions, selectSuggestion])

  const latNum = parseCoord(lat)
  const lngNum = parseCoord(lng)
  const hasValidCoords = latNum != null && lngNum != null
  const center: [number, number] = hasValidCoords ? [latNum, lngNum] : [DEFAULT_LAT, DEFAULT_LNG]
  const zoom = hasValidCoords ? 13 : 11

  const handleSearchInputChange = useCallback(
    (value: string) => {
      setInputValue(value)
      setQuery(value)
      const coords = parseCoordinates(value)
      if (coords) {
        onLatLngChange(String(coords[0]), String(coords[1]))
        clearSuggestions()
        showMessage('Location set')
        return
      }
      search(value, false)
    },
    [setQuery, search, clearSuggestions, onLatLngChange, showMessage]
  )

  const handleSearchSubmit = useCallback(() => {
    const trimmed = inputValue.trim()
    if (!trimmed) return
    if (parseCoordinates(trimmed)) return
    search(trimmed, true)
  }, [inputValue, search])

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) {
      showMessage('Geolocation is not supported')
      return
    }
    if (onMessage) onMessage('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = String(pos.coords.latitude.toFixed(6))
        const ln = String(pos.coords.longitude.toFixed(6))
        onLatLngChange(la, ln)
        showMessage('Location set')
      },
      () => showMessage('Could not get your location')
    )
  }, [onLatLngChange, showMessage, onMessage])

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Location on Map</label>
      <p className="text-xs text-muted-foreground mb-1">Search only within Jordan. Coordinates (e.g. 31.95, 35.91) update the map immediately.</p>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            placeholder="Address or coordinates (e.g. 31.95, 35.91)"
            value={inputValue}
            onChange={(e) => handleSearchInputChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearchSubmit())}
            className="pr-10"
            disabled={disabled}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {geoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </span>
        </div>
        <Button type="button" variant="outline" onClick={handleSearchSubmit} disabled={disabled || geoLoading}>
          Search
        </Button>
      </div>
      {geoError && <p className="text-xs text-destructive mt-1">{geoError}</p>}

      <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-4 space-y-2')}>
        <div>
          <label className="block text-sm font-medium mb-1">Latitude</label>
          <Input
            type="text"
            placeholder="31.9539"
            value={lat}
            onChange={(e) => onLatLngChange(e.target.value, lng)}
            disabled={disabled}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Longitude</label>
          <Input
            type="text"
            placeholder="35.9106"
            value={lng}
            onChange={(e) => onLatLngChange(lat, e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="relative z-0 w-full rounded-xl border border-border bg-card shadow-sm overflow-hidden h-[280px] sm:h-[320px] md:h-[360px] lg:h-[420px]">
        <MapContainer
          center={center}
          zoom={zoom}
          scrollWheelZoom={!disabled}
          className="h-full w-full rounded-xl"
          style={{ minHeight: 280 }}
        >
          <MapViewUpdater center={center} zoom={zoom} />
          <MapClickHandler disabled={disabled} onLatLngChange={onLatLngChange} showMessage={showMessage} />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <Marker
            position={center}
            icon={bluePinIcon}
            draggable={!disabled}
            eventHandlers={{
              dragend: (e: L.LeafletEvent) => {
                const ll = (e.target as L.Marker).getLatLng()
                onLatLngChange(String(ll.lat.toFixed(6)), String(ll.lng.toFixed(6)))
                showMessage('Location set')
              },
            }}
          >
            <Popup>Selected location</Popup>
          </Marker>
        </MapContainer>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute bottom-3 right-3 z-[1000] rounded-lg border bg-background/90 shadow h-9 w-9"
            onClick={handleLocate}
            disabled={geoLoading}
          >
            {geoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Locate className="h-4 w-4" />}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Tip: Drag the pin or click on the map to set the location. Type coordinates (e.g. 31.95, 35.91 or 31.95 35.91) to update the map without search, or search by address (debounced; first result in Jordan is applied automatically).
      </p>
    </div>
  )
}
