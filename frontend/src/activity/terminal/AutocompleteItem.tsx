import { useState } from 'react';
import { TerminalSquare, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SuggestionItem } from './terminalAutocomplete';

export interface AutocompleteItemProps {
  item: SuggestionItem;
  index: number;
  isSelected: boolean;
  isDark: boolean;
  selectedSubIndex: number;
  onSelectSuggestion: (item: SuggestionItem, podName?: string) => void;
}

const getAutocompleteItemClass = (isSelected: boolean, isDark: boolean): string => {
  if (isSelected) {
    return isDark ? "bg-slate-800 text-white border-blue-600/80" : "bg-blue-50 text-slate-900 border-blue-400/80";
  }
  return isDark ? "hover:bg-slate-800/80 text-slate-300 border-slate-800/60" : "hover:bg-slate-50 text-slate-700 border-slate-100";
};

const getCategoryBadgeClass = (isSelected: boolean, isDark: boolean): string => {
  if (isSelected) {
    return "bg-blue-600 text-white";
  }
  return isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500";
};

const getInfoBtnClass = (isSelected: boolean, isDark: boolean): string => {
  if (isSelected) {
    return "hover:bg-blue-700 text-white";
  }
  return isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-200 text-slate-600";
};

const getAccordionClass = (isSelected: boolean, isDark: boolean): string => {
  if (isSelected) {
    return "bg-slate-900/90 text-blue-100 border-slate-800";
  }
  return isDark ? "bg-slate-950/80 text-slate-300 border-slate-800" : "bg-slate-100/90 text-slate-700 border-slate-200";
};

const getSubItemClass = (isSubSelected: boolean, isDark: boolean): string => {
  if (isSubSelected) {
    return "bg-blue-600 text-white border-blue-400 shadow-sm font-bold scale-105";
  }
  if (isDark) {
    return "bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white";
  }
  return "bg-white text-slate-700 border-slate-200 hover:bg-blue-50 hover:text-blue-600";
};

export const AutocompleteItem = ({
  item,
  index,
  isSelected,
  isDark,
  selectedSubIndex,
  onSelectSuggestion,
}: AutocompleteItemProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const containerClass = getAutocompleteItemClass(isSelected, isDark);
  const categoryBadgeClass = getCategoryBadgeClass(isSelected, isDark);
  const infoBtnClass = getInfoBtnClass(isSelected, isDark);
  const accordionClass = getAccordionClass(isSelected, isDark);

  const hasSubItems = Boolean(item.subItems && item.subItems.length > 0);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsInfoOpen(false);
      }}
      className={cn(
        "group flex flex-col transition-colors border-b last:border-b-0",
        containerClass
      )}
    >
      <div className="flex items-center justify-between px-3 py-1.5 w-full">
        <button
          type="button"
          data-testid={`autocomplete-item-${index}`}
          onClick={() => onSelectSuggestion(item)}
          className="flex-1 flex items-center gap-2 overflow-hidden text-left focus:outline-none"
        >
          <TerminalSquare size={12} className={isSelected ? "text-blue-400 shrink-0" : "text-blue-500 shrink-0"} />
          <span className="font-semibold truncate text-[11px]">{item.label}</span>
        </button>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          {item.description && (
            <span className={cn("text-[9px] truncate max-w-[120px] hidden sm:inline-block", isSelected ? "text-slate-300" : "text-slate-400")}>
              {item.description}
            </span>
          )}

          <span className={cn(
            "text-[8px] uppercase px-1 py-0.5 rounded font-bold tracking-wider",
            categoryBadgeClass
          )}>
            {item.category}
          </span>

          {/* Info toggle button visible on hover */}
          {item.description && (
            <button
              type="button"
              data-testid={`autocomplete-info-btn-${index}`}
              title="Toggle detailed description"
              onClick={(e) => {
                e.stopPropagation();
                setIsInfoOpen(prev => !prev);
              }}
              className={cn(
                "p-0.5 rounded transition-all focus:outline-none",
                isHovered || isInfoOpen ? "opacity-100" : "opacity-0",
                infoBtnClass
              )}
            >
              <Info size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Accordion list showing inline sub-item options (pod names) */}
      {hasSubItems && (
        <div
          data-testid={`autocomplete-subitems-accordion-${index}`}
          className={cn(
            "px-3 py-1.5 text-[10px] border-t flex flex-wrap items-center gap-1.5 animate-in slide-in-from-top-1 duration-150",
            accordionClass
          )}
        >
          {item.subItems!.map((subName, subIdx) => {
            const isSubSelected = isSelected && selectedSubIndex === subIdx;
            return (
              <button
                type="button"
                key={`subitem-${subName}-${subIdx}`}
                data-testid={`autocomplete-subitem-${subIdx}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectSuggestion(item, subName);
                }}
                className={cn(
                  "px-2 py-0.5 rounded font-mono text-[10px] transition-all inline-block border focus:outline-none",
                  getSubItemClass(isSubSelected, isDark)
                )}
              >
                {subName}
              </button>
            );
          })}
        </div>
      )}

      {/* Accordion dropdown for full description */}
      {isInfoOpen && item.description && (
        <div
          data-testid={`autocomplete-description-accordion-${index}`}
          className={cn(
            "px-3 py-1.5 text-[10px] border-t leading-relaxed animate-in slide-in-from-top-1 duration-150",
            accordionClass
          )}
        >
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
};
