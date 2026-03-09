import { cn } from '../lib/utils'

export interface PageTabItem {
  id: string
  label: string
}

export interface PageTabsProps {
  tabs: PageTabItem[]
  activeTab: string
  onTabChange: (id: string) => void
}

export function PageTabs({ tabs, activeTab, onTabChange }: PageTabsProps) {
  return (
    <div className="flex items-center gap-0 border-b border-border mt-4">
      {tabs.map((tab, index) => (
        <span key={tab.id} className="flex items-center gap-0">
          {index > 0 && <span className="h-4 w-px bg-border mx-2" aria-hidden />}
          <button
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'pb-2 border-b-2 -mb-px text-sm px-3',
              activeTab === tab.id
                ? 'border-primary text-primary font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        </span>
      ))}
    </div>
  )
}
