import React, { useState, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ComponentOption {
  readonly id: string;
  readonly label: string;
  readonly type: string;
}

export interface ConfigMapComponentSectionProps {
  readonly attachedComponents: readonly ComponentOption[];
  readonly availableComponents: readonly ComponentOption[];
  readonly onRemoveComponent: (componentId: string) => void;
  readonly onAttachComponent: (component: ComponentOption) => void;
  readonly isDark: boolean;
}

export const ConfigMapComponentSection: React.FC<ConfigMapComponentSectionProps> = ({
  attachedComponents,
  availableComponents,
  onRemoveComponent,
  onAttachComponent,
  isDark,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const attachedIds = new Set(attachedComponents.map((c) => c.id));
  const unattachedAvailable = availableComponents.filter((c) => !attachedIds.has(c.id));

  const filteredSuggestions = unattachedAvailable.filter((c) => {
    if (!inputValue.trim()) return true;
    const q = inputValue.toLowerCase().trim();
    return c.label.toLowerCase().includes(q) || c.type.toLowerCase().includes(q);
  });

  const handleSelect = (comp: ComponentOption) => {
    onAttachComponent(comp);
    setInputValue('');
    setSelectedIndex(0);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && filteredSuggestions.length > 0) {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredSuggestions.length);
      return;
    }
    if (e.key === 'ArrowUp' && filteredSuggestions.length > 0) {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
      return;
    }
    if ((e.key === 'Enter' || e.key === 'Tab') && filteredSuggestions[selectedIndex] !== undefined) {
      e.preventDefault();
      handleSelect(filteredSuggestions[selectedIndex]);
      return;
    }
    if (e.key === 'Backspace' && !inputValue && attachedComponents.length > 0) {
      onRemoveComponent(attachedComponents[attachedComponents.length - 1].id);
      return;
    }
    if (e.key === 'Escape') {
      setIsFocused(false);
    }
  };

  return (
    <div className="space-y-1">
      <label
        htmlFor="configmap-component-tagify-input"
        className="block text-xs font-semibold text-slate-400"
      >
        Related Components (Komponen Terkait)
      </label>

      <div className="relative">
        <div
          ref={containerRef}
          data-testid="configmap-tagify-container"
          onClick={() => inputRef.current?.focus()}
          className={cn(
            "min-h-[38px] p-1.5 rounded-lg border flex flex-wrap items-center gap-1.5 cursor-text transition-all",
            isFocused
              ? "ring-2 ring-teal-500/50 border-teal-500"
              : isDark ? "border-slate-800 bg-slate-950" : "border-slate-300 bg-white"
          )}
        >
          {attachedComponents.map((comp) => (
            <span
              key={`attached-comp-${comp.id}`}
              data-testid={`attached-component-tag-${comp.id}`}
              className={cn(
                "px-2 py-0.5 rounded-md text-xs font-medium flex items-center gap-1.5 border shadow-xs transition-all animate-in fade-in zoom-in-95 duration-150 select-none",
                isDark
                  ? "bg-teal-950/80 text-teal-300 border-teal-500/40"
                  : "bg-teal-50 text-teal-800 border-teal-300"
              )}
            >
              <span className="text-[10px] uppercase font-bold opacity-75">{comp.type}:</span>
              <span className="font-semibold">{comp.label}</span>
              <button
                type="button"
                data-testid={`remove-component-tag-${comp.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveComponent(comp.id);
                }}
                className="p-0.5 rounded-full hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                title={`Remove ${comp.label}`}
                aria-label={`Remove ${comp.label}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}

          <input
            id="configmap-component-tagify-input"
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setSelectedIndex(0);
            }}
            onFocus={() => {
              setIsFocused(true);
              setSelectedIndex(0);
            }}
            onBlur={() => {
              setTimeout(() => setIsFocused(false), 200);
            }}
            onKeyDown={handleKeyDown}
            placeholder={attachedComponents.length === 0 ? "Attach component (e.g. Deployment, Pod)..." : "Add more components..."}
            className={cn(
              "flex-1 min-w-[140px] bg-transparent text-xs font-mono outline-none py-1 px-1",
              isDark ? "text-slate-100 placeholder:text-slate-500" : "text-slate-900 placeholder:text-slate-400"
            )}
          />
        </div>

        {isFocused && (
          <div
            data-testid="tagify-suggestions-dropdown"
            className={cn(
              "absolute left-0 right-0 mt-1 rounded-lg shadow-2xl border p-1 z-30 text-xs animate-in fade-in-50 zoom-in-95 duration-100 max-h-48 overflow-y-auto custom-scrollbar",
              isDark
                ? "bg-slate-900 border-slate-700 text-slate-200 divide-y divide-slate-800"
                : "bg-white border-slate-200 text-slate-800 divide-slate-100"
            )}
          >
            {filteredSuggestions.length === 0 ? (
              <div className="py-2 px-3 text-center text-slate-400 text-xs italic">
                {availableComponents.length === 0
                  ? "No components on canvas. Add a Deployment or Pod first."
                  : "No matching components found."}
              </div>
            ) : (
              filteredSuggestions.map((comp, idx) => (
                <button
                  key={`sug-comp-${comp.id}`}
                  type="button"
                  data-testid={`tagify-suggestion-${comp.id}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(comp);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    "w-full px-3 py-1.5 flex items-center justify-between text-left rounded transition-colors cursor-pointer",
                    idx === selectedIndex
                      ? isDark ? "bg-teal-600/30 text-teal-200" : "bg-teal-50 text-teal-800"
                      : isDark ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-100 text-slate-700"
                  )}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className={cn(
                      "text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded",
                      isDark ? "bg-slate-800 text-teal-400" : "bg-slate-100 text-teal-600"
                    )}>
                      {comp.type}
                    </span>
                    <span className="font-semibold text-xs truncate">{comp.label}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">Click to attach</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
