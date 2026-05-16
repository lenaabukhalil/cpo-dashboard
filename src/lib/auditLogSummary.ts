/**
 * Human-readable summary for Audit Log table "Details" column and detail modal.
 */

import type { AuditLogEntry } from '../services/api'

type TFunction = (key: string) => string

const AUTH_ACTIONS = new Set([
  'login',
  'logout',
  'failed_login',
  'password_reset',
  'token_refresh',
  'session_expired',
  'mfa_login',
  'mfa_failed',
])

export function isAuthAuditRow(row: Pick<AuditLogEntry, 'action' | 'entity_type'>): boolean {
  return row.entity_type === 'auth' || AUTH_ACTIONS.has(row.action)
}

/** Convert snake_case entity_type to a translated label. */
export function formatEntityType(entity_type: string, t: TFunction): string {
  const key = `audit.entity.${entity_type}`
  const translated = t(key)
  if (translated !== key) return translated
  return entity_type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function parseValue(val: Record<string, unknown> | null | string | undefined): Record<string, unknown> | null {
  if (val == null) return null
  if (typeof val === 'object') return val
  if (typeof val === 'string') {
    try {
      const o = JSON.parse(val)
      return typeof o === 'object' && o !== null ? o : null
    } catch {
      return null
    }
  }
  return null
}

function getChangedFields(
  oldVal: Record<string, unknown> | null,
  newVal: Record<string, unknown> | null,
): string[] {
  if (!newVal || typeof newVal !== 'object') return []
  const old = oldVal && typeof oldVal === 'object' ? oldVal : {}
  const keys = Object.keys(newVal)
  return keys.filter((k) => JSON.stringify(old[k]) !== JSON.stringify(newVal[k]))
}

const MAINTENANCE_FIELD_LABELS: Record<string, string> = {
  status: 'status',
  priority: 'priority',
  subject: 'subject',
  description: 'description',
  assigned_to: 'assigned to',
}

const AUTH_SUMMARY_KEYS: Record<string, string> = {
  login: 'audit.summary.loggedIn',
  logout: 'audit.summary.loggedOut',
  failed_login: 'audit.summary.failedLogin',
  password_reset: 'audit.summary.passwordReset',
  token_refresh: 'audit.summary.tokenRefresh',
  session_expired: 'audit.summary.sessionExpired',
  mfa_login: 'audit.summary.mfaLogin',
  mfa_failed: 'audit.summary.mfaFailed',
}

/**
 * Audit Log: summary from action, entity_type, and optional old/new value diff.
 */
export function getAuditLogSummary(
  row: Pick<AuditLogEntry, 'action' | 'entity_type' | 'old_value' | 'new_value'>,
  t: TFunction,
): string {
  const act = row.action
  const entity = row.entity_type || ''

  if (isAuthAuditRow(row)) {
    const key = AUTH_SUMMARY_KEYS[act]
    return key ? t(key) : act
  }

  if (entity === 'maintenance_ticket') {
    if (act === 'create') return t('audit.summary.createdTicket')
    if (act === 'delete') return t('audit.summary.deletedTicket')
    if (act === 'update') {
      const changed = getChangedFields(row.old_value, row.new_value)
      if (changed.length === 0) return t('audit.summary.updatedTicket')
      const known = changed.filter((k) => MAINTENANCE_FIELD_LABELS[k])
      if (known.length === 2 && known.includes('status') && known.includes('priority')) {
        return t('audit.summary.updatedStatusAndPriority')
      }
      if (known.length === 1) {
        return t('audit.summary.updatedField').replace('{field}', MAINTENANCE_FIELD_LABELS[known[0]] || known[0])
      }
      if (changed.length <= 3) {
        return changed.map((k) => MAINTENANCE_FIELD_LABELS[k] || k).join(', ').replace(/^/, `${t('audit.summary.updatedFieldsPrefix')} `)
      }
      return t('audit.summary.changedNFields').replace('{count}', String(changed.length))
    }
  }

  if (entity === 'org_logo') {
    if (act === 'update') return t('audit.summary.updatedLogo')
    if (act === 'create') return t('audit.summary.createdLogo')
  }

  if (act === 'notification') return t('audit.summary.notification')

  const entityLabel = formatEntityType(entity, t).toLowerCase() || 'record'
  if (act === 'create') return t('audit.summary.createdEntity').replace('{entity}', entityLabel)
  if (act === 'delete') return t('audit.summary.deletedEntity').replace('{entity}', entityLabel)
  if (act === 'update') {
    const changed = getChangedFields(row.old_value, row.new_value)
    if (changed.length > 0 && changed.length <= 5) {
      return `${t('audit.summary.updatedFieldsPrefix')} ${changed.join(', ')}`
    }
    if (changed.length > 5) {
      return t('audit.summary.changedNFields').replace('{count}', String(changed.length))
    }
    return t('audit.summary.updatedEntity').replace('{entity}', entityLabel)
  }

  return `${act} ${entityLabel}`
}

const DETAIL_FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  description: 'Description',
  priority: 'Priority',
  status: 'Status',
  team: 'Team',
  subject: 'Subject',
  assigned_to: 'Assigned to',
  charger_id: 'Charger ID',
  location_id: 'Location ID',
  connector_id: 'Connector ID',
  organization_id: 'Organization ID',
  f_name: 'First name',
  l_name: 'Last name',
  first_name: 'First name',
  last_name: 'Last name',
  mobile: 'Mobile',
  email: 'Email',
  role_id: 'Role ID',
  role_name: 'Role',
  user_name: 'User name',
  logo_url: 'Logo',
  message: 'Message',
  level: 'Level',
  online: 'Online',
}

function formatDetailValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export interface AuditLogDetailChange {
  field: string
  fieldLabel: string
  oldVal: string
  newVal: string
}

export interface AuditLogDetailKeyValue {
  field: string
  fieldLabel: string
  value: string
}

export interface AuditLogDetailSections {
  when: string
  who: string
  action: string
  where: string
  changeSummary: 'changes' | 'created' | 'deleted' | 'notification' | 'auth'
  changes?: AuditLogDetailChange[]
  createdFields?: AuditLogDetailKeyValue[]
  deletedText?: string
  notificationFields?: AuditLogDetailKeyValue[]
  authFields?: AuditLogDetailKeyValue[]
}

function actionLabel(row: AuditLogEntry, t: TFunction): string {
  if (row.action === 'create') return t('audit.actionCreate')
  if (row.action === 'update') return t('audit.actionUpdate')
  if (row.action === 'delete') return t('audit.actionDelete')
  if (row.action === 'notification') return t('audit.actionNotification')
  if (row.action === 'login') return t('audit.actionLogin')
  if (row.action === 'logout') return t('audit.actionLogout')
  return row.action
}

export function getAuditLogDetailSections(
  row: AuditLogEntry,
  t: TFunction,
  formatDateTimeFn: (value: unknown) => string,
): AuditLogDetailSections {
  const when = formatDateTimeFn(row.timestamp)
  const who = row.user_name ?? (row.user_id != null ? String(row.user_id) : '—')
  const action = actionLabel(row, t)
  const where =
    [formatEntityType(row.entity_type || '', t), row.entity_id].filter(Boolean).join(' · ') || '—'

  const oldV = parseValue(row.old_value)
  const newV = parseValue(row.new_value)

  if (isAuthAuditRow(row)) {
    const authFields: AuditLogDetailKeyValue[] = []
    const src = newV ?? oldV
    if (src) {
      for (const k of ['user_name', 'mobile', 'role_name', 'email']) {
        if (src[k] != null && src[k] !== '') {
          authFields.push({
            field: k,
            fieldLabel: DETAIL_FIELD_LABELS[k] ?? k.replace(/_/g, ' '),
            value: formatDetailValue(src[k]),
          })
        }
      }
    }
    return {
      when,
      who,
      action,
      where,
      changeSummary: 'auth',
      authFields: authFields.length ? authFields : [{ field: '—', fieldLabel: t('audit.user'), value: who }],
    }
  }

  if (row.action === 'notification') {
    const items: AuditLogDetailKeyValue[] = []
    if (newV) {
      if (newV.message != null) items.push({ field: 'message', fieldLabel: t('audit.detailsModal.message'), value: formatDetailValue(newV.message) })
      if (newV.level != null) items.push({ field: 'level', fieldLabel: t('audit.detailsModal.level'), value: formatDetailValue(newV.level) })
      if (newV.online != null) items.push({ field: 'online', fieldLabel: t('audit.detailsModal.online'), value: formatDetailValue(newV.online) })
    }
    return {
      when,
      who,
      action,
      where,
      changeSummary: 'notification',
      notificationFields: items.length ? items : [{ field: '—', fieldLabel: t('audit.detailsModal.message'), value: '—' }],
    }
  }

  if (row.action === 'delete') {
    const entityLabel = formatEntityType(row.entity_type || 'record', t).toLowerCase()
    const deletedText = t('audit.detailsModal.deletedRecord')
      .replace('{entity}', entityLabel)
      .replace('{id}', row.entity_id ?? '—')
    if (oldV && Object.keys(oldV).length > 0) {
      const createdFields: AuditLogDetailKeyValue[] = Object.entries(oldV)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .slice(0, 20)
        .map(([k, v]) => ({
          field: k,
          fieldLabel: DETAIL_FIELD_LABELS[k] ?? k.replace(/_/g, ' '),
          value: formatDetailValue(v),
        }))
      return { when, who, action, where, changeSummary: 'deleted', deletedText, createdFields }
    }
    return { when, who, action, where, changeSummary: 'deleted', deletedText }
  }

  if (row.action === 'create' && newV) {
    const createdFields: AuditLogDetailKeyValue[] = Object.entries(newV)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .slice(0, 15)
      .map(([k, v]) => ({
        field: k,
        fieldLabel: DETAIL_FIELD_LABELS[k] ?? k.replace(/_/g, ' '),
        value: formatDetailValue(v),
      }))
    return { when, who, action, where, changeSummary: 'created', createdFields }
  }

  if (row.action === 'update' && newV) {
    const oldObj = oldV ?? {}
    const changedKeys = getChangedFields(oldObj, newV)
    const changes: AuditLogDetailChange[] = changedKeys.map((k) => ({
      field: k,
      fieldLabel: DETAIL_FIELD_LABELS[k] ?? k.replace(/_/g, ' '),
      oldVal: formatDetailValue(oldObj[k]),
      newVal: formatDetailValue(newV[k]),
    }))
    return { when, who, action, where, changeSummary: 'changes', changes }
  }

  return {
    when,
    who,
    action,
    where,
    changeSummary: 'created',
    createdFields: newV
      ? Object.entries(newV).slice(0, 10).map(([k, v]) => ({
          field: k,
          fieldLabel: DETAIL_FIELD_LABELS[k] ?? k.replace(/_/g, ' '),
          value: formatDetailValue(v),
        }))
      : [],
  }
}
