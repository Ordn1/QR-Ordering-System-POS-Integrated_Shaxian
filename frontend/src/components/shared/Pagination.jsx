import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const WINDOW = 7;

/** Page numbers around the current page, with ellipses once there are too many. */
function pageList(page, pageCount) {
  if (pageCount <= WINDOW) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set([1, pageCount, page]);
  for (let offset = 1; offset <= 2; offset += 1) {
    if (page - offset > 1) {
      pages.add(page - offset);
    }
    if (page + offset < pageCount) {
      pages.add(page + offset);
    }
  }

  const ordered = [...pages].sort((a, b) => a - b);
  const out = [];
  ordered.forEach((value, index) => {
    if (index > 0 && value - ordered[index - 1] > 1) {
      out.push(`gap-${value}`);
    }
    out.push(value);
  });
  return out;
}

export default function Pagination({ page, pageCount, from, to, total, onChange }) {
  const { t } = useTranslation();

  if (pageCount <= 1) {
    return null;
  }

  return (
    <nav className="pagination" aria-label={t('pagination.label')}>
      <p className="pagination-range">{t('pagination.showing', { from, to, total })}</p>

      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-step"
          aria-label={t('pagination.previous')}
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>

        {pageList(page, pageCount).map((value) =>
          typeof value === 'string' ? (
            <span className="pagination-gap" key={value} aria-hidden="true">
              …
            </span>
          ) : (
            <button
              type="button"
              key={value}
              className="pagination-page"
              aria-label={t('pagination.page', { number: value })}
              aria-current={value === page ? 'page' : undefined}
              onClick={() => onChange(value)}
            >
              <span className="numeric">{value}</span>
            </button>
          ),
        )}

        <button
          type="button"
          className="pagination-step"
          aria-label={t('pagination.next')}
          disabled={page === pageCount}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
