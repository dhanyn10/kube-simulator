import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { K8sResourceType } from '@/types';
import { useFlowStore } from '@/store';
import { cn } from '@/lib/utils';
import { AutocompleteDropdown, AutocompleteSuggestion } from '@/components/UI/AutocompleteDropdown';

/**
 * Props for TagInput component.
 */
export interface TagInputProps {
  readonly id?: string;
  readonly tags: readonly string[];
  readonly onChange: (tags: string[]) => void;
  readonly placeholder?: string;
  readonly suggestions?: readonly string[];
  readonly colorMode: string;
  readonly tagBgClass?: string;
}

/**
 * TagInput component allows multi-tag input with autocomplete support for K8s role rules.
 *
 * @param props TagInputProps
 * @returns JSX Element
 */
export const TagInput: React.FC<TagInputProps> = ({
  id,
  tags,
  onChange,
  placeholder = 'Add tag...',
  suggestions = [],
  colorMode,
  tagBgClass = 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300',
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isFocused && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const scrollParent = containerRef.current.closest('.custom-scrollbar') || containerRef.current.closest('.overflow-y-auto');

      let spaceBelow = window.innerHeight - rect.bottom;
      let spaceAbove = rect.top;

      if (scrollParent) {
        const parentRect = scrollParent.getBoundingClientRect();
        spaceBelow = parentRect.bottom - rect.bottom;
        spaceAbove = rect.top - parentRect.top;
      }

      setOpenUpward(spaceBelow < 170 && spaceAbove > 120);
    }
  }, [isFocused, inputValue]);

  const nodes = useFlowStore((state) => state.nodes);

  const buildSuggestionItem = (s: string): AutocompleteSuggestion => {
    const label = s === '' ? 'Core API' : s;
    const description = s === '' ? 'Core Kubernetes API Group (Pods, Services, ConfigMaps, Secrets)' : undefined;

    const resourceToTypeMap: Record<string, string> = {
      pods: 'Pod',
      deployments: 'Deployment',
      services: 'Service',
      configmaps: 'ConfigMap',
      secrets: 'Secret',
      persistentvolumeclaims: 'PVC',
      ingresses: 'Ingress',
      horizontalpodautoscalers: 'HPA',
    };

    const targetType = resourceToTypeMap[s.toLowerCase()];
    const isMissingFromCanvas = Boolean(targetType && !nodes.some((n) => n.type === targetType));

    return {
      label,
      value: s,
      category: isMissingFromCanvas ? 'add to canvas' : undefined,
      description,
    };
  };

  const availableSuggestions: AutocompleteSuggestion[] = suggestions
    .filter((s) => !tags.includes(s))
    .map(buildSuggestionItem)
    .filter((item) => {
      if (!inputValue.trim()) return true;
      const lowerInput = inputValue.toLowerCase().trim();
      return item.label.toLowerCase().includes(lowerInput) || item.value.toLowerCase().includes(lowerInput);
    });

  const addNode = useFlowStore((state) => state.addNode);
  const addLog = useFlowStore((state) => state.addLog);

  const handleAddTag = (value: string) => {
    let trimmed = value.trim();
    if (!trimmed) return;
    if (trimmed.toLowerCase() === 'core api' || trimmed.toLowerCase() === 'core') {
      trimmed = '';
    }

    if (!tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }

    const resourceToTypeMap: Record<string, K8sResourceType> = {
      pods: 'Pod',
      deployments: 'Deployment',
      services: 'Service',
      configmaps: 'ConfigMap',
      secrets: 'Secret',
      persistentvolumeclaims: 'PVC',
      ingresses: 'Ingress',
      horizontalpodautoscalers: 'HPA',
    };

    const targetType = resourceToTypeMap[trimmed.toLowerCase()];
    if (targetType) {
      const existsOnCanvas = nodes.some((n) => n.type === targetType);
      if (!existsOnCanvas) {
        addNode(targetType);
        addLog('info', `[Role Modal Action] Instantiated missing resource '${targetType}' on canvas directly from Role suggestions`, 'UI');
      }
    }

    setInputValue('');
    setSelectedIndex(0);
  };

  const handleRemoveTag = (indexToRemove: number) => {
    onChange(tags.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSuggestionNavKey = (e: React.KeyboardEvent<HTMLInputElement>): boolean => {
    if (!isFocused || availableSuggestions.length === 0) return false;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % availableSuggestions.length);
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + availableSuggestions.length) % availableSuggestions.length);
      return true;
    }
    if ((e.key === 'Enter' || e.key === 'Tab') && availableSuggestions[selectedIndex] !== undefined) {
      e.preventDefault();
      handleAddTag(availableSuggestions[selectedIndex].value);
      return true;
    }
    return false;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (handleSuggestionNavKey(e)) return;

    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      handleRemoveTag(tags.length - 1);
    } else if (e.key === 'Escape') {
      setIsFocused(false);
    }
  };

  return (
    <div ref={containerRef} className="relative space-y-1">
      <label
        htmlFor={id}
        className={cn(
          "min-h-[38px] p-1.5 rounded-lg border flex flex-wrap items-center gap-1.5 cursor-text transition-all",
          isFocused ? "ring-2 ring-indigo-500/50 border-indigo-500/80" : "border-slate-700/60",
          colorMode === 'dark' ? "bg-slate-900" : "bg-white"
        )}
      >
        {tags.map((tag, idx) => (
          <span
            key={`tag-${tag}-${idx}`}
            className={cn(
              "px-2 py-0.5 rounded-md text-xs font-mono font-semibold flex items-center gap-1 border shadow-xs transition-all animate-in fade-in zoom-in-95 duration-150",
              tagBgClass
            )}
          >
            <span>{tag === '' ? 'Core API' : tag}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveTag(idx);
              }}
              className="hover:opacity-80 p-0.5 rounded-full transition-opacity cursor-pointer"
            >
              <X size={10} />
            </button>
          </span>
        ))}

        <input
          id={id}
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            setTimeout(() => setIsFocused(false), 150);
          }}
          onFocus={() => {
            setIsFocused(true);
            setSelectedIndex(0);
          }}
          placeholder={tags.length === 0 ? placeholder : ''}
          className={cn(
            "flex-1 min-w-[120px] bg-transparent text-xs font-mono outline-none py-0.5 px-1",
            colorMode === 'dark' ? "text-slate-100 placeholder-slate-500" : "text-slate-800 placeholder-slate-400"
          )}
        />
      </label>

      {isFocused && availableSuggestions.length > 0 && (
        <AutocompleteDropdown
          suggestions={availableSuggestions}
          selectedIndex={selectedIndex}
          onSelect={(item) => handleAddTag(item.value)}
          onHoverIndex={(idx) => setSelectedIndex(idx)}
          colorMode={colorMode === 'dark' ? 'dark' : 'light'}
          openUpward={openUpward}
          showIcon={false}
        />
      )}
    </div>
  );
};
