import React from 'react';
import { LogEntry } from '../../../store/types';
import { AlertCircle, AlertTriangle, Info, Trash2, CheckSquare, Square } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface LogRowProps {
  log: LogEntry;
  isSelected: boolean;
  isExpanded: boolean;
  searchQuery: string;
  colorMode: 'dark' | 'light';
  onToggleSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onDelete: (id: string) => void;
}

const formatTime = (ts: number) => {
  return new Date(ts).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

/**
 * Highlights matches of searchQuery in message.
 */
const renderHighlightedText = (text: string, query: string) => {
  if (!query.trim()) return text;

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));

  return parts.map((part, i) => {
    const key = `part-${part}-${i}`;
    if (part.toLowerCase() === query.toLowerCase()) {
      return (
        <mark key={key} className="bg-amber-400/30 text-amber-200 rounded px-0.5 font-semibold underline">
          {part}
        </mark>
      );
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
};

export const LogRow: React.FC<LogRowProps> = ({
  log,
  isSelected,
  isExpanded,
  searchQuery,
  colorMode,
  onToggleSelect,
  onToggleExpand,
  onDelete,
}) => {
  const isDark = colorMode === 'dark';
  const isError = log.level === 'error' || log.level === 'fatal';

  let badgeClass = 'bg-blue-400/10 text-blue-400';
  if (isError) {
    badgeClass = 'bg-red-500/10 text-red-500';
  } else if (log.level === 'warn') {
    badgeClass = 'bg-amber-500/10 text-amber-500';
  }

  let rowColorClass = isDark
    ? 'bg-transparent border-slate-800/50 hover:bg-slate-800/40'
    : 'bg-transparent border-slate-100 hover:bg-slate-50';

  if (isSelected) {
    rowColorClass = isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200';
  }

  const scopeName = log.scope || 'System';

  return (
    <div
      className={cn(
        'group p-1.5 px-2 rounded flex items-start gap-3 transition-all select-text border-b',
        rowColorClass
      )}
    >
      <label
        className={cn(
          "mt-0.5 p-1 rounded transition-colors shrink-0 cursor-pointer outline-none focus-within:ring-1 focus-within:ring-blue-500",
          isSelected ? "text-blue-500" : "text-slate-600 opacity-30 group-hover:opacity-100"
        )}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={isSelected}
          onChange={() => onToggleSelect(log.id)}
          data-testid="log-checkbox"
        />
        {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
      </label>

      <button
        type="button"
        onClick={() => onToggleExpand(log.id)}
        aria-expanded={isExpanded}
        className="flex-1 min-w-0 flex flex-col gap-1 text-left outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
      >
        <div className="flex items-start justify-between gap-4 w-full">
          <div className="flex-1 min-w-0 pt-0.5">
            <pre className={cn(
              "text-xs font-mono leading-relaxed break-all whitespace-pre-wrap select-text",
              !isExpanded && "line-clamp-1",
              isDark ? "text-slate-300" : "text-slate-700"
            )}>
              <span className="inline-flex items-center gap-1.5 mr-2 align-baseline translate-y-[1px]">
                {isError && <AlertCircle size={10} className="text-red-500" />}
                {log.level === 'warn' && <AlertTriangle size={10} className="text-amber-500" />}
                {log.level === 'info' && <Info size={10} className="text-blue-400" />}
                <span className={cn('text-[8px] font-bold uppercase px-1 rounded leading-tight', badgeClass)}>
                  {log.level}
                </span>
                <span className={cn(
                  'text-[9px] font-semibold px-1.5 py-0.5 rounded leading-none border',
                  isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'
                )} data-testid="log-scope-badge">
                  {scopeName}
                </span>
              </span>
              {renderHighlightedText(log.message, searchQuery)}
            </pre>
          </div>

          <div className="flex items-center gap-3 shrink-0 pt-0.5">
            <span className="text-[10px] tabular-nums text-slate-500 font-medium">{formatTime(log.timestamp)}</span>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(log.id);
        }}
        className="p-1 mt-0.5 text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded hover:bg-red-500/10 shrink-0"
        title="Delete log"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
};
