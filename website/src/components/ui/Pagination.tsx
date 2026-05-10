import { cn } from '../../utils/cn'

export interface PaginationProps {
  page: number
  totalPages: number
  total: number
  rangeStart: number
  rangeEnd: number
  pageSize: number
  onPageChange: (n: number) => void
  onPageSizeChange?: (n: number) => void
  pageSizeOptions?: number[]
  itemLabel?: string
  className?: string
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

export function Pagination({
  page, totalPages, total, rangeStart, rangeEnd,
  pageSize, onPageChange, onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  itemLabel = 'items',
  className,
}: PaginationProps) {
  const visible = computeVisible(page, totalPages)

  return (
    <div
      className={cn(
        'flex flex-col gap-3 px-3 py-3 text-xs sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex flex-col items-start gap-1.5 text-text-muted sm:flex-row sm:items-center sm:gap-3">
        <span>
          {total === 0
            ? `No ${itemLabel}`
            : <>Showing <span className="font-medium text-white">{rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()}</span> of <span className="font-medium text-white">{total.toLocaleString()}</span> {itemLabel}</>}
        </span>
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5">
            <span className="text-text-subtle">Per page</span>
            <select
              value={pageSize}
              onChange={e => onPageSizeChange(Number(e.target.value))}
              className="h-7 rounded-md border border-white/10 bg-white/[0.04] px-1.5 text-xs text-white focus:border-white/30 focus:outline-none"
            >
              {pageSizeOptions.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto sm:overflow-visible">
          <PageButton
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
            ariaLabel="Previous page"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </PageButton>
          {visible.map((p, i) =>
            p === '…' ? (
              <span key={`gap-${i}`} className="px-2 text-text-subtle">…</span>
            ) : (
              <PageButton
                key={p}
                active={p === page}
                onClick={() => onPageChange(p)}
                ariaLabel={`Page ${p}`}
              >
                {p}
              </PageButton>
            ),
          )}
          <PageButton
            disabled={page === totalPages}
            onClick={() => onPageChange(page + 1)}
            ariaLabel="Next page"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </PageButton>
        </div>
      )}
    </div>
  )
}

function PageButton({
  active, disabled, onClick, ariaLabel, children,
}: {
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  ariaLabel?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'grid h-7 min-w-7 place-items-center rounded-md px-2 text-xs font-medium transition-colors',
        active
          ? 'bg-white text-black'
          : 'border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.10] disabled:opacity-30 disabled:hover:bg-white/[0.04]',
      )}
    >
      {children}
    </button>
  )
}

// Compact page list with ellipses, e.g. for page 7 of 20: 1 … 5 6 [7] 8 9 … 20
function computeVisible(page: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const out: (number | '…')[] = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(totalPages - 1, page + 1)
  if (start > 2) out.push('…')
  for (let i = start; i <= end; i++) out.push(i)
  if (end < totalPages - 1) out.push('…')
  out.push(totalPages)
  return out
}
