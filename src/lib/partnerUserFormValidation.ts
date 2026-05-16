export const USER_TYPE_OPTIONS = ['admin', 'manager', 'engineer', 'accountant', 'operator'] as const
export type PartnerUserType = (typeof USER_TYPE_OPTIONS)[number]

export type AddPartnerUserFormValues = {
  first_name: string
  last_name: string
  country_code: string
  mobile: string
  email: string
  password: string
  role_id: string
  user_type: PartnerUserType
}

export type AddPartnerUserFieldErrors = Partial<Record<keyof AddPartnerUserFormValues, string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function stripMobileDigits(value: string): string {
  return value.replace(/\D/g, '')
}

export function validateAddPartnerUserForm(values: AddPartnerUserFormValues): AddPartnerUserFieldErrors {
  const errors: AddPartnerUserFieldErrors = {}

  if (!values.first_name.trim()) errors.first_name = 'First name is required'
  if (!values.last_name.trim()) errors.last_name = 'Last name is required'

  const cc = Number(values.country_code)
  if (!values.country_code.trim() || !Number.isInteger(cc) || cc <= 0) {
    errors.country_code = 'Enter a valid country code (e.g. 962)'
  }

  const mobileDigits = stripMobileDigits(values.mobile)
  if (mobileDigits.length < 7) {
    errors.mobile = 'Mobile must be at least 7 digits'
  }

  const email = values.email.trim()
  if (!email) errors.email = 'Email is required'
  else if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address'

  if (!values.password || values.password.length < 8) {
    errors.password = 'Password must be at least 8 characters'
  }

  const roleId = Number(values.role_id)
  if (!values.role_id || !Number.isInteger(roleId) || roleId <= 0) {
    errors.role_id = 'Select a role'
  }

  if (!USER_TYPE_OPTIONS.includes(values.user_type)) {
    errors.user_type = 'Select a user type'
  }

  return errors
}

export function isAddPartnerUserFormValid(values: AddPartnerUserFormValues): boolean {
  return Object.keys(validateAddPartnerUserForm(values)).length === 0
}

export const defaultAddPartnerUserFormValues = (): AddPartnerUserFormValues => ({
  first_name: '',
  last_name: '',
  country_code: '962',
  mobile: '',
  email: '',
  password: '',
  role_id: '',
  user_type: 'operator',
})
