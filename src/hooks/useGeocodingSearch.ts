import { useState, useRef, useCallback, useEffect } from 'react'
import { normalizeArabic } from '../lib/arabic'

const PHOTON_BASE = 'https://photon.komoot.io/api/'
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search'
const DEBOUNCE_MS = 400
const DISPLAY_LIMIT = 10
const JORDAN_LAT = 31.95
const JORDAN_LON = 35.91
const JORDAN_VIEWBOX = '34.96,33.37,39.30,29.19'

function getPhotonUrl(params: { q: string; limit: number; lat?: number; lon?: number }): string {
  const sp = new URLSearchParams()
  sp.set('q', params.q)
  sp.set('limit', String(params.limit))
  if (params.lat != null && params.lon != null) {
    sp.set('lat', String(params.lat))
    sp.set('lon', String(params.lon))
  }
  return `${PHOTON_BASE}?${sp}`
}

function parsePhotonToSuggestions(data: unknown): GeocodingSuggestion[] {
  const features = (data as { features?: unknown[] })?.features
  if (!Array.isArray(features)) return []
  return features
    .map((f: unknown) => {
      const item = f as { geometry?: { coordinates?: number[] }; properties?: Record<string, string> }
      const p = item.properties || {}
      const coords = item.geometry?.coordinates
      const lon = Array.isArray(coords) ? coords[0] : null
      const lat = Array.isArray(coords) ? coords[1] : null
      if (typeof lat !== 'number' || typeof lon !== 'number') return null
      const name = p.name || p.street || p.city || p.county || ''
      const street = p.street || ''
      const city = p.city || p.state || ''
      const country = p.country || ''
      const countryCode = (p.countrycode || '').toLowerCase()
      const display_name =
        [name, street, city, country].filter(Boolean).join(', ') || name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`
      const suggestion: GeocodingSuggestion = {
        lat: String(lat),
        lon: String(lon),
        display_name,
        address: {
          road: street || undefined,
          city: city || undefined,
          state: p.state || undefined,
          country: country || undefined,
          country_code: countryCode || undefined,
          suburb: p.district || p.suburb || undefined,
        },
      }
      return suggestion
    })
    .filter((s): s is GeocodingSuggestion => s !== null)
}

function parseNominatimToSuggestions(data: unknown): GeocodingSuggestion[] {
  const list = Array.isArray(data) ? data : []
  return list
    .map((item: { lat?: string; lon?: string; display_name?: string; address?: Record<string, string> }) => {
      const latN = item.lat != null ? Number(item.lat) : NaN
      const lonN = item.lon != null ? Number(item.lon) : NaN
      if (!Number.isFinite(latN) || !Number.isFinite(lonN)) return null
      const addr = item.address || {}
      const countryCode = (addr.country_code || '').toLowerCase()
      const suggestion: GeocodingSuggestion = {
        lat: String(latN),
        lon: String(lonN),
        display_name: item.display_name || `${latN.toFixed(4)}, ${lonN.toFixed(4)}`,
        address: {
          road: addr.road || undefined,
          suburb: addr.suburb || addr.neighbourhood || undefined,
          city: addr.city || addr.town || addr.village || addr.state || undefined,
          state: addr.state || undefined,
          country: addr.country || undefined,
          country_code: countryCode || undefined,
        },
      }
      return suggestion
    })
    .filter((s): s is GeocodingSuggestion => s !== null)
}

export interface GeocodingSuggestion {
  lat: string
  lon: string
  display_name: string
  address?: {
    road?: string
    suburb?: string
    city?: string
    state?: string
    country?: string
    country_code?: string
  }
}

export interface UseGeocodingSearchOptions {
  onLocationSelect: (lat: string, lng: string) => void
}

function filterToJordanOnly(list: GeocodingSuggestion[]): GeocodingSuggestion[] {
  return list.filter((s) => {
    const code = s.address?.country_code?.toLowerCase()
    const country = (s.address?.country || '').toLowerCase()
    return code === 'jo' || code === 'jor' || country === 'jordan' || /أردن|الاردن/.test(country)
  })
}

function prioritizeJordan(list: GeocodingSuggestion[]): GeocodingSuggestion[] {
  const jo = list.filter((s) => s.address?.country_code?.toLowerCase() === 'jo')
  const rest = list.filter((s) => !jo.includes(s))
  return [...jo, ...rest]
}

const FRIENDLY_ERROR = 'Service temporarily unavailable. Please try again.'
const NOMINATIM_UA = 'IONDashboard/1.0 (Location search)'

async function fetchPhoton(url: string, signal: AbortSignal): Promise<GeocodingSuggestion[]> {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) {
    if (res.status === 429) throw new Error(FRIENDLY_ERROR)
    const body = await res.json().catch(() => ({}))
    const msg = (body && typeof body.error === 'string' ? body.error : null) || FRIENDLY_ERROR
    throw new Error(msg)
  }
  const data = await res.json()
  return parsePhotonToSuggestions(data)
}

async function fetchNominatim(q: string, signal: AbortSignal): Promise<GeocodingSuggestion[]> {
  const params = new URLSearchParams({
    q,
    format: 'json',
    limit: String(DISPLAY_LIMIT),
    addressdetails: '1',
    viewbox: JORDAN_VIEWBOX,
    bounded: '1',
  })
  const url = `${NOMINATIM_BASE}?${params}`
  const res = await fetch(url, {
    signal,
    headers: { Accept: 'application/json', 'User-Agent': NOMINATIM_UA },
  })
  if (!res.ok) return []
  const data = await res.json()
  return parseNominatimToSuggestions(data)
}

export function useGeocodingSearch({ onLocationSelect }: UseGeocodingSearchOptions) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<GeocodingSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback(async (q: string) => {
    const normalized = normalizeArabic(q).trim()
    if (!normalized) {
      setSuggestions([])
      setError(null)
      return
    }

    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller
    const currentId = ++requestIdRef.current
    const signal = controller.signal

    setLoading(true)
    setError(null)

    try {
      let url = getPhotonUrl({
        q: normalized,
        limit: DISPLAY_LIMIT + 5,
        lat: JORDAN_LAT,
        lon: JORDAN_LON,
      })
      let data = await fetchPhoton(url, signal)
      if (currentId !== requestIdRef.current) return
      data = filterToJordanOnly(data)

      if (data.length === 0 && !normalized.toLowerCase().includes('jordan')) {
        const fallbackQ = `${normalized}, Amman, Jordan`
        url = getPhotonUrl({
          q: fallbackQ,
          limit: DISPLAY_LIMIT + 5,
          lat: JORDAN_LAT,
          lon: JORDAN_LON,
        })
        data = await fetchPhoton(url, signal)
        if (currentId !== requestIdRef.current) return
        data = filterToJordanOnly(data)
      }

      if (data.length === 0) {
        data = await fetchNominatim(normalized, signal)
        if (currentId !== requestIdRef.current) return
        data = filterToJordanOnly(data)
      }

      if (data.length > 0) {
        const prioritized = prioritizeJordan(data).slice(0, DISPLAY_LIMIT)
        setSuggestions(prioritized)
        setShowDropdown(true)
      } else {
        setSuggestions([])
        setError('لا توجد نتائج داخل الأردن. جرّب عبارة أخرى أو أدخل إحداثيات (مثلاً 31.95, 35.91).')
      }
    } catch (e) {
      if (currentId !== requestIdRef.current) return
      if (e instanceof Error && e.name === 'AbortError') return
      setSuggestions([])
      const message =
        e instanceof Error && (e.message === 'Failed to fetch' || e.name === 'TypeError')
          ? FRIENDLY_ERROR
          : e instanceof Error
            ? e.message
            : FRIENDLY_ERROR
      setError(message)
    } finally {
      if (currentId === requestIdRef.current) setLoading(false)
    }
  }, [])

  const search = useCallback(
    (q: string, immediate = false) => {
      setQuery(q)
      if (immediate) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current)
          debounceTimerRef.current = null
        }
        runSearch(q)
        return
      }
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => runSearch(q), DEBOUNCE_MS)
    },
    [runSearch]
  )

  const selectSuggestion = useCallback(
    (item: GeocodingSuggestion) => {
      setSuggestions([])
      setShowDropdown(false)
      setError(null)
      onLocationSelect(item.lat, item.lon)
    },
    [onLocationSelect]
  )

  const clearSuggestions = useCallback(() => {
    setShowDropdown(false)
    setSuggestions([])
  }, [])

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [])

  return {
    query,
    setQuery,
    search,
    suggestions,
    showDropdown,
    setShowDropdown,
    clearSuggestions,
    selectSuggestion,
    loading,
    error,
  }
}
