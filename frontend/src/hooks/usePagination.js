import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Page size for both admin views.
 *
 * The tile grid is `repeat(auto-fill, minmax(220px, 1fr))` inside a 1080px
 * content column, which resolves to four columns — so twelve fills exactly three
 * rows and never leaves a ragged last row. The same number keeps the table view
 * consistent with it.
 */
export const PAGE_SIZE = 12;

/**
 * The page lives in the query string rather than component state, so a refresh
 * or a shared link lands on the same rows, and the back button steps through
 * pages the way it does through any other navigation.
 */
export default function usePagination(rows, pageSize = PAGE_SIZE) {
  const [params, setParams] = useSearchParams();

  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const requested = Number.parseInt(params.get('page') ?? '1', 10);
  // Clamp on read: deleting the last row of the final page falls back a page,
  // and a hand-typed out-of-range value resolves instead of showing nothing.
  const page = Number.isNaN(requested) ? 1 : Math.min(Math.max(requested, 1), pageCount);
  const start = (page - 1) * pageSize;

  const setPage = useCallback(
    (next) => {
      setParams(
        (previous) => {
          const updated = new URLSearchParams(previous);
          if (next <= 1) {
            updated.delete('page');
          } else {
            updated.set('page', String(next));
          }
          return updated;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const revealIndex = useCallback(
    (index) => {
      if (index >= 0) {
        setPage(Math.floor(index / pageSize) + 1);
      }
    },
    [setPage, pageSize],
  );

  return {
    page,
    setPage,
    revealIndex,
    pageCount,
    slice: rows.slice(start, start + pageSize),
    total,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, total),
  };
}
