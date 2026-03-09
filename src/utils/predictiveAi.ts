/**
 * Predictive AI utilities (non-ML): forecast engine, classification, insights, recommendations.
 * All logic for the Predictive AI tab.
 */

export type PredictionType = 'revenue' | 'sessions' | 'kwh'

export interface DataPoint {
  weekLabel: string
  value: number
}

export interface ForecastStats {
  mean: number
  trendSlope: number
  volatility: number
  predictedNextWeek: number
  predictedNext4Weeks: number[]
  percentChangeVsLastWeek: number
  lastWeekValue: number
  trend: 'Increasing' | 'Decreasing' | 'Stable'
  volatilityLevel: 'Low' | 'Medium' | 'High'
}

export interface InsightCard {
  title: string
  message: string
  severity: 'info' | 'warning' | 'success' | 'neutral'
  iconKey: string
}

// --- Core math ---

export function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const m = mean(values)
  const squaredDiffs = values.map((v) => (v - m) ** 2)
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1))
}

function clampToZero(x: number): number {
  return Math.max(0, x)
}

// --- Forecast engine ---

export function computeForecast(
  points: DataPoint[],
  N: number,
  horizon: number = 4
): ForecastStats | null {
  const values = points.map((p) => p.value)
  const lastN = values.slice(-N)
  if (lastN.length < 1) return null

  const m = mean(lastN)
  const slope = lastN.length >= 2
    ? (lastN[lastN.length - 1] - lastN[0]) / Math.max(1, lastN.length - 1)
    : 0
  const std = stdDev(lastN)
  const predictedNext = clampToZero(lastN.length === 1 ? lastN[0] : m)
  const next4: number[] = []
  for (let i = 1; i <= horizon; i++) {
    next4.push(clampToZero(predictedNext + slope * i))
  }

  const lastWeek = lastN[lastN.length - 1]
  const percentChange =
    lastWeek !== 0 ? ((predictedNext - lastWeek) / Math.abs(lastWeek)) * 100 : 0

  const trend = classifyTrend(slope, m)
  const volatilityLevel = classifyVolatility(std, m)

  return {
    mean: m,
    trendSlope: slope,
    volatility: std,
    predictedNextWeek: predictedNext,
    predictedNext4Weeks: next4,
    percentChangeVsLastWeek: percentChange,
    lastWeekValue: lastWeek,
    trend,
    volatilityLevel,
  }
}

export function classifyTrend(slope: number, avg: number): 'Increasing' | 'Decreasing' | 'Stable' {
  const threshold = Math.abs(avg) * 0.02
  if (slope > threshold) return 'Increasing'
  if (slope < -threshold) return 'Decreasing'
  return 'Stable'
}

export function classifyVolatility(std: number, avg: number): 'Low' | 'Medium' | 'High' {
  if (avg === 0) return std === 0 ? 'Low' : 'High'
  const ratio = std / Math.abs(avg)
  if (ratio < 0.15) return 'Low'
  if (ratio <= 0.35) return 'Medium'
  return 'High'
}

// --- Formatting ---

export function formatValue(type: PredictionType, value: number): string {
  if (type === 'revenue') return `${value.toFixed(2)} JOD`
  if (type === 'sessions') return Math.round(value).toString()
  return `${value.toFixed(1)} kWh`
}

// --- Insights ---

export function buildInsights(type: PredictionType, stats: ForecastStats, weeksToPredict: number = 4): InsightCard[] {
  const cards: InsightCard[] = []
  const { trend, volatilityLevel, predictedNextWeek, mean, volatility, percentChangeVsLastWeek } = stats
  const peakRisk = predictedNextWeek > mean + volatility

  // A) Demand Forecast (Sessions / Energy)
  if (type === 'sessions' || type === 'kwh') {
    let demandMsg = 'Demand is expected to '
    if (trend === 'Increasing') demandMsg += 'increase'
    else if (trend === 'Decreasing') demandMsg += 'decrease'
    else demandMsg += 'stay stable'
    demandMsg += ' next week.'
    if (peakRisk) demandMsg += ' Peak risk: high utilization possible.'
    cards.push({
      title: 'Demand Forecast',
      message: demandMsg,
      severity: peakRisk ? 'warning' : 'info',
      iconKey: 'trend',
    })
  }

  // B) Revenue Opportunity — sum of predicted values for the chosen horizon (so the number matches "Weeks to predict")
  if (type === 'revenue') {
    const allPredicted = [stats.predictedNextWeek, ...stats.predictedNext4Weeks]
    const sum = allPredicted.slice(0, weeksToPredict).reduce((a, b) => a + b, 0)
    const weekLabel = weeksToPredict === 1 ? '1 week' : `${weeksToPredict} weeks`
    let msg = `Estimated revenue for next ${weekLabel}: ${formatValue('revenue', sum)}. `
    if (trend === 'Increasing' && (volatilityLevel === 'Low' || volatilityLevel === 'Medium')) {
      msg += 'Consider dynamic pricing during peak hours to capture demand.'
    } else if (trend === 'Decreasing') {
      msg += 'Consider promotions or partnerships to boost sessions.'
    } else {
      msg += 'Revenue trend is stable. Monitor for opportunities.'
    }
    cards.push({
      title: 'Revenue Opportunity',
      message: msg,
      severity: trend === 'Increasing' ? 'success' : trend === 'Decreasing' ? 'warning' : 'neutral',
      iconKey: 'revenue',
    })
  }

  // C) Utilization Risk Alert
  if (percentChangeVsLastWeek > 25 || peakRisk) {
    cards.push({
      title: 'Risk Alert',
      message:
        'High utilization risk next week. Monitor queues and availability.',
      severity: 'warning',
      iconKey: 'alert',
    })
  } else if (percentChangeVsLastWeek < -25) {
    cards.push({
      title: 'Risk Alert',
      message:
        'Demand drop predicted. Review pricing, uptime, and station visibility.',
      severity: 'warning',
      iconKey: 'alert',
    })
  }

  return cards
}

// --- Recommendations ---

export function buildRecommendations(type: PredictionType, stats: ForecastStats): string[] {
  const list: string[] = []
  const { trend } = stats

  if (type === 'revenue') {
    list.push('Enable peak pricing window (e.g., 6–9 PM).')
    list.push('Review underperforming stations and improve visibility.')
    if (trend === 'Decreasing') {
      list.push('Consider promotions or partnerships to boost sessions.')
    }
  }

  if (type === 'sessions') {
    list.push('Check downtime and connector availability.')
    list.push('Promote stations during predicted low-demand periods.')
    if (trend === 'Increasing') {
      list.push('Ensure capacity and queue management for peak demand.')
    }
  }

  if (type === 'kwh') {
    list.push('Plan energy procurement for predicted demand spike.')
    list.push('Use load balancing during peak periods.')
    if (trend === 'Increasing') {
      list.push('Coordinate with grid/utility for higher draw.')
    }
  }

  return list.slice(0, 4)
}
