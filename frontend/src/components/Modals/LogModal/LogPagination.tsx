import React from 'react';
import { cn } from '../../../lib/utils';

interface LogPaginationProps {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  colorMode: 'dark' | 'light';
}

export const LogPagination: React.FC<LogPaginationProps> = ({
  currentPage,
  totalPages,
  itemsPerPage,
  totalItems,
  onPageChange,
  colorMode,
}) => {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const maxPageButtons = 5;
    if (totalPages <= maxPageButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    let start = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
    let end = start + maxPageButtons - 1;

    if (end > totalPages) {
      end = totalPages;
      start = end - maxPageButtons + 1;
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(totalItems, currentPage * itemsPerPage);

  return (
    <div
      className={cn(
        "flex items-center justify-between border-t border-slate-700/30 pt-3 text-xs mt-1 shrink-0",
        colorMode === 'dark' ? "text-slate-400" : "text-slate-600"
      )}
    >
      <div>
        Showing <span className="font-semibold">{startItem}</span> to{" "}
        <span className="font-semibold">{endItem}</span> of{" "}
        <span className="font-semibold">{totalItems}</span> logs
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(1)}
          className="px-2 py-1 rounded hover:bg-slate-500/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          data-testid="log-pagination-first"
        >
          First
        </button>
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          className="px-2 py-1 rounded hover:bg-slate-500/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors font-semibold"
          data-testid="log-pagination-prev"
        >
          &lt; Prev
        </button>

        <div className="flex items-center gap-0.5 mx-1">
          {getPageNumbers().map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => onPageChange(p)}
              className={cn(
                "px-2.5 py-1 rounded transition-colors text-[11px] font-medium",
                currentPage === p
                  ? "bg-blue-600 text-white font-bold"
                  : "hover:bg-slate-500/10"
              )}
              data-testid={`log-pagination-page-${p}`}
            >
              {p}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          className="px-2 py-1 rounded hover:bg-slate-500/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors font-semibold"
          data-testid="log-pagination-next"
        >
          Next &gt;
        </button>
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(totalPages)}
          className="px-2 py-1 rounded hover:bg-slate-500/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          data-testid="log-pagination-last"
        >
          Last
        </button>
      </div>
    </div>
  );
};
