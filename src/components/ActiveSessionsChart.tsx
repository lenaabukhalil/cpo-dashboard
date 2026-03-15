import { useState, useMemo } from 'react'
import { formatTime, formatDateTime } from '../lib/dateFormat'

export interface ActiveSessionsChartPoint {
  ts: number
  count: number
}

const PADDING = { top: 24, right: 16, bottom: 28, left: 36 }
const WIDTH = 520
const HEIGHT = 180
const Y_TICKS = 5
const X_TICK_COUNT = 8

function formatAxisTime(tsMs: number): string {
  return formatTime(tsMs)
}

function formatTooltipTime(tsMs: number): string {
  return formatDateTime(tsMs)
}

function formatUpdated(at: Date | string): string {
  return formatTime(at)
}

export interface ActiveSessionsChartProps {
  title?: string
  points: ActiveSessionsChartPoint[]
  updatedAt?: Date | string
  className?: string
}

export function ActiveSessionsChart({ title = 'Active Sessions', points, updatedAt, className = '' }: ActiveSessionsChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const pathPointsStr = useMemo(() => {
    if (!points.length) return ''
    const max = Math.max(...points.map((p) => p.count), 1)
    const innerW = WIDTH - PADDING.left - PADDING.right
    const innerH = HEIGHT - PADDING.top - PADDING.bottom
    return points
      .map((p, i) => {
        const x = PADDING.left + (i / (points.length - 1 || 1)) * innerW
        const y = PADDING.top + innerH - (p.count / max) * innerH
        return `${x},${y}`
      })
      .join(' ')
  }, [points])

  const pathData = useMemo(() => {
    if (!points.length) return []
    const max = Math.max(...points.map((p) => p.count), 1)
    const innerW = WIDTH - PADDING.left - PADDING.right
    const innerH = HEIGHT - PADDING.top - PADDING.bottom
    return points.map((p, i) => {
      const x = PADDING.left + (i / (points.length - 1 || 1)) * innerW
      const y = PADDING.top + innerH - (p.count / max) * innerH
      return { x, y, ...p }
    })
  }, [points])

  const hoveredPoint = hoveredIndex != null && pathData[hoveredIndex] ? pathData[hoveredIndex] : null

  if (!points.length) {
    return (
      <div className={className}>
        {(title || updatedAt) && (
          <div className="flex items-center justify-between mb-2">
            {title && <span className="text-sm font-medium text-foreground">{title}</span>}
            {updatedAt && <span className="text-xs text-muted-foreground">Updated {formatUpdated(updatedAt)}</span>}
          </div>
        )}
        <p className="text-sm text-muted-foreground py-8">No data</p>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-foreground">{title}</span>
        {updatedAt && <span className="text-xs text-muted-foreground">Updated {formatUpdated(updatedAt)}</span>}
      </div>
      <div className="relative">
        <svg
          width="100%"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="overflow-visible"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {/* Grid */}
          {pathData.length && (() => {
            const max = Math.max(...points.map((p) => p.count), 1)
            const yTicks: number[] = []
            const step = Math.ceil(max / (Y_TICKS - 1)) || 1
            for (let v = 0; v <= max; v += step) yTicks.push(v)
            if (yTicks[yTicks.length - 1] !== max) yTicks.push(max)
            const innerW = WIDTH - PADDING.left - PADDING.right
            const innerH = HEIGHT - PADDING.top - PADDING.bottom
            return (
              <g className="text-muted-foreground/40">
                {yTicks.map((_, i) => {
                  const y = PADDING.top + innerH - (i / (yTicks.length - 1 || 1)) * innerH
                  return <line key={i} x1={PADDING.left} y1={y} x2={PADDING.left + innerW} y2={y} stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" />
                })}
                {pathData.filter((_, i) => i % Math.max(1, Math.floor(pathData.length / X_TICK_COUNT)) === 0).map((p, i) => (
                  <line key={i} x1={p.x} y1={PADDING.top} x2={p.x} y2={PADDING.top + innerH} stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" />
                ))}
              </g>
            )
          })()}
          {/* Y-axis labels */}
          {pathData.length && (() => {
            const max = Math.max(...points.map((p) => p.count), 1)
            const yTicks: number[] = []
            const step = Math.ceil(max / (Y_TICKS - 1)) || 1
            for (let v = 0; v <= max; v += step) yTicks.push(v)
            if (yTicks[yTicks.length - 1] !== max) yTicks.push(max)
            const innerH = HEIGHT - PADDING.top - PADDING.bottom
            return (
              <g className="text-muted-foreground text-[10px]" fill="currentColor">
                {yTicks.map((val, i) => {
                  const y = PADDING.top + innerH - (i / (yTicks.length - 1 || 1)) * innerH
                  return (
                    <text key={i} x={PADDING.left - 6} y={y + 3} textAnchor="end">
                      {val}
                    </text>
                  )
                })}
              </g>
            )
          })()}
          {/* X-axis labels */}
          {pathData.length && (() => {
            const xStep = Math.max(1, Math.floor(points.length / X_TICK_COUNT))
            const ticks = points.filter((_, i) => i % xStep === 0 || i === points.length - 1)
            const innerW = WIDTH - PADDING.left - PADDING.right
            return (
              <g className="text-muted-foreground text-[10px]" fill="currentColor">
                {ticks.map((p, i) => {
                  const idx = points.indexOf(p)
                  const x = PADDING.left + (idx / (points.length - 1 || 1)) * innerW
                  return (
                    <text key={i} x={x} y={HEIGHT - 6} textAnchor="middle">
                      {formatAxisTime(p.ts)}
                    </text>
                  )
                })}
              </g>
            )
          })()}
          {/* Line */}
          <polyline
            fill="none"
            stroke="hsl(var(--destructive))"
            strokeWidth="2"
            points={pathPointsStr}
            vectorEffect="non-scaling-stroke"
          />
          {/* Hover targets */}
          {pathData.map((p, i) => (
            <rect
              key={i}
              x={p.x - 8}
              y={PADDING.top}
              width={16}
              height={HEIGHT - PADDING.top - PADDING.bottom}
              fill="transparent"
              onMouseEnter={() => setHoveredIndex(i)}
            />
          ))}
          {/* Hovered point dot */}
          {hoveredPoint && (
            <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="4" fill="hsl(var(--destructive))" />
          )}
        </svg>
        {/* Tooltip */}
        {hoveredPoint && (
          <div
            className="absolute z-10 px-3 py-2 text-xs bg-background border border-border rounded-md shadow-md whitespace-nowrap pointer-events-none"
            style={{ left: `${(hoveredPoint.x / WIDTH) * 100}%`, top: `${Math.max((hoveredPoint.y / HEIGHT) * 100 - 12, 0)}%`, transform: 'translateY(-100%)' }}
          >
            <div className="text-muted-foreground">{formatTooltipTime(hoveredPoint.ts)}</div>
            <div className="font-medium">Active Sessions : {hoveredPoint.count}</div>
          </div>
        )}
      </div>
    </div>
  )
}
