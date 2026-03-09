export function parseCoordinates(input: string): [number, number] | null {
  const s = (input ?? '').toString().trim()
  if (!s) return null
  const parts = s.split(/[\s,]+/).filter(Boolean)
  if (parts.length < 2) return null
  const lat = Number(parts[0])
  const lng = Number(parts[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90) return null
  if (lng < -180 || lng > 180) return null
  return [lat, lng]
}

export function parseCoord(s: string): number | null {
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
