export type OrgAccessType = 'owner' | 'grant'

export interface AccessibleOrg {
  /** organizations.id (PK) — use as targetOrgId for CPO APIs */
  id: number
  /** organizations.organization_id (business ID) — use for /api/v4/location etc. */
  biz_id: number
  name: string
  access_type: OrgAccessType
}
