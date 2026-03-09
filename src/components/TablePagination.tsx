import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from './ui/button'
import { AppSelect } from './shared/AppSelect'
import { useTranslation } from '../context/LanguageContext'

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

export interface TablePaginationProps {
  total: number
  page: number
  perPage: number
  onPageChange: (page: number) => void
  onPerPageChange: (perPage: number) => void
  pageSizeOptions?: number[]
}

export function TablePagination({
  total,
  page,
  perPage,
  onPageChange,
  onPerPageChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}: TablePaginationProps) {
  const { t } = useTranslation()
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const start = total === 0 ? 0 : (page - 1) * perPage + 1
  const end = Math.min(page * perPage, total)

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground pt-4">
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline">{t('list.itemsPerPage')}</span>
        <AppSelect
          options={pageSizeOptions.map((n) => ({ value: String(n), label: String(n) }))}
          value={String(perPage)}
          onChange={(v) => onPerPageChange(Number(v))}
          size="sm"
          className="w-20"
        />
      </div>
      <div className="flex items-center gap-2">
        <span>
          {total === 0 ? '0 of 0' : `${start}-${end} of ${total}`}
        </span>
        <div className="flex gap-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(1)}
            disabled={page <= 1 || total === 0}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || total === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || total === 0}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages || total === 0}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
