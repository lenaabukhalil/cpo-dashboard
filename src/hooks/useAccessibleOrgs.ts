import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAccessibleOrgs } from '../services/api'
import type { AccessibleOrg } from '../types/org'

export const CPO_SELECTED_ORG_PK_KEY = 'cpo_selected_org_pk'

/** Business `organization_id` for GET /api/v4/location (not JWT PK). */
export function getLocationsBizId(
  selectedOrg: AccessibleOrg | null | undefined,
  ownOrg: AccessibleOrg | null | undefined,
): number | undefined {
  const bizId = selectedOrg?.biz_id ?? ownOrg?.biz_id
  return bizId != null && Number.isFinite(bizId) ? bizId : undefined
}

export function clearSelectedOrgPk(): void {
  try {
    sessionStorage.removeItem(CPO_SELECTED_ORG_PK_KEY)
  } catch {
    /* private mode / blocked storage */
  }
}

function readStoredPk(orgs: AccessibleOrg[], fallbackPk: number | null): number | null {
  try {
    const stored = sessionStorage.getItem(CPO_SELECTED_ORG_PK_KEY)
    if (!stored?.trim()) return fallbackPk
    const n = Number(stored.trim())
    if (Number.isFinite(n) && orgs.some((o) => o.id === n)) return n
  } catch {
    /* ignore */
  }
  return fallbackPk
}

export function useAccessibleOrgs() {
  const [orgs, setOrgs] = useState<AccessibleOrg[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedOrgPK, setSelectedOrgPKState] = useState<number | null>(null)
  const [ready, setReady] = useState(false)

  const ownOrg = useMemo(() => orgs.find((o) => o.access_type === 'owner') ?? null, [orgs])
  const hasGrants = orgs.length > 1

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getAccessibleOrgs()
      .then((list) => {
        if (cancelled) return
        setOrgs(list)
        const defaultPk = list.find((o) => o.access_type === 'owner')?.id ?? list[0]?.id ?? null
        setSelectedOrgPKState(readStoredPk(list, defaultPk))
        setReady(true)
      })
      .catch((err) => {
        if (!cancelled) {
          setError((err as Error)?.message || 'Failed to load accessible organizations')
          setOrgs([])
          setSelectedOrgPKState(null)
          setReady(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const setSelectedOrgPK = useCallback((pk: number) => {
    setSelectedOrgPKState(pk)
    try {
      sessionStorage.setItem(CPO_SELECTED_ORG_PK_KEY, String(pk))
    } catch {
      /* ignore */
    }
  }, [])

  const selectedOrg = useMemo(() => {
    if (selectedOrgPK == null) return ownOrg
    return orgs.find((o) => o.id === selectedOrgPK) ?? ownOrg
  }, [orgs, selectedOrgPK, ownOrg])

  const getTargetOrgIdParam = useCallback((): string | undefined => {
    if (selectedOrgPK == null) return undefined
    return String(selectedOrgPK)
  }, [selectedOrgPK])

  return {
    orgs,
    selectedOrg,
    selectedOrgPK: selectedOrgPK ?? ownOrg?.id ?? null,
    setSelectedOrgPK,
    loading: loading || !ready,
    error,
    hasGrants,
    ownOrg,
    getTargetOrgIdParam,
  }
}
