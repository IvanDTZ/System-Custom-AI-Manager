import { useEffect, useMemo, useState } from 'react'

export interface PaginationState<T> {
  pageItems: T[]
  page: number
  totalPages: number
  total: number
  pageSize: number
  setPage: (n: number) => void
  setPageSize: (n: number) => void
  rangeStart: number
  rangeEnd: number
}

const DEFAULT_PAGE_SIZE = 20

export function usePagination<T>(items: T[], opts?: { pageSize?: number }): PaginationState<T> {
  const [pageSize, setPageSize] = useState(opts?.pageSize ?? DEFAULT_PAGE_SIZE)
  const [page, setPage] = useState(1)

  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)

  // Snap back to a valid page when the underlying list shrinks below us.
  useEffect(() => {
    if (page !== safePage) setPage(safePage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safePage])

  const pageItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize],
  )

  const rangeStart = total === 0 ? 0 : (safePage - 1) * pageSize + 1
  const rangeEnd = Math.min(safePage * pageSize, total)

  return {
    pageItems,
    page: safePage,
    totalPages,
    total,
    pageSize,
    setPage,
    setPageSize,
    rangeStart,
    rangeEnd,
  }
}
