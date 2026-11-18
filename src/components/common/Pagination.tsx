import { useMemo } from "react";
import "./Pagination.css";

type PaginationProps = {
  page: number;
  pageSize: number;
  totalPages: number;
  totalElements: number;
  isLoading: boolean;
  pageSizeId: string;
  ariaLabel: string;
  totalLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

function Pagination({
  page,
  pageSize,
  totalPages,
  totalElements,
  isLoading,
  pageSizeId,
  ariaLabel,
  totalLabel,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const visiblePages = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(0, Math.min(page - 2, totalPages - 5));
    const end = Math.min(totalPages, start + 5);
    for (let value = start; value < end; value += 1) pages.push(value);
    return pages;
  }, [page, totalPages]);

  return (
    <div className="records-pagination" aria-label={ariaLabel}>
      <div className="records-pagination-info">
        <label htmlFor={pageSizeId}>Rows per page</label>
        <select
          id={pageSizeId}
          value={pageSize}
          onChange={(event) => {
            onPageSizeChange(Number(event.target.value));
            onPageChange(0);
          }}
          disabled={isLoading}
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
        <span>{totalElements} {totalLabel}</span>
      </div>

      <div className="records-pagination-controls">
        <button
          type="button"
          className="records-page-button"
          onClick={() => onPageChange(Math.max(0, page - 1))}
          disabled={isLoading || page === 0 || totalPages === 0}
        >
          Previous
        </button>
        {visiblePages.map((pageNumber) => (
          <button
            type="button"
            key={pageNumber}
            className={`records-page-button records-page-number${page === pageNumber ? " is-active" : ""}`}
            aria-current={page === pageNumber ? "page" : undefined}
            aria-label={`Go to page ${pageNumber + 1}`}
            onClick={() => onPageChange(pageNumber)}
            disabled={isLoading}
          >
            {pageNumber + 1}
          </button>
        ))}
        <button
          type="button"
          className="records-page-button"
          onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
          disabled={isLoading || totalPages === 0 || page >= totalPages - 1}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default Pagination;
