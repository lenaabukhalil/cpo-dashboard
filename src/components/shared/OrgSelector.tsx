import { useMemo } from 'react'
import { Info } from 'lucide-react'
import { AppSelect } from './AppSelect'
import { Label } from '../ui/label'
import { useTranslation } from '../../context/LanguageContext'
import type { AccessibleOrg } from '../../types/org'

type OrgSelectorProps = {
  orgs: AccessibleOrg[]
  value: number | null
  onChange: (pk: number) => void
  loading?: boolean
  className?: string
}

export function OrgSelector({ orgs, value, onChange, loading = false, className = '' }: OrgSelectorProps) {
  const { t } = useTranslation()

  const options = useMemo(
    () =>
      orgs.map((org) => {
        const badge =
          org.access_type === 'owner' ? t('org_selector.owner_badge') : t('org_selector.grant_badge')
        return {
          value: String(org.id),
          label: `${org.name} [${badge}]`,
        }
      }),
    [orgs, t],
  )

  const selectedOrg = useMemo(
    () => (value != null ? orgs.find((o) => o.id === value) ?? null : null),
    [orgs, value],
  )

  if (orgs.length <= 1) return null

  const selectValue = value != null ? String(value) : ''

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      <div className="w-full max-w-md space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t('org_selector.label')}</Label>
        {loading ? (
          <div
            className="h-10 w-full max-w-md rounded-md border border-input bg-muted/40 animate-pulse"
            aria-hidden
          />
        ) : (
          <div role="group" aria-label={t('org_selector.aria_label')}>
            <AppSelect
              options={options}
              value={selectValue}
              onChange={(v) => {
                const pk = Number(v)
                if (Number.isFinite(pk)) onChange(pk)
              }}
              isDisabled={loading || options.length === 0}
              className="w-full bg-background"
              placeholder={t('org_selector.label')}
            />
          </div>
        )}
      </div>
      {selectedOrg?.access_type === 'grant' ? (
        <p className="flex items-start gap-2 text-sm text-muted-foreground rounded-md border border-border bg-muted/30 px-3 py-2 max-w-xl">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" aria-hidden />
          <span>
            {t('org_selector.granted_notice').replace('{orgName}', selectedOrg.name)}
          </span>
        </p>
      ) : null}
    </div>
  )
}
