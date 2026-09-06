import React from 'react';
import { cn } from '../../lib/utils';

export interface TerminalPaginationBarProps {
  filteredLogsLength: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  colorMode: 'dark' | 'light';
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  isAutoscroll: boolean;
  onToggleAutoscroll: (val: boolean) => void;
}

export const TerminalPaginationBar = ({
  filteredLogsLength,
  currentPage,
  pageSize,
  totalPages,
  colorMode,
  setCurrentPage,
  isAutoscroll,
  onToggleAutoscroll,
}: TerminalPaginationBarProps) => {
  const startCount = Math.min(filteredLogsLength, (currentPage - 1) * pageSize + 1);
  const endCount = Math.min(filteredLogsLength, currentPage * pageSize);
  const isDark = colorMode === 'dark';

  return (
    <div className={cn(
      "terminal-pagination-bar",
      isDark ? "text-slate-400" : "text-slate-500"
    )}>
      <div>
        Showing {startCount}-{endCount} of {filteredLogsLength} logs
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5 cursor-pointer text-[10px] uppercase font-bold select-none hover:opacity-80">
          <input
            type="checkbox"
            checked={isAutoscroll}
            onChange={(e) => onToggleAutoscroll(e.target.checked)}
            className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            data-testid="autoscroll-checkbox-logs"
          />
          <span>Autoscroll</span>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            className={cn(
              "terminal-pagination-btn",
              isDark
                ? "border-slate-800 hover:bg-slate-900 bg-slate-950 text-slate-300"
                : "border-slate-200 hover:bg-slate-100 bg-white text-slate-600"
            )}
          >
            Prev
          </button>
          <span className="font-bold">Page {currentPage} of {totalPages}</span>
          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            className={cn(
              "terminal-pagination-btn",
              isDark
                ? "border-slate-800 hover:bg-slate-900 bg-slate-950 text-slate-300"
                : "border-slate-200 hover:bg-slate-100 bg-white text-slate-600"
            )}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
