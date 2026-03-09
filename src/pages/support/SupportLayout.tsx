import { Outlet } from 'react-router-dom'
import { useTranslation } from '../../context/LanguageContext'

export default function SupportLayout() {
  const { t } = useTranslation()
  return (
    <div className="space-y-6 text-start">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('support.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('support.subtitle')}
        </p>
      </div>

      <Outlet />
    </div>
  )
}
