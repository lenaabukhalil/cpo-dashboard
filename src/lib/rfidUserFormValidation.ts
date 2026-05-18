export const RFID_UID_RE = /^[A-F0-9]{4,32}$/

export const RFID_CARD_TYPES = ['employee', 'customer', 'fleet', 'vip', 'test', 'other'] as const
export type RfidCardType = (typeof RFID_CARD_TYPES)[number]

export const RFID_STATUSES = ['active', 'disabled', 'suspended', 'pending'] as const
export type RfidStatus = (typeof RFID_STATUSES)[number]

export type AddRfidUserFormValues = {
  rfid_uid: string
  first_name: string
  last_name: string
  country_code: string
  mobile: string
  email: string
  card_type: RfidCardType
  status: RfidStatus
  allowed_location_ids: string[]
  notes: string
}

export type AddRfidUserFieldErrors = Partial<Record<keyof AddRfidUserFormValues, string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeRfidUid(value: string): string {
  return value.replace(/[^a-fA-F0-9]/g, '').toUpperCase()
}

export function stripDigits(value: string): string {
  return value.replace(/\D/g, '')
}

export type RfidUserValidationMessages = {
  rfidUidRequired: string
  rfidUidInvalid: string
  firstNameRequired: string
  firstNameLength: string
  lastNameRequired: string
  lastNameLength: string
  emailInvalid: string
  notesMaxLength: string
}

export function validateAddRfidUserForm(
  values: AddRfidUserFormValues,
  messages: RfidUserValidationMessages,
): AddRfidUserFieldErrors {
  const errors: AddRfidUserFieldErrors = {}

  const uid = normalizeRfidUid(values.rfid_uid)
  if (!uid) errors.rfid_uid = messages.rfidUidRequired
  else if (!RFID_UID_RE.test(uid)) errors.rfid_uid = messages.rfidUidInvalid

  const first = values.first_name.trim()
  if (!first) errors.first_name = messages.firstNameRequired
  else if (first.length > 255) errors.first_name = messages.firstNameLength

  const last = values.last_name.trim()
  if (!last) errors.last_name = messages.lastNameRequired
  else if (last.length > 255) errors.last_name = messages.lastNameLength

  const email = values.email.trim()
  if (email && !EMAIL_RE.test(email)) errors.email = messages.emailInvalid

  if (values.notes.length > 500) errors.notes = messages.notesMaxLength

  return errors
}

export const defaultAddRfidUserFormValues = (): AddRfidUserFormValues => ({
  rfid_uid: '',
  first_name: '',
  last_name: '',
  country_code: '',
  mobile: '',
  email: '',
  card_type: 'customer',
  status: 'active',
  allowed_location_ids: [],
  notes: '',
})
