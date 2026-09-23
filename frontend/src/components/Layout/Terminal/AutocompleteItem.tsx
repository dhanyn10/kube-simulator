import { useState } from 'react';
import { TerminalSquare, Info, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SuggestionItem } from '@/activities/terminal';

export interface AutocompleteItemProps {
  item: SuggestionItem;
  index: number;
  isSelected: boolean;
  isDark: boolean;
  selectedSubIndex: number;
  onSelectSuggestion: (item: SuggestionItem, podName?: string) => void;
}

const getAutocompleteItemClass = (isSelected: boolean, isDark: boolean, isDisabled: boolean): string => {
  if (isDisabled) {
    return isDark ? "opacity-50 text-slate-500 border-slate-800/60 cursor-not-allowed" : "opacity-50 text-slate-400 border-slate-100 cursor-not-allowed";
  }
  if (isSelected) {
    return "bg-slate-800 text-white border-blue-600/80";
  }
  return isDark ? "hover:bg-slate-800/80 text-slate-300 border-slate-800/60" : "hover:bg-slate-50 text-slate-700 border-slate-100";
};

const getCategoryBadgeClass = (isSelected: boolean, isDark: boolean, isDisabled: boolean): string => {
  if (isDisabled) {
    return isDark ? "bg-slate-900 text-slate-600" : "bg-slate-100 text-slate-400";
  }
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

  const isDisabled = Boolean(item.disabled);
  const containerClass = getAutocompleteItemClass(isSelected, isDark, isDisabled);
  const categoryBadgeClass = getCategoryBadgeClass(isSelected, isDark, isDisabled);
  const infoBtnClass = getInfoBtnClass(isSelected, isDark);
  const accordionClass = getAccordionClass(isSelected, isDark);

  const hasSubItems = Boolean(item.subItems && item.subItems.length > 0);

  let iconClass = "text-blue-500 shrink-0";
  if (isDisabled) {
    iconClass = "text-slate-600 shrink-0";
  } else if (isSelected) {
    iconClass = "text-blue-400 shrink-0";
  }

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
          disabled={isDisabled}
          data-testid={`autocomplete-item-${index}`}
          onClick={() => !isDisabled && onSelectSuggestion(item)}
          className={cn(
            "flex-1 flex items-center gap-2 overflow-hidden text-left focus:outline-none min-w-0",
            isDisabled && "cursor-not-allowed"
          )}
        >
          <TerminalSquare size={12} className={iconClass} />
          <span className="font-semibold truncate text-[11px] w-full">{item.label}</span>
        </button>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className={cn(
            "text-[8px] uppercase px-1 py-0.5 rounded font-bold tracking-wider",
            categoryBadgeClass
          )}>
            {item.category}
          </span>

          {/* Info toggle button visible on hover */}
          <button
            type="button"
            data-testid={`autocomplete-info-btn-${index}`}
            title="Toggle details & full command"
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
        </div>
      </div>

      {/* Accordion list showing inline sub-item options (pod names) */}
      {hasSubItems && !isDisabled && (
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

      {/* Accordion dropdown for full command and detailed description */}
      {isInfoOpen && (
        <div
          data-testid={`autocomplete-description-accordion-${index}`}
          className={cn(
            "px-3 py-2 text-[10px] border-t leading-relaxed space-y-2 animate-in slide-in-from-top-1 duration-150",
            accordionClass
          )}
        >
          {/* Full Command Section */}
          <div className="flex items-start gap-1.5">
            <Terminal size={11} className="mt-0.5 shrink-0 text-blue-400" />
            <div className="w-full min-w-0">
              <p className="font-bold uppercase text-[9px] tracking-wider text-blue-400 mb-0.5">Full Command</p>
              <p className="select-text whitespace-normal break-all font-mono text-[11px] font-bold bg-black/20 p-1.5 rounded border border-blue-500/20">
                {item.value}
              </p>
            </div>
          </div>

          {/* Detailed Information Description Section */}
          {item.description && (
            <div className="flex items-start gap-1.5">
              <Info size={11} className="mt-0.5 shrink-0 opacity-80" />
              <div>
                <p className="font-bold uppercase text-[9px] tracking-wider opacity-90 mb-0.5">Detailed Information</p>
                <p className="select-text whitespace-normal break-words">{item.description}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
