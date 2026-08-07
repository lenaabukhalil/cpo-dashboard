/** Roles a CPO organization may assign; excludes ION-internal and tenant-custom roles. */
export const ASSIGNABLE_ROLE_CODES = [
  'org_admin',
  'org_accountant',
  'manager',
  'engineer',
] as const
