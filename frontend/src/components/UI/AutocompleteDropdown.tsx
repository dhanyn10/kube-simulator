import React, { useState } from 'react';
import { TerminalSquare, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface AutocompleteSuggestion {
  label: string;
  value: string;
  category?: string;
  description?: string;
  subItems?: string[];
}

interface AutocompleteDropdownProps {
  suggestions: AutocompleteSuggestion[];
  selectedIndex: number;
  selectedSubIndex?: number;
  onSelect: (item: AutocompleteSuggestion, subItem?: string) => void;
  onHoverIndex?: (index: number) => void;
  colorMode?: 'dark' | 'light';
  openUpward?: boolean;
  className?: string;
}

export const AutocompleteDropdown: React.FC<AutocompleteDropdownProps> = ({
  suggestions,
  selectedIndex,
  selectedSubIndex = 0,
  onSelect,
  onHoverIndex,
  colorMode = 'dark',
  openUpward = false,
  className,
}) => {
  const isDark = colorMode === 'dark';
  const [activeInfoIndex, setActiveInfoIndex] = useState<number | null>(null);

  if (suggestions.length === 0) return null;

  return (
    <div
      className={cn(
        "absolute left-0 right-0 z-50 max-h-48 overflow-y-auto rounded-lg border shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100 font-mono text-xs custom-scrollbar",
        openUpward ? "bottom-full mb-1" : "top-full mt-1",
        isDark ? "bg-slate-900 border-slate-700/80 text-slate-200" : "bg-white border-slate-300 text-slate-800",
        className
      )}
    >
      {suggestions.map((item, idx) => {
        const isSelected = idx === selectedIndex;
        const hasSubItems = Boolean(item.subItems && item.subItems.length > 0);
        const isInfoOpen = activeInfoIndex === idx;

        return (
          <div
            key={`sug-${item.value}-${idx}`}
            onMouseEnter={() => onHoverIndex?.(idx)}
            className={cn(
              "group flex flex-col transition-colors border-b last:border-b-0 border-slate-800/40",
              isSelected
                ? (isDark ? "bg-indigo-600/30 text-indigo-100 font-bold" : "bg-indigo-50 text-indigo-900 font-bold")
                : (isDark ? "hover:bg-slate-800/60 text-slate-300" : "hover:bg-slate-50 text-slate-700")
            )}
          >
            <div className="flex items-center justify-between px-3 py-1.5 w-full">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(item);
                }}
                className="flex-1 flex items-center gap-2 overflow-hidden text-left focus:outline-none cursor-pointer"
              >
                <TerminalSquare size={12} className={isSelected ? "text-indigo-400 shrink-0" : "text-indigo-500 shrink-0"} />
                <span className="font-semibold truncate text-[11px]">{item.label}</span>
              </button>

              <div className="flex items-center gap-2 shrink-0 ml-2">
                {item.description && (
                  <span className={cn("text-[9px] truncate max-w-[120px] hidden sm:inline-block", isSelected ? "text-slate-300" : "text-slate-400")}>
                    {item.description}
                  </span>
                )}

                {item.category && (
                  <span className={cn(
                    "text-[8px] uppercase px-1 py-0.5 rounded font-bold tracking-wider",
                    isSelected
                      ? "bg-indigo-600 text-white"
                      : (isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500")
                  )}>
                    {item.category}
                  </span>
                )}

                {item.description && (
                  <button
                    type="button"
                    title="Toggle detailed description"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setActiveInfoIndex(prev => prev === idx ? null : idx);
                    }}
                    className={cn(
                      "p-0.5 rounded transition-all focus:outline-none opacity-0 group-hover:opacity-100",
                      isSelected ? "hover:bg-indigo-700 text-white" : (isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-200 text-slate-600")
                    )}
                  >
                    <Info size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Sub-items accordion */}
            {hasSubItems && (
              <div className={cn(
                "px-3 py-1.5 text-[10px] border-t flex flex-wrap items-center gap-1.5 animate-in slide-in-from-top-1 duration-150",
                isDark ? "bg-slate-950/80 text-slate-300 border-slate-800" : "bg-slate-100/90 text-slate-700 border-slate-200"
              )}>
                {item.subItems!.map((subName, subIdx) => {
                  const isSubSelected = isSelected && selectedSubIndex === subIdx;
                  return (
                    <button
                      type="button"
                      key={`sub-${subName}-${subIdx}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onSelect(item, subName);
                      }}
                      className={cn(
                        "px-2 py-0.5 rounded font-mono text-[10px] transition-all inline-block border focus:outline-none cursor-pointer",
                        isSubSelected
                          ? "bg-indigo-600 text-white border-indigo-400 font-bold scale-105"
                          : (isDark ? "bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800" : "bg-white text-slate-700 border-slate-200 hover:bg-indigo-50")
                      )}
                    >
                      {subName}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Info description accordion */}
            {isInfoOpen && item.description && (
              <div className={cn(
                "px-3 py-1.5 text-[10px] border-t leading-relaxed animate-in slide-in-from-top-1 duration-150",
                isDark ? "bg-slate-950/80 text-slate-300 border-slate-800" : "bg-slate-100/90 text-slate-700 border-slate-200"
              )}>
                <div className="flex items-start gap-1.5">
                  <Info size={11} className="mt-0.5 shrink-0 opacity-80" />
                  <div>
                    <p className="font-bold mb-0.5 uppercase text-[9px] tracking-wider opacity-90">Detailed Information</p>
                    <p className="select-text whitespace-normal break-words">{item.description}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
