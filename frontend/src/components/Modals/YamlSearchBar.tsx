import React from 'react';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMatchCountDisplay } from '@/activities/modals/yamlSearchHelpers';

interface YamlSearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  totalMatches: number;
  activeIndex: number;
  onNextMatch: () => void;
  onPrevMatch: () => void;
  onClear: () => void;
  colorMode: 'dark' | 'light';
}

const getSearchCountBadgeClass = (totalMatches: number, isDark: boolean): string => {
  if (totalMatches > 0) {
    return isDark
      ? 'bg-amber-950/40 text-amber-300 border-amber-800/40'
      : 'bg-amber-50 text-amber-800 border-amber-200';
  }
  return isDark
    ? 'bg-rose-950/40 text-rose-400 border-rose-800/40'
    : 'bg-rose-50 text-rose-700 border-rose-200';
};

export const YamlSearchBar: React.FC<YamlSearchBarProps> = ({
  query,
  onQueryChange,
  totalMatches,
  activeIndex,
  onNextMatch,
  onPrevMatch,
  onClear,
  colorMode,
}) => {
  const isDark = colorMode === 'dark';
  const hasQuery = query.trim().length > 0;
  const matchDisplay = getMatchCountDisplay(totalMatches, activeIndex, hasQuery);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        onPrevMatch();
      } else {
        onNextMatch();
      }
    } else if (e.key === 'Escape' && hasQuery) {
      e.stopPropagation();
      onClear();
    }
  };

  return (
    <div
      data-testid="yaml-search-bar"
      className={cn(
        'p-3 border-b flex flex-col gap-2 select-none shrink-0',
        isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-white/60'
      )}
    >
      <div className="flex items-center justify-between">
        <h3
          className={cn(
            'text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5',
            isDark ? 'text-slate-400' : 'text-slate-600'
          )}
        >
          <Search size={12} className="text-blue-500" />
          Search Keyword
        </h3>
        {hasQuery && (
          <span
            data-testid="yaml-search-count"
            className={cn(
              'text-[9px] font-mono px-1.5 py-0.5 rounded border font-semibold',
              getSearchCountBadgeClass(totalMatches, isDark)
            )}
          >
            {matchDisplay}
          </span>
        )}
      </div>

      <div className="relative flex items-center">
        <Search
          size={12}
          className={cn(
            'absolute left-2.5 pointer-events-none transition-colors',
            isDark ? 'text-slate-500' : 'text-slate-400'
          )}
        />
        <input
          data-testid="yaml-search-input"
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Keyword (e.g. port, env)..."
          className={cn(
            'w-full pl-7 pr-7 py-1.5 text-[11px] rounded font-mono outline-none transition-all border',
            isDark
              ? 'bg-slate-900 border-slate-700/70 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:bg-slate-900/90'
              : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white'
          )}
        />
        {hasQuery && (
          <button
            data-testid="yaml-search-clear"
            type="button"
            onClick={onClear}
            title="Clear search (Esc)"
            className={cn(
              'absolute right-2 p-0.5 rounded transition-colors',
              isDark
                ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'
            )}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {hasQuery && (
        <div className="flex items-center justify-between text-[9px] pt-0.5 animate-in fade-in duration-150">
          <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>
            Enter / Shift+Enter
          </span>
          <div className="flex items-center gap-1">
            <button
              data-testid="yaml-search-prev"
              type="button"
              onClick={onPrevMatch}
              disabled={totalMatches === 0}
              title="Previous match (Shift+Enter)"
              className={cn(
                'px-1.5 py-0.5 rounded border text-[9px] font-semibold flex items-center gap-0.5 transition-colors disabled:opacity-40 disabled:pointer-events-none',
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
              )}
            >
              <ChevronUp size={11} /> Prev
            </button>
            <button
              data-testid="yaml-search-next"
              type="button"
              onClick={onNextMatch}
              disabled={totalMatches === 0}
              title="Next match (Enter)"
              className={cn(
                'px-1.5 py-0.5 rounded border text-[9px] font-semibold flex items-center gap-0.5 transition-colors disabled:opacity-40 disabled:pointer-events-none',
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
              )}
            >
              Next <ChevronDown size={11} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
