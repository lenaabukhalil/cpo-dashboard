import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { normalizeRoleCode } from '../config/sidebar'
import { ViewModeSwitcher } from '../components/stations/ViewModeSwitcher'
import WizardView from './stations/WizardView'
import TableView from './stations/TableView'

const VIEW_STORAGE_KEY = 'stations.viewMode'

type ViewMode = 'wizard' | 'table'

function resolveViewMode(
  searchParams: URLSearchParams,
  roleCode?: string | null,
  roleName?: string | null,
): ViewMode {
  const viewParam = searchParams.get('view')
  if (viewParam === 'table' || viewParam === 'wizard') return viewParam

  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY)
    if (stored === 'table' || stored === 'wizard') return stored
  } catch {
    /* ignore */
  }

  if (normalizeRoleCode(roleCode, roleName) === 'org_accountant') return 'table'
  return 'wizard'
}

export default function OrgDetails() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const viewMode = useMemo(
    () => resolveViewMode(searchParams, user?.role_code, user?.role_name),
    [searchParams, user?.role_code, user?.role_name],
  )

  const handleViewChange = (next: ViewMode) => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
    setSearchParams({ view: next }, { replace: true })
  }

  return (
    <div className="space-y-6 text-start">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('stations.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('stations.subtitle')}</p>
        </div>
        <ViewModeSwitcher value={viewMode} onChange={handleViewChange} />
      </div>

      {viewMode === 'wizard' ? <WizardView embedded /> : <TableView embedded />}
    </div>
  )
}
