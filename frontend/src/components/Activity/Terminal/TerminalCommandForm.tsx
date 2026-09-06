import React from 'react';
import { cn } from '../../../lib/utils';
import { useFlowStore } from '../../../store';
import { SuggestionItem } from './terminalAutocomplete';
import { AutocompleteItem } from './AutocompleteItem';

export interface TerminalCommandFormProps {
  onSubmit: (e: React.SyntheticEvent<HTMLFormElement>) => void;
  commandInput: string;
  onInputChange: (val: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  colorMode: 'dark' | 'light';
  isAutoscroll: boolean;
  onToggleAutoscroll: (val: boolean) => void;
  suggestions: SuggestionItem[];
  isDropdownOpen: boolean;
  selectedIndex: number;
  selectedSubIndex: number;
  onSelectSuggestion: (item: SuggestionItem, podName?: string) => void;
}

export const TerminalCommandForm = ({
  onSubmit,
  commandInput,
  onInputChange,
  onKeyDown,
  colorMode,
  isAutoscroll,
  onToggleAutoscroll,
  suggestions,
  isDropdownOpen,
  selectedIndex,
  selectedSubIndex,
  onSelectSuggestion,
}: TerminalCommandFormProps) => {
  const isDark = colorMode === 'dark';
  const isAwaitingAdminPassword = useFlowStore((state) => state.isAwaitingAdminPassword);

  return (
    <div className="flex items-center justify-between gap-4 w-full relative">
      {/* Autocomplete Popup Dropdown */}
      {!isAwaitingAdminPassword && isDropdownOpen && suggestions.length > 0 && (
        <div
          data-testid="terminal-autocomplete-popup"
          className={cn(
            "terminal-autocomplete-popup custom-scrollbar",
            isDark
              ? "bg-slate-900 border-slate-700 text-slate-200 divide-slate-800"
              : "bg-white border-slate-200 text-slate-800 divide-slate-100"
          )}
        >
          {suggestions.map((item, index) => {
            const isSelected = index === selectedIndex;
            return (
              <AutocompleteItem
                key={`suggestion-${item.value}-${index}`}
                item={item}
                index={index}
                isSelected={isSelected}
                isDark={isDark}
                selectedSubIndex={selectedSubIndex}
                onSelectSuggestion={onSelectSuggestion}
              />
            );
          })}
        </div>
      )}

      <form onSubmit={onSubmit} className={cn(
        "flex-1 flex items-center gap-2 select-text",
        isDark ? "text-slate-300" : "text-slate-700"
      )}>
        <span className={cn("font-bold select-none", isDark ? "text-cyan-400" : "text-cyan-600")}>$</span>
        <input
          type={isAwaitingAdminPassword ? "password" : "text"}
          value={commandInput}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          placeholder={isAwaitingAdminPassword ? "Enter admin password (input hidden)..." : "Type kubectl command (e.g. 'help', 'kubectl get pods')..."}
          className={cn(
            "flex-1 bg-transparent outline-none border-none font-mono text-[11px] p-0 focus:ring-0",
            isDark ? "text-slate-200 placeholder-slate-700" : "text-slate-800 placeholder-slate-300"
          )}
          data-testid="terminal-cli-input"
        />
      </form>
      <label className={cn(
        "flex items-center gap-1.5 cursor-pointer text-[10px] uppercase font-bold select-none shrink-0 hover:opacity-80",
        isDark ? "text-slate-400" : "text-slate-500"
      )}>
        <input
          type="checkbox"
          checked={isAutoscroll}
          onChange={(e) => onToggleAutoscroll(e.target.checked)}
          className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
          data-testid="autoscroll-checkbox-activity"
        />
        <span>Autoscroll</span>
      </label>
    </div>
  );
};
