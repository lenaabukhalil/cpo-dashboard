/**
 * Human-readable summary for Audit Log / Access Log table "Details" column.
 * Replaces raw JSON with short text derived from action, entity_type, old_value, new_value.
 */

import type { AccessLogEntry } from '../services/api'
import type { AuditLogEntry } from '../services/api'

type TFunction = (key: string) => string

function getChangedFields(
  oldVal: Record<string, unknown> | null,
  newVal: Record<string, unknown> | null
): string[] {
  if (!newVal || typeof newVal !== 'object') return []
  const old = oldVal && typeof oldVal === 'object' ? oldVal : {}
  const keys = Object.keys(newVal)
  return keys.filter((k) => JSON.stringify(old[k]) !== JSON.stringify(newVal[k]))
}

/** Known maintenance_ticket fields we can show in summary. */
const MAINTENANCE_FIELD_LABELS: Record<string, string> = {
  status: 'status',
  priority: 'priority',
  subject: 'subject',
  description: 'description',
  assigned_to: 'assigned to',
}

/**
 * Access Log (auth events): summary from action only.
 */
export function getAccessLogSummary(
  row: Pick<AccessLogEntry, 'action'>,
  t: TFunction
): string {
  const keyMap: Record<string, string> = {
    login: 'audit.summary.loggedIn',
    logout: 'audit.summary.loggedOut',
    failed_login: 'audit.summary.failedLogin',
    password_reset: 'audit.summary.passwordReset',
    token_refresh: 'audit.summary.tokenRefresh',
    session_expired: 'audit.summary.sessionExpired',
    mfa_login: 'audit.summary.mfaLogin',
    mfa_failed: 'audit.summary.mfaFailed',
  }
  const key = keyMap[row.action]
  return key ? t(key) : row.action
}

/**
 * Audit Log: summary from action, entity_type, and optional old/new value diff.
 */
export function getAuditLogSummary(
  row: Pick<AuditLogEntry, 'action' | 'entity_type' | 'old_value' | 'new_value'>,
  t: TFunction
): string {
  const act = row.action
  const entity = row.entity_type || ''

  if (entity === 'maintenance_ticket') {
    if (act === 'create') return t('audit.summary.createdTicket')
    if (act === 'delete') return t('audit.summary.deletedTicket')
    if (act === 'update') {
      const changed = getChangedFields(row.old_value, row.new_value)
      if (changed.length === 0) return t('audit.summary.updatedTicket')
      const known = changed.filter((k) => MAINTENANCE_FIELD_LABELS[k])
      if (
        known.length === 2 &&
        known.includes('status') &&
        known.includes('priority')
      )
        return t('audit.summary.updatedStatusAndPriority')
      if (known.length === 1)
        return t('audit.summary.updatedField').replace(
          '{field}',
          MAINTENANCE_FIELD_LABELS[known[0]] || known[0]
        )
      if (changed.length <= 3)
        return changed
          .map((k) => MAINTENANCE_FIELD_LABELS[k] || k)
          .join(', ')
          .replace(/^/, t('audit.summary.updatedFieldsPrefix') + ' ')
      const msg = t('audit.summary.changedNFields')
      return msg.replace('{count}', String(changed.length))
    }
  }

  if (entity === 'org_logo') {
    if (act === 'update') return t('audit.summary.updatedLogo')
    if (act === 'create') return t('audit.summary.createdLogo')
  }

  // Generic fallback
  const entityLabel = entity.replace(/_/g, ' ') || 'record'
  if (act === 'create') return t('audit.summary.createdEntity').replace('{entity}', entityLabel)
  if (act === 'delete') return t('audit.summary.deletedEntity').replace('{entity}', entityLabel)
  if (act === 'update') {
    const changed = getChangedFields(row.old_value, row.new_value)
    if (changed.length > 0 && changed.length <= 5)
      return t('audit.summary.updatedFieldsPrefix') + ' ' + changed.join(', ')
    if (changed.length > 5) {
      const msg = t('audit.summary.changedNFields')
      return msg.replace('{count}', String(changed.length))
    }
    return t('audit.summary.updatedEntity').replace('{entity}', entityLabel)
  }

  return `${act} ${entityLabel}`
}
